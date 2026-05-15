// [S2-1] Routes Demandes de materiel - extrait de ordersRoutes.js (L1367-2221)
import db, { addToHistory } from '../database.js';
import logger from '../logger.js';

export function setupMaterialRequestsRoutes(app, authenticateToken, requireAdmin) {
  // Liste des demandes (avec filtres) — chaque demande inclut un tableau lines
  app.get('/api/material-requests', authenticateToken, (req, res) => {
    try {
      const { status, affaire_id, requested_by, search, priority } = req.query;
      let query = `SELECT mr.*, u.name as requested_by_name_db FROM material_requests mr LEFT JOIN users u ON u.id = mr.requested_by WHERE 1=1`;
      const params = [];
      if (status) {
        query += ' AND mr.status = ?';
        params.push(status);
      }
      if (affaire_id) {
        query += ' AND mr.affaire_id = ?';
        params.push(affaire_id);
      }
      if (requested_by) {
        query += ' AND mr.requested_by = ?';
        params.push(requested_by);
      }
      if (priority) {
        query += ' AND mr.priority = ?';
        params.push(priority);
      }
      if (search) {
        query += ' AND (mr.article LIKE ? OR mr.supplier_name LIKE ? OR mr.notes LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      query +=
        " ORDER BY CASE mr.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, mr.created_at DESC";
      const requests = db.prepare(query).all(...params);
      if (requests.length > 0) {
        const ids = requests.map((r) => r.id);
        const placeholders = ids.map(() => '?').join(',');
        const allLines = db
          .prepare(
            `SELECT id, request_id, article, ref_code, quantity, order_id, order_item_id, status
             FROM material_request_lines WHERE request_id IN (${placeholders})
             ORDER BY id ASC`,
          )
          .all(...ids);
        const linesByReq = new Map();
        for (const l of allLines) {
          if (!linesByReq.has(l.request_id)) linesByReq.set(l.request_id, []);
          linesByReq.get(l.request_id).push(l);
        }
        for (const r of requests) {
          r.lines = linesByReq.get(r.id) || [];
        }
      }
      res.json(requests);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Stats des demandes
  app.get('/api/material-requests/stats', authenticateToken, (req, res) => {
    try {
      const total = db.prepare('SELECT COUNT(*) as c FROM material_requests').get().c;
      const pending = db
        .prepare('SELECT COUNT(*) as c FROM material_requests WHERE status = ?')
        .get('pending').c;
      const approved = db
        .prepare('SELECT COUNT(*) as c FROM material_requests WHERE status = ?')
        .get('approved').c;
      const ordered = db
        .prepare('SELECT COUNT(*) as c FROM material_requests WHERE status = ?')
        .get('ordered').c;
      res.json({ total, pending, approved, ordered });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Créer une demande (tout utilisateur authentifié) — supporte multi-références
  app.post('/api/material-requests', authenticateToken, (req, res) => {
    try {
      const {
        article,
        supplier_id,
        supplier_name,
        quantity,
        priority,
        affaire_id,
        destination,
        destination_other,
        notes,
        ref_code,
        lines,
      } = req.body;

      // Normaliser : toujours un tableau de lignes en interne.
      const inputLines =
        Array.isArray(lines) && lines.length > 0
          ? lines
              .map((l) => ({
                article: (l.article || '').trim(),
                ref_code: l.ref_code || null,
                quantity: Number(l.quantity) || 1,
              }))
              .filter((l) => l.article)
          : article && article.trim()
            ? [
                {
                  article: article.trim(),
                  ref_code: ref_code || null,
                  quantity: Number(quantity) || 1,
                },
              ]
            : [];

      if (inputLines.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'Au moins une référence (article) est requise' });
      }

      const createTx = db.transaction(() => {
        const first = inputLines[0];
        const result = db
          .prepare(
            `INSERT INTO material_requests (article, supplier_id, supplier_name, quantity, priority, affaire_id, destination, destination_other, notes, ref_code, requested_by, requested_by_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            first.article,
            supplier_id || null,
            supplier_name || null,
            first.quantity,
            priority || 'normal',
            affaire_id || null,
            destination || 'Stock',
            destination_other || null,
            notes || null,
            first.ref_code,
            req.user.id,
            req.user.name,
          );
        const requestId = result.lastInsertRowid;
        const insertLine = db.prepare(
          `INSERT INTO material_request_lines (request_id, article, ref_code, quantity)
           VALUES (?, ?, ?, ?)`,
        );
        for (const l of inputLines) {
          insertLine.run(requestId, l.article, l.ref_code, l.quantity);
        }
        return requestId;
      });

      const requestId = createTx();
      const created = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(requestId);
      created.lines = db
        .prepare(
          `SELECT id, request_id, article, ref_code, quantity, order_id, order_item_id, status
           FROM material_request_lines WHERE request_id = ? ORDER BY id ASC`,
        )
        .all(requestId);

      addToHistory(
        'material_request',
        created.id,
        'create',
        JSON.stringify({
          lines_count: created.lines.length,
          first_article: created.article,
          priority: created.priority,
          destination: created.destination,
        }),
        req.user.id,
        req.user.name,
      );
      res.status(201).json(created);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Modifier une demande (méta + lignes)
  app.put('/api/material-requests/:id', authenticateToken, (req, res) => {
    try {
      const existing = db
        .prepare('SELECT * FROM material_requests WHERE id = ?')
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Demande non trouvée' });
      // Seul le demandeur ou un admin peut modifier
      if (existing.requested_by !== req.user.id) {
        const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Non autorisé' });
      }
      if (existing.status !== 'pending' && existing.status !== 'approved') {
        return res.status(400).json({
          success: false,
          error: 'Demande déjà commandée ou rejetée — modification impossible',
        });
      }
      const isApproved = existing.status === 'approved';
      const {
        article,
        supplier_id,
        supplier_name,
        quantity,
        priority,
        affaire_id,
        destination,
        destination_other,
        notes,
        ref_code,
        lines,
      } = req.body;

      const normalisedLines =
        Array.isArray(lines) && lines.length > 0
          ? lines
              .map((l) => ({
                article: (l.article || '').trim(),
                ref_code: l.ref_code || null,
                quantity: Number(l.quantity) || 1,
              }))
              .filter((l) => l.article)
          : null;

      const updateTx = db.transaction(() => {
        const first = normalisedLines?.[0];
        db.prepare(
          `UPDATE material_requests SET article = ?, supplier_id = ?, supplier_name = ?, quantity = ?, priority = ?,
           affaire_id = ?, destination = ?, destination_other = ?, notes = ?, ref_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).run(
          first?.article ?? article ?? existing.article,
          supplier_id ?? existing.supplier_id,
          supplier_name ?? existing.supplier_name,
          first?.quantity ?? quantity ?? existing.quantity,
          priority || existing.priority,
          affaire_id ?? existing.affaire_id,
          destination || existing.destination,
          destination_other ?? existing.destination_other,
          notes ?? existing.notes,
          first?.ref_code ?? ref_code ?? existing.ref_code,
          req.params.id,
        );

        if (normalisedLines) {
          // Sécurité : si la demande est déjà approuvée, on ne touche pas aux
          // lignes liées à des order_items (préserve l'intégrité des commandes).
          // Seules les lignes encore "pending" peuvent être modifiées.
          if (isApproved) {
            const linkedLines = db
              .prepare(
                `SELECT COUNT(*) AS c FROM material_request_lines
                 WHERE request_id = ? AND status != 'pending'`,
              )
              .get(req.params.id).c;
            if (linkedLines > 0) {
              // Demande approuvée avec lignes liées : on ignore le replacement de
              // lignes pour ne pas déranger la commande. Les méta sont quand même
              // mises à jour ci-dessus.
            } else {
              db.prepare('DELETE FROM material_request_lines WHERE request_id = ?').run(
                req.params.id,
              );
              const insertLine = db.prepare(
                `INSERT INTO material_request_lines (request_id, article, ref_code, quantity)
                 VALUES (?, ?, ?, ?)`,
              );
              for (const l of normalisedLines) {
                insertLine.run(req.params.id, l.article, l.ref_code, l.quantity);
              }
            }
          } else {
            db.prepare('DELETE FROM material_request_lines WHERE request_id = ?').run(
              req.params.id,
            );
            const insertLine = db.prepare(
              `INSERT INTO material_request_lines (request_id, article, ref_code, quantity)
               VALUES (?, ?, ?, ?)`,
            );
            for (const l of normalisedLines) {
              insertLine.run(req.params.id, l.article, l.ref_code, l.quantity);
            }
          }
        }
      });
      updateTx();

      const updated = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
      updated.lines = db
        .prepare(
          `SELECT id, request_id, article, ref_code, quantity, order_id, order_item_id, status
           FROM material_request_lines WHERE request_id = ? ORDER BY id ASC`,
        )
        .all(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // #7 Commandes : retirer une demande approuvée de sa/ses commande(s) liée(s).
  // Repasse la demande en 'pending', supprime les order_items créés et nettoie
  // les liens des lignes. Bloqué si l'une des commandes liées n'est plus
  // modifiable (statut différent de draft/sent), pour ne pas casser une
  // commande validée/expédiée/payée.
  app.post('/api/material-requests/:id/detach', authenticateToken, requireAdmin, (req, res) => {
    try {
      const existing = db
        .prepare('SELECT * FROM material_requests WHERE id = ?')
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Demande non trouvée' });
      if (existing.status !== 'approved') {
        return res.status(400).json({
          success: false,
          error: 'Seules les demandes approuvées peuvent être retirées d\u2019une commande',
        });
      }

      const lines = db
        .prepare(
          `SELECT id, order_id, order_item_id, status FROM material_request_lines
             WHERE request_id = ? AND order_id IS NOT NULL`,
        )
        .all(req.params.id);

      if (lines.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'Aucune ligne liée à une commande à détacher' });
      }

      // Vérifie l'éligibilité de toutes les commandes cibles
      const orderIds = [...new Set(lines.map((l) => l.order_id))];
      const placeholders = orderIds.map(() => '?').join(',');
      const linkedOrders = db
        .prepare(`SELECT id, reference, status FROM orders WHERE id IN (${placeholders})`)
        .all(...orderIds);
      const blocking = linkedOrders.filter((o) => !['draft', 'sent'].includes(o.status));
      if (blocking.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Impossible : commande(s) non modifiable(s) — ${blocking.map((o) => `${o.reference} (${o.status})`).join(', ')}`,
        });
      }

      const detachTx = db.transaction(() => {
        const deleteItem = db.prepare('DELETE FROM order_items WHERE id = ?');
        const resetLine = db.prepare(
          `UPDATE material_request_lines SET order_id = NULL, order_item_id = NULL, status = 'pending' WHERE id = ?`,
        );
        for (const l of lines) {
          if (l.order_item_id) deleteItem.run(l.order_item_id);
          resetLine.run(l.id);
        }
        db.prepare(
          `UPDATE material_requests SET status = 'pending', order_id = NULL, approved_by = NULL, approved_by_name = NULL, approved_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).run(req.params.id);
      });
      detachTx();

      addToHistory(
        'material_request',
        req.params.id,
        'detach',
        JSON.stringify({ orders: linkedOrders.map((o) => o.reference) }),
        req.user.id,
        req.user.name,
      );

      const updated = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
      updated.lines = db
        .prepare(
          `SELECT id, request_id, article, ref_code, quantity, order_id, order_item_id, status
             FROM material_request_lines WHERE request_id = ? ORDER BY id ASC`,
        )
        .all(req.params.id);
      res.json({ success: true, request: updated, detached_orders: linkedOrders });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Supprimer une demande
  app.delete('/api/material-requests/:id', authenticateToken, (req, res) => {
    try {
      const existing = db
        .prepare('SELECT * FROM material_requests WHERE id = ?')
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Demande non trouvée' });
      if (existing.requested_by !== req.user.id) {
        const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (!user?.is_admin) return res.status(403).json({ success: false, error: 'Non autorisé' });
      }
      db.prepare('DELETE FROM material_requests WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ Commandes éligibles pour répartir une demande approuvée ═══
  app.get(
    '/api/material-requests/:id/eligible-orders',
    authenticateToken,
    requireAdmin,
    (req, res) => {
      try {
        const request = db
          .prepare('SELECT * FROM material_requests WHERE id = ?')
          .get(req.params.id);
        if (!request) return res.status(404).json({ success: false, error: 'Demande non trouvée' });

        const supplierName = (request.supplier_name || '').trim().toUpperCase();
        const supplier = supplierName
          ? db.prepare('SELECT id, name FROM suppliers WHERE UPPER(name) = ?').get(supplierName)
          : null;

        const sameSupplier = supplier
          ? db
              .prepare(
                `SELECT o.id, o.reference, o.status, o.order_date, o.total_ht, o.total_ttc, s.name AS supplier_name,
                        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
                 FROM orders o
                 LEFT JOIN suppliers s ON s.id = o.supplier_id
                 WHERE o.supplier_id = ? AND o.status IN ('draft', 'sent')
                 ORDER BY o.created_at DESC LIMIT 50`,
              )
              .all(supplier.id)
          : [];

        const otherSupplier = db
          .prepare(
            `SELECT o.id, o.reference, o.status, o.order_date, o.total_ht, o.total_ttc, s.name AS supplier_name,
                    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
             FROM orders o
             LEFT JOIN suppliers s ON s.id = o.supplier_id
             WHERE o.status IN ('draft', 'sent')
               ${supplier ? 'AND o.supplier_id <> ?' : ''}
             ORDER BY o.created_at DESC LIMIT 50`,
          )
          .all(...(supplier ? [supplier.id] : []));

        return res.json({
          success: true,
          request_supplier: request.supplier_name || null,
          same_supplier: sameSupplier,
          other_supplier: otherSupplier,
        });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ═══ Validation admin : approuver/rejeter et répartir en commandes ═══
  app.post('/api/material-requests/:id/validate', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { action, rejection_reason } = req.body; // action: 'approve' | 'reject'
      const request = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(req.params.id);
      if (!request) return res.status(404).json({ success: false, error: 'Demande non trouvée' });
      if (request.status !== 'pending')
        return res.status(400).json({ success: false, error: 'Cette demande a déjà été traitée' });

      if (action === 'reject') {
        db.prepare(
          `UPDATE material_requests SET status = 'rejected', approved_by = ?, approved_by_name = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).run(req.user.id, req.user.name, rejection_reason || null, req.params.id);
        addToHistory(
          'material_request',
          req.params.id,
          'reject',
          JSON.stringify({ reason: rejection_reason }),
          req.user.id,
          req.user.name,
        );
        const updated = db
          .prepare('SELECT * FROM material_requests WHERE id = ?')
          .get(req.params.id);
        return res.json({ success: true, request: updated, action: 'rejected' });
      }

      if (action === 'approve') {
        const { target_order_id, assignments } = req.body || {};

        // Charger toutes les lignes pending de la demande
        const lines = db
          .prepare(
            `SELECT id, article, ref_code, quantity, status FROM material_request_lines
             WHERE request_id = ? ORDER BY id ASC`,
          )
          .all(req.params.id);

        if (lines.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Cette demande ne contient aucune référence à dispatcher',
          });
        }

        // Construire la map {line_id -> target_order_id} et {line_id -> order_item_id (optionnel)}.
        // Compat : si pas d'assignments, on applique target_order_id (ou auto) à TOUTES les lignes.
        const assignMap = new Map();
        const itemMap = new Map();
        if (Array.isArray(assignments) && assignments.length > 0) {
          for (const a of assignments) {
            if (a && a.line_id != null) {
              assignMap.set(Number(a.line_id), a.target_order_id ?? null);
              if (a.order_item_id != null) itemMap.set(Number(a.line_id), Number(a.order_item_id));
            }
          }
          // Vérifier que toutes les lignes sont assignées
          const missing = lines.filter((l) => !assignMap.has(l.id) && l.status === 'pending');
          if (missing.length > 0) {
            return res.status(400).json({
              success: false,
              error: `Toutes les références doivent être assignées (${missing.length} manquante(s))`,
            });
          }
        } else {
          for (const l of lines) {
            if (l.status === 'pending') assignMap.set(l.id, target_order_id ?? undefined);
          }
        }

        // Supplier de la demande (utilisé pour le supplier_id par défaut des nouvelles commandes)
        const requestSupplierName = (request.supplier_name || 'DIVERS').trim();
        let requestSupplier = db
          .prepare('SELECT id, name FROM suppliers WHERE UPPER(name) = ?')
          .get(requestSupplierName.toUpperCase());

        const dispatchTx = db.transaction(() => {
          if (!requestSupplier) {
            const sr = db
              .prepare('INSERT INTO suppliers (name) VALUES (?)')
              .run(requestSupplierName);
            requestSupplier = { id: sr.lastInsertRowid, name: requestSupplierName };
          }

          // Cache des nouvelles commandes créées (clé: 'new' | `new:<supplierId>`).
          const newOrders = new Map();
          // Récap des dispatch.
          const dispatched = [];
          // Cache du dernier numéro de référence pour éviter conflits.
          const computeNextRef = () => {
            const year = new Date().getFullYear();
            const last = db
              .prepare(
                `SELECT reference FROM orders WHERE reference LIKE ? ORDER BY id DESC LIMIT 1`,
              )
              .get(`BC-${year}-%`);
            let num = 1;
            if (last) {
              const parts = last.reference.split('-');
              num = parseInt(parts[2] || '0', 10) + 1;
            }
            return `BC-${year}-${String(num).padStart(3, '0')}`;
          };

          const insertOrderItem = db.prepare(
            `INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, ref_code, source_requester_id, source_requester_name, source_affaire_id, source_type)
             VALUES (?, ?, ?, 'u', 0, 20, 0, ?, ?, ?, ?, ?)`,
          );
          const updateLine = db.prepare(
            `UPDATE material_request_lines SET order_id = ?, order_item_id = ?, status = 'approved' WHERE id = ?`,
          );

          for (const line of lines) {
            if (line.status !== 'pending') continue;
            const target = assignMap.get(line.id);
            const preItemId = itemMap.get(line.id);

            // Cas "item déjà créé" via OrderFormModal côté frontend.
            if (preItemId && target && target !== 'new') {
              const existing = db
                .prepare(`SELECT id, reference FROM orders WHERE id = ?`)
                .get(parseInt(target, 10));
              if (!existing) {
                const err = new Error(`Commande cible introuvable (ligne ${line.id})`);
                err.statusCode = 404;
                throw err;
              }
              // Renseigner source_* sur l'item déjà créé (s'ils n'avaient pas été envoyés).
              db.prepare(
                `UPDATE order_items SET source_requester_id = COALESCE(source_requester_id, ?), source_requester_name = COALESCE(source_requester_name, ?), source_affaire_id = COALESCE(source_affaire_id, ?), source_type = COALESCE(source_type, ?) WHERE id = ?`,
              ).run(
                request.requested_by,
                request.requested_by_name,
                request.affaire_id || null,
                request.affaire_id ? 'affaire' : 'personnel',
                preItemId,
              );
              updateLine.run(existing.id, preItemId, line.id);
              dispatched.push({
                line_id: line.id,
                article: line.article,
                order_id: existing.id,
                order_ref: existing.reference,
                isNew: true,
              });
              continue;
            }

            let chosenOrder = null;
            let createNew = false;
            let supplierIdForNew = requestSupplier.id;

            if (target === 'new' || target === undefined || target === null || target === '') {
              if (target === undefined) {
                // Comportement auto : chercher une commande draft/sent même fournisseur
                chosenOrder = db
                  .prepare(
                    `SELECT id, reference, supplier_id FROM orders WHERE supplier_id = ? AND status IN ('draft', 'sent') ORDER BY created_at DESC LIMIT 1`,
                  )
                  .get(requestSupplier.id);
              }
              if (!chosenOrder) createNew = true;
            } else {
              chosenOrder = db
                .prepare(`SELECT id, reference, supplier_id, status FROM orders WHERE id = ?`)
                .get(parseInt(target, 10));
              if (!chosenOrder) {
                const err = new Error(`Commande cible introuvable (ligne ${line.id})`);
                err.statusCode = 404;
                throw err;
              }
              if (!['draft', 'sent'].includes(chosenOrder.status)) {
                const err = new Error(
                  `Impossible d'ajouter à la commande ${chosenOrder.reference} (statut non modifiable)`,
                );
                err.statusCode = 400;
                throw err;
              }
            }

            let orderId;
            let orderRef;
            let isNew = false;

            if (createNew) {
              const cacheKey = `new:${supplierIdForNew}`;
              const cached = newOrders.get(cacheKey);
              if (cached) {
                orderId = cached.id;
                orderRef = cached.reference;
              } else {
                orderRef = computeNextRef();
                const or = db
                  .prepare(
                    `INSERT INTO orders (reference, type, supplier_id, status, order_date, total_ht, tva_rate, total_ttc, notes, created_by) VALUES (?, 'purchase', ?, 'draft', ?, 0, 20, 0, ?, ?)`,
                  )
                  .run(
                    orderRef,
                    supplierIdForNew,
                    new Date().toISOString().slice(0, 10),
                    `Commande groupée — demande matériel #${req.params.id}`,
                    req.user.id,
                  );
                orderId = or.lastInsertRowid;
                isNew = true;
                newOrders.set(cacheKey, { id: orderId, reference: orderRef });
              }
            } else {
              orderId = chosenOrder.id;
              orderRef = chosenOrder.reference;
            }

            const itemResult = insertOrderItem.run(
              orderId,
              line.article,
              line.quantity || 1,
              line.ref_code || null,
              request.requested_by,
              request.requested_by_name,
              request.affaire_id || null,
              request.affaire_id ? 'affaire' : 'personnel',
            );
            updateLine.run(orderId, itemResult.lastInsertRowid, line.id);

            dispatched.push({
              line_id: line.id,
              article: line.article,
              order_id: orderId,
              order_ref: orderRef,
              isNew,
            });
          }

          // Statut global : la demande est approuvée si toutes les lignes le sont.
          const stillPending = db
            .prepare(
              `SELECT COUNT(*) AS c FROM material_request_lines WHERE request_id = ? AND status = 'pending'`,
            )
            .get(req.params.id).c;
          const newStatus = stillPending === 0 ? 'approved' : 'pending';
          // order_id du request : 1ère commande dispatchée (rétrocompatible).
          const firstOrderId = dispatched[0]?.order_id || null;
          db.prepare(
            `UPDATE material_requests SET status = ?, order_id = COALESCE(?, order_id), approved_by = ?, approved_by_name = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          ).run(newStatus, firstOrderId, req.user.id, req.user.name, req.params.id);

          addToHistory(
            'material_request',
            req.params.id,
            'approve',
            JSON.stringify({ dispatched }),
            req.user.id,
            req.user.name,
          );

          return { dispatched, newOrders: Array.from(newOrders.values()) };
        });

        const result = dispatchTx();
        const updated = db
          .prepare('SELECT * FROM material_requests WHERE id = ?')
          .get(req.params.id);
        updated.lines = db
          .prepare(
            `SELECT id, request_id, article, ref_code, quantity, order_id, order_item_id, status FROM material_request_lines WHERE request_id = ? ORDER BY id ASC`,
          )
          .all(req.params.id);

        // Format compat : si une seule commande au final, exposer order={orderId,orderRef,isNew}
        const distinctOrders = [...new Set(result.dispatched.map((d) => d.order_id))];
        const compatOrder =
          distinctOrders.length === 1
            ? {
                orderId: result.dispatched[0].order_id,
                orderRef: result.dispatched[0].order_ref,
                isNew: result.dispatched[0].isNew,
              }
            : null;

        return res.json({
          success: true,
          request: updated,
          action: 'approved',
          dispatched: result.dispatched,
          order: compatOrder,
        });
      }

      return res
        .status(400)
        .json({ success: false, error: 'Action invalide — approve ou reject attendu' });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Validation en masse
  app.post('/api/material-requests/batch-validate', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { request_ids = [], action } = req.body;
      if (!request_ids.length)
        return res.status(400).json({ success: false, error: 'Aucune demande sélectionnée' });

      const results = [];
      for (const id of request_ids) {
        try {
          const request = db
            .prepare('SELECT * FROM material_requests WHERE id = ? AND status = ?')
            .get(id, 'pending');
          if (!request) {
            results.push({ id, status: 'skipped' });
            continue;
          }

          if (action === 'reject') {
            db.prepare(
              `UPDATE material_requests SET status = 'rejected', approved_by = ?, approved_by_name = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
            ).run(req.user.id, req.user.name, id);
            results.push({ id, status: 'rejected' });
          } else if (action === 'approve') {
            // Same distribution logic as single validate
            const supplierName = (request.supplier_name || 'DIVERS').trim().toUpperCase();
            let supplier = db
              .prepare('SELECT id FROM suppliers WHERE UPPER(name) = ?')
              .get(supplierName);
            if (!supplier) {
              const sr = db
                .prepare('INSERT INTO suppliers (name) VALUES (?)')
                .run(request.supplier_name || 'DIVERS');
              supplier = { id: sr.lastInsertRowid };
            }

            let orderId;
            const existingOrder = db
              .prepare(
                `SELECT id FROM orders WHERE supplier_id = ? AND status IN ('draft', 'sent') ORDER BY created_at DESC LIMIT 1`,
              )
              .get(supplier.id);
            if (existingOrder) {
              orderId = existingOrder.id;
            } else {
              const year = new Date().getFullYear();
              const last = db
                .prepare(
                  `SELECT reference FROM orders WHERE reference LIKE ? ORDER BY id DESC LIMIT 1`,
                )
                .get(`BC-${year}-%`);
              let num = 1;
              if (last) {
                const parts = last.reference.split('-');
                num = parseInt(parts[2] || '0', 10) + 1;
              }
              const ref = `BC-${year}-${String(num).padStart(3, '0')}`;
              const or = db
                .prepare(
                  `INSERT INTO orders (reference, type, supplier_id, status, order_date, total_ht, tva_rate, total_ttc, notes, created_by) VALUES (?, 'purchase', ?, 'draft', ?, 0, 20, 0, 'Commande groupée', ?)`,
                )
                .run(ref, supplier.id, new Date().toISOString().slice(0, 10), req.user.id);
              orderId = or.lastInsertRowid;
            }

            db.prepare(
              `INSERT INTO order_items (order_id, designation, quantity, unit, unit_price_ht, tva_rate, total_ht, ref_code, source_requester_id, source_requester_name, source_affaire_id, source_type) VALUES (?, ?, ?, 'u', 0, 20, 0, ?, ?, ?, ?, ?)`,
            ).run(
              orderId,
              request.article,
              request.quantity || 1,
              request.ref_code || null,
              request.requested_by,
              request.requested_by_name,
              request.affaire_id || null,
              request.affaire_id ? 'affaire' : 'personnel',
            );

            db.prepare(
              `UPDATE material_requests SET status = 'approved', order_id = ?, approved_by = ?, approved_by_name = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
            ).run(orderId, req.user.id, req.user.name, id);
            results.push({ id, status: 'approved', order_id: orderId });
          }
        } catch (err) {
          results.push({ id, status: 'error', message: err.message });
        }
      }
      res.json({ success: true, results });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Documents fournisseurs + Auto-validation réception + Alertes complétion
// ═══════════════════════════════════════════════════════════════
