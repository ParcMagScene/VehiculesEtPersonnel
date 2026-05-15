// [S2-1] Routes Devis - extrait de ordersRoutes.js (L615-1366)
import { resolveBrand } from '../brandHelpers.js';
import db, { addToHistory } from '../database.js';
import logger from '../logger.js';
import { QUOTE_TRANSITIONS, generateReference, validateStatusTransition } from './_helpers.js';

export function setupQuotesRoutes(app, authenticateToken, requireAdmin) {
  function generateQuoteReference() {
    const year = new Date().getFullYear();
    const last = db
      .prepare(
        `SELECT reference FROM quotes WHERE reference LIKE ? ORDER BY reference DESC LIMIT 1`,
      )
      .get(`DEV-${year}-%`);
    let num = 1;
    if (last) {
      const parts = last.reference.split('-');
      num = parseInt(parts[parts.length - 1] || '0', 10) + 1;
    }
    return `DEV-${year}-${String(num).padStart(3, '0')}`;
  }

  // Liste des devis
  app.get('/api/quotes', authenticateToken, (req, res) => {
    try {
      const { status, affaire_id, search } = req.query;
      let query = `
        SELECT q.*, u.name as created_by_name,
          (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as item_count,
          COALESCE(NULLIF(a.nom, ''), NULLIF(a.titre, ''), NULLIF(a.client, ''), '') as affaire_name
        FROM quotes q
        LEFT JOIN users u ON q.created_by = u.id
        LEFT JOIN affaires a ON a.numero_affaire = q.affaire_id
        WHERE 1=1
      `;
      const params = [];
      if (status) {
        query += ' AND q.status = ?';
        params.push(status);
      }
      if (affaire_id) {
        query += ' AND q.affaire_id = ?';
        params.push(affaire_id);
      }
      if (search) {
        query += ' AND (q.reference LIKE ? OR q.client_name LIKE ? OR q.notes LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY q.created_at DESC';
      const quotes = db.prepare(query).all(...params);
      res.json(quotes);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Détail d'un devis
  app.get('/api/quotes/:id', authenticateToken, (req, res) => {
    try {
      const quote = db
        .prepare(
          `
        SELECT q.*, u.name as created_by_name,
          COALESCE(NULLIF(a.nom, ''), NULLIF(a.titre, ''), NULLIF(a.client, ''), '') as affaire_name
        FROM quotes q LEFT JOIN users u ON q.created_by = u.id
        LEFT JOIN affaires a ON a.numero_affaire = q.affaire_id
        WHERE q.id = ?
      `,
        )
        .get(req.params.id);
      if (!quote) return res.status(404).json({ success: false, error: 'Devis non trouvé' });
      const items = db
        .prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY id ASC')
        .all(req.params.id);
      res.json({ ...quote, items });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Créer un devis
  app.post('/api/quotes', authenticateToken, (req, res) => {
    try {
      const {
        affaire_id,
        client_name,
        client_email,
        client_address,
        status = 'draft',
        quote_date,
        validity_date,
        notes,
        items = [],
      } = req.body;

      // Validation des items
      for (const item of items) {
        if (!item.designation || !item.designation.trim()) {
          return res
            .status(400)
            .json({ success: false, error: 'Chaque ligne doit avoir une désignation' });
        }
      }

      const tva_rate = req.body.tva_rate || 20;

      // Transaction atomique
      const createQuote = db.transaction(() => {
        const reference = generateQuoteReference();
        let total_ht = 0;
        for (const item of items) {
          total_ht += (item.quantity || 1) * (item.unit_price_ht || 0);
        }
        const total_ttc = total_ht * (1 + tva_rate / 100);

        const result = db
          .prepare(
            `
          INSERT INTO quotes (reference, affaire_id, client_name, client_email, client_address, status, quote_date, validity_date, total_ht, tva_rate, total_ttc, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            reference,
            affaire_id || null,
            client_name || null,
            client_email || null,
            client_address || null,
            status,
            quote_date || new Date().toISOString().slice(0, 10),
            validity_date || null,
            total_ht,
            tva_rate,
            total_ttc,
            notes || null,
            req.user.id,
          );

        const quoteId = result.lastInsertRowid;

        const insertItem = db.prepare(
          'INSERT INTO quote_items (quote_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        for (const item of items) {
          const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
          insertItem.run(
            quoteId,
            item.designation.trim(),
            item.quantity || 1,
            item.unit || 'u',
            item.unit_price_ht || 0,
            item.tva_rate || tva_rate,
            itemTotal,
            item.notes || null,
          );
        }

        addToHistory(
          'quote',
          quoteId,
          'create',
          JSON.stringify({ reference, status }),
          req.user.id,
          req.user.name,
        );
        return quoteId;
      });

      const quoteId = createQuote();
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
      const quoteItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quoteId);
      res.status(201).json({ ...quote, items: quoteItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Modifier un devis
  app.put('/api/quotes/:id', authenticateToken, (req, res) => {
    try {
      const {
        affaire_id,
        client_name,
        client_email,
        client_address,
        status,
        quote_date,
        validity_date,
        notes,
        items,
        tva_rate,
      } = req.body;
      const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Devis non trouvé' });

      // Validation transition de statut
      if (status && status !== existing.status) {
        if (!validateStatusTransition(QUOTE_TRANSITIONS, existing.status, status)) {
          return res.status(400).json({
            success: false,
            error: `Transition de statut invalide: ${existing.status} → ${status}`,
          });
        }
      }

      // Validation des items si fournis
      if (items) {
        for (const item of items) {
          if (!item.designation || !item.designation.trim()) {
            return res
              .status(400)
              .json({ success: false, error: 'Chaque ligne doit avoir une désignation' });
          }
        }
      }

      // Transaction atomique
      const updateQuote = db.transaction(() => {
        let total_ht = existing.total_ht;
        let finalTvaRate = tva_rate !== undefined ? tva_rate : existing.tva_rate;
        if (items) {
          total_ht = 0;
          for (const item of items) {
            total_ht += (item.quantity || 1) * (item.unit_price_ht || 0);
          }
        }
        const total_ttc = total_ht * (1 + finalTvaRate / 100);

        db.prepare(
          `
          UPDATE quotes SET affaire_id = ?, client_name = ?, client_email = ?, client_address = ?,
          status = ?, quote_date = ?, validity_date = ?, total_ht = ?, tva_rate = ?, total_ttc = ?,
          notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `,
        ).run(
          affaire_id !== undefined ? affaire_id : existing.affaire_id,
          client_name !== undefined ? client_name : existing.client_name,
          client_email !== undefined ? client_email : existing.client_email,
          client_address !== undefined ? client_address : existing.client_address,
          status || existing.status,
          quote_date || existing.quote_date,
          validity_date !== undefined ? validity_date : existing.validity_date,
          total_ht,
          finalTvaRate,
          total_ttc,
          notes !== undefined ? notes : existing.notes,
          req.params.id,
        );

        if (items) {
          db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
          const insertItem = db.prepare(
            'INSERT INTO quote_items (quote_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          );
          for (const item of items) {
            const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
            insertItem.run(
              req.params.id,
              item.designation.trim(),
              item.quantity || 1,
              item.unit || 'u',
              item.unit_price_ht || 0,
              item.tva_rate || finalTvaRate,
              itemTotal,
              item.notes || null,
            );
          }
        }

        addToHistory(
          'quote',
          req.params.id,
          'update',
          JSON.stringify({ status: status || existing.status }),
          req.user.id,
          req.user.name,
        );
      });

      updateQuote();
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      const quoteItems = db
        .prepare('SELECT * FROM quote_items WHERE quote_id = ?')
        .all(req.params.id);
      res.json({ ...quote, items: quoteItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Convertir un devis en commande
  app.post('/api/quotes/:id/convert', authenticateToken, (req, res) => {
    try {
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      if (!quote) return res.status(404).json({ success: false, error: 'Devis non trouvé' });
      if (quote.status !== 'accepted')
        return res
          .status(400)
          .json({ success: false, error: 'Seul un devis accepté peut être converti' });
      if (quote.converted_to_order_id)
        return res.status(400).json({ success: false, error: 'Ce devis a déjà été converti' });

      const quoteItems = db
        .prepare('SELECT * FROM quote_items WHERE quote_id = ?')
        .all(req.params.id);

      // Transaction atomique pour conversion complète
      const convertQuote = db.transaction(() => {
        // Générer référence commande dans la transaction (atomique)
        const year = new Date().getFullYear();
        const last = db
          .prepare('SELECT reference FROM orders WHERE reference LIKE ? ORDER BY id DESC LIMIT 1')
          .get(`BC-${year}-%`);
        let num = 1;
        if (last) {
          num = parseInt(last.reference.split('-')[2] || '0', 10) + 1;
        }
        const reference = `BC-${year}-${String(num).padStart(3, '0')}`;

        const orderResult = db
          .prepare(
            `
          INSERT INTO orders (reference, type, affaire_id, status, order_date, total_ht, tva_rate, total_ttc, notes, created_by)
          VALUES (?, 'purchase', ?, 'draft', ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            reference,
            quote.affaire_id,
            new Date().toISOString().slice(0, 10),
            quote.total_ht,
            quote.tva_rate,
            quote.total_ttc,
            `Converti depuis devis ${quote.reference}`,
            req.user.id,
          );

        const orderId = orderResult.lastInsertRowid;

        const insertItem = db.prepare(
          'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        for (const item of quoteItems) {
          insertItem.run(
            orderId,
            item.designation,
            item.quantity,
            item.unit,
            item.unit_price_ht,
            item.tva_rate,
            item.total_ht,
            item.notes,
          );
        }

        db.prepare(
          'UPDATE quotes SET converted_to_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ).run(orderId, req.params.id);

        addToHistory(
          'quote',
          req.params.id,
          'convert_to_order',
          JSON.stringify({ order_id: orderId, reference }),
          req.user.id,
          req.user.name,
        );
        return orderId;
      });

      const orderId = convertQuote();
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Supprimer un devis
  app.delete('/api/quotes/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Devis non trouvé' });

      // Empêcher suppression si déjà converti
      if (existing.converted_to_order_id) {
        return res.status(400).json({
          success: false,
          error: 'Impossible de supprimer un devis déjà converti en commande',
        });
      }

      const deleteQuote = db.transaction(() => {
        db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
        db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
        addToHistory(
          'quote',
          req.params.id,
          'delete',
          JSON.stringify({ reference: existing.reference }),
          req.user.id,
          req.user.name,
        );
      });
      deleteQuote();
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Préparer la génération de commandes depuis une affaire
  // Retourne les articles groupés par fournisseur + commandes existantes
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/orders/prepare-from-affaire', authenticateToken, (req, res) => {
    try {
      const { affaire_id } = req.body;
      if (!affaire_id) return res.status(400).json({ success: false, error: 'affaire_id requis' });

      // 1) Récupérer tous les BL de l'affaire
      const bls = db
        .prepare('SELECT * FROM bl_imports WHERE affaire_id = ? AND status != ?')
        .all(affaire_id, 'rejected');
      const allItems = [];
      const seen = new Set();
      for (const bl of bls) {
        let pd = bl.parsed_data;
        if (typeof pd === 'string') {
          try {
            pd = JSON.parse(pd);
          } catch {
            continue;
          }
        }
        if (pd?.items && Array.isArray(pd.items)) {
          for (const item of pd.items) {
            // Ne prendre que les articles de la section VENTE/VTE (item_type = 'article')
            const sectionUpper = (item.section || '').toUpperCase();
            if (sectionUpper !== 'VENTE' && sectionUpper !== 'VTE') continue;

            const ref = (item.code || item.reference || '').trim();
            const desc = (item.description || '').trim();
            const key = `${ref}|${desc}|${item.quantity || ''}`;
            if (!seen.has(key)) {
              seen.add(key);
              allItems.push({ ...item, code: ref, blFilename: bl.filename, blId: bl.id });
            }
          }
        }
      }

      // 2) Enrichir les items sans fournisseur (BP Location/Prestation)
      //    a) via bp_items → equipment.brand (canonique via brands table)
      //    b) via extraction marque dans la description (après •)
      const brandIndex = {};
      try {
        db.prepare(
          `
          SELECT bp.reference, COALESCE(b.name, e.brand) as brand FROM bp_items bp
          JOIN equipment e ON e.id = bp.equipment_id
          LEFT JOIN brands b ON e.brand_id = b.id
          WHERE bp.bl_import_id IN (SELECT id FROM bl_imports WHERE affaire_id = ?)
            AND (e.brand IS NOT NULL AND e.brand != '')
        `,
        )
          .all(affaire_id)
          .forEach((r) => {
            if (r.reference && r.brand) brandIndex[r.reference.toUpperCase()] = r.brand;
          });
      } catch {
        /* bp_items may not exist */
      }

      for (const item of allItems) {
        if (item.fournisseur) continue;
        const ref = (item.code || '').toUpperCase();
        // a) Match via equipment brand
        if (ref && brandIndex[ref]) {
          item.fournisseur = brandIndex[ref];
          continue;
        }
        // b) Extraire marque avant ou après • dans la description, puis normaliser
        const desc = item.description || '';
        const beforeBullet = desc.match(/^([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9\s&'./-]{0,30}?)\s*[•·]/);
        if (beforeBullet) {
          const resolved = resolveBrand(beforeBullet[1].trim());
          item.fournisseur = resolved ? resolved.name : beforeBullet[1].trim().toUpperCase();
        } else {
          const afterBullet = desc.match(/[•·]\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9\s&'./-]{1,30})\s*$/);
          if (afterBullet) {
            const resolved = resolveBrand(afterBullet[1].trim());
            item.fournisseur = resolved ? resolved.name : afterBullet[1].trim().toUpperCase();
          }
        }
      }

      // 3) Grouper par fournisseur
      const bySupplier = {};
      for (const item of allItems) {
        const fournisseur = (item.fournisseur || '').trim().toUpperCase();
        if (!fournisseur) continue;
        if (!bySupplier[fournisseur]) bySupplier[fournisseur] = [];
        bySupplier[fournisseur].push(item);
      }

      // 4) Pour chaque fournisseur, chercher commandes existantes sur cette affaire
      const suppliers = [];
      for (const [name, items] of Object.entries(bySupplier)) {
        const supplier = db
          .prepare('SELECT id, name FROM suppliers WHERE UPPER(name) = ?')
          .get(name);
        const existingOrders = supplier
          ? db
              .prepare(
                `
              SELECT o.id, o.reference, o.status, o.order_date, o.total_ht,
                (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
              FROM orders o
              WHERE o.supplier_id = ? AND o.affaire_id = ? AND o.status NOT IN ('cancelled')
              ORDER BY o.created_at DESC
            `,
              )
              .all(supplier.id, affaire_id)
          : [];

        suppliers.push({
          name,
          supplier_id: supplier?.id || null,
          items,
          existing_orders: existingOrders,
        });
      }

      // 5) Articles sans fournisseur
      const noSupplierItems = allItems.filter((it) => !(it.fournisseur || '').trim());

      res.json({
        affaire_id,
        suppliers: suppliers.sort((a, b) => a.name.localeCompare(b.name)),
        no_supplier_items: noSupplierItems,
        total_items: allItems.length,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Générer des commandes groupées depuis les articles BL d'une affaire
  // Les articles sont répartis par fournisseur → 1 commande par fournisseur
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/orders/generate-from-bl', authenticateToken, (req, res) => {
    try {
      const { affaire_id, affaire_reference, items = [] } = req.body;
      if (!affaire_id || !items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'affaire_id et items sont requis' });
      }

      // Group items by fournisseur
      const bySupplier = {};
      for (const item of items) {
        const fournisseur = (item.fournisseur || 'INCONNU').trim().toUpperCase();
        if (!bySupplier[fournisseur]) bySupplier[fournisseur] = [];
        bySupplier[fournisseur].push(item);
      }

      const generateOrders = db.transaction(() => {
        const createdOrders = [];

        for (const [supplierName, supplierItems] of Object.entries(bySupplier)) {
          // Find or create supplier
          let supplier = db
            .prepare('SELECT id FROM suppliers WHERE UPPER(name) = ?')
            .get(supplierName);
          if (!supplier) {
            const result = db.prepare('INSERT INTO suppliers (name) VALUES (?)').run(supplierName);
            supplier = { id: result.lastInsertRowid };
            logger.info(`✅ Fournisseur auto-créé: ${supplierName}`);
          }

          // Generate order reference
          const reference = generateReference('BC');

          // Calculate total
          let total_ht = 0;
          for (const item of supplierItems) {
            total_ht += (item.quantity || 1) * (item.unit_price_ht || 0);
          }
          const total_ttc = total_ht * 1.2; // TVA 20%

          const orderResult = db
            .prepare(
              `
            INSERT INTO orders (reference, type, affaire_id, supplier_id, status, order_date, total_ht, tva_rate, total_ttc, notes, created_by)
            VALUES (?, 'purchase', ?, ?, 'draft', ?, ?, 20, ?, ?, ?)
          `,
            )
            .run(
              reference,
              affaire_id,
              supplier.id,
              new Date().toISOString().slice(0, 10),
              total_ht,
              total_ttc,
              `Généré depuis BL affaire ${affaire_reference || affaire_id}`,
              req.user.id,
            );

          const orderId = orderResult.lastInsertRowid;

          // Insert items with source tracking
          const insertItem = db.prepare(`
            INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, ref_code, source_affaire_id, source_type)
            VALUES (?, ?, ?, 'u', ?, 20, ?, ?, ?, 'affaire')
          `);
          for (const item of supplierItems) {
            const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
            insertItem.run(
              orderId,
              item.description || item.designation || '—',
              item.quantity || 1,
              item.unit_price_ht || 0,
              itemTotal,
              item.code || null,
              affaire_id,
            );
          }

          addToHistory(
            'order',
            orderId,
            'create',
            JSON.stringify({
              reference,
              type: 'purchase',
              status: 'draft',
              generated_from: 'bl',
              affaire_id,
              supplier: supplierName,
              item_count: supplierItems.length,
            }),
            req.user.id,
            req.user.name,
          );

          createdOrders.push({
            id: orderId,
            reference,
            supplier_name: supplierName,
            supplier_id: supplier.id,
            item_count: supplierItems.length,
            total_ht,
          });
        }

        return createdOrders;
      });

      const orders = generateOrders();
      res.status(201).json({
        success: true,
        message: `${orders.length} commande${orders.length > 1 ? 's' : ''} créée${orders.length > 1 ? 's' : ''}`,
        orders,
      });
    } catch (error) {
      logger.error('generate-from-bl error:', error?.message || error, error?.stack);
      res
        .status(500)
        .json({ success: false, error: 'Erreur serveur interne', detail: error?.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Ajouter des articles à une commande existante (commande groupée)
  // Permet d'enrichir une commande avec des items d'autres affaires ou demandeurs
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/orders/:id/add-items', authenticateToken, (req, res) => {
    try {
      const { items = [] } = req.body;
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return res.status(404).json({ success: false, error: 'Commande non trouvée' });

      if (items.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucun article à ajouter' });
      }

      const addItems = db.transaction(() => {
        const insertItem = db.prepare(`
          INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht,
            ref_code, source_affaire_id, source_requester_id, source_requester_name, source_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let addedTotal = 0;
        for (const item of items) {
          const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
          addedTotal += itemTotal;
          insertItem.run(
            order.id,
            item.designation || '—',
            item.quantity || 1,
            item.unit || 'u',
            item.unit_price_ht || 0,
            item.tva_rate || 20,
            itemTotal,
            item.ref_code || null,
            item.source_affaire_id || null,
            item.source_requester_id || null,
            item.source_requester_name || null,
            item.source_type || 'affaire',
          );
        }

        // Update order totals
        const newTotal = (order.total_ht || 0) + addedTotal;
        const newTtc = newTotal * (1 + (order.tva_rate || 20) / 100);
        db.prepare(
          'UPDATE orders SET total_ht = ?, total_ttc = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ).run(newTotal, newTtc, order.id);

        addToHistory(
          'order',
          order.id,
          'add_items',
          JSON.stringify({
            count: items.length,
            added_total: addedTotal,
          }),
          req.user.id,
          req.user.name,
        );
      });

      addItems();
      const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      const orderItems = db
        .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
        .all(req.params.id);
      res.json({ ...updatedOrder, items: orderItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Demandes de matériel
// ═══════════════════════════════════════════════════════════════
