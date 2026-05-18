// ═══════════════════════════════════════════════════════════════
// Module Planning — Routes API
// Affichage dynamique + Import BL + Planification des tâches
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

import { cacheMiddleware, icalCache, listCache, statsCache } from './cache.js';
import db from './database.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  assignPersonSchema,
  dateBodySchema,
  displayEventCreateSchema,
  displayEventUpdateSchema,
  fromDateBodySchema,
  icalCalendarCreateSchema,
  icalCalendarUpdateSchema,
  planningAssignmentSchema,
  recurringTaskCreateSchema,
  recurringTaskUpdateSchema,
} from './schemas/planning.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { setupBLImportRoutes } from './planning/blImportRoutes.js';
import { setupTaskRoutes } from './planning/taskRoutes.js';

// ═══════════════════════════════════════════════
// VALIDATION — Dates & Heures
// ═══════════════════════════════════════════════

const DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

// S3-1/S3-2 — Singleton timer du cron rollover (clearable au shutdown).
let rolloverCronTimer = null;

export function stopPlanningRolloverCron() {
  if (rolloverCronTimer) {
    clearInterval(rolloverCronTimer);
    rolloverCronTimer = null;
  }
}

function isValidDate(str) {
  return typeof str === 'string' && DATE_RE.test(str);
}

function isValidTime(str) {
  return typeof str === 'string' && TIME_RE.test(str);
}

// ═══════════════════════════════════════════════
// AFFICHAGE DYNAMIQUE — CRUD
// ═══════════════════════════════════════════════

