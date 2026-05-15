// [S2-1] Routes Fournisseurs - extrait de ordersRoutes.js (L44-178)
import db from '../database.js';
import logger from '../logger.js';

export function setupSuppliersRoutes(app, authenticateToken, requireAdmin) {
  // Liste des fournisseurs
  app.get('/api/suppliers', authenticateToken, (req, res) => {
    try {
      const { search } = req.query;
      let query =
        'SELECT s.*, (SELECT COUNT(*) FROM orders WHERE supplier_id = s.id) as order_count FROM suppliers s';
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
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Créer un fournisseur
  app.post('/api/suppliers', authenticateToken, (req, res) => {
    try {
      const {
        name,
        contact_name,
        email,
        phone,
        address,
        notes,
        website,
        shipping_flat_rate,
        shipping_free_threshold,
        shipping_notes,
      } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Le nom est requis' });
      const result = db
        .prepare(
          `INSERT INTO suppliers
            (name, contact_name, email, phone, address, notes, website,
             shipping_flat_rate, shipping_free_threshold, shipping_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          name,
          contact_name || null,
          email || null,
          phone || null,
          address || null,
          notes || null,
          website || null,
          shipping_flat_rate != null ? Number(shipping_flat_rate) : null,
          shipping_free_threshold != null ? Number(shipping_free_threshold) : null,
          shipping_notes || null,
        );
      const supplier = db
        .prepare('SELECT * FROM suppliers WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(supplier);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Modifier un fournisseur
  app.put('/api/suppliers/:id', authenticateToken, (req, res) => {
    try {
      const {
        name,
        contact_name,
        email,
        phone,
        address,
        notes,
        website,
        shipping_flat_rate,
        shipping_free_threshold,
        shipping_notes,
      } = req.body;
      db.prepare(
        `UPDATE suppliers SET
          name = ?, contact_name = ?, email = ?, phone = ?, address = ?, notes = ?,
          website = ?, shipping_flat_rate = ?, shipping_free_threshold = ?, shipping_notes = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).run(
        name,
        contact_name || null,
        email || null,
        phone || null,
        address || null,
        notes || null,
        website || null,
        shipping_flat_rate != null ? Number(shipping_flat_rate) : null,
        shipping_free_threshold != null ? Number(shipping_free_threshold) : null,
        shipping_notes || null,
        req.params.id,
      );
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
      res.json(supplier);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Supprimer un fournisseur
  app.delete('/api/suppliers/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const orderCount = db
        .prepare('SELECT COUNT(*) as count FROM orders WHERE supplier_id = ?')
        .get(req.params.id);
      if (orderCount.count > 0) {
        return res.status(400).json({
          success: false,
          error: `Ce fournisseur est lié à ${orderCount.count} commande(s)`,
        });
      }
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Commandes (Bons de commande)
// ═══════════════════════════════════════════════════════════════

// Générer référence auto — défini au scope module pour être accessible
// depuis setupOrdersRoutes ET setupQuotesRoutes (qui contient generate-from-bl)
