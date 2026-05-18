// ═══════════════════════════════════════════════════════════════
// controlesPeriodiquesRoutes.js — API REST /api/controls/*
// ═══════════════════════════════════════════════════════════════
import db from './database.js';
import logger from './logger.js';
import {
  controlPerformSchema,
  controlTypeSchema,
  controlTypeUpdateSchema,
  equipmentControlCreateSchema,
  equipmentControlUpdateSchema,
  validate,
} from './schemas/controles.js';
import {
  addDays,
  computeStatus,
  getControlById,
  performControl,
  recomputeAllStatuses,
  STATUS,
  todayIso,
} from './services/controlesService.js';

function safe(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      const code = e.statusCode || 500;
      if (code >= 500) logger.error('Contrôles périodiques:', e);
      res.status(code).json({ success: false, error: e.message || 'Erreur serveur' });
    }
  };
}

function listControlsForEntity(entityType, entityId) {
  return db
    .prepare(
      `SELECT ec.*, ct.code AS type_code, ct.name AS type_name,
              ct.is_vehicle_specific, ct.missed_after_days,
              u.name AS assigned_name, u.email AS assigned_email
         FROM equipment_controls ec
         JOIN control_types ct ON ct.id = ec.control_type_id
    LEFT JOIN users u ON u.id = ec.assigned_to
        WHERE ec.entity_type = ? AND ec.entity_id = ? AND ec.is_active = 1
        ORDER BY ec.next_due_date ASC`,
    )
    .all(entityType, String(entityId));
}