export function setupPlanningRoutes(app, authenticateToken, _requireAdmin) {
  // ─── GET /api/planning/display-events ───
  // Liste avec filtres optionnels : date, dateFrom, dateTo, type, category, affaire_id
  // Enrichit chaque événement avec nom/client de l'affaire liée (LEFT JOIN)
  app.get('/api/planning/display-events', authenticateToken, (req, res) => {
    try {
      let query = `SELECT dde.*, a.nom AS affaire_nom, a.client AS affaire_client, a.type AS affaire_type,
        p.first_name AS assigned_person_first_name, p.last_name AS assigned_person_last_name
        FROM dynamic_display_events dde
        LEFT JOIN affaires a ON dde.affaire_id = a.numero_affaire
        LEFT JOIN persons p ON p.id = dde.assigned_person_id
        WHERE 1=1`;
      const params = [];

      if (req.query.date) {
        query += ' AND dde.date = ?';
        params.push(req.query.date);
      }
      if (req.query.dateFrom) {
        query += ' AND dde.date >= ?';
        params.push(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        query += ' AND dde.date <= ?';
        params.push(req.query.dateTo);
      }
      if (req.query.type) {
        query += ' AND dde.type = ?';
        params.push(req.query.type);
      }
      if (req.query.category) {
        query += ' AND dde.category = ?';
        params.push(req.query.category);
      }
      if (req.query.affaire_id) {
        query += ' AND dde.affaire_id = ?';
        params.push(req.query.affaire_id);
      }

      query += ' ORDER BY dde.date DESC, dde.created_at DESC';

      const events = db.prepare(query).all(...params);
      res.json(events);
    } catch (error) {
      logger.error('GET /api/planning/display-events error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/planning/display-events/:id ───
  app.get('/api/planning/display-events/:id', authenticateToken, (req, res) => {
    try {
      const event = db
        .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
        .get(req.params.id);
      if (!event) return res.status(404).json({ success: false, error: 'Événement non trouvé' });
      res.json(event);
    } catch (error) {
      logger.error('GET /api/planning/display-events/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/planning/display-events ───
  app.post(
    '/api/planning/display-events',
    authenticateToken,
    validate(displayEventCreateSchema),
    (req, res) => {
      try {
        const {
          affaire_id,
          bl_import_id,
          type,
          category,
          date,
          period,
          time,
          comment,
          client,
          location,
        } = req.body;

        if (!type || !category || !date) {
          return res
            .status(400)
            .json({ success: false, error: 'Champs obligatoires : type, category, date' });
        }
        if (!isValidDate(date)) {
          return res
            .status(400)
            .json({ success: false, error: 'Format date invalide (attendu YYYY-MM-DD)' });
        }
        if (time && !isValidTime(time)) {
          return res
            .status(400)
            .json({ success: false, error: 'Format heure invalide (attendu HH:mm)' });
        }

        const id = crypto.randomUUID().replace(/-/g, '');

        const stmt = db.prepare(`
        INSERT INTO dynamic_display_events (id, affaire_id, bl_import_id, type, category, date, period, time, comment, client, location, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

        stmt.run(
          id,
          affaire_id || null,
          bl_import_id || null,
          type,
          category,
          date,
          period || null,
          time || null,
          comment || '',
          client || '',
          location || '',
          req.user.id,
        );

        const created = db.prepare('SELECT * FROM dynamic_display_events WHERE id = ?').get(id);
        res.status(201).json(created);
      } catch (error) {
        logger.error('POST /api/planning/display-events error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── PUT /api/planning/display-events/:id ───
  app.put(
    '/api/planning/display-events/:id',
    authenticateToken,
    validate(displayEventUpdateSchema),
    (req, res) => {
      try {
        const existing = db
          .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
          .get(req.params.id);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Événement non trouvé' });

        const {
          affaire_id,
          bl_import_id,
          type,
          category,
          date,
          period,
          time,
          comment,
          client,
          location,
          visible,
        } = req.body;

        if (date && !isValidDate(date)) {
          return res
            .status(400)
            .json({ success: false, error: 'Format date invalide (attendu YYYY-MM-DD)' });
        }
        if (time && !isValidTime(time)) {
          return res
            .status(400)
            .json({ success: false, error: 'Format heure invalide (attendu HH:mm)' });
        }

        const stmt = db.prepare(`
        UPDATE dynamic_display_events
        SET affaire_id = ?, bl_import_id = ?, type = ?, category = ?, date = ?, period = ?, time = ?, comment = ?, client = ?, location = ?, visible = ?, modified_by = ?, modified_at = datetime('now')
        WHERE id = ?
      `);

        stmt.run(
          affaire_id ?? existing.affaire_id,
          bl_import_id ?? existing.bl_import_id,
          type || existing.type,
          category || existing.category,
          date || existing.date,
          period !== undefined ? period : existing.period,
          time !== undefined ? time : existing.time,
          comment !== undefined ? comment : existing.comment,
          client !== undefined ? client : existing.client,
          location !== undefined ? location : existing.location,
          visible !== undefined ? (visible ? 1 : 0) : (existing.visible ?? 1),
          req.user.id,
          req.params.id,
        );

        const updated = db
          .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
          .get(req.params.id);
        res.json(updated);
      } catch (error) {
        logger.error('PUT /api/planning/display-events/:id error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── DELETE /api/planning/display-events/:id ───
  app.delete('/api/planning/display-events/:id', authenticateToken, (req, res) => {
    try {
      const existing = db
        .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
        .get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Événement non trouvé' });

      db.prepare('DELETE FROM dynamic_display_events WHERE id = ?').run(req.params.id);
      res.json({ success: true, message: 'Événement supprimé' });
    } catch (error) {
      logger.error('DELETE /api/planning/display-events/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ── Sous-modules extraits (Sprint 2) ──
  setupBLImportRoutes(app, authenticateToken);
  setupTaskRoutes(app, authenticateToken);
  // ═══════════════════════════════════════════════
  // STATS — Résumé pour le tableau de bord
  // ═══════════════════════════════════════════════

  // ─── GET /api/planning/stats ─── [PERF] Cache 20s
  app.get(
    '/api/planning/stats',
    authenticateToken,
    cacheMiddleware(statsCache, () => 'comm-stats', 20_000),
    (req, res) => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        const displayEventsToday = db
          .prepare('SELECT COUNT(*) as count FROM dynamic_display_events WHERE date = ?')
          .get(today);

        const displayEventsTotal = db
          .prepare('SELECT COUNT(*) as count FROM dynamic_display_events')
          .get();

        const tasksToday = db
          .prepare(
            'SELECT COUNT(*) as count FROM task_assignments WHERE date = ? AND deleted_at IS NULL',
          )
          .get(today);

        const tasksPending = db
          .prepare(
            "SELECT COUNT(*) as count FROM task_assignments WHERE status = 'pending' AND deleted_at IS NULL",
          )
          .get();

        const blImportsTotal = db.prepare('SELECT COUNT(*) as count FROM bl_imports').get();

        const displayByType = db
          .prepare(
            `
        SELECT type, COUNT(*) as count 
        FROM dynamic_display_events 
        WHERE date >= ? 
        GROUP BY type 
        ORDER BY count DESC
      `,
          )
          .all(today);

        res.json({
          displayEventsToday: displayEventsToday.count,
          displayEventsTotal: displayEventsTotal.count,
          tasksToday: tasksToday.count,
          tasksPending: tasksPending.count,
          blImportsTotal: blImportsTotal.count,
          displayByType,
        });
      } catch (error) {
        logger.error('GET /api/planning/stats error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // AFFAIRES POUR PLANNING — Filtrage par date
  // ═══════════════════════════════════════════════

  // ─── GET /api/planning/planning-affaires ─── [PERF] Cache 15s par clé date
  // Retourne les affaires actives pour une date ou plage de dates
  // Inclut les affaires dont des display_events/tâches/BL existent à la date demandée
  // Les affaires masquées (planning_hidden_affaires) sont incluses avec hidden=true
  // pour permettre la résolution nom/client dans les display events
  app.get(
    '/api/planning/planning-affaires',
    authenticateToken,
    cacheMiddleware(
      listCache,
      (req) =>
        `planning-affaires-${req.query.date || ''}-${req.query.dateFrom || ''}-${req.query.dateTo || ''}`,
      15_000,
    ),
    (req, res) => {
      try {
        const { date, dateFrom, dateTo } = req.query;

        let query, params;

        if (date) {
          // Affaires dont la période couvre cette date OU qui ont des événements/tâches/BL à cette date
          query = `
          SELECT DISTINCT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count,
            (SELECT COUNT(*) FROM task_assignments WHERE affaire_num = a.numero_affaire AND deleted_at IS NULL) as task_count
          FROM affaires a
          WHERE (
            (a.date_debut <= ? AND (a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?))
            OR EXISTS (SELECT 1 FROM dynamic_display_events WHERE affaire_id = a.numero_affaire AND date = ?)
            OR EXISTS (SELECT 1 FROM task_assignments WHERE affaire_num = a.numero_affaire AND date = ? AND deleted_at IS NULL)
          )
          AND (
            EXISTS (SELECT 1 FROM bl_imports WHERE affaire_id = a.numero_affaire)
            OR EXISTS (SELECT 1 FROM dynamic_display_events WHERE affaire_id = a.numero_affaire)
            OR EXISTS (SELECT 1 FROM task_assignments WHERE affaire_num = a.numero_affaire AND deleted_at IS NULL)
          )
          ORDER BY a.type, a.date_debut
        `;
          params = [date, date, date, date];
        } else if (dateFrom && dateTo) {
          // Affaires dont la période chevauche la plage OU qui ont des événements/tâches dans la plage
          query = `
          SELECT DISTINCT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count,
            (SELECT COUNT(*) FROM task_assignments WHERE affaire_num = a.numero_affaire AND deleted_at IS NULL) as task_count
          FROM affaires a
          WHERE (
            (a.date_debut <= ? AND (a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?))
            OR EXISTS (SELECT 1 FROM dynamic_display_events WHERE affaire_id = a.numero_affaire AND date >= ? AND date <= ?)
            OR EXISTS (SELECT 1 FROM task_assignments WHERE affaire_num = a.numero_affaire AND date >= ? AND date <= ? AND deleted_at IS NULL)
          )
          AND (
            EXISTS (SELECT 1 FROM bl_imports WHERE affaire_id = a.numero_affaire)
            OR EXISTS (SELECT 1 FROM dynamic_display_events WHERE affaire_id = a.numero_affaire)
            OR EXISTS (SELECT 1 FROM task_assignments WHERE affaire_num = a.numero_affaire AND deleted_at IS NULL)
          )
          ORDER BY a.type, a.date_debut
        `;
          params = [dateTo, dateFrom, dateFrom, dateTo, dateFrom, dateTo];
        } else {
          // Sans filtre de date : toutes les affaires actives (non archivées) avec activité
          const today = new Date().toISOString().slice(0, 10);
          query = `
          SELECT a.*, 
            (SELECT COUNT(*) FROM bl_imports WHERE affaire_id = a.numero_affaire) as bl_count,
            (SELECT COUNT(*) FROM dynamic_display_events WHERE affaire_id = a.numero_affaire) as events_count,
            (SELECT COUNT(*) FROM task_assignments WHERE affaire_num = a.numero_affaire AND deleted_at IS NULL) as task_count
          FROM affaires a
          WHERE (a.date_fin IS NULL OR a.date_fin = '' OR a.date_fin >= ?)
            AND (
              EXISTS (SELECT 1 FROM bl_imports WHERE affaire_id = a.numero_affaire)
              OR EXISTS (SELECT 1 FROM dynamic_display_events WHERE affaire_id = a.numero_affaire)
              OR EXISTS (SELECT 1 FROM task_assignments WHERE affaire_num = a.numero_affaire AND deleted_at IS NULL)
            )
          ORDER BY a.type, a.date_debut
        `;
          params = [today];
        }

        const affaires = db.prepare(query).all(...params);

        // Marquer les affaires masquées de la planification (au lieu de les exclure)
        // Elles restent disponibles pour la résolution nom/client dans les display events
        const hiddenSet = new Set(
          db
            .prepare('SELECT numero_affaire FROM planning_hidden_affaires')
            .all()
            .map((r) => r.numero_affaire),
        );
        // Récupérer les statuts de traitement des affaires
        const statusMap = new Map(
          db
            .prepare('SELECT numero_affaire, status FROM planning_affaire_status')
            .all()
            .map((r) => [r.numero_affaire, r.status]),
        );
        const result = affaires.map((a) => ({
          ...a,
          planning_hidden: hiddenSet.has(a.numero_affaire) ? 1 : 0,
          planning_status: statusMap.get(a.numero_affaire) || 'pending',
        }));

        res.json(result);
      } catch (error) {
        logger.error('GET /api/planning/planning-affaires error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── PATCH /api/planning/planning-affaires/:num/cycle-status ───
  // Basculer le statut de traitement d'une affaire (pending → in_progress → done → pending)
  app.patch('/api/planning/planning-affaires/:num/cycle-status', authenticateToken, (req, res) => {
    try {
      const num = req.params.num;
      const existing = db
        .prepare('SELECT status FROM planning_affaire_status WHERE numero_affaire = ?')
        .get(num);
      const currentStatus = existing?.status || 'pending';
      const nextStatus = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
      const newStatus = nextStatus[currentStatus] || 'pending';
      db.prepare(
        `INSERT INTO planning_affaire_status (numero_affaire, status, updated_at) VALUES (?, ?, datetime('now'))
        ON CONFLICT(numero_affaire) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
      ).run(num, newStatus);
      res.json({ numero_affaire: num, status: newStatus });
    } catch (error) {
      logger.error('PATCH /api/planning/planning-affaires/:num/cycle-status error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/planning/planning-events/:type/:id/cycle-status ───
  // Basculer le statut d'un événement planning (google_event, ical_event, rdv)
  app.patch(
    '/api/planning/planning-events/:type/:id/cycle-status',
    authenticateToken,
    (req, res) => {
      try {
        const { type, id } = req.params;
        const validTypes = ['google_event', 'ical_event', 'rdv'];
        if (!validTypes.includes(type))
          return res.status(400).json({ success: false, error: 'Type invalide' });
        const existing = db
          .prepare('SELECT status FROM planning_event_status WHERE event_type = ? AND event_id = ?')
          .get(type, id);
        const currentStatus = existing?.status || 'pending';
        const nextStatus = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
        const newStatus = nextStatus[currentStatus] || 'pending';
        db.prepare(
          `INSERT INTO planning_event_status (event_type, event_id, status, updated_at) VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(event_type, event_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
        ).run(type, id, newStatus);
        res.json({ event_type: type, event_id: id, status: newStatus });
      } catch (error) {
        logger.error('PATCH /api/planning/planning-events/:type/:id/cycle-status error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/planning/planning-event-statuses ───
  // Récupérer tous les statuts d'événements planning
  app.get('/api/planning/planning-event-statuses', authenticateToken, (req, res) => {
    try {
      const rows = db
        .prepare('SELECT event_type, event_id, status FROM planning_event_status WHERE status != ?')
        .all('pending');
      res.json(rows);
    } catch (error) {
      logger.error('GET /api/planning/planning-event-statuses error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/planning/planning-hidden-affaires/:id ───
  // Masquer une affaire de la planification
  app.post('/api/planning/planning-hidden-affaires/:id', authenticateToken, (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('INSERT OR IGNORE INTO planning_hidden_affaires (numero_affaire) VALUES (?)').run(
        id,
      );
      res.json({ success: true, hidden: id });
    } catch (error) {
      logger.error('POST /api/planning/planning-hidden-affaires error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── DELETE /api/planning/planning-hidden-affaires/:id ───
  // Réafficher une affaire dans la planification
  app.delete('/api/planning/planning-hidden-affaires/:id', authenticateToken, (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM planning_hidden_affaires WHERE numero_affaire = ?').run(id);
      res.json({ success: true, unhidden: id });
    } catch (error) {
      logger.error('DELETE /api/planning/planning-hidden-affaires error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/planning/tasks/:id/toggle-visible ───
  // Basculer la visibilité d'une tâche (affichage écran dynamique)
  app.patch('/api/planning/tasks/:id/toggle-visible', authenticateToken, (req, res) => {
    try {
      const task = db
        .prepare('SELECT * FROM task_assignments WHERE id = ? AND deleted_at IS NULL')
        .get(req.params.id);
      if (!task) return res.status(404).json({ success: false, error: 'Tâche non trouvée' });

      const newVisible = task.visible === 0 ? 1 : 0;
      db.prepare(
        "UPDATE task_assignments SET visible = ?, modified_by = ?, modified_at = datetime('now') WHERE id = ?",
      ).run(newVisible, req.user.id, req.params.id);

      const updated = db
        .prepare(
          `
        SELECT ta.*, p.first_name AS person_first_name, p.last_name AS person_last_name
        FROM task_assignments ta
        LEFT JOIN persons p ON ta.person_id = p.id
        WHERE ta.id = ?
      `,
        )
        .get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('PATCH /api/planning/tasks/:id/toggle-visible error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/planning/display-events/:id/toggle-visible ───
  // Basculer la visibilité d'un événement d'affichage
  app.patch('/api/planning/display-events/:id/toggle-visible', authenticateToken, (req, res) => {
    try {
      const event = db
        .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
        .get(req.params.id);
      if (!event) return res.status(404).json({ success: false, error: 'Événement non trouvé' });

      const newVisible = event.visible === 0 ? 1 : 0;
      db.prepare(
        "UPDATE dynamic_display_events SET visible = ?, modified_by = ?, modified_at = datetime('now') WHERE id = ?",
      ).run(newVisible, req.user.id, req.params.id);

      const updated = db
        .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
        .get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('PATCH /api/planning/display-events/:id/toggle-visible error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/planning/display-events/:id/cycle-status ───
  // Basculer le statut d'un événement d'affichage (pending → in_progress → done → pending)
  app.patch('/api/planning/display-events/:id/cycle-status', authenticateToken, (req, res) => {
    try {
      const event = db
        .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
        .get(req.params.id);
      if (!event) return res.status(404).json({ success: false, error: 'Événement non trouvé' });

      const nextStatus = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
      const newStatus = nextStatus[event.status] || 'pending';
      db.prepare(
        "UPDATE dynamic_display_events SET status = ?, modified_by = ?, modified_at = datetime('now') WHERE id = ?",
      ).run(newStatus, req.user.id, req.params.id);

      const updated = db
        .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
        .get(req.params.id);
      res.json(updated);
    } catch (error) {
      logger.error('PATCH /api/planning/display-events/:id/cycle-status error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/planning/display-events/:id/assign ───
  // Affecter un personnel à un événement d'affichage
  app.put(
    '/api/planning/display-events/:id/assign',
    authenticateToken,
    validate(assignPersonSchema),
    (req, res) => {
      try {
        const { person_id } = req.body;
        const event = db
          .prepare('SELECT * FROM dynamic_display_events WHERE id = ?')
          .get(req.params.id);
        if (!event) return res.status(404).json({ success: false, error: 'Événement non trouvé' });

        db.prepare('UPDATE dynamic_display_events SET assigned_person_id = ? WHERE id = ?').run(
          person_id || null,
          req.params.id,
        );

        const updated = db
          .prepare(
            `
        SELECT de.*, p.first_name as assigned_person_first_name, p.last_name as assigned_person_last_name
        FROM dynamic_display_events de
        LEFT JOIN persons p ON p.id = de.assigned_person_id
        WHERE de.id = ?
      `,
          )
          .get(req.params.id);

        res.json(updated);
      } catch (error) {
        logger.error('PUT /api/planning/display-events/:id/assign error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════
  // ──────── TÂCHES RÉCURRENTES ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════

  // GET /api/planning/recurring-tasks
  app.get('/api/planning/recurring-tasks', authenticateToken, (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM recurring_tasks ORDER BY created_at DESC').all();
      res.json({ recurringTasks: rows });
    } catch (error) {
      logger.error('GET /api/planning/recurring-tasks error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/planning/recurring-tasks
  app.post(
    '/api/planning/recurring-tasks',
    authenticateToken,
    validate(recurringTaskCreateSchema),
    (req, res) => {
      try {
        const { title, section, time, period, recurrence, day_of_week, day_of_month, notes } =
          req.body;
        const id = crypto.randomUUID().replace(/-/g, '');
        db.prepare(
          `
        INSERT INTO recurring_tasks (id, title, section, time, period, recurrence, day_of_week, day_of_month, notes, active, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
      `,
        ).run(
          id,
          title.trim(),
          section || 'manual',
          time || null,
          period || null,
          recurrence || 'daily',
          day_of_week ?? null,
          day_of_month ?? null,
          notes || '',
          req.user.id,
        );
        const created = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(id);
        res.status(201).json(created);
      } catch (error) {
        logger.error('POST /api/planning/recurring-tasks error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // PUT /api/planning/recurring-tasks/:id
  app.put(
    '/api/planning/recurring-tasks/:id',
    authenticateToken,
    validate(recurringTaskUpdateSchema),
    (req, res) => {
      try {
        const {
          title,
          section,
          time,
          period,
          recurrence,
          day_of_week,
          day_of_month,
          notes,
          active,
        } = req.body;
        db.prepare(
          `
        UPDATE recurring_tasks SET title = ?, section = ?, time = ?, period = ?, recurrence = ?, day_of_week = ?, day_of_month = ?, notes = ?, active = ?
        WHERE id = ?
      `,
        ).run(
          title,
          section || 'manual',
          time || null,
          period || null,
          recurrence || 'daily',
          day_of_week ?? null,
          day_of_month ?? null,
          notes || '',
          active ?? 1,
          req.params.id,
        );
        const updated = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(req.params.id);
        if (!updated)
          return res.status(404).json({ success: false, error: 'Tâche récurrente introuvable' });
        res.json(updated);
      } catch (error) {
        logger.error('PUT /api/planning/recurring-tasks/:id error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // DELETE /api/planning/recurring-tasks/:id
  app.delete('/api/planning/recurring-tasks/:id', authenticateToken, (req, res) => {
    try {
      const result = db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(req.params.id);
      if (result.changes === 0)
        return res.status(404).json({ success: false, error: 'Introuvable' });
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/planning/recurring-tasks error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/planning/recurring-tasks/generate
  // Génère les tâches récurrentes pour une date donnée
  app.post(
    '/api/planning/recurring-tasks/generate',
    authenticateToken,
    validate(dateBodySchema),
    (req, res) => {
      try {
        const { date } = req.body;
        const count = generateRecurringTasks(date);
        res.json({ generated: count });
      } catch (error) {
        logger.error('POST /api/planning/recurring-tasks/generate error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // POST /api/planning/tasks/clear-completed
  // Soft-delete toutes les tâches terminées d'une date donnée
  app.post(
    '/api/planning/tasks/clear-completed',
    authenticateToken,
    validate(dateBodySchema),
    (req, res) => {
      try {
        const { date } = req.body;
        const result = db
          .prepare(
            `
        UPDATE task_assignments
        SET deleted_at = datetime('now'), modified_by = ?, modified_at = datetime('now')
        WHERE date = ? AND status = 'done' AND deleted_at IS NULL
      `,
          )
          .run(req.user.id, date);
        // Aussi nettoyer display_completed_events associés
        db.prepare(
          `
        DELETE FROM display_completed_events
        WHERE event_id IN (
          SELECT id FROM task_assignments WHERE date = ? AND status = 'done'
        )
      `,
        ).run(date);
        res.json({ cleared: result.changes });
      } catch (error) {
        logger.error('POST /api/planning/tasks/clear-completed error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // POST /api/planning/tasks/rollover
  // Reporter les tâches non terminées au lendemain
  app.post(
    '/api/planning/tasks/rollover',
    authenticateToken,
    validate(fromDateBodySchema),
    (req, res) => {
      try {
        const { fromDate } = req.body;
        const count = rolloverPendingTasks(fromDate);
        res.json({ rolled: count });
      } catch (error) {
        logger.error('POST /api/planning/tasks/rollover error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ═══════════════════════════════════════════════════════
  // iCal Calendars — CRUD + synchronisation
  // ═══════════════════════════════════════════════════════

  // GET /api/planning/ical-calendars
  app.get('/api/planning/ical-calendars', authenticateToken, (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM ical_calendars ORDER BY name ASC').all();
      res.json({ calendars: rows });
    } catch (error) {
      logger.error('GET ical-calendars error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/planning/ical-calendars
  app.post(
    '/api/planning/ical-calendars',
    authenticateToken,
    validate(icalCalendarCreateSchema),
    (req, res) => {
      try {
        const { name, url, color } = req.body;
        const id = crypto.randomUUID().replace(/-/g, '');
        db.prepare('INSERT INTO ical_calendars (id, name, url, color) VALUES (?, ?, ?, ?)').run(
          id,
          name.trim(),
          url.trim(),
          color || '#3b82f6',
        );
        const created = db.prepare('SELECT * FROM ical_calendars WHERE id = ?').get(id);
        res.status(201).json(created);
      } catch (error) {
        logger.error('POST ical-calendars error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // PUT /api/planning/ical-calendars/:id
  app.put(
    '/api/planning/ical-calendars/:id',
    authenticateToken,
    validate(icalCalendarUpdateSchema),
    (req, res) => {
      try {
        const { name, url, color, enabled } = req.body;
        db.prepare(
          'UPDATE ical_calendars SET name = ?, url = ?, color = ?, enabled = ? WHERE id = ?',
        ).run(name, url, color || '#3b82f6', enabled ?? 1, req.params.id);
        const updated = db.prepare('SELECT * FROM ical_calendars WHERE id = ?').get(req.params.id);
        if (!updated)
          return res.status(404).json({ success: false, error: 'Calendrier introuvable' });
        res.json(updated);
      } catch (error) {
        logger.error('PUT ical-calendars error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // DELETE /api/planning/ical-calendars/:id
  app.delete('/api/planning/ical-calendars/:id', authenticateToken, (req, res) => {
    try {
      const result = db.prepare('DELETE FROM ical_calendars WHERE id = ?').run(req.params.id);
      if (result.changes === 0)
        return res.status(404).json({ success: false, error: 'Introuvable' });
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE ical-calendars error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // GET /api/planning/ical-events — récupère les événements iCal dans une plage de dates [PERF] Cache 5min
  app.get(
    '/api/planning/ical-events',
    authenticateToken,
    cacheMiddleware(
      icalCache,
      (req) => `ical-${req.query.dateFrom}-${req.query.dateTo}`,
      5 * 60_000,
    ),
    async (req, res) => {
      try {
        const { dateFrom, dateTo } = req.query;
        if (!dateFrom || !dateTo)
          return res.status(400).json({ success: false, error: 'dateFrom et dateTo requis' });

        const calendars = db.prepare('SELECT * FROM ical_calendars WHERE enabled = 1').all();
        const allEvents = [];
        const syncErrors = [];

        for (const cal of calendars) {
          try {
            const response = await fetch(cal.url, { signal: AbortSignal.timeout(10000) });
            if (!response.ok) {
              const msg = `${cal.name}: HTTP ${response.status}`;
              logger.warn(`iCal fetch failed — ${msg}`);
              syncErrors.push(msg);
              db.prepare('UPDATE ical_calendars SET last_sync_error = ? WHERE id = ?').run(
                `HTTP ${response.status}`,
                cal.id,
              );
              continue;
            }
            const icalData = await response.text();
            const events = parseICalData(icalData, dateFrom, dateTo);
            events.forEach((ev) => {
              ev.calendarId = cal.id;
              ev.calendarName = cal.name;
              ev.calendarColor = cal.color;
            });
            allEvents.push(...events);

            // Mettre à jour last_sync + reset erreur
            db.prepare(
              "UPDATE ical_calendars SET last_sync = datetime('now'), last_sync_error = NULL WHERE id = ?",
            ).run(cal.id);
          } catch (fetchErr) {
            const msg = `${cal.name}: ${fetchErr.message}`;
            logger.warn(`iCal sync error — ${msg}`);
            syncErrors.push(msg);
            try {
              db.prepare('UPDATE ical_calendars SET last_sync_error = ? WHERE id = ?').run(
                fetchErr.message,
                cal.id,
              );
            } catch {
              /* ignored */
            }
          }
        }

        // Trier par date de début
        allEvents.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
        res.json({ events: allEvents, syncErrors: syncErrors.length ? syncErrors : undefined });
      } catch (error) {
        logger.error('GET ical-events error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ── Parser iCal simplifié ──
  function parseICalData(icalData, dateFrom, dateTo) {
    const events = [];
    // Unfold continuation lines (RFC 5545: lines starting with space/tab are continuation of previous line)
    const rawLines = icalData.split(/\r?\n/);
    const lines = [];
    for (const raw of rawLines) {
      if (/^[ \t]/.test(raw) && lines.length > 0) {
        lines[lines.length - 1] += raw.substring(1);
      } else {
        lines.push(raw);
      }
    }
    let currentEvent = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (line === 'END:VEVENT' && currentEvent) {
        // Filtrer par plage de dates
        const evDate = (currentEvent.dtstart || '').slice(0, 10);
        if (evDate >= dateFrom && evDate <= dateTo && currentEvent.summary) {
          events.push({
            id: currentEvent.uid || `ical-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            summary: cleanICalText(currentEvent.summary),
            start: currentEvent.dtstart || '',
            end: currentEvent.dtend || '',
            location: cleanICalText(currentEvent.location || ''),
            description: cleanICalText(currentEvent.description || ''),
          });
        }
        currentEvent = null;
      } else if (currentEvent) {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) continue;
        const keyPart = line.substring(0, colonIdx);
        const value = line.substring(colonIdx + 1);
        // Strip parameters (e.g., DTSTART;TZID=Europe/Paris)
        const baseKey = keyPart.split(';')[0].toLowerCase();

        if (baseKey === 'dtstart') {
          currentEvent.dtstart = formatICalDate(value);
        } else if (baseKey === 'dtend') {
          currentEvent.dtend = formatICalDate(value);
        } else if (baseKey === 'summary') {
          currentEvent.summary = value;
        } else if (baseKey === 'location') {
          currentEvent.location = value;
        } else if (baseKey === 'description') {
          currentEvent.description = value;
        } else if (baseKey === 'uid') {
          currentEvent.uid = value;
        }
      }
    }
    return events;
  }

  function formatICalDate(dateStr) {
    // Formats: 20260303T140000Z, 20260303T140000, 20260303
    const clean = dateStr.replace(/[^0-9TZ]/g, '');
    const isUTC = clean.endsWith('Z');
    if (clean.length >= 15) {
      // YYYYMMDDTHHMMSS[Z]
      const y = clean.slice(0, 4),
        m = clean.slice(4, 6),
        d = clean.slice(6, 8);
      const hh = clean.slice(9, 11),
        mm = clean.slice(11, 13),
        ss = clean.slice(13, 15) || '00';
      if (isUTC) {
        // Conserver le Z pour que new Date() interprète correctement en UTC
        // puis convertir en heure locale (Europe/Paris) pour l'affichage
        const utcDate = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`);
        const localY = utcDate.getFullYear();
        const localM = String(utcDate.getMonth() + 1).padStart(2, '0');
        const localD = String(utcDate.getDate()).padStart(2, '0');
        const localHH = String(utcDate.getHours()).padStart(2, '0');
        const localMM = String(utcDate.getMinutes()).padStart(2, '0');
        return `${localY}-${localM}-${localD}T${localHH}:${localMM}`;
      }
      // Pas de Z → heure locale (TZID=Europe/Paris ou sans timezone)
      return `${y}-${m}-${d}T${hh}:${mm}`;
    }
    if (clean.length >= 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    }
    return dateStr;
  }

  function cleanICalText(text) {
    if (!text) return '';
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  // ═══ Fonctions internes ═══

  // Générer les tâches récurrentes pour une date donnée
  function generateRecurringTasks(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = d.getDay(); // 0=dim, 1=lun...
    const dayOfMonth = d.getDate();

    const recurring = db.prepare('SELECT * FROM recurring_tasks WHERE active = 1').all();
    const insertStmt = db.prepare(`
      INSERT INTO task_assignments (id, date, period, time, section, title, notes, source_type, source_id, status, visible, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'recurring', ?, 'pending', 1, datetime('now'))
    `);

    let count = 0;
    for (const rt of recurring) {
      let shouldGenerate = false;
      if (rt.recurrence === 'daily') shouldGenerate = true;
      else if (rt.recurrence === 'weekly' && rt.day_of_week === dayOfWeek) shouldGenerate = true;
      else if (rt.recurrence === 'monthly' && rt.day_of_month === dayOfMonth) shouldGenerate = true;

      if (!shouldGenerate) continue;

      // Vérifier qu'on n'a pas déjà créé cette tâche (y compris si elle a été soft-deleted)
      const existing = db
        .prepare(
          "SELECT 1 FROM task_assignments WHERE source_type = 'recurring' AND source_id = ? AND date = ?",
        )
        .get(rt.id, dateStr);
      if (existing) continue;

      const id = crypto.randomUUID().replace(/-/g, '');
      insertStmt.run(id, dateStr, rt.period, rt.time, rt.section, rt.title, rt.notes, rt.id);
      count++;
    }
    return count;
  }

  // Reporter les tâches non terminées au lendemain
  function rolloverPendingTasks(fromDate) {
    const d = new Date(fromDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Tâches pending/in_progress du jour qui ne sont pas des RDV/événements
    // Exclure les soft-deleted ET les tâches récurrentes (elles seront re-générées)
    const pending = db
      .prepare(
        `
      SELECT * FROM task_assignments
      WHERE date = ? AND status IN ('pending', 'in_progress')
        AND section NOT IN ('rdv', 'evenements')
        AND source_type != 'recurring'
        AND deleted_at IS NULL
    `,
      )
      .all(fromDate);

    const insertStmt = db.prepare(`
      INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, visible, location_address, location_lat, location_lng, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'))
    `);
    // Soft-delete l'originale après report pour éviter les copies infinies
    const markRolledStmt = db.prepare(
      "UPDATE task_assignments SET deleted_at = datetime('now'), notes = COALESCE(notes, '') || ' [reportée]' WHERE id = ?",
    );

    let count = 0;
    for (const t of pending) {
      // Vérifier pas de doublon (même titre + section + date cible, y compris soft-deleted)
      const dup = db
        .prepare('SELECT 1 FROM task_assignments WHERE date = ? AND section = ? AND title = ?')
        .get(nextDate, t.section, t.title);
      if (dup) {
        // Doublon trouvé : soft-delete l'originale quand même
        markRolledStmt.run(t.id);
        continue;
      }

      const id = crypto.randomUUID().replace(/-/g, '');
      insertStmt.run(
        id,
        t.display_event_id,
        t.person_id,
        nextDate,
        t.period,
        t.time,
        t.end_time,
        t.section,
        t.title,
        t.notes || '',
        t.source_type,
        t.source_id,
        t.google_event_title,
        t.affaire_num,
        t.visible ?? 1,
        t.location_address || null,
        t.location_lat ?? null,
        t.location_lng ?? null,
      );
      markRolledStmt.run(t.id);
      count++;
    }
    return count;
  }

  // ═══════════════════════════════════════════════
  // MULTI-AFFECTATION PERSONNEL (planning_assignments)
  // ═══════════════════════════════════════════════

  // GET /api/planning/planning-assignments?entity_type=affaire&entity_ids=AF123,AF456
  // ou ?entity_type=display_event&entity_ids=abc,def
  // ou sans filtre → tous
  app.get('/api/planning/planning-assignments', authenticateToken, (req, res) => {
    try {
      let query = `
        SELECT pa.*, p.first_name, p.last_name
        FROM planning_assignments pa
        LEFT JOIN persons p ON p.id = pa.person_id
        WHERE 1=1
      `;
      const params = [];
      if (req.query.entity_type) {
        query += ' AND pa.entity_type = ?';
        params.push(req.query.entity_type);
      }
      if (req.query.entity_ids) {
        const ids = req.query.entity_ids.split(',');
        query += ` AND pa.entity_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
      query += ' ORDER BY pa.created_at ASC';
      const rows = db.prepare(query).all(...params);
      res.json(rows);
    } catch (error) {
      logger.error('GET /api/planning/planning-assignments error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // POST /api/planning/planning-assignments
  // Body: { entity_type, entity_id, person_id }
  app.post(
    '/api/planning/planning-assignments',
    authenticateToken,
    validate(planningAssignmentSchema),
    (req, res) => {
      try {
        const { entity_type, entity_id, person_id } = req.body;
        const id = crypto.randomUUID().replace(/-/g, '');
        db.prepare(
          `
        INSERT OR IGNORE INTO planning_assignments (id, entity_type, entity_id, person_id)
        VALUES (?, ?, ?, ?)
      `,
        ).run(id, entity_type, entity_id, person_id);
        // Retourner toutes les affectations pour cette entité
        const assignments = db
          .prepare(
            `
        SELECT pa.*, p.first_name, p.last_name
        FROM planning_assignments pa
        LEFT JOIN persons p ON p.id = pa.person_id
        WHERE pa.entity_type = ? AND pa.entity_id = ?
        ORDER BY pa.created_at ASC
      `,
          )
          .all(entity_type, entity_id);
        res.json(assignments);
      } catch (error) {
        logger.error('POST /api/planning/planning-assignments error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // DELETE /api/planning/planning-assignments/:id
  app.delete('/api/planning/planning-assignments/:id', authenticateToken, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM planning_assignments WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ success: false, error: 'Affectation non trouvée' });
      db.prepare('DELETE FROM planning_assignments WHERE id = ?').run(req.params.id);
      // Retourner les affectations restantes pour cette entité
      const assignments = db
        .prepare(
          `
        SELECT pa.*, p.first_name, p.last_name
        FROM planning_assignments pa
        LEFT JOIN persons p ON p.id = pa.person_id
        WHERE pa.entity_type = ? AND pa.entity_id = ?
        ORDER BY pa.created_at ASC
      `,
        )
        .all(row.entity_type, row.entity_id);
      res.json(assignments);
    } catch (error) {
      logger.error('DELETE /api/planning/planning-assignments error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // DELETE /api/planning/planning-assignments/entity/:type/:id — supprimer toutes les affectations d'une entité
  app.delete(
    '/api/planning/planning-assignments/entity/:type/:id',
    authenticateToken,
    (req, res) => {
      try {
        db.prepare('DELETE FROM planning_assignments WHERE entity_type = ? AND entity_id = ?').run(
          req.params.type,
          req.params.id,
        );
        res.json([]);
      } catch (error) {
        logger.error('DELETE /api/planning/planning-assignments/entity error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ═══ Cron automatique : tous les jours a 00h00 ═══
  function scheduleRolloverCron() {
    let lastRunDayKey = null;

    const check = () => {
      const now = new Date();
      // Apres minuit: reporter les taches non faites de J-1 vers J
      // et generer les recurrentes de J. Garde-fou: une seule execution par jour.
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (lastRunDayKey === todayStr) return;
        lastRunDayKey = todayStr;

        const yesterdayD = new Date(now);
        yesterdayD.setDate(yesterdayD.getDate() - 1);
        const yesterdayStr = `${yesterdayD.getFullYear()}-${String(yesterdayD.getMonth() + 1).padStart(2, '0')}-${String(yesterdayD.getDate()).padStart(2, '0')}`;

        // 1. Reporter les tâches non terminées de la veille vers aujourd'hui
        const rolled = rolloverPendingTasks(yesterdayStr);
        logger.info(
          `⏰ Cron 00h00 : ${rolled} tâche(s) reportée(s) de ${yesterdayStr} vers ${todayStr}`,
        );

        // 2. Générer les tâches récurrentes d'aujourd'hui
        const generated = generateRecurringTasks(todayStr);
        logger.info(
          `⏰ Cron 00h00 : ${generated} tâche(s) récurrente(s) générée(s) pour ${todayStr}`,
        );
      }
    };
    // Vérifier toutes les 30 secondes (pour capter 18:00 sans timer compliqué)
    if (rolloverCronTimer) clearInterval(rolloverCronTimer);
    rolloverCronTimer = setInterval(check, 30000);
    if (typeof rolloverCronTimer.unref === 'function') rolloverCronTimer.unref();
    logger.info('⏰ Cron report tâches 00h00 activé');

    // Au démarrage : reporter les tâches pending des jours précédents + générer récurrentes
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 1. Reporter les tâches pending de tous les jours passés vers aujourd'hui
    try {
      const pendingDays = db
        .prepare(
          `
        SELECT DISTINCT date FROM task_assignments
        WHERE date < ? AND status IN ('pending', 'in_progress')
          AND section NOT IN ('rdv', 'evenements')
          AND source_type != 'recurring'
          AND deleted_at IS NULL
        ORDER BY date ASC
      `,
        )
        .all(todayStr)
        .map((r) => r.date);

      let totalRolled = 0;
      const markRolledStmt = db.prepare(
        "UPDATE task_assignments SET deleted_at = datetime('now'), notes = COALESCE(notes, '') || ' [reportée]' WHERE id = ?",
      );
      for (const pastDate of pendingDays) {
        // Reporter directement vers aujourd'hui (pas jour par jour) — exclure les soft-deleted et les récurrentes
        const pending = db
          .prepare(
            `
          SELECT * FROM task_assignments
          WHERE date = ? AND status IN ('pending', 'in_progress')
            AND section NOT IN ('rdv', 'evenements')
            AND source_type != 'recurring'
            AND deleted_at IS NULL
        `,
          )
          .all(pastDate);

        const insertStmt = db.prepare(`
          INSERT INTO task_assignments (id, display_event_id, person_id, date, period, time, end_time, section, title, notes, source_type, source_id, google_event_title, affaire_num, status, visible, location_address, location_lat, location_lng, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'))
        `);

        for (const t of pending) {
          // Pas de doublon : même titre + section + date cible (y compris soft-deleted)
          const dup = db
            .prepare('SELECT 1 FROM task_assignments WHERE date = ? AND section = ? AND title = ?')
            .get(todayStr, t.section, t.title);
          if (dup) {
            // Doublon trouvé : soft-delete l'originale quand même
            markRolledStmt.run(t.id);
            continue;
          }

          const id = crypto.randomUUID().replace(/-/g, '');
          insertStmt.run(
            id,
            t.display_event_id,
            t.person_id,
            todayStr,
            t.period,
            t.time,
            t.end_time,
            t.section,
            t.title,
            t.notes || '',
            t.source_type,
            t.source_id,
            t.google_event_title,
            t.affaire_num,
            t.visible ?? 1,
            t.location_address || null,
            t.location_lat ?? null,
            t.location_lng ?? null,
          );
          markRolledStmt.run(t.id);
          totalRolled++;
        }
      }
      if (totalRolled > 0)
        logger.info(
          `🔄 Démarrage : ${totalRolled} tâche(s) en attente reportée(s) des jours passés vers aujourd'hui`,
        );
    } catch (err) {
      logger.error('Erreur rollover au démarrage:', err);
    }

    // 2. Générer les tâches récurrentes d'aujourd'hui si pas encore fait
    const generated = generateRecurringTasks(todayStr);
    if (generated > 0)
      logger.info(`🔄 Démarrage : ${generated} tâche(s) récurrente(s) générée(s) pour aujourd'hui`);
  }

  scheduleRolloverCron();
}
