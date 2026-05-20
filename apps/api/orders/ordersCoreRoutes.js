// [S2-1] Routes Commandes - extrait de ordersRoutes.js (L192-614)
import db, { addToHistory } from '../database.js';
import logger from '../logger.js';
import { orderSchema } from '../schemas/crud.js';
import { validate } from '../schemas/imports.js';
import { diffOrderItems } from '../services/orderImportDiff.js';
import { parsePagination, sendPaginated } from '../utils/pagination.js';
import { generateReference, ORDER_TRANSITIONS, validateStatusTransition } from './_helpers.js';

export function setupOrdersRoutes(app, authenticateToken, requireAdmin) {
  // Liste des commandes avec filtres
  app.get('/api/orders', authenticateToken, (req, res) => {
    try {
      const { status, affaire_id, supplier_id, search, type } = req.query;
      let query = `
        SELECT o.*, s.name as supplier_name, u.name as created_by_name,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
          COALESCE(NULLIF(a.nom, ''), NULLIF(a.titre, ''), NULLIF(a.client, ''), '') as affaire_name
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        LEFT JOIN users u ON o.created_by = u.id
        LEFT JOIN affaires a ON a.numero_affaire = o.affaire_id
        WHERE 1=1
      `;
      const params = [];
      if (status) {
        query += ' AND o.status = ?';
        params.push(status);
      }
      if (affaire_id) {
        query += ' AND o.affaire_id = ?';
        params.push(affaire_id);
      }
      if (supplier_id) {
        query += ' AND o.supplier_id = ?';
        params.push(supplier_id);
      }
      if (type) {
        query += ' AND o.type = ?';
        params.push(type);
      }
      if (search) {
        query += ' AND (o.reference LIKE ? OR o.notes LIKE ? OR s.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY o.created_at DESC';
      const orders = db.prepare(query).all(...params);

      // [S2-2] Pagination opt-in : si ?page= ou ?limit=, retour {data,pagination}
      // Sinon comportement legacy (tableau brut). Slice côté Node : OK tant que
      // la liste reste raisonnable (<10k commandes), évite refactor SQL.
      const p = parsePagination(req);
      return sendPaginated(res, orders, p);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Stats des commandes
  app.get('/api/orders/stats', authenticateToken, (req, res) => {
    try {
      const stats = {
        orders: db
          .prepare(
            `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN status IN ('partial','received') THEN 1 ELSE 0 END) as received,
          SUM(total_ht) as total_ht
        FROM orders WHERE type = 'purchase'`,
          )
          .get(),
        quotes: db
          .prepare(
            `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN status = 'refused' THEN 1 ELSE 0 END) as refused,
          SUM(total_ht) as total_ht
        FROM quotes`,
          )
          .get(),
        suppliers: db.prepare('SELECT COUNT(*) as total FROM suppliers').get(),
      };
      res.json(stats);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Commandes liées aux demandes de l'utilisateur courant (pour utilisateurs simples)
  app.get('/api/orders/my-linked', authenticateToken, (req, res) => {
    try {
      const userId = req.user.id;
      const orders = db
        .prepare(
          `
        SELECT DISTINCT o.*, s.name as supplier_name, u.name as created_by_name,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND received_qty >= quantity) as completed_items
        FROM orders o
        INNER JOIN material_requests mr ON mr.order_id = o.id AND mr.requested_by = ?
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        LEFT JOIN users u ON o.created_by = u.id
        ORDER BY o.created_at DESC
      `,
        )
        .all(userId);
      res.json(orders);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Détail d'une commande avec ses lignes
  app.get('/api/orders/:id', authenticateToken, (req, res) => {
    try {
      const order = db
        .prepare(
          `
        SELECT o.*, s.name as supplier_name, s.email as supplier_email,
          s.phone as supplier_phone, s.address as supplier_address,
          u.name as created_by_name,
          COALESCE(NULLIF(a.nom, ''), NULLIF(a.titre, ''), NULLIF(a.client, ''), '') as affaire_name
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        LEFT JOIN users u ON o.created_by = u.id
        LEFT JOIN affaires a ON a.numero_affaire = o.affaire_id
        WHERE o.id = ?
      `,
        )
        .get(req.params.id);
      if (!order) return res.status(404).json({ success: false, error: 'Commande non trouvée' });
      const items = db
        .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
        .all(req.params.id);
      res.json({ ...order, items });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Créer une commande
  app.post('/api/orders', authenticateToken, validate(orderSchema), (req, res) => {
    try {
      const {
        type = 'purchase',
        affaire_id,
        supplier_id,
        supplier_order_number,
        status = 'draft',
        order_date,
        expected_date,
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
        if (item.quantity !== undefined && (item.quantity <= 0 || isNaN(item.quantity))) {
          return res
            .status(400)
            .json({ success: false, error: `Quantité invalide pour "${item.designation}"` });
        }
        if (
          item.unit_price_ht !== undefined &&
          (item.unit_price_ht < 0 || isNaN(item.unit_price_ht))
        ) {
          return res
            .status(400)
            .json({ success: false, error: `Prix invalide pour "${item.designation}"` });
        }
      }

      // Vérifier le fournisseur si fourni
      if (supplier_id) {
        const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(supplier_id);
        if (!supplier)
          return res.status(400).json({ success: false, error: 'Fournisseur introuvable' });
      }

      const prefix = type === 'purchase' ? 'BC' : 'BV';
      const tva_rate = req.body.tva_rate || 20;

      // Transaction atomique
      const createOrder = db.transaction(() => {
        const reference = generateReference(prefix);

        let total_ht = 0;
        for (const item of items) {
          total_ht += (item.quantity || 1) * (item.unit_price_ht || 0);
        }
        const total_ttc = total_ht * (1 + tva_rate / 100);

        const result = db
          .prepare(
            `
          INSERT INTO orders (reference, type, affaire_id, supplier_id, supplier_order_number, status, order_date, expected_date, total_ht, tva_rate, total_ttc, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            reference,
            type,
            affaire_id || null,
            supplier_id || null,
            supplier_order_number ? String(supplier_order_number).trim() || null : null,
            status,
            order_date || new Date().toISOString().slice(0, 10),
            expected_date || null,
            total_ht,
            tva_rate,
            total_ttc,
            notes || null,
            req.user.id,
          );

        const orderId = result.lastInsertRowid;

        const insertItem = db.prepare(
          'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes, source_affaire_id, source_requester_id, source_requester_name, source_type, ref_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        );
        for (const item of items) {
          const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
          insertItem.run(
            orderId,
            item.designation.trim(),
            item.quantity || 1,
            item.unit || 'u',
            item.unit_price_ht || 0,
            item.tva_rate || tva_rate,
            itemTotal,
            item.notes || null,
            item.source_affaire_id || null,
            item.source_requester_id || null,
            item.source_requester_name || null,
            item.source_type || null,
            item.ref_code || null,
          );
        }

        addToHistory(
          'order',
          orderId,
          'create',
          JSON.stringify({ reference, type, status }),
          req.user.id,
          req.user.name,
        );
        return orderId;
      });

      const orderId = createOrder();
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Modifier une commande
  app.put('/api/orders/:id', authenticateToken, (req, res) => {
    try {
      const {
        affaire_id,
        supplier_id,
        supplier_order_number,
        status,
        order_date,
        expected_date,
        received_date,
        notes,
        items,
        tva_rate,
      } = req.body;
      const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Commande non trouvée' });

      // Validation transition de statut
      if (status && status !== existing.status) {
        if (!validateStatusTransition(ORDER_TRANSITIONS, existing.status, status)) {
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

      // Transaction atomique pour update + remplacement items
      const updateOrder = db.transaction(() => {
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
          UPDATE orders SET affaire_id = ?, supplier_id = ?, supplier_order_number = ?, status = ?, order_date = ?, 
          expected_date = ?, received_date = ?, total_ht = ?, tva_rate = ?, total_ttc = ?, 
          notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `,
        ).run(
          affaire_id !== undefined ? affaire_id : existing.affaire_id,
          supplier_id !== undefined ? supplier_id : existing.supplier_id,
          supplier_order_number !== undefined
            ? String(supplier_order_number).trim() || null
            : existing.supplier_order_number,
          status || existing.status,
          order_date || existing.order_date,
          expected_date !== undefined ? expected_date : existing.expected_date,
          received_date !== undefined ? received_date : existing.received_date,
          total_ht,
          finalTvaRate,
          total_ttc,
          notes !== undefined ? notes : existing.notes,
          req.params.id,
        );

        if (items) {
          db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
          const insertItem = db.prepare(
            'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, received_qty, notes, source_affaire_id, source_requester_id, source_requester_name, source_type, ref_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
              item.received_qty || 0,
              item.notes || null,
              item.source_affaire_id || null,
              item.source_requester_id || null,
              item.source_requester_name || null,
              item.source_type || null,
              item.ref_code || null,
            );
          }
        }

        addToHistory(
          'order',
          req.params.id,
          'update',
          JSON.stringify({ status: status || existing.status }),
          req.user.id,
          req.user.name,
        );
      });

      updateOrder();
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      const orderItems = db
        .prepare('SELECT * FROM order_items WHERE order_id = ?')
        .all(req.params.id);
      res.json({ ...order, items: orderItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ L8 — 3.2 : Import PDF commande fournisseur (preview & apply) ═══
  // Le frontend parse le PDF (apps/web/src/utils/catalogParsers.js) et envoie
  // un tableau d'items { ref_code?, designation, quantity?, unit?, unit_price_ht? }.
  // - preview : calcule le diff (added/updated/unchanged/conflicts), sans toucher la DB.
  // - apply   : applique le diff dans une transaction, en honorant les décisions par clé.

  function normalizeIncomingItems(rawItems) {
    if (!Array.isArray(rawItems)) return [];
    const out = [];
    for (const it of rawItems) {
      if (!it || typeof it !== 'object') continue;
      const designation = String(it.designation || '').trim();
      if (!designation) continue;
      const qty = Number(it.quantity);
      const price = Number(it.unit_price_ht);
      out.push({
        designation,
        ref_code: it.ref_code != null ? String(it.ref_code).trim() || null : null,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        unit: it.unit ? String(it.unit).trim() : 'u',
        unit_price_ht: Number.isFinite(price) && price >= 0 ? price : 0,
      });
    }
    return out;
  }

  app.post('/api/orders/:id/import-preview', authenticateToken, (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return res.status(404).json({ success: false, error: 'Commande non trouvée' });
      const items = normalizeIncomingItems(req.body && req.body.items);
      const opts = {
        quantityMode: req.body && req.body.quantityMode === 'replace' ? 'replace' : 'sum',
      };
      const existing = db
        .prepare(
          'SELECT id, designation, ref_code, quantity, unit_price_ht FROM order_items WHERE order_id = ?',
        )
        .all(req.params.id);
      const diff = diffOrderItems(existing, items, opts);
      res.json({
        success: true,
        orderId: order.id,
        reference: order.reference,
        diff,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.post('/api/orders/:id/import-apply', authenticateToken, (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) return res.status(404).json({ success: false, error: 'Commande non trouvée' });

      const items = normalizeIncomingItems(req.body && req.body.items);
      if (items.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucune ligne valide à importer' });
      }
      const decisions = (req.body && req.body.decisions) || {};
      const opts = {
        quantityMode: req.body && req.body.quantityMode === 'replace' ? 'replace' : 'sum',
      };

      const existing = db
        .prepare(
          'SELECT id, designation, ref_code, quantity, unit_price_ht, tva_rate FROM order_items WHERE order_id = ?',
        )
        .all(req.params.id);
      const diff = diffOrderItems(existing, items, opts);

      const tvaRate = order.tva_rate || 20;

      const applyTx = db.transaction(() => {
        const insertItem = db.prepare(
          'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, ref_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        );
        const updateItem = db.prepare(
          'UPDATE order_items SET quantity = ?, unit_price_ht = ?, total_ht = ? WHERE id = ?',
        );

        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const perKey = decisions.perKey || {};

        // added
        for (const a of diff.added) {
          const action = perKey[a.key] || 'add';
          if (action === 'skip') {
            skippedCount++;
            continue;
          }
          const qty = Number(a.item.quantity) || 1;
          const price = Number(a.item.unit_price_ht) || 0;
          insertItem.run(
            req.params.id,
            a.item.designation,
            qty,
            a.item.unit || 'u',
            price,
            tvaRate,
            qty * price,
            a.item.ref_code || null,
          );
          addedCount++;
        }

        // updated
        for (const u of diff.updated) {
          const action = perKey[u.key] || 'update';
          if (action === 'skip') {
            skippedCount++;
            continue;
          }
          if (action === 'add') {
            const qty = Number(u.incoming.quantity) || 1;
            const price = Number(u.incoming.unit_price_ht) || 0;
            insertItem.run(
              req.params.id,
              u.incoming.designation,
              qty,
              'u',
              price,
              tvaRate,
              qty * price,
              u.incoming.ref_code || null,
            );
            addedCount++;
            continue;
          }
          const qty = Number(u.suggested.quantity) || 1;
          const price = Number(u.suggested.unit_price_ht) || 0;
          updateItem.run(qty, price, qty * price, u.existingId);
          updatedCount++;
        }

        // Recalcul des totaux de la commande
        const sumRow = db
          .prepare(
            'SELECT COALESCE(SUM(quantity * unit_price_ht), 0) AS total_ht FROM order_items WHERE order_id = ?',
          )
          .get(req.params.id);
        const total_ht = Number(sumRow.total_ht) || 0;
        const total_ttc = total_ht * (1 + tvaRate / 100);
        db.prepare(
          'UPDATE orders SET total_ht = ?, total_ttc = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ).run(total_ht, total_ttc, req.params.id);

        addToHistory(
          'order',
          req.params.id,
          'import',
          JSON.stringify({
            added: addedCount,
            updated: updatedCount,
            skipped: skippedCount,
            conflicts: diff.conflicts.length,
          }),
          req.user.id,
          req.user.name,
        );

        return { addedCount, updatedCount, skippedCount };
      });

      const result = applyTx();
      const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      const updatedItems = db
        .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
        .all(req.params.id);
      res.json({
        success: true,
        order: { ...updatedOrder, items: updatedItems },
        applied: {
          added: result.addedCount,
          updated: result.updatedCount,
          skipped: result.skippedCount,
          conflicts: diff.conflicts,
        },
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Supprimer une commande
  app.delete('/api/orders/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Commande non trouvée' });

      // Vérifier qu'aucun devis n'est lié
      const linkedQuote = db
        .prepare('SELECT id, reference FROM quotes WHERE converted_to_order_id = ?')
        .get(req.params.id);
      if (linkedQuote) {
        return res.status(400).json({
          success: false,
          error: `Impossible de supprimer : liée au devis ${linkedQuote.reference}`,
        });
      }

      const deleteOrder = db.transaction(() => {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
        db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
        addToHistory(
          'order',
          req.params.id,
          'delete',
          JSON.stringify({ reference: existing.reference }),
          req.user.id,
          req.user.name,
        );
      });
      deleteOrder();
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Devis
// ═══════════════════════════════════════════════════════════════