export function setupControlesPeriodiquesRoutes(app, authenticateToken, requireAdmin) {
  // ───────────────────────────────────────────────
  // GET /api/controls/types — référentiel
  // ───────────────────────────────────────────────
  app.get(
    '/api/controls/types',
    authenticateToken,
    safe((req, res) => {
      const onlyActive = req.query.active !== 'false';
      const sql = `SELECT * FROM control_types ${onlyActive ? 'WHERE is_active = 1' : ''} ORDER BY name`;
      res.json({ success: true, data: db.prepare(sql).all() });
    }),
  );

  app.post(
    '/api/controls/types',
    authenticateToken,
    requireAdmin,
    validate(controlTypeSchema),
    safe((req, res) => {
      const b = req.body;
      const r = db
        .prepare(
          `INSERT INTO control_types
            (code, name, description, default_periodicity_days, missed_after_days,
             is_vehicle_specific, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          b.code,
          b.name,
          b.description || null,
          b.default_periodicity_days,
          b.missed_after_days,
          b.is_vehicle_specific,
          b.is_active,
        );
      res.json({
        success: true,
        data: db.prepare('SELECT * FROM control_types WHERE id = ?').get(r.lastInsertRowid),
      });
    }),
  );

  app.put(
    '/api/controls/types/:id',
    authenticateToken,
    requireAdmin,
    validate(controlTypeUpdateSchema),
    safe((req, res) => {
      const id = Number(req.params.id);
      const existing = db.prepare('SELECT * FROM control_types WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ success: false, error: 'Type introuvable' });
      const merged = { ...existing, ...req.body };
      db.prepare(
        `UPDATE control_types SET code=?, name=?, description=?, default_periodicity_days=?,
            missed_after_days=?, is_vehicle_specific=?, is_active=?, updated_at=CURRENT_TIMESTAMP
          WHERE id = ?`,
      ).run(
        merged.code,
        merged.name,
        merged.description,
        merged.default_periodicity_days,
        merged.missed_after_days,
        merged.is_vehicle_specific,
        merged.is_active,
        id,
      );
      res.json({
        success: true,
        data: db.prepare('SELECT * FROM control_types WHERE id = ?').get(id),
      });
    }),
  );

  app.delete(
    '/api/controls/types/:id',
    authenticateToken,
    requireAdmin,
    safe((req, res) => {
      const id = Number(req.params.id);
      // Soft : désactive si déjà utilisé
      const used = db
        .prepare('SELECT COUNT(*) AS n FROM equipment_controls WHERE control_type_id = ?')
        .get(id);
      if (used.n > 0) {
        db.prepare('UPDATE control_types SET is_active = 0 WHERE id = ?').run(id);
        return res.json({ success: true, soft: true });
      }
      db.prepare('DELETE FROM control_types WHERE id = ?').run(id);
      res.json({ success: true });
    }),
  );

  // ───────────────────────────────────────────────
  // GET /api/controls/equipment/:entityType/:entityId
  // ───────────────────────────────────────────────
  app.get(
    '/api/controls/equipment/:entityType/:entityId',
    authenticateToken,
    safe((req, res) => {
      const { entityType, entityId } = req.params;
      if (!['vehicle', 'equipment'].includes(entityType)) {
        return res.status(400).json({ success: false, error: 'entity_type invalide' });
      }
      res.json({ success: true, data: listControlsForEntity(entityType, entityId) });
    }),
  );

  // ───────────────────────────────────────────────
  // POST /api/controls — créer un contrôle planifié
  // ───────────────────────────────────────────────
  app.post(
    '/api/controls',
    authenticateToken,
    validate(equipmentControlCreateSchema),
    safe((req, res) => {
      const b = req.body;
      const type = db
        .prepare(
          'SELECT default_periodicity_days FROM control_types WHERE id = ? AND is_active = 1',
        )
        .get(b.control_type_id);
      if (!type)
        return res.status(400).json({ success: false, error: 'Type de contrôle invalide' });
      const periodicity = b.periodicity_days || type.default_periodicity_days;
      const r = db
        .prepare(
          `INSERT INTO equipment_controls
            (entity_type, entity_id, control_type_id, periodicity_days,
             next_due_date, last_done_date, status, assigned_to, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 'A_FAIRE', ?, ?, ?)`,
        )
        .run(
          b.entity_type,
          String(b.entity_id),
          b.control_type_id,
          periodicity,
          b.next_due_date,
          b.last_done_date || null,
          b.assigned_to || null,
          b.notes || null,
          req.user?.id || null,
        );
      res.status(201).json({ success: true, data: getControlById(db, r.lastInsertRowid) });
    }),
  );

  // ───────────────────────────────────────────────
  // PUT /api/controls/:id
  // ───────────────────────────────────────────────
  app.put(
    '/api/controls/:id',
    authenticateToken,
    validate(equipmentControlUpdateSchema),
    safe((req, res) => {
      const id = Number(req.params.id);
      const existing = getControlById(db, id);
      if (!existing) return res.status(404).json({ success: false, error: 'Contrôle introuvable' });
      const m = { ...existing, ...req.body };
      db.prepare(
        `UPDATE equipment_controls
            SET control_type_id=?, periodicity_days=?, next_due_date=?,
                last_done_date=?, assigned_to=?, notes=?, is_active=?,
                updated_at=CURRENT_TIMESTAMP
          WHERE id = ?`,
      ).run(
        m.control_type_id,
        m.periodicity_days,
        m.next_due_date,
        m.last_done_date,
        m.assigned_to,
        m.notes,
        m.is_active,
        id,
      );
      // Recalcul status après update
      const updated = getControlById(db, id);
      const status = computeStatus(updated);
      if (status !== updated.status) {
        db.prepare('UPDATE equipment_controls SET status = ? WHERE id = ?').run(status, id);
      }
      res.json({ success: true, data: getControlById(db, id) });
    }),
  );

  // ───────────────────────────────────────────────
  // DELETE /api/controls/:id  → soft delete
  // ───────────────────────────────────────────────
  app.delete(
    '/api/controls/:id',
    authenticateToken,
    requireAdmin,
    safe((req, res) => {
      const id = Number(req.params.id);
      db.prepare(
        'UPDATE equipment_controls SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).run(id);
      res.json({ success: true });
    }),
  );

  // ───────────────────────────────────────────────
  // POST /api/controls/perform/:id  → effectuer un contrôle
  // ───────────────────────────────────────────────
  app.post(
    '/api/controls/perform/:id',
    authenticateToken,
    validate(controlPerformSchema),
    safe((req, res) => {
      const id = Number(req.params.id);
      const data = performControl(db, id, req.body, req.user?.id || null);
      res.json({ success: true, data });
    }),
  );

  // ───────────────────────────────────────────────
  // GET /api/controls/history/:controlId
  // ───────────────────────────────────────────────
  app.get(
    '/api/controls/history/:controlId',
    authenticateToken,
    safe((req, res) => {
      const id = Number(req.params.controlId);
      const rows = db
        .prepare(
          `SELECT h.*, u.name AS performed_by_name
             FROM control_history h
        LEFT JOIN users u ON u.id = h.performed_by
            WHERE h.equipment_control_id = ?
            ORDER BY h.performed_at DESC, h.id DESC`,
        )
        .all(id);
      // Décoder documents JSON
      for (const r of rows) {
        if (r.documents) {
          try {
            r.documents = JSON.parse(r.documents);
          } catch {
            r.documents = [];
          }
        }
      }
      res.json({ success: true, data: rows });
    }),
  );

  // ───────────────────────────────────────────────
  // GET /api/controls/dashboard
  //   query : ?status=...&assigned_to=...&entity_type=...&type_id=...
  //   retourne stats + list groupées par statut
  // ───────────────────────────────────────────────
  app.get(
    '/api/controls/dashboard',
    authenticateToken,
    safe((req, res) => {
      const { status, assigned_to, entity_type, type_id } = req.query;
      const where = ['ec.is_active = 1'];
      const params = [];
      if (status) {
        where.push('ec.status = ?');
        params.push(status);
      }
      if (assigned_to) {
        where.push('ec.assigned_to = ?');
        params.push(Number(assigned_to));
      }
      if (entity_type) {
        where.push('ec.entity_type = ?');
        params.push(entity_type);
      }
      if (type_id) {
        where.push('ec.control_type_id = ?');
        params.push(Number(type_id));
      }
      const sql = `
        SELECT ec.*, ct.code AS type_code, ct.name AS type_name,
               ct.is_vehicle_specific, ct.missed_after_days,
               u.name AS assigned_name, u.email AS assigned_email,
               CASE
                 WHEN ec.entity_type='vehicle'  THEN v.name
                 WHEN ec.entity_type='equipment' THEN e.name
               END AS entity_name,
               CASE
                 WHEN ec.entity_type='equipment' THEN e.uid
                 ELSE NULL
               END AS entity_uid
          FROM equipment_controls ec
          JOIN control_types ct ON ct.id = ec.control_type_id
     LEFT JOIN users u  ON u.id = ec.assigned_to
     LEFT JOIN vehicles v  ON ec.entity_type='vehicle'  AND v.id  = ec.entity_id
     LEFT JOIN equipment e ON ec.entity_type='equipment' AND CAST(e.id AS TEXT) = ec.entity_id
         WHERE ${where.join(' AND ')}
         ORDER BY ec.next_due_date ASC
      `;
      const rows = db.prepare(sql).all(...params);

      const today = todayIso();
      const stats = {
        total: rows.length,
        a_faire: 0,
        en_retard: 0,
        manque: 0,
        within_30: 0,
        within_7: 0,
      };
      for (const r of rows) {
        if (r.status === STATUS.A_FAIRE) stats.a_faire++;
        if (r.status === STATUS.EN_RETARD) stats.en_retard++;
        if (r.status === STATUS.MANQUE) stats.manque++;
        if (r.next_due_date && r.next_due_date >= today) {
          const days = Math.round(
            (new Date(`${r.next_due_date}T00:00:00Z`).getTime() -
              new Date(`${today}T00:00:00Z`).getTime()) /
              86400000,
          );
          if (days <= 30) stats.within_30++;
          if (days <= 7) stats.within_7++;
        }
      }
      res.json({ success: true, data: rows, stats });
    }),
  );

  // ───────────────────────────────────────────────
  // POST /api/controls/recompute  (admin) — relance le calcul de status
  // ───────────────────────────────────────────────
  app.post(
    '/api/controls/recompute',
    authenticateToken,
    requireAdmin,
    safe((_req, res) => {
      const r = recomputeAllStatuses(db);
      res.json({ success: true, ...r });
    }),
  );
}

// expose pour usage interne (scheduler / migrations)
export { addDays };
