import db, { addToHistory } from './database.js';
import logger from './logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// Transitions de statut autorisées
// ═══════════════════════════════════════════════════════════════
const ORDER_TRANSITIONS = {
  draft:     ['sent', 'cancelled'],
  sent:      ['confirmed', 'cancelled'],
  confirmed: ['partial', 'received', 'cancelled'],
  partial:   ['received'],
  received:  [],
  cancelled: ['draft']
};

const QUOTE_TRANSITIONS = {
  draft:    ['sent', 'cancelled'],
  sent:     ['accepted', 'refused', 'cancelled'],
  accepted: [],
  refused:  ['draft'],
  cancelled:['draft']
};

function validateStatusTransition(transitions, from, to) {
  if (from === to) return true;
  const allowed = transitions[from];
  return allowed && allowed.includes(to);
}

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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Créer une commande
  app.post('/api/orders', authenticateToken, (req, res) => {
    try {
      const { type = 'purchase', affaire_id, supplier_id, status = 'draft', order_date, expected_date, notes, items = [] } = req.body;

      // Validation des items
      for (const item of items) {
        if (!item.designation || !item.designation.trim()) {
          return res.status(400).json({ error: 'Chaque ligne doit avoir une désignation' });
        }
        if (item.quantity !== undefined && (item.quantity <= 0 || isNaN(item.quantity))) {
          return res.status(400).json({ error: `Quantité invalide pour "${item.designation}"` });
        }
        if (item.unit_price_ht !== undefined && (item.unit_price_ht < 0 || isNaN(item.unit_price_ht))) {
          return res.status(400).json({ error: `Prix invalide pour "${item.designation}"` });
        }
      }

      // Vérifier le fournisseur si fourni
      if (supplier_id) {
        const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(supplier_id);
        if (!supplier) return res.status(400).json({ error: 'Fournisseur introuvable' });
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

        const result = db.prepare(`
          INSERT INTO orders (reference, type, affaire_id, supplier_id, status, order_date, expected_date, total_ht, tva_rate, total_ttc, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(reference, type, affaire_id || null, supplier_id || null, status,
          order_date || new Date().toISOString().slice(0, 10), expected_date || null,
          total_ht, tva_rate, total_ttc, notes || null, req.user.id);

        const orderId = result.lastInsertRowid;

        const insertItem = db.prepare(
          'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, notes, source_affaire_id, source_requester_id, source_requester_name, source_type, ref_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const item of items) {
          const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
          insertItem.run(orderId, item.designation.trim(), item.quantity || 1, item.unit || 'u',
            item.unit_price_ht || 0, item.tva_rate || tva_rate, itemTotal, item.notes || null,
            item.source_affaire_id || null, item.source_requester_id || null,
            item.source_requester_name || null, item.source_type || null, item.ref_code || null);
        }

        addToHistory('order', orderId, 'create', JSON.stringify({ reference, type, status }), req.user.id, req.user.name);
        return orderId;
      });

      const orderId = createOrder();
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Modifier une commande
  app.put('/api/orders/:id', authenticateToken, (req, res) => {
    try {
      const { affaire_id, supplier_id, status, order_date, expected_date, received_date, notes, items, tva_rate } = req.body;
      const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Commande non trouvée' });

      // Validation transition de statut
      if (status && status !== existing.status) {
        if (!validateStatusTransition(ORDER_TRANSITIONS, existing.status, status)) {
          return res.status(400).json({ error: `Transition de statut invalide: ${existing.status} → ${status}` });
        }
      }

      // Validation des items si fournis
      if (items) {
        for (const item of items) {
          if (!item.designation || !item.designation.trim()) {
            return res.status(400).json({ error: 'Chaque ligne doit avoir une désignation' });
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

        if (items) {
          db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
          const insertItem = db.prepare(
            'INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, received_qty, notes, source_affaire_id, source_requester_id, source_requester_name, source_type, ref_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );
          for (const item of items) {
            const itemTotal = (item.quantity || 1) * (item.unit_price_ht || 0);
            insertItem.run(req.params.id, item.designation.trim(), item.quantity || 1, item.unit || 'u',
              item.unit_price_ht || 0, item.tva_rate || finalTvaRate, itemTotal, item.received_qty || 0, item.notes || null,
              item.source_affaire_id || null, item.source_requester_id || null,
              item.source_requester_name || null, item.source_type || null, item.ref_code || null);
          }
        }

        addToHistory('order', req.params.id, 'update', JSON.stringify({ status: status || existing.status }), req.user.id, req.user.name);
      });

      updateOrder();
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
      res.json({ ...order, items: orderItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Supprimer une commande
  app.delete('/api/orders/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Commande non trouvée' });

      // Vérifier qu'aucun devis n'est lié
      const linkedQuote = db.prepare('SELECT id, reference FROM quotes WHERE converted_to_order_id = ?').get(req.params.id);
      if (linkedQuote) {
        return res.status(400).json({ error: `Impossible de supprimer : liée au devis ${linkedQuote.reference}` });
      }

      const deleteOrder = db.transaction(() => {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
        db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
        addToHistory('order', req.params.id, 'delete', JSON.stringify({ reference: existing.reference }), req.user.id, req.user.name);
      });
      deleteOrder();
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Créer un devis
  app.post('/api/quotes', authenticateToken, (req, res) => {
    try {
      const { affaire_id, client_name, client_email, client_address, status = 'draft', quote_date, validity_date, notes, items = [] } = req.body;

      // Validation des items
      for (const item of items) {
        if (!item.designation || !item.designation.trim()) {
          return res.status(400).json({ error: 'Chaque ligne doit avoir une désignation' });
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
          insertItem.run(quoteId, item.designation.trim(), item.quantity || 1, item.unit || 'u',
            item.unit_price_ht || 0, item.tva_rate || tva_rate, itemTotal, item.notes || null);
        }

        addToHistory('quote', quoteId, 'create', JSON.stringify({ reference, status }), req.user.id, req.user.name);
        return quoteId;
      });

      const quoteId = createQuote();
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
      const quoteItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quoteId);
      res.status(201).json({ ...quote, items: quoteItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Modifier un devis
  app.put('/api/quotes/:id', authenticateToken, (req, res) => {
    try {
      const { affaire_id, client_name, client_email, client_address, status, quote_date, validity_date, notes, items, tva_rate } = req.body;
      const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });

      // Validation transition de statut
      if (status && status !== existing.status) {
        if (!validateStatusTransition(QUOTE_TRANSITIONS, existing.status, status)) {
          return res.status(400).json({ error: `Transition de statut invalide: ${existing.status} → ${status}` });
        }
      }

      // Validation des items si fournis
      if (items) {
        for (const item of items) {
          if (!item.designation || !item.designation.trim()) {
            return res.status(400).json({ error: 'Chaque ligne doit avoir une désignation' });
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
            insertItem.run(req.params.id, item.designation.trim(), item.quantity || 1, item.unit || 'u',
              item.unit_price_ht || 0, item.tva_rate || finalTvaRate, itemTotal, item.notes || null);
          }
        }

        addToHistory('quote', req.params.id, 'update', JSON.stringify({ status: status || existing.status }), req.user.id, req.user.name);
      });

      updateQuote();
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      const quoteItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id);
      res.json({ ...quote, items: quoteItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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

      // Transaction atomique pour conversion complète
      const convertQuote = db.transaction(() => {
        // Générer référence commande dans la transaction (atomique)
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
        return orderId;
      });

      const orderId = convertQuote();
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Supprimer un devis
  app.delete('/api/quotes/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Devis non trouvé' });

      // Empêcher suppression si déjà converti
      if (existing.converted_to_order_id) {
        return res.status(400).json({ error: 'Impossible de supprimer un devis déjà converti en commande' });
      }

      const deleteQuote = db.transaction(() => {
        db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
        db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
        addToHistory('quote', req.params.id, 'delete', JSON.stringify({ reference: existing.reference }), req.user.id, req.user.name);
      });
      deleteQuote();
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Générer des commandes groupées depuis les articles BL d'une affaire
  // Les articles sont répartis par fournisseur → 1 commande par fournisseur
  // ═══════════════════════════════════════════════════════════════
  app.post('/api/orders/generate-from-bl', authenticateToken, (req, res) => {
    try {
      const { affaire_id, affaire_reference, items = [] } = req.body;
      if (!affaire_id || items.length === 0) {
        return res.status(400).json({ error: 'affaire_id et items sont requis' });
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
          let supplier = db.prepare('SELECT id FROM suppliers WHERE UPPER(name) = ?').get(supplierName);
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

          const orderResult = db.prepare(`
            INSERT INTO orders (reference, type, affaire_id, supplier_id, status, order_date, total_ht, tva_rate, total_ttc, notes, created_by)
            VALUES (?, 'purchase', ?, ?, 'draft', ?, ?, 20, ?, ?, ?)
          `).run(
            reference, affaire_id, supplier.id,
            new Date().toISOString().slice(0, 10),
            total_ht, total_ttc,
            `Généré depuis BL affaire ${affaire_reference || affaire_id}`,
            req.user.id
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
              affaire_id
            );
          }

          addToHistory('order', orderId, 'create', JSON.stringify({
            reference, type: 'purchase', status: 'draft',
            generated_from: 'bl', affaire_id, supplier: supplierName,
            item_count: supplierItems.length
          }), req.user.id, req.user.name);

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
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
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
      if (!order) return res.status(404).json({ error: 'Commande non trouvée' });

      if (items.length === 0) {
        return res.status(400).json({ error: 'Aucun article à ajouter' });
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
            item.source_type || 'affaire'
          );
        }

        // Update order totals
        const newTotal = (order.total_ht || 0) + addedTotal;
        const newTtc = newTotal * (1 + (order.tva_rate || 20) / 100);
        db.prepare('UPDATE orders SET total_ht = ?, total_ttc = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newTotal, newTtc, order.id);

        addToHistory('order', order.id, 'add_items', JSON.stringify({
          count: items.length, added_total: addedTotal
        }), req.user.id, req.user.name);
      });

      addItems();
      const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(req.params.id);
      res.json({ ...updatedOrder, items: orderItems });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Demandes de matériel
// ═══════════════════════════════════════════════════════════════
export function setupMaterialRequestsRoutes(app, authenticateToken, requireAdmin) {

  // Liste des demandes (avec filtres)
  app.get('/api/material-requests', authenticateToken, (req, res) => {
    try {
      const { status, affaire_id, requested_by, search, priority } = req.query;
      let query = `SELECT mr.*, u.name as requested_by_name_db FROM material_requests mr LEFT JOIN users u ON u.id = mr.requested_by WHERE 1=1`;
      const params = [];
      if (status) { query += ' AND mr.status = ?'; params.push(status); }
      if (affaire_id) { query += ' AND mr.affaire_id = ?'; params.push(affaire_id); }
      if (requested_by) { query += ' AND mr.requested_by = ?'; params.push(requested_by); }
      if (priority) { query += ' AND mr.priority = ?'; params.push(priority); }
      if (search) { query += ' AND (mr.article LIKE ? OR mr.supplier_name LIKE ? OR mr.notes LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
      query += ' ORDER BY CASE mr.priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'normal\' THEN 2 ELSE 3 END, mr.created_at DESC';
      const requests = db.prepare(query).all(...params);
      res.json(requests);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Stats des demandes
  app.get('/api/material-requests/stats', authenticateToken, (req, res) => {
    try {
      const total = db.prepare('SELECT COUNT(*) as c FROM material_requests').get().c;
      const pending = db.prepare('SELECT COUNT(*) as c FROM material_requests WHERE status = ?').get('pending').c;
      const approved = db.prepare('SELECT COUNT(*) as c FROM material_requests WHERE status = ?').get('approved').c;
      const ordered = db.prepare('SELECT COUNT(*) as c FROM material_requests WHERE status = ?').get('ordered').c;
      res.json({ total, pending, approved, ordered });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Créer une demande (tout utilisateur authentifié)
  app.post('/api/material-requests', authenticateToken, (req, res) => {
    try {
      const { article, supplier_id, supplier_name, quantity, priority, affaire_id, destination, destination_other, notes, ref_code } = req.body;
      if (!article || !article.trim()) {
        return res.status(400).json({ error: 'L\'article est requis' });
      }
      const result = db.prepare(`
        INSERT INTO material_requests (article, supplier_id, supplier_name, quantity, priority, affaire_id, destination, destination_other, notes, ref_code, requested_by, requested_by_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        article.trim(),
        supplier_id || null,
        supplier_name || null,
        quantity || 1,
        priority || 'normal',
        affaire_id || null,
        destination || 'Stock Mag Scène',
        destination_other || null,
        notes || null,
        ref_code || null,
        req.user.id,
        req.user.name
      );
      const created = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(result.lastInsertRowid);
      addToHistory('material_request', created.id, 'create', JSON.stringify({ article, quantity, priority, destination }), req.user.id, req.user.name);
      res.status(201).json(created);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Modifier une demande
  app.put('/api/material-requests/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Demande non trouvée' });
      // Seul le demandeur ou un admin peut modifier
      if (existing.requested_by !== req.user.id) {
        const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (!user?.is_admin) return res.status(403).json({ error: 'Non autorisé' });
      }
      const { article, supplier_id, supplier_name, quantity, priority, affaire_id, destination, destination_other, notes, ref_code } = req.body;
      db.prepare(`
        UPDATE material_requests SET article = ?, supplier_id = ?, supplier_name = ?, quantity = ?, priority = ?,
        affaire_id = ?, destination = ?, destination_other = ?, notes = ?, ref_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(
        article || existing.article, supplier_id ?? existing.supplier_id, supplier_name ?? existing.supplier_name,
        quantity ?? existing.quantity, priority || existing.priority, affaire_id ?? existing.affaire_id,
        destination || existing.destination, destination_other ?? existing.destination_other,
        notes ?? existing.notes, ref_code ?? existing.ref_code, req.params.id
      );
      const updated = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Supprimer une demande
  app.delete('/api/material-requests/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Demande non trouvée' });
      if (existing.requested_by !== req.user.id) {
        const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (!user?.is_admin) return res.status(403).json({ error: 'Non autorisé' });
      }
      db.prepare('DELETE FROM material_requests WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ═══ Validation admin : approuver/rejeter et répartir en commandes ═══
  app.post('/api/material-requests/:id/validate', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { action, rejection_reason } = req.body; // action: 'approve' | 'reject'
      const request = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ error: 'Demande non trouvée' });
      if (request.status !== 'pending') return res.status(400).json({ error: 'Cette demande a déjà été traitée' });

      if (action === 'reject') {
        db.prepare(`UPDATE material_requests SET status = 'rejected', approved_by = ?, approved_by_name = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .run(req.user.id, req.user.name, rejection_reason || null, req.params.id);
        addToHistory('material_request', req.params.id, 'reject', JSON.stringify({ reason: rejection_reason }), req.user.id, req.user.name);
        const updated = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
        return res.json({ success: true, request: updated, action: 'rejected' });
      }

      if (action === 'approve') {
        // Répartir dans une commande existante (même fournisseur, status draft/sent) ou en créer une nouvelle
        const distributeToOrder = db.transaction(() => {
          let orderId = null;
          let orderRef = null;
          let isNew = false;

          const supplierName = (request.supplier_name || 'DIVERS').trim().toUpperCase();
          // Find or create supplier
          let supplier = db.prepare('SELECT id FROM suppliers WHERE UPPER(name) = ?').get(supplierName);
          if (!supplier) {
            const sr = db.prepare('INSERT INTO suppliers (name) VALUES (?)').run(request.supplier_name || 'DIVERS');
            supplier = { id: sr.lastInsertRowid };
          }

          // Try to find existing draft order for this supplier
          const existingOrder = db.prepare(`SELECT id, reference, total_ht, tva_rate FROM orders WHERE supplier_id = ? AND status IN ('draft', 'sent') ORDER BY created_at DESC LIMIT 1`).get(supplier.id);

          if (existingOrder) {
            orderId = existingOrder.id;
            orderRef = existingOrder.reference;
          } else {
            // Create new order
            const year = new Date().getFullYear();
            const last = db.prepare(`SELECT reference FROM orders WHERE reference LIKE ? ORDER BY id DESC LIMIT 1`).get(`BC-${year}-%`);
            let num = 1;
            if (last) { const parts = last.reference.split('-'); num = parseInt(parts[2] || '0', 10) + 1; }
            orderRef = `BC-${year}-${String(num).padStart(3, '0')}`;

            const or = db.prepare(`INSERT INTO orders (reference, type, supplier_id, status, order_date, total_ht, tva_rate, total_ttc, notes, created_by) VALUES (?, 'purchase', ?, 'draft', ?, 0, 20, 0, ?, ?)`)
              .run(orderRef, supplier.id, new Date().toISOString().slice(0, 10), `Commande groupée - demandes matériel`, req.user.id);
            orderId = or.lastInsertRowid;
            isNew = true;
          }

          // Add item to order
          const itemTotal = (request.quantity || 1) * 0; // No price on requests
          db.prepare(`INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, ref_code, source_requester_id, source_requester_name, source_affaire_id, source_type)
            VALUES (?, ?, ?, 'u', 0, 20, 0, ?, ?, ?, ?, ?)`)
            .run(orderId, request.article, request.quantity || 1, request.ref_code || null,
              request.requested_by, request.requested_by_name, request.affaire_id || null,
              request.affaire_id ? 'affaire' : 'personnel');

          // Update request status
          db.prepare(`UPDATE material_requests SET status = 'approved', order_id = ?, approved_by = ?, approved_by_name = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(orderId, req.user.id, req.user.name, req.params.id);

          addToHistory('material_request', req.params.id, 'approve', JSON.stringify({ order_id: orderId, order_ref: orderRef }), req.user.id, req.user.name);

          return { orderId, orderRef, isNew, supplierId: supplier.id };
        });

        const result = distributeToOrder();
        const updated = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
        return res.json({ success: true, request: updated, action: 'approved', order: result });
      }

      return res.status(400).json({ error: 'Action invalide — approve ou reject attendu' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Validation en masse
  app.post('/api/material-requests/batch-validate', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { request_ids = [], action } = req.body;
      if (!request_ids.length) return res.status(400).json({ error: 'Aucune demande sélectionnée' });

      const results = [];
      for (const id of request_ids) {
        try {
          const request = db.prepare('SELECT * FROM material_requests WHERE id = ? AND status = ?').get(id, 'pending');
          if (!request) { results.push({ id, status: 'skipped' }); continue; }

          if (action === 'reject') {
            db.prepare(`UPDATE material_requests SET status = 'rejected', approved_by = ?, approved_by_name = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`)
              .run(req.user.id, req.user.name, id);
            results.push({ id, status: 'rejected' });
          } else if (action === 'approve') {
            // Same distribution logic as single validate
            const supplierName = (request.supplier_name || 'DIVERS').trim().toUpperCase();
            let supplier = db.prepare('SELECT id FROM suppliers WHERE UPPER(name) = ?').get(supplierName);
            if (!supplier) {
              const sr = db.prepare('INSERT INTO suppliers (name) VALUES (?)').run(request.supplier_name || 'DIVERS');
              supplier = { id: sr.lastInsertRowid };
            }

            let orderId;
            const existingOrder = db.prepare(`SELECT id FROM orders WHERE supplier_id = ? AND status IN ('draft', 'sent') ORDER BY created_at DESC LIMIT 1`).get(supplier.id);
            if (existingOrder) {
              orderId = existingOrder.id;
            } else {
              const year = new Date().getFullYear();
              const last = db.prepare(`SELECT reference FROM orders WHERE reference LIKE ? ORDER BY id DESC LIMIT 1`).get(`BC-${year}-%`);
              let num = 1;
              if (last) { const parts = last.reference.split('-'); num = parseInt(parts[2] || '0', 10) + 1; }
              const ref = `BC-${year}-${String(num).padStart(3, '0')}`;
              const or = db.prepare(`INSERT INTO orders (reference, type, supplier_id, status, order_date, total_ht, tva_rate, total_ttc, notes, created_by) VALUES (?, 'purchase', ?, 'draft', ?, 0, 20, 0, 'Commande groupée', ?)`)
                .run(ref, supplier.id, new Date().toISOString().slice(0, 10), req.user.id);
              orderId = or.lastInsertRowid;
            }

            db.prepare(`INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, ref_code, source_requester_id, source_requester_name, source_affaire_id, source_type) VALUES (?, ?, ?, 'u', 0, 20, 0, ?, ?, ?, ?, ?)`)
              .run(orderId, request.article, request.quantity || 1, request.ref_code || null,
                request.requested_by, request.requested_by_name, request.affaire_id || null,
                request.affaire_id ? 'affaire' : 'personnel');

            db.prepare(`UPDATE material_requests SET status = 'approved', order_id = ?, approved_by = ?, approved_by_name = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`)
              .run(orderId, req.user.id, req.user.name, id);
            results.push({ id, status: 'approved', order_id: orderId });
          }
        } catch (err) {
          results.push({ id, status: 'error', message: err.message });
        }
      }
      res.json({ success: true, results });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Documents fournisseurs + Auto-validation réception + Alertes complétion
// ═══════════════════════════════════════════════════════════════
export function setupSupplierDocumentsRoutes(app, authenticateToken, requireAdmin) {
  // Upload dir
  const uploadDir = path.join(__dirname, '..', 'public', 'supplier-docs');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  // Liste des documents fournisseur
  app.get('/api/supplier-documents', authenticateToken, (req, res) => {
    try {
      const { supplier_id, order_id, doc_type } = req.query;
      let query = 'SELECT sd.*, s.name as supplier_name FROM supplier_documents sd LEFT JOIN suppliers s ON s.id = sd.supplier_id WHERE 1=1';
      const params = [];
      if (supplier_id) { query += ' AND sd.supplier_id = ?'; params.push(supplier_id); }
      if (order_id) { query += ' AND sd.order_id = ?'; params.push(order_id); }
      if (doc_type) { query += ' AND sd.doc_type = ?'; params.push(doc_type); }
      query += ' ORDER BY sd.created_at DESC';
      res.json(db.prepare(query).all(...params));
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Upload document fournisseur
  app.post('/api/supplier-documents', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { supplier_id, order_id, doc_type, filename, notes } = req.body;
      if (!supplier_id || !doc_type) return res.status(400).json({ error: 'supplier_id et doc_type requis' });
      const validTypes = ['acknowledgment', 'delivery_note', 'quote', 'invoice'];
      if (!validTypes.includes(doc_type)) return res.status(400).json({ error: 'Type document invalide' });

      const result = db.prepare(`
        INSERT INTO supplier_documents (supplier_id, order_id, doc_type, filename, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(supplier_id, order_id || null, doc_type, filename || `${doc_type}-${Date.now()}`, notes || null, req.user.id);

      const doc = db.prepare('SELECT * FROM supplier_documents WHERE id = ?').get(result.lastInsertRowid);

      // If it's a delivery note, auto-validate received items
      if (doc_type === 'delivery_note' && order_id) {
        autoValidateReceivedItems(order_id, result.lastInsertRowid, req.user);
      }

      addToHistory('supplier_document', doc.id, 'create', JSON.stringify({ doc_type, supplier_id, order_id }), req.user.id, req.user.name);
      res.status(201).json(doc);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // Supprimer un document fournisseur
  app.delete('/api/supplier-documents/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const doc = db.prepare('SELECT * FROM supplier_documents WHERE id = ?').get(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Document non trouvé' });
      if (doc.file_path) {
        const fp = path.join(uploadDir, doc.file_path);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      db.prepare('DELETE FROM supplier_documents WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ═══ Fournisseurs avec commandes en cours ═══
  app.get('/api/suppliers/with-orders', authenticateToken, (req, res) => {
    try {
      const { include_archived } = req.query;
      let statusFilter = `AND o.status IN ('draft','sent','confirmed','partial')`;
      if (include_archived === 'true') statusFilter = '';
      const suppliers = db.prepare(`
        SELECT s.*, 
          COUNT(DISTINCT o.id) as active_order_count,
          SUM(o.total_ht) as total_ht,
          GROUP_CONCAT(DISTINCT o.status) as order_statuses
        FROM suppliers s
        INNER JOIN orders o ON o.supplier_id = s.id ${statusFilter}
        GROUP BY s.id
        ORDER BY active_order_count DESC, s.name ASC
      `).all();
      res.json(suppliers);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ═══ Commandes d'un fournisseur ═══
  app.get('/api/suppliers/:id/orders', authenticateToken, (req, res) => {
    try {
      const { include_archived } = req.query;
      let statusFilter = `AND o.status IN ('draft','sent','confirmed','partial')`;
      if (include_archived === 'true') statusFilter = '';
      const orders = db.prepare(`
        SELECT o.*, u.name as created_by_name,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND received_qty >= quantity) as completed_items
        FROM orders o
        LEFT JOIN users u ON u.id = o.created_by
        WHERE o.supplier_id = ? ${statusFilter}
        ORDER BY o.created_at DESC
      `).all(req.params.id);
      res.json(orders);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ═══ Détail complet fournisseur (commandes + documents + BL correspondance) ═══
  app.get('/api/suppliers/:id/full-detail', authenticateToken, (req, res) => {
    try {
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
      if (!supplier) return res.status(404).json({ error: 'Fournisseur non trouvé' });

      const orders = db.prepare(`
        SELECT o.*, u.name as created_by_name,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND received_qty >= quantity) as completed_items
        FROM orders o LEFT JOIN users u ON u.id = o.created_by
        WHERE o.supplier_id = ? ORDER BY o.created_at DESC
      `).all(req.params.id);

      // Get items for each order with affaire correspondence
      for (const order of orders) {
        order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id);
      }

      const documents = db.prepare('SELECT * FROM supplier_documents WHERE supplier_id = ? ORDER BY created_at DESC').all(req.params.id);

      // BL correspondence: find affaires linked to this supplier's orders
      const affaireIds = [...new Set(orders.map(o => o.affaire_id).filter(Boolean))];
      const blCorrespondence = [];
      for (const affId of affaireIds) {
        const bls = db.prepare('SELECT * FROM bl_imports WHERE affaire_id = ?').all(affId);
        blCorrespondence.push(...bls.map(bl => ({ ...bl, affaire_id: affId })));
      }

      // Workflow summary per order
      const workflow = orders.map(o => {
        const hasQuote = documents.some(d => d.order_id === o.id && d.doc_type === 'quote');
        const hasAck = documents.some(d => d.order_id === o.id && d.doc_type === 'acknowledgment');
        const hasBL = documents.some(d => d.order_id === o.id && d.doc_type === 'delivery_note');
        const hasInvoice = documents.some(d => d.order_id === o.id && d.doc_type === 'invoice');
        return {
          order_id: o.id,
          reference: o.reference,
          status: o.status,
          steps: {
            quote: hasQuote,
            order: true,
            acknowledgment: hasAck,
            delivery_note: hasBL,
            invoice: hasInvoice,
          },
          completion: o.item_count > 0 ? Math.round((o.completed_items / o.item_count) * 100) : 0,
        };
      });

      res.json({ supplier, orders, documents, blCorrespondence, workflow });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  // ═══ Auto-validation des articles reçus ═══
  function autoValidateReceivedItems(orderId, deliveryNoteId, user) {
    try {
      // When a delivery note is imported, mark all items as fully received
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      const now = new Date().toISOString().slice(0, 10);

      for (const item of items) {
        if ((item.received_qty || 0) < item.quantity) {
          db.prepare('UPDATE order_items SET received_qty = quantity, received_date = ?, delivery_note_id = ? WHERE id = ?')
            .run(now, deliveryNoteId, item.id);
        }
      }

      // Check if order is now fully received
      const remaining = db.prepare('SELECT COUNT(*) as c FROM order_items WHERE order_id = ? AND (received_qty IS NULL OR received_qty < quantity)').get(orderId);
      if (remaining.c === 0) {
        db.prepare("UPDATE orders SET status = 'received', received_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(now, orderId);

        // Check completion and send alerts
        checkOrderCompletion(orderId, user);
      } else {
        db.prepare("UPDATE orders SET status = 'partial', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);
      }

      addToHistory('order', orderId, 'auto_receive', JSON.stringify({ delivery_note_id: deliveryNoteId, items_count: items.length }), user.id, user.name);
    } catch (error) {
      logger.error('Auto-validation error:', error);
    }
  }

  // ═══ Vérification complétion et alertes ═══
  function checkOrderCompletion(orderId, user) {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order || order.completion_notified) return;

      // Create alert for order completion
      db.prepare("UPDATE orders SET completion_notified = 1 WHERE id = ?").run(orderId);

      // Find all requesters for this order's items
      const requesters = db.prepare(`SELECT DISTINCT source_requester_id, source_requester_name FROM order_items WHERE order_id = ? AND source_requester_id IS NOT NULL`).all(orderId);
      for (const r of requesters) {
        db.prepare(`INSERT INTO completion_alerts (entity_type, entity_id, entity_reference, alert_type, message, recipient_id, recipient_name) VALUES ('order', ?, ?, 'completion', ?, ?, ?)`)
          .run(String(orderId), order.reference, `La commande ${order.reference} est entièrement réceptionnée. Vos articles sont disponibles.`, r.source_requester_id, r.source_requester_name);
      }

      // Check if all orders for a linked affaire are complete
      if (order.affaire_id) {
        checkAffaireCompletion(order.affaire_id, user);
      }
      // Also check affaires linked through items
      const affaireIds = db.prepare('SELECT DISTINCT source_affaire_id FROM order_items WHERE order_id = ? AND source_affaire_id IS NOT NULL').all(orderId);
      for (const { source_affaire_id } of affaireIds) {
        checkAffaireCompletion(source_affaire_id, user);
      }
    } catch (error) {
      logger.error('Check order completion error:', error);
    }
  }

  function checkAffaireCompletion(affaireId, user) {
    try {
      // Check if all orders linked to this affaire are received
      const pendingOrders = db.prepare(`
        SELECT COUNT(*) as c FROM orders WHERE (affaire_id = ? OR id IN (SELECT DISTINCT order_id FROM order_items WHERE source_affaire_id = ?))
        AND status NOT IN ('received', 'cancelled')
      `).get(affaireId, affaireId);

      if (pendingOrders.c === 0) {
        // All orders are complete — check if we already notified
        const existingAlert = db.prepare(`SELECT id FROM completion_alerts WHERE entity_type = 'affaire' AND entity_id = ? AND alert_type = 'completion'`).get(affaireId);
        if (!existingAlert) {
          // Find the affaire creator
          const affaire = db.prepare('SELECT * FROM affaires WHERE numero_affaire = ?').get(affaireId);
          if (affaire && affaire.created_by) {
            const creator = db.prepare('SELECT id, name FROM users WHERE id = ?').get(affaire.created_by);
            if (creator) {
              db.prepare(`INSERT INTO completion_alerts (entity_type, entity_id, entity_reference, alert_type, message, recipient_id, recipient_name) VALUES ('affaire', ?, ?, 'completion', ?, ?, ?)`)
                .run(affaireId, affaireId, `Tous les articles commandés pour l'affaire ${affaireId} ont été réceptionnés.`, creator.id, creator.name);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Check affaire completion error:', error);
    }
  }

  // ═══ Alertes de complétion ═══
  app.get('/api/completion-alerts', authenticateToken, (req, res) => {
    try {
      const { unread_only } = req.query;
      let query = 'SELECT * FROM completion_alerts WHERE recipient_id = ?';
      const params = [req.user.id];
      if (unread_only === 'true') { query += ' AND is_read = 0'; }
      query += ' ORDER BY created_at DESC LIMIT 50';
      res.json(db.prepare(query).all(...params));
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/completion-alerts/:id/read', authenticateToken, (req, res) => {
    try {
      db.prepare('UPDATE completion_alerts SET is_read = 1 WHERE id = ? AND recipient_id = ?').run(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/completion-alerts/mark-all-read', authenticateToken, (req, res) => {
    try {
      db.prepare('UPDATE completion_alerts SET is_read = 1 WHERE recipient_id = ? AND is_read = 0').run(req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
}
