// [S2-1] Routes Documents fournisseurs - extrait de ordersRoutes.js (L2222-fin)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { addToHistory } from '../database.js';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupSupplierDocumentsRoutes(app, authenticateToken, requireAdmin) {
  // Upload dir
  const uploadDir = path.join(__dirname, '..', '..', 'public', 'supplier-docs');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  // Liste des documents fournisseur
  app.get('/api/supplier-documents', authenticateToken, (req, res) => {
    try {
      const { supplier_id, order_id, doc_type } = req.query;
      let query =
        'SELECT sd.*, s.name as supplier_name FROM supplier_documents sd LEFT JOIN suppliers s ON s.id = sd.supplier_id WHERE 1=1';
      const params = [];
      if (supplier_id) {
        query += ' AND sd.supplier_id = ?';
        params.push(supplier_id);
      }
      if (order_id) {
        query += ' AND sd.order_id = ?';
        params.push(order_id);
      }
      if (doc_type) {
        query += ' AND sd.doc_type = ?';
        params.push(doc_type);
      }
      query += ' ORDER BY sd.created_at DESC';
      res.json(db.prepare(query).all(...params));
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Upload document fournisseur
  app.post('/api/supplier-documents', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { supplier_id, order_id, doc_type, filename, notes } = req.body;
      if (!supplier_id || !doc_type)
        return res.status(400).json({ success: false, error: 'supplier_id et doc_type requis' });
      const validTypes = ['acknowledgment', 'delivery_note', 'quote', 'invoice'];
      if (!validTypes.includes(doc_type))
        return res.status(400).json({ success: false, error: 'Type document invalide' });

      const result = db
        .prepare(
          `
        INSERT INTO supplier_documents (supplier_id, order_id, doc_type, filename, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          supplier_id,
          order_id || null,
          doc_type,
          filename || `${doc_type}-${Date.now()}`,
          notes || null,
          req.user.id,
        );

      const doc = db
        .prepare('SELECT * FROM supplier_documents WHERE id = ?')
        .get(result.lastInsertRowid);

      // If it's a delivery note, auto-validate received items
      if (doc_type === 'delivery_note' && order_id) {
        autoValidateReceivedItems(order_id, result.lastInsertRowid, req.user);
      }

      addToHistory(
        'supplier_document',
        doc.id,
        'create',
        JSON.stringify({ doc_type, supplier_id, order_id }),
        req.user.id,
        req.user.name,
      );
      res.status(201).json(doc);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Supprimer un document fournisseur
  app.delete('/api/supplier-documents/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const doc = db.prepare('SELECT * FROM supplier_documents WHERE id = ?').get(req.params.id);
      if (!doc) return res.status(404).json({ success: false, error: 'Document non trouvé' });
      if (doc.file_path) {
        const fp = path.join(uploadDir, doc.file_path);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      db.prepare('DELETE FROM supplier_documents WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ Fournisseurs avec commandes en cours ═══
  app.get('/api/suppliers/with-orders', authenticateToken, (req, res) => {
    try {
      const { include_archived } = req.query;
      let statusFilter = `AND o.status IN ('draft','sent','confirmed','partial')`;
      if (include_archived === 'true') statusFilter = '';
      const suppliers = db
        .prepare(
          `
        SELECT s.*,
          COUNT(DISTINCT o.id) as active_order_count,
          COALESCE(SUM(o.total_ht), 0) as total_ht,
          GROUP_CONCAT(DISTINCT o.status) as order_statuses,
          (SELECT COUNT(*) FROM catalog_imports ci WHERE ci.supplier_id = s.id) as catalog_count
        FROM suppliers s
        LEFT JOIN orders o ON o.supplier_id = s.id ${statusFilter}
        GROUP BY s.id
        ORDER BY active_order_count DESC, s.name ASC
      `,
        )
        .all();
      res.json(suppliers);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ Commandes d'un fournisseur ═══
  app.get('/api/suppliers/:id/orders', authenticateToken, (req, res) => {
    try {
      const { include_archived } = req.query;
      let statusFilter = `AND o.status IN ('draft','sent','confirmed','partial')`;
      if (include_archived === 'true') statusFilter = '';
      const orders = db
        .prepare(
          `
        SELECT o.*, u.name as created_by_name,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND received_qty >= quantity) as completed_items,
          COALESCE(NULLIF(a.nom, ''), NULLIF(a.titre, ''), NULLIF(a.client, ''), '') as affaire_name
        FROM orders o
        LEFT JOIN users u ON u.id = o.created_by
        LEFT JOIN affaires a ON a.numero_affaire = o.affaire_id
        WHERE o.supplier_id = ? ${statusFilter}
        ORDER BY o.created_at DESC
      `,
        )
        .all(req.params.id);

      // Charger les items pour chaque commande
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => '?').join(',');
        const allItems = db
          .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`)
          .all(...orderIds);
        const itemsByOrder = {};
        for (const item of allItems) {
          if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
          itemsByOrder[item.order_id].push(item);
        }
        for (const order of orders) {
          order.items = itemsByOrder[order.id] || [];
        }
      }
      res.json(orders);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ Catalogues importés d'un fournisseur ═══
  app.get('/api/suppliers/:id/catalogs', authenticateToken, (req, res) => {
    try {
      const catalogs = db
        .prepare('SELECT * FROM catalog_imports WHERE supplier_id = ? ORDER BY created_at DESC')
        .all(req.params.id);
      res.json(catalogs);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ═══ Détail complet fournisseur (commandes + documents + BL correspondance) ═══
  app.get('/api/suppliers/:id/full-detail', authenticateToken, (req, res) => {
    try {
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
      if (!supplier)
        return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });

      const orders = db
        .prepare(
          `
        SELECT o.*, u.name as created_by_name,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id AND received_qty >= quantity) as completed_items,
          COALESCE(NULLIF(a.nom, ''), NULLIF(a.titre, ''), NULLIF(a.client, ''), '') as affaire_name
        FROM orders o LEFT JOIN users u ON u.id = o.created_by
        LEFT JOIN affaires a ON a.numero_affaire = o.affaire_id
        WHERE o.supplier_id = ? ORDER BY o.created_at DESC
      `,
        )
        .all(req.params.id);

      // Get items for all orders in one query (évite N+1)
      const orderIds = orders.map((o) => o.id);
      const itemsByOrder = {};
      if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => '?').join(',');
        const allItems = db
          .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`)
          .all(...orderIds);
        for (const item of allItems) {
          if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
          itemsByOrder[item.order_id].push(item);
        }
      }
      for (const order of orders) {
        order.items = itemsByOrder[order.id] || [];
      }

      const documents = db
        .prepare('SELECT * FROM supplier_documents WHERE supplier_id = ? ORDER BY created_at DESC')
        .all(req.params.id);

      // Catalog imports for this supplier
      const catalogs = db
        .prepare('SELECT * FROM catalog_imports WHERE supplier_id = ? ORDER BY created_at DESC')
        .all(req.params.id);

      // BL correspondence: find affaires linked to this supplier's orders
      const affaireIds = [...new Set(orders.map((o) => o.affaire_id).filter(Boolean))];
      const blCorrespondence = [];
      for (const affId of affaireIds) {
        const bls = db.prepare('SELECT * FROM bl_imports WHERE affaire_id = ?').all(affId);
        blCorrespondence.push(...bls.map((bl) => ({ ...bl, affaire_id: affId })));
      }

      // Workflow summary per order
      const workflow = orders.map((o) => {
        const hasQuote = documents.some((d) => d.order_id === o.id && d.doc_type === 'quote');
        const hasAck = documents.some(
          (d) => d.order_id === o.id && d.doc_type === 'acknowledgment',
        );
        const hasBL = documents.some((d) => d.order_id === o.id && d.doc_type === 'delivery_note');
        const hasInvoice = documents.some((d) => d.order_id === o.id && d.doc_type === 'invoice');
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

      res.json({ supplier, orders, documents, catalogs, blCorrespondence, workflow });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
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
          db.prepare(
            'UPDATE order_items SET received_qty = quantity, received_date = ?, delivery_note_id = ? WHERE id = ?',
          ).run(now, deliveryNoteId, item.id);
        }
      }

      // Check if order is now fully received
      const remaining = db
        .prepare(
          'SELECT COUNT(*) as c FROM order_items WHERE order_id = ? AND (received_qty IS NULL OR received_qty < quantity)',
        )
        .get(orderId);
      if (remaining.c === 0) {
        db.prepare(
          "UPDATE orders SET status = 'received', received_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(now, orderId);

        // Check completion and send alerts
        checkOrderCompletion(orderId, user);
      } else {
        db.prepare(
          "UPDATE orders SET status = 'partial', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(orderId);
      }

      addToHistory(
        'order',
        orderId,
        'auto_receive',
        JSON.stringify({ delivery_note_id: deliveryNoteId, items_count: items.length }),
        user.id,
        user.name,
      );
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
      db.prepare('UPDATE orders SET completion_notified = 1 WHERE id = ?').run(orderId);

      // Find all requesters for this order's items
      const requesters = db
        .prepare(
          `SELECT DISTINCT source_requester_id, source_requester_name FROM order_items WHERE order_id = ? AND source_requester_id IS NOT NULL`,
        )
        .all(orderId);
      for (const r of requesters) {
        db.prepare(
          `INSERT INTO completion_alerts (entity_type, entity_id, entity_reference, alert_type, message, recipient_id, recipient_name) VALUES ('order', ?, ?, 'completion', ?, ?, ?)`,
        ).run(
          String(orderId),
          order.reference,
          `La commande ${order.reference} est entièrement réceptionnée. Vos articles sont disponibles.`,
          r.source_requester_id,
          r.source_requester_name,
        );
      }

      // Check if all orders for a linked affaire are complete
      if (order.affaire_id) {
        checkAffaireCompletion(order.affaire_id, user);
      }
      // Also check affaires linked through items
      const affaireIds = db
        .prepare(
          'SELECT DISTINCT source_affaire_id FROM order_items WHERE order_id = ? AND source_affaire_id IS NOT NULL',
        )
        .all(orderId);
      for (const { source_affaire_id } of affaireIds) {
        checkAffaireCompletion(source_affaire_id, user);
      }
    } catch (error) {
      logger.error('Check order completion error:', error);
    }
  }

  function checkAffaireCompletion(affaireId, _user) {
    try {
      // Check if all orders linked to this affaire are received
      const pendingOrders = db
        .prepare(
          `
        SELECT COUNT(*) as c FROM orders WHERE (affaire_id = ? OR id IN (SELECT DISTINCT order_id FROM order_items WHERE source_affaire_id = ?))
        AND status NOT IN ('received', 'cancelled')
      `,
        )
        .get(affaireId, affaireId);

      if (pendingOrders.c === 0) {
        // All orders are complete — check if we already notified
        const existingAlert = db
          .prepare(
            `SELECT id FROM completion_alerts WHERE entity_type = 'affaire' AND entity_id = ? AND alert_type = 'completion'`,
          )
          .get(affaireId);
        if (!existingAlert) {
          // Find the affaire creator
          const affaire = db
            .prepare('SELECT * FROM affaires WHERE numero_affaire = ?')
            .get(affaireId);
          if (affaire && affaire.created_by) {
            const creator = db
              .prepare('SELECT id, name FROM users WHERE id = ?')
              .get(affaire.created_by);
            if (creator) {
              db.prepare(
                `INSERT INTO completion_alerts (entity_type, entity_id, entity_reference, alert_type, message, recipient_id, recipient_name) VALUES ('affaire', ?, ?, 'completion', ?, ?, ?)`,
              ).run(
                affaireId,
                affaireId,
                `Tous les articles commandés pour l'affaire ${affaireId} ont été réceptionnés.`,
                creator.id,
                creator.name,
              );
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
      if (unread_only === 'true') {
        query += ' AND is_read = 0';
      }
      query += ' ORDER BY created_at DESC LIMIT 50';
      res.json(db.prepare(query).all(...params));
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/completion-alerts/:id/read', authenticateToken, (req, res) => {
    try {
      db.prepare('UPDATE completion_alerts SET is_read = 1 WHERE id = ? AND recipient_id = ?').run(
        req.params.id,
        req.user.id,
      );
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  app.put('/api/completion-alerts/mark-all-read', authenticateToken, (req, res) => {
    try {
      db.prepare(
        'UPDATE completion_alerts SET is_read = 1 WHERE recipient_id = ? AND is_read = 0',
      ).run(req.user.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
