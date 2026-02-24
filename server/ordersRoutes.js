import db, { addToHistory } from './database.js';

// ═══════════════════════════════════════════════════════════════
// Fournisseurs
// ═══════════════════════════════════════════════════════════════
export function setupSuppliersRoutes(app, authenticateToken, requireAdmin) {
  // Liste des fournisseurs
  app.get('/api/suppliers', authenticateToken, (req, res) => {
    try {
      const { search } = req.query;
      let query = 'SELECT s.*, (SELECT COUNT(*) FROM orders WHERE supplier_id = s.id) as order_count FROM suppliers s';
      const params = [];
      if (search) {
        query += ' WHERE s.name LIKE ? OR s.contact_name LIKE ? OR s.email LIKE ?';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY s.name ASC';
      const suppliers = db.prepare(query).all(...params);
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Créer un fournisseur
  app.post('/api/suppliers', authenticateToken, (req, res) => {
    try {
      const { name, contact_name, email, phone, address, notes } = req.body;
      if (!name) return res.status(400).json({ error: 'Le nom est requis' });
      const result = db.prepare(
        'INSERT INTO suppliers (name, contact_name, email, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(name, contact_name || null, email || null, phone || null, address || null, notes || null);
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(supplier);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Modifier un fournisseur
  app.put('/api/suppliers/:id', authenticateToken, (req, res) => {
    try {
      const { name, contact_name, email, phone, address, notes } = req.body;
      db.prepare(
        'UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(name, contact_name || null, email || null, phone || null, address || null, notes || null, req.params.id);
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Supprimer un fournisseur
  app.delete('/api/suppliers/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE supplier_id = ?').get(req.params.id);
      if (orderCount.count > 0) {
        return res.status(400).json({ error: `Ce fournisseur est lié à ${orderCount.count} commande(s)` });
      }
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Commandes (Bons de commande)
// ═══════════════════════════════════════════════════════════════
export function setupOrdersRoutes(app, authenticateToken, requireAdmin) {
  // Générer référence auto
  function generateReference(prefix) {
    const year = new Date().getFullYear();
    const last = db.prepare(
      `SELECT reference FROM orders WHERE reference LIKE ? ORDER BY id DESC LIMIT 1`
    ).get(`${prefix}-${year}-%`);
    let num = 1;
    if (last) {
      const parts = last.reference.split('-');
      num = parseInt(parts[2] || '0', 10) + 1;
    }
    return `${prefix}-${year}-${String(num).padStart(3, '0')}`;
  }

  // Liste des commandes avec filtres
  app.get('/api/orders', authenticateToken, (req, res) => {
    try {
      const { status, affaire_id, supplier_id, search, type } = req.query;
      let query = `
        SELECT o.*, s.name as supplier_name, u.name as created_by_name,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        LEFT JOIN users u ON o.created_by = u.id
        WHERE 1=1
      `;
      const params = [];
      if (status) { query += ' AND o.status = ?'; params.push(status); }
      if (affaire_id) { query += ' AND o.affaire_id = ?'; params.push(affaire_id); }
      if (supplier_id) { query += ' AND o.supplier_id = ?'; params.push(supplier_id); }
      if (type) { query += ' AND o.type = ?'; params.push(type); }
      if (search) {
        query += ' AND (o.reference LIKE ? OR o.notes LIKE ? OR s.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY o.created_at DESC';
      const orders = db.prepare(query).all(...params);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stats des commandes
  app.get('/api/orders/stats', authenticateToken, (req, res) => {
    try {
      const stats = {
        orders: db.prepare(`SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN status IN ('partial','received') THEN 1 ELSE 0 END) as received,
          SUM(total_ht) as total_ht
        FROM orders WHERE type = 'purchase'`).get(),
        quotes: db.prepare(`SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN status = 'refused' THEN 1 ELSE 0 END) as refused,
          SUM(total_ht) as total_ht
        FROM quotes`).get(),
        suppliers: db.prepare('SELECT COUNT(*) as total FROM suppliers').get()
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Détail d'une commande avec ses lignes
  app.get('/api/orders/:id', authenticateToken, (req, res) => {
    try {
      const order = db.prepare(`
        SELECT o.*, s.name as supplier_name, s.email as supplier_email,
          s.phone as supplier_phone, s.address as supplier_address,
          u.name as created_by_name
        FROM orders o
        LEFT JOIN suppliers s ON o.supplier_id = s.id
        LEFT JOIN users u ON o.created_by = u.id
        WHERE o.id = ?
      `).get(req.params.id);
      if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(req.params.id);
      res.json({ ...order, items });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Créer une commande
  app.post('/api/orders', authenticateToken, (req, res) => {
    try {
      const { type = 'purchase', affaire_id, supplier_id, status = 'draft', order_date, expected_date, notes, items = [] } = req.body;
      const prefix = type === 'purchase' ? 'BC' : 'BV';
      const reference = generateReference(prefix);

      // Calcul totaux
      let total_ht = 0;
      const tva_rate = req.body.tva_rate || 20;
      for (const item of items) {
        total_ht += (item.quantity || 1) * (item.unit_price_ht || 0);
      }
      const total_ttc = total_ht * (1 + tva_rate / 100);

      const result = db.prepare(`
        INSERT INTO orders (reference, type, affaire_id, supplier_id, status, order_date, expected_date, total_ht, tva_rate, total_ttc, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(reference, type, affaire_id || null, supplier_id || null, status,
        order_date || new Date().toISOString().slice(0, 10), expected_date || null,
        total_ht, tva_rate, total_ttc, notes || null, req.user.id);

      const orderId = result.lastInsertRowid;

      // Insérer les lignes
      const insertItem = db.prepare(
        'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const item of items) {
        const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
        insertItem.run(orderId, item.designation, item.quantity || 1, item.unit || 'u',
          item.unit_price_ht || 0, item.tva_rate || tva_rate, itemTotal, item.notes || null);
      }

      addToHistory('order', orderId, 'create', JSON.stringify({ reference, type, status }), req.user.id, req.user.name);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Modifier une commande
  app.put('/api/orders/:id', authenticateToken, (req, res) => {
    try {
      const { affaire_id, supplier_id, status, order_date, expected_date, received_date, notes, items, tva_rate } = req.body;
      const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Commande non trouvée' });

      // Recalculer totaux si items fournis
      let total_ht = existing.total_ht;
      let finalTvaRate = tva_rate !== undefined ? tva_rate : existing.tva_rate;
      if (items) {
        total_ht = 0;
        for (const item of items) {
          total_ht += (item.quantity || 1) * (item.unit_price_ht || 0);
        }
      }
      const total_ttc = total_ht * (1 + finalTvaRate / 100);

      db.prepare(`
        UPDATE orders SET affaire_id = ?, supplier_id = ?, status = ?, order_date = ?, 
        expected_date = ?, received_date = ?, total_ht = ?, tva_rate = ?, total_ttc = ?, 
        notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(
        affaire_id !== undefined ? affaire_id : existing.affaire_id,
        supplier_id !== undefined ? supplier_id : existing.supplier_id,
        status || existing.status,
        order_date || existing.order_date,
        expected_date !== undefined ? expected_date : existing.expected_date,
        received_date !== undefined ? received_date : existing.received_date,
        total_ht, finalTvaRate, total_ttc,
        notes !== undefined ? notes : existing.notes,
        req.params.id
      );

      // Remplacer les lignes si items fournis
      if (items) {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
        const insertItem = db.prepare(
          'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, received_qty, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const item of items) {
          const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
          insertItem.run(req.params.id, item.designation, item.quantity || 1, item.unit || 'u',
            item.unit_price_ht || 0, item.tva_rate || finalTvaRate, itemTotal, item.received_qty || 0, item.notes || null);
        }
      }

      addToHistory('order', req.params.id, 'update', JSON.stringify({ status: status || existing.status }), req.user.id, req.user.name);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
      res.json({ ...order, items: orderItems });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Supprimer une commande
  app.delete('/api/orders/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
      addToHistory('order', req.params.id, 'delete', null, req.user.id, req.user.name);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Devis
// ═══════════════════════════════════════════════════════════════
export function setupQuotesRoutes(app, authenticateToken, requireAdmin) {
  function generateQuoteReference() {
    const year = new Date().getFullYear();
    const last = db.prepare(
      `SELECT reference FROM quotes WHERE reference LIKE ? ORDER BY id DESC LIMIT 1`
    ).get(`DEV-${year}-%`);
    let num = 1;
    if (last) {
      const parts = last.reference.split('-');
      num = parseInt(parts[2] || '0', 10) + 1;
    }
    return `DEV-${year}-${String(num).padStart(3, '0')}`;
  }

  // Liste des devis
  app.get('/api/quotes', authenticateToken, (req, res) => {
    try {
      const { status, affaire_id, search } = req.query;
      let query = `
        SELECT q.*, u.name as created_by_name,
          (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as item_count
        FROM quotes q
        LEFT JOIN users u ON q.created_by = u.id
        WHERE 1=1
      `;
      const params = [];
      if (status) { query += ' AND q.status = ?'; params.push(status); }
      if (affaire_id) { query += ' AND q.affaire_id = ?'; params.push(affaire_id); }
      if (search) {
        query += ' AND (q.reference LIKE ? OR q.client_name LIKE ? OR q.notes LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY q.created_at DESC';
      const quotes = db.prepare(query).all(...params);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Détail d'un devis
  app.get('/api/quotes/:id', authenticateToken, (req, res) => {
    try {
      const quote = db.prepare(`
        SELECT q.*, u.name as created_by_name
        FROM quotes q LEFT JOIN users u ON q.created_by = u.id WHERE q.id = ?
      `).get(req.params.id);
      if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
      const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY id ASC').all(req.params.id);
      res.json({ ...quote, items });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Créer un devis
  app.post('/api/quotes', authenticateToken, (req, res) => {
    try {
      const { affaire_id, client_name, client_email, client_address, status = 'draft', quote_date, validity_date, notes, items = [] } = req.body;
      const reference = generateQuoteReference();

      let total_ht = 0;
      const tva_rate = req.body.tva_rate || 20;
      for (const item of items) {
        total_ht += (item.quantity || 1) * (item.unit_price_ht || 0);
      }
      const total_ttc = total_ht * (1 + tva_rate / 100);

      const result = db.prepare(`
        INSERT INTO quotes (reference, affaire_id, client_name, client_email, client_address, status, quote_date, validity_date, total_ht, tva_rate, total_ttc, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(reference, affaire_id || null, client_name || null, client_email || null, client_address || null,
        status, quote_date || new Date().toISOString().slice(0, 10), validity_date || null,
        total_ht, tva_rate, total_ttc, notes || null, req.user.id);

      const quoteId = result.lastInsertRowid;

      const insertItem = db.prepare(
        'INSERT INTO quote_items (quote_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const item of items) {
        const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
        insertItem.run(quoteId, item.designation, item.quantity || 1, item.unit || 'u',
          item.unit_price_ht || 0, item.tva_rate || tva_rate, itemTotal, item.notes || null);
      }

      addToHistory('quote', quoteId, 'create', JSON.stringify({ reference, status }), req.user.id, req.user.name);
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
      const quoteItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quoteId);
      res.status(201).json({ ...quote, items: quoteItems });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Modifier un devis
  app.put('/api/quotes/:id', authenticateToken, (req, res) => {
    try {
      const { affaire_id, client_name, client_email, client_address, status, quote_date, validity_date, notes, items, tva_rate } = req.body;
      const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });

      let total_ht = existing.total_ht;
      let finalTvaRate = tva_rate !== undefined ? tva_rate : existing.tva_rate;
      if (items) {
        total_ht = 0;
        for (const item of items) {
          total_ht += (item.quantity || 1) * (item.unit_price_ht || 0);
        }
      }
      const total_ttc = total_ht * (1 + finalTvaRate / 100);

      db.prepare(`
        UPDATE quotes SET affaire_id = ?, client_name = ?, client_email = ?, client_address = ?,
        status = ?, quote_date = ?, validity_date = ?, total_ht = ?, tva_rate = ?, total_ttc = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(
        affaire_id !== undefined ? affaire_id : existing.affaire_id,
        client_name !== undefined ? client_name : existing.client_name,
        client_email !== undefined ? client_email : existing.client_email,
        client_address !== undefined ? client_address : existing.client_address,
        status || existing.status,
        quote_date || existing.quote_date,
        validity_date !== undefined ? validity_date : existing.validity_date,
        total_ht, finalTvaRate, total_ttc,
        notes !== undefined ? notes : existing.notes,
        req.params.id
      );

      if (items) {
        db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
        const insertItem = db.prepare(
          'INSERT INTO quote_items (quote_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const item of items) {
          const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
          insertItem.run(req.params.id, item.designation, item.quantity || 1, item.unit || 'u',
            item.unit_price_ht || 0, item.tva_rate || finalTvaRate, itemTotal, item.notes || null);
        }
      }

      addToHistory('quote', req.params.id, 'update', JSON.stringify({ status: status || existing.status }), req.user.id, req.user.name);
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      const quoteItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id);
      res.json({ ...quote, items: quoteItems });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Convertir un devis en commande
  app.post('/api/quotes/:id/convert', authenticateToken, (req, res) => {
    try {
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      if (!quote) return res.status(404).json({ error: 'Devis non trouvé' });
      if (quote.status !== 'accepted') return res.status(400).json({ error: 'Seul un devis accepté peut être converti' });
      if (quote.converted_to_order_id) return res.status(400).json({ error: 'Ce devis a déjà été converti' });

      const quoteItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id);

      // Générer référence commande
      const year = new Date().getFullYear();
      const last = db.prepare('SELECT reference FROM orders WHERE reference LIKE ? ORDER BY id DESC LIMIT 1').get(`BC-${year}-%`);
      let num = 1;
      if (last) { num = parseInt(last.reference.split('-')[2] || '0', 10) + 1; }
      const reference = `BC-${year}-${String(num).padStart(3, '0')}`;

      const orderResult = db.prepare(`
        INSERT INTO orders (reference, type, affaire_id, status, order_date, total_ht, tva_rate, total_ttc, notes, created_by)
        VALUES (?, 'purchase', ?, 'draft', ?, ?, ?, ?, ?, ?)
      `).run(reference, quote.affaire_id, new Date().toISOString().slice(0, 10),
        quote.total_ht, quote.tva_rate, quote.total_ttc,
        `Converti depuis devis ${quote.reference}`, req.user.id);

      const orderId = orderResult.lastInsertRowid;

      const insertItem = db.prepare(
        'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const item of quoteItems) {
        insertItem.run(orderId, item.designation, item.quantity, item.unit,
          item.unit_price_ht, item.tva_rate, item.total_ht, item.notes);
      }

      db.prepare('UPDATE quotes SET converted_to_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(orderId, req.params.id);

      addToHistory('quote', req.params.id, 'convert_to_order', JSON.stringify({ order_id: orderId, reference }), req.user.id, req.user.name);

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Supprimer un devis
  app.delete('/api/quotes/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
      addToHistory('quote', req.params.id, 'delete', null, req.user.id, req.user.name);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
