// ═══════════════════════════════════════════════════════════════
// MODULE SUIVI DU PERSONNEL — Routes API Express
// Fiches quotidiennes + synthèses + export PDF
//
// [S2-1 step 3] Refactor split monolithe (2857L → 3 fichiers) :
//   - apps/api/suiviRoutes.js          (ce fichier, ~1150L : routes uniquement)
//   - apps/api/suiviRoutes/_helpers.js (~770L : fonctions métier)
//   - apps/api/suiviRoutes/_pdf.js     (~937L : génération PDF)
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import { cacheMiddleware, invalidateOnSuccess, suiviPersonnelCache } from './cache.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  entryPatchSchema,
  incidentTicketUpsertSchema,
  sheetUpdateSchema,
  suiviRecurringTaskCreateSchema,
  suiviRecurringTaskUpdateSchema,
  syntheseDateSchema,
  syntheseMonthSchema,
  syntheseWeekSchema,
  syntheseYearSchema,
} from './schemas/suivi.js';

// [S2-1 step 3] Helpers et PDF generation extraits dans des sous-modules
import {
  getOrCreateSheet,
  getSheetWithEntries,
  isRecurringDueOnDate,
  canManagePerson,
  enrichSheetWithDayContext,
  getWeekDates,
  getMonthDates,
  getYearDates,
  getWeekBounds,
  safeJsonParseArray,
  getAffaireIncidentBase,
  computeIncidentSynthese,
  buildSynthese,
} from './suiviRoutes/_helpers.js';
import {
  generateSheetPdf,
  generateBatchPdf,
  generateBatchPrintPdf,
  generateSynthesePdf,
} from './suiviRoutes/_pdf.js';

export function setupSuiviRoutes(app, authenticateToken, requireAdmin) {
  // ─────────────────────────────────────────────────
  // Routes statiques AVANT les routes avec paramètres
  // (sinon /api/suivi/:personnelId/:date intercepterait tout)
  // ─────────────────────────────────────────────────

  // ─── GET /api/suivi/personnel ─── Liste du personnel avec stats suivi
  // [S2-3] Cache 60s — invalidé par mutations tracking_sheets / persons
  app.get(
    '/api/suivi/personnel',
    authenticateToken,
    cacheMiddleware(suiviPersonnelCache, () => 'list'),
    (req, res) => {
      try {
        const persons = db
          .prepare(
            `SELECT p.id, p.first_name, p.last_name, p.type, p.status, p.user_id,
                  COUNT(ts.id) AS total_sheets,
                  SUM(CASE WHEN ts.status = 'validated' THEN 1 ELSE 0 END) AS validated_sheets
           FROM persons p
           LEFT JOIN tracking_sheets ts ON ts.person_id = p.id
           WHERE p.status = 'active' AND p.type IN ('permanent', 'contractuel', 'stagiaire', 'apprenti')
           GROUP BY p.id
           ORDER BY p.last_name, p.first_name`,
          )
          .all();
        res.json(persons);
      } catch (error) {
        logger.error('GET /api/suivi/personnel error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/suivi/planning-tasks/:date ─── Tâches planifiées du jour (inclut terminées)
  app.get('/api/suivi/planning-tasks/:date', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide' });
      }

      // Tâches du jour (on conserve aussi les tâches terminées)
      const tasks = db
        .prepare(
          `SELECT ta.id, ta.title, ta.section, ta.period, ta.time, ta.end_time,
                  ta.affaire_num, ta.notes, ta.status, ta.google_event_title,
                  a.nom AS affaire_nom, a.titre AS affaire_titre,
                  a.type AS affaire_type, a.client AS affaire_client
           FROM task_assignments ta
           LEFT JOIN affaires a ON ta.affaire_num = a.numero_affaire
           WHERE ta.date = ? AND ta.deleted_at IS NULL
           ORDER BY ta.period ASC, ta.time ASC, ta.section ASC`,
        )
        .all(date);

      res.json(tasks);
    } catch (error) {
      logger.error('GET /api/suivi/planning-tasks error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/recurring/:personnelId ─── Liste des récurrences d'un personnel
  app.get('/api/suivi/recurring/:personnelId', authenticateToken, (req, res) => {
    try {
      const personnelId = Number(req.params.personnelId);
      const person = db.prepare('SELECT id, user_id FROM persons WHERE id = ?').get(personnelId);
      if (!person) {
        return res.status(404).json({ success: false, error: 'Personnel non trouvé' });
      }

      const currentUser = db
        .prepare('SELECT id, is_admin FROM users WHERE id = ?')
        .get(req.user.id);
      if (!canManagePerson(person, currentUser)) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }

      const rows = db
        .prepare(
          `SELECT *
           FROM tracking_recurring_tasks
           WHERE person_id = ?
           ORDER BY active DESC, created_at DESC`,
        )
        .all(personnelId);

      res.json(rows);
    } catch (error) {
      logger.error('GET /api/suivi/recurring/:personnelId error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/suivi/recurring/:personnelId ─── Créer une récurrence Suivi
  app.post(
    '/api/suivi/recurring/:personnelId',
    authenticateToken,
    validate(suiviRecurringTaskCreateSchema),
    (req, res) => {
      try {
        const personnelId = Number(req.params.personnelId);
        const person = db.prepare('SELECT id, user_id FROM persons WHERE id = ?').get(personnelId);
        if (!person) {
          return res.status(404).json({ success: false, error: 'Personnel non trouvé' });
        }

        const currentUser = db
          .prepare('SELECT id, is_admin FROM users WHERE id = ?')
          .get(req.user.id);
        if (!canManagePerson(person, currentUser)) {
          return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const {
          title,
          period,
          recurrence,
          day_of_week,
          day_of_month,
          default_time_spent,
          default_comment,
          active,
        } = req.body;

        const id = crypto.randomUUID().replace(/-/g, '');

        db.prepare(
          `INSERT INTO tracking_recurring_tasks (
             id, person_id, title, period, recurrence, day_of_week, day_of_month,
             default_time_spent, default_comment, active, created_by
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          personnelId,
          title,
          period,
          recurrence,
          recurrence === 'weekly' ? day_of_week : null,
          recurrence === 'monthly' ? day_of_month : null,
          default_time_spent || 0,
          default_comment || '',
          active ?? 1,
          req.user.id,
        );

        const created = db.prepare('SELECT * FROM tracking_recurring_tasks WHERE id = ?').get(id);
        res.status(201).json(created);
      } catch (error) {
        logger.error('POST /api/suivi/recurring/:personnelId error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── PUT /api/suivi/recurring/:id ─── Modifier une récurrence Suivi
  app.put(
    '/api/suivi/recurring/:id',
    authenticateToken,
    validate(suiviRecurringTaskUpdateSchema),
    (req, res) => {
      try {
        const recurring = db
          .prepare('SELECT * FROM tracking_recurring_tasks WHERE id = ?')
          .get(req.params.id);
        if (!recurring) {
          return res.status(404).json({ success: false, error: 'Récurrence introuvable' });
        }

        const person = db
          .prepare('SELECT id, user_id FROM persons WHERE id = ?')
          .get(recurring.person_id);
        const currentUser = db
          .prepare('SELECT id, is_admin FROM users WHERE id = ?')
          .get(req.user.id);
        if (!canManagePerson(person, currentUser)) {
          return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const data = req.body;
        const fields = [
          'title',
          'period',
          'recurrence',
          'day_of_week',
          'day_of_month',
          'default_time_spent',
          'default_comment',
          'active',
        ].filter((f) => data[f] !== undefined);

        if (fields.length === 0) {
          return res.status(400).json({ success: false, error: 'Aucun champ à mettre à jour' });
        }

        const setClause = fields.map((f) => `${f} = ?`).join(', ');
        const values = fields.map((f) => data[f]);
        db.prepare(`UPDATE tracking_recurring_tasks SET ${setClause} WHERE id = ?`).run(
          ...values,
          req.params.id,
        );

        const updated = db
          .prepare('SELECT * FROM tracking_recurring_tasks WHERE id = ?')
          .get(req.params.id);
        res.json(updated);
      } catch (error) {
        logger.error('PUT /api/suivi/recurring/:id error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── DELETE /api/suivi/recurring/:id ─── Supprimer une récurrence Suivi
  app.delete('/api/suivi/recurring/:id', authenticateToken, (req, res) => {
    try {
      const recurring = db
        .prepare('SELECT id, person_id FROM tracking_recurring_tasks WHERE id = ?')
        .get(req.params.id);
      if (!recurring) {
        return res.status(404).json({ success: false, error: 'Récurrence introuvable' });
      }

      const person = db
        .prepare('SELECT id, user_id FROM persons WHERE id = ?')
        .get(recurring.person_id);
      const currentUser = db
        .prepare('SELECT id, is_admin FROM users WHERE id = ?')
        .get(req.user.id);
      if (!canManagePerson(person, currentUser)) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }

      db.prepare('DELETE FROM tracking_recurring_tasks WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/suivi/recurring/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/suivi/tache/:tacheId ─── Mise à jour d'une entrée
  app.patch(
    '/api/suivi/tache/:tacheId',
    authenticateToken,
    validate(entryPatchSchema),
    (req, res) => {
      try {
        const entry = db
          .prepare(
            'SELECT te.*, ts.person_id FROM tracking_entries te JOIN tracking_sheets ts ON ts.id = te.sheet_id WHERE te.id = ?',
          )
          .get(req.params.tacheId);
        if (!entry) {
          return res.status(404).json({ success: false, error: 'Entrée non trouvée' });
        }

        // Vérification des droits
        const person = db.prepare('SELECT user_id FROM persons WHERE id = ?').get(entry.person_id);
        const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (currentUser?.is_admin !== 1 && person?.user_id !== req.user.id) {
          return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const fields = [];
        const params = [];
        for (const [key, value] of Object.entries(req.body)) {
          if (['completed', 'time_spent', 'comment', 'task', 'period'].includes(key)) {
            fields.push(`${key} = ?`);
            params.push(value);
          }
        }

        if (fields.length > 0) {
          fields.push("modified_at = datetime('now')");
          db.prepare(`UPDATE tracking_entries SET ${fields.join(', ')} WHERE id = ?`).run(
            ...params,
            req.params.tacheId,
          );

          // Synchroniser le statut de la tâche planifiée liée
          if (req.body.completed !== undefined && entry.task_assignment_id) {
            const newStatus = req.body.completed === 1 ? 'done' : 'pending';
            db.prepare('UPDATE task_assignments SET status = ? WHERE id = ?').run(
              newStatus,
              entry.task_assignment_id,
            );
          }
        }

        const updated = db
          .prepare('SELECT * FROM tracking_entries WHERE id = ?')
          .get(req.params.tacheId);
        res.json(updated);
      } catch (error) {
        logger.error('PATCH /api/suivi/tache/:tacheId error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/suivi/incidents/affaire/:affaireNum/base ─── Préremplissage ticket incident
  app.get('/api/suivi/incidents/affaire/:affaireNum/base', authenticateToken, (req, res) => {
    try {
      const affaireNum = String(req.params.affaireNum || '').trim();
      if (!affaireNum) {
        return res.status(400).json({ success: false, error: 'Numéro affaire requis' });
      }
      const base = getAffaireIncidentBase(affaireNum);
      res.json(base);
    } catch (error) {
      logger.error('GET /api/suivi/incidents/affaire/:affaireNum/base error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/incidents/tickets/:week ─── Tickets incidents d'une semaine
  app.get('/api/suivi/incidents/tickets/:week', authenticateToken, (req, res) => {
    try {
      const weekKey = String(req.params.week || '').trim();
      if (!/^\d{4}-W\d{2}$/.test(weekKey)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format semaine invalide (YYYY-Wnn)' });
      }

      const tickets = db
        .prepare(
          `SELECT *
           FROM tracking_incident_tickets
           WHERE week_key = ?
           ORDER BY COALESCE(incident_date, period_start_date) DESC,
                    created_at DESC,
                    affaire_num ASC`,
        )
        .all(weekKey)
        .map((t) => ({
          ...t,
          is_tournee: Boolean(t.is_tournee),
          linked_reservations: safeJsonParseArray(t.linked_reservations_json),
          linked_personnel: safeJsonParseArray(t.linked_personnel_json),
        }));

      const ticketIds = tickets.map((t) => t.id);
      let entries = [];
      if (ticketIds.length > 0) {
        const placeholders = ticketIds.map(() => '?').join(',');
        entries = db
          .prepare(
            `SELECT ie.*, p.first_name, p.last_name
             FROM tracking_incident_entries ie
             LEFT JOIN persons p ON p.id = ie.reporter_person_id
             WHERE ie.ticket_id IN (${placeholders})
             ORDER BY ie.created_at ASC`,
          )
          .all(...ticketIds)
          .map((e) => ({
            ...e,
            reporter_name:
              [e.first_name, e.last_name].filter(Boolean).join(' ').trim() ||
              e.reporter_name_snapshot ||
              '',
          }));
      }

      const entriesByTicket = new Map();
      for (const e of entries) {
        if (!entriesByTicket.has(e.ticket_id)) entriesByTicket.set(e.ticket_id, []);
        entriesByTicket.get(e.ticket_id).push(e);
      }

      const payload = tickets.map((t) => ({
        ...t,
        incidents: entriesByTicket.get(t.id) || [],
      }));
      res.json({ week_key: weekKey, tickets: payload });
    } catch (error) {
      logger.error('GET /api/suivi/incidents/tickets/:week error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/suivi/incidents/tickets ─── Création/MàJ d'un ticket hebdomadaire
  app.post(
    '/api/suivi/incidents/tickets',
    authenticateToken,
    validate(incidentTicketUpsertSchema),
    (req, res) => {
      try {
        const data = req.body;
        const weekKey = String(data.week_key || '').trim();
        const affaireNum = String(data.affaire_num || '').trim();
        if (!weekKey || !affaireNum) {
          return res.status(400).json({ success: false, error: 'week_key et affaire_num requis' });
        }

        const bounds = getWeekBounds(weekKey);

        // Mode édition explicite : id fourni ⇒ on met à jour CE ticket précis.
        // Sinon : on crée toujours un nouveau ticket (plusieurs tickets autorisés
        // pour une même semaine + affaire, chacun étant daté).
        const requestedId = String(data.id || '').trim();
        const existing = requestedId
          ? db
              .prepare(
                `SELECT *
                 FROM tracking_incident_tickets
                 WHERE id = ?`,
              )
              .get(requestedId)
          : null;

        const base = getAffaireIncidentBase(affaireNum);
        const linkedReservations = Array.isArray(data.linked_reservations)
          ? data.linked_reservations
          : base.linked_reservations;
        const linkedPersonnel = Array.isArray(data.linked_personnel)
          ? data.linked_personnel
          : base.linked_personnel;

        const ticketId = existing?.id || crypto.randomUUID().replace(/-/g, '');

        // incident_date : valeur fournie OU date du jour par défaut
        const incidentDate =
          data.incident_date && /^\d{4}-\d{2}-\d{2}$/.test(data.incident_date)
            ? data.incident_date
            : new Date().toISOString().slice(0, 10);

        if (existing) {
          db.prepare(
            `UPDATE tracking_incident_tickets
             SET period_start_date = ?,
                 period_end_date = ?,
                 affaire_name = ?,
                 incident_date = ?,
                 affaire_start_date = ?,
                 affaire_end_date = ?,
                 is_tournee = ?,
                 linked_reservations_json = ?,
                 linked_personnel_json = ?,
                 notes = ?,
                 modified_by = ?,
                 modified_at = datetime('now')
             WHERE id = ?`,
          ).run(
            bounds.start,
            bounds.end,
            data.affaire_name || base.affaire_name || affaireNum,
            incidentDate,
            data.affaire_start_date ?? base.affaire_start_date,
            data.affaire_end_date ?? base.affaire_end_date,
            data.is_tournee === undefined ? (base.is_tournee ? 1 : 0) : data.is_tournee ? 1 : 0,
            JSON.stringify(linkedReservations),
            JSON.stringify(linkedPersonnel),
            data.notes || '',
            req.user.id,
            ticketId,
          );
        } else {
          db.prepare(
            `INSERT INTO tracking_incident_tickets (
               id, week_key, period_start_date, period_end_date,
               affaire_num, affaire_name, incident_date,
               affaire_start_date, affaire_end_date,
               is_tournee, linked_reservations_json, linked_personnel_json, notes,
               created_by, modified_by
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            ticketId,
            weekKey,
            bounds.start,
            bounds.end,
            affaireNum,
            data.affaire_name || base.affaire_name || affaireNum,
            incidentDate,
            data.affaire_start_date ?? base.affaire_start_date,
            data.affaire_end_date ?? base.affaire_end_date,
            data.is_tournee === undefined ? (base.is_tournee ? 1 : 0) : data.is_tournee ? 1 : 0,
            JSON.stringify(linkedReservations),
            JSON.stringify(linkedPersonnel),
            data.notes || '',
            req.user.id,
            req.user.id,
          );
        }

        db.prepare('DELETE FROM tracking_incident_entries WHERE ticket_id = ?').run(ticketId);

        const createVehicleBreakdownReportIfNeeded = (item) => {
          if (item.incident_type !== 'vehicle_problem') return item.linked_maintenance_id || null;

          const vehicleId =
            item.vehicle_id === null || item.vehicle_id === undefined
              ? null
              : Number(item.vehicle_id);

          if (!vehicleId || !Number.isFinite(vehicleId)) return item.linked_maintenance_id || null;

          const existingMaintenanceId = String(item.linked_maintenance_id || '').trim();
          if (existingMaintenanceId) {
            const existing = db
              .prepare('SELECT id FROM maintenances WHERE id = ?')
              .get(existingMaintenanceId);
            if (existing?.id) return existing.id;
          }

          const vehicle = db.prepare('SELECT id, name FROM vehicles WHERE id = ?').get(vehicleId);
          if (!vehicle?.id) return null;

          const maintenanceId = crypto.randomUUID().replace(/-/g, '');
          const reportDate = bounds.end;
          const vehicleName =
            String(item.vehicle_name_snapshot || '').trim() || String(vehicle.name || '').trim();
          const reportDescription = String(item.description || '').trim();

          db.prepare(
            `INSERT INTO maintenances (id, vehicle_id, vehicle_name, type, status, date, end_date,
                                       start_date_period, end_date_period,
                                       description, garage_id, cost, mileage, notes, is_immobilized,
                                       is_quick_report, technical_control_type, created_by, modified_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            maintenanceId,
            vehicleId,
            vehicleName,
            'other',
            'reported',
            reportDate,
            reportDate,
            'AM',
            'PM',
            reportDescription,
            null,
            null,
            null,
            `Signalement créé automatiquement depuis incident suivi (${weekKey} / ${affaireNum})`,
            0,
            1,
            null,
            req.user.id,
            req.user.id,
          );

          return maintenanceId;
        };

        const insertIncident = db.prepare(
          `INSERT INTO tracking_incident_entries (
             id, ticket_id, incident_type, description,
             reporter_person_id, reporter_name_snapshot,
             vehicle_id, vehicle_name_snapshot, linked_maintenance_id,
             created_by, modified_by
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );

        const addAll = db.transaction((items) => {
          for (const item of items) {
            const reporterId =
              item.reporter_person_id === null || item.reporter_person_id === undefined
                ? null
                : Number(item.reporter_person_id);
            let reporterSnapshot = '';
            if (reporterId) {
              const p = db
                .prepare('SELECT first_name, last_name FROM persons WHERE id = ?')
                .get(reporterId);
              reporterSnapshot = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
            }

            const vehicleId =
              item.vehicle_id === null || item.vehicle_id === undefined
                ? null
                : Number(item.vehicle_id);
            const vehicleSnapshot = String(item.vehicle_name_snapshot || '').trim();
            const linkedMaintenanceId = createVehicleBreakdownReportIfNeeded(item);

            insertIncident.run(
              crypto.randomUUID().replace(/-/g, ''),
              ticketId,
              item.incident_type,
              item.description || '',
              reporterId,
              reporterSnapshot,
              Number.isFinite(vehicleId) ? vehicleId : null,
              vehicleSnapshot,
              linkedMaintenanceId,
              req.user.id,
              req.user.id,
            );
          }
        });

        addAll(Array.isArray(data.incidents) ? data.incidents : []);

        const saved = db
          .prepare('SELECT * FROM tracking_incident_tickets WHERE id = ?')
          .get(ticketId);
        const savedEntries = db
          .prepare(
            `SELECT ie.*, p.first_name, p.last_name
             FROM tracking_incident_entries ie
             LEFT JOIN persons p ON p.id = ie.reporter_person_id
             WHERE ie.ticket_id = ?
             ORDER BY ie.created_at ASC`,
          )
          .all(ticketId)
          .map((e) => ({
            ...e,
            reporter_name:
              [e.first_name, e.last_name].filter(Boolean).join(' ').trim() ||
              e.reporter_name_snapshot ||
              '',
          }));

        res.json({
          ...saved,
          is_tournee: Boolean(saved.is_tournee),
          linked_reservations: safeJsonParseArray(saved.linked_reservations_json),
          linked_personnel: safeJsonParseArray(saved.linked_personnel_json),
          incidents: savedEntries,
        });
      } catch (error) {
        logger.error('POST /api/suivi/incidents/tickets error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── DELETE /api/suivi/incidents/tickets/:ticketId ─── Supprimer un ticket incident
  app.delete('/api/suivi/incidents/tickets/:ticketId', authenticateToken, (req, res) => {
    try {
      const ticketId = String(req.params.ticketId || '').trim();
      const existing = db
        .prepare('SELECT id FROM tracking_incident_tickets WHERE id = ?')
        .get(ticketId);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Ticket introuvable' });
      }
      db.prepare('DELETE FROM tracking_incident_tickets WHERE id = ?').run(ticketId);
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/suivi/incidents/tickets/:ticketId error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/incidents/synthese/semaine/:week ─── Synthèse incidents hebdomadaire
  app.get('/api/suivi/incidents/synthese/semaine/:week', authenticateToken, (req, res) => {
    try {
      const weekKey = String(req.params.week || '').trim();
      if (!/^\d{4}-W\d{2}$/.test(weekKey)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format semaine invalide (YYYY-Wnn)' });
      }
      const bounds = getWeekBounds(weekKey);
      const synthese = computeIncidentSynthese(bounds.start, bounds.end);
      res.json({ ...synthese, period_key: weekKey, mode: 'semaine' });
    } catch (error) {
      logger.error('GET /api/suivi/incidents/synthese/semaine/:week error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/incidents/synthese/mois/:month ─── Synthèse incidents mensuelle
  app.get('/api/suivi/incidents/synthese/mois/:month', authenticateToken, (req, res) => {
    try {
      const month = String(req.params.month || '').trim();
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ success: false, error: 'Format mois invalide (YYYY-MM)' });
      }
      const dates = getMonthDates(month);
      const synthese = computeIncidentSynthese(dates[0], dates[dates.length - 1]);
      res.json({ ...synthese, period_key: month, mode: 'mois' });
    } catch (error) {
      logger.error('GET /api/suivi/incidents/synthese/mois/:month error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/incidents/synthese/annee/:year ─── Synthèse incidents annuelle
  app.get('/api/suivi/incidents/synthese/annee/:year', authenticateToken, (req, res) => {
    try {
      const year = String(req.params.year || '').trim();
      const parsed = syntheseYearSchema.safeParse({ year });
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Format année invalide (YYYY)' });
      }
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const synthese = computeIncidentSynthese(start, end);
      res.json({ ...synthese, period_key: year, mode: 'annee' });
    } catch (error) {
      logger.error('GET /api/suivi/incidents/synthese/annee/:year error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/jour/:date ─── Synthèse journalière
  app.get('/api/suivi/synthese/jour/:date', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide' });
      }
      const synthese = buildSynthese([date]);
      synthese.incidents = computeIncidentSynthese(date, date);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/jour/:date error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/semaine/:week ─── Synthèse hebdomadaire
  app.get('/api/suivi/synthese/semaine/:week', authenticateToken, (req, res) => {
    try {
      const { week } = req.params;
      if (!/^\d{4}-W\d{2}$/.test(week)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format semaine invalide (YYYY-Wnn)' });
      }
      const dates = getWeekDates(week);
      const synthese = buildSynthese(dates);
      synthese.incidents = computeIncidentSynthese(dates[0], dates[dates.length - 1]);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/semaine/:week error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/mois/:month ─── Synthèse mensuelle
  app.get('/api/suivi/synthese/mois/:month', authenticateToken, (req, res) => {
    try {
      const { month } = req.params;
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ success: false, error: 'Format mois invalide (YYYY-MM)' });
      }
      const dates = getMonthDates(month);
      const synthese = buildSynthese(dates);
      synthese.incidents = computeIncidentSynthese(dates[0], dates[dates.length - 1]);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/mois/:month error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/annee/:year ─── Synthèse annuelle
  app.get('/api/suivi/synthese/annee/:year', authenticateToken, (req, res) => {
    try {
      const year = String(req.params.year || '').trim();
      const parsed = syntheseYearSchema.safeParse({ year });
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Format année invalide (YYYY)' });
      }
      const dates = getYearDates(year);
      const synthese = buildSynthese(dates);
      synthese.incidents = computeIncidentSynthese(dates[0], dates[dates.length - 1]);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/annee/:year error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/jour/:date/pdf ─── PDF synthèse journalière
  app.get('/api/suivi/synthese/jour/:date/pdf', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      const synthese = buildSynthese([date]);
      synthese.incidents = computeIncidentSynthese(date, date);
      generateSynthesePdf(synthese, `jour-${date}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/jour/:date/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── GET /api/suivi/synthese/semaine/:week/pdf ─── PDF synthèse hebdomadaire
  app.get('/api/suivi/synthese/semaine/:week/pdf', authenticateToken, (req, res) => {
    try {
      const { week } = req.params;
      const dates = getWeekDates(week);
      const synthese = buildSynthese(dates);
      synthese.incidents = computeIncidentSynthese(dates[0], dates[dates.length - 1]);
      generateSynthesePdf(synthese, `semaine-${week}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/semaine/:week/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── GET /api/suivi/synthese/mois/:month/pdf ─── PDF synthèse mensuelle
  app.get('/api/suivi/synthese/mois/:month/pdf', authenticateToken, (req, res) => {
    try {
      const { month } = req.params;
      const dates = getMonthDates(month);
      const synthese = buildSynthese(dates);
      synthese.incidents = computeIncidentSynthese(dates[0], dates[dates.length - 1]);
      generateSynthesePdf(synthese, `mois-${month}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/mois/:month/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── GET /api/suivi/synthese/annee/:year/pdf ─── PDF synthèse annuelle
  app.get('/api/suivi/synthese/annee/:year/pdf', authenticateToken, (req, res) => {
    try {
      const year = String(req.params.year || '').trim();
      const parsed = syntheseYearSchema.safeParse({ year });
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Format année invalide (YYYY)' });
      }
      const dates = getYearDates(year);
      const synthese = buildSynthese(dates);
      synthese.incidents = computeIncidentSynthese(dates[0], dates[dates.length - 1]);
      generateSynthesePdf(synthese, `annee-${year}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/annee/:year/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── POST /api/suivi/batch/pdf ─── Export PDF multi-fiches (normal, sans recto-verso)
  app.post('/api/suivi/batch/pdf', authenticateToken, (req, res) => {
    try {
      const { sheetIds } = req.body;
      if (!Array.isArray(sheetIds) || sheetIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'sheetIds requis (tableau non vide)' });
      }
      if (sheetIds.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximum 50 fiches à la fois' });
      }
      const sheets = [];
      for (const id of sheetIds) {
        const full = getSheetWithEntries(id);
        if (full) sheets.push(enrichSheetWithDayContext(full));
      }
      if (sheets.length === 0) {
        return res.status(404).json({ success: false, error: 'Aucune fiche trouvée' });
      }
      generateBatchPdf(sheets, res);
    } catch (error) {
      logger.error('POST /api/suivi/batch/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF batch' });
      }
    }
  });

  // ─── POST /api/suivi/batch/print ─── PDF impression recto-verso (Matin/Après-midi + filigrane)
  app.post('/api/suivi/batch/print', authenticateToken, (req, res) => {
    try {
      const { sheetIds } = req.body;
      if (!Array.isArray(sheetIds) || sheetIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'sheetIds requis (tableau non vide)' });
      }
      if (sheetIds.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximum 50 fiches à la fois' });
      }
      const sheets = [];
      for (const id of sheetIds) {
        const full = getSheetWithEntries(id);
        if (full) sheets.push(enrichSheetWithDayContext(full));
      }
      if (sheets.length === 0) {
        return res.status(404).json({ success: false, error: 'Aucune fiche trouvée' });
      }
      generateBatchPrintPdf(sheets, res);
    } catch (error) {
      logger.error('POST /api/suivi/batch/print error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF impression' });
      }
    }
  });

  // ─────────────────────────────────────────────────
  // Routes avec paramètres dynamiques (après les statiques)

  // ─── POST /api/suivi/entries/:entryId/postpone ─── Reporter une tâche récurrente
  app.post(
    '/api/suivi/entries/:entryId/postpone',
    authenticateToken,
    invalidateOnSuccess(suiviPersonnelCache),
    (req, res) => {
      try {
        const entryId = parseInt(req.params.entryId, 10);
        const { target_date, target_period } = req.body;

        if (!entryId || isNaN(entryId)) {
          return res.status(400).json({ success: false, error: 'ID entrée invalide' });
        }
        if (!target_date || !/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
          return res
            .status(400)
            .json({ success: false, error: 'Date cible invalide (YYYY-MM-DD)' });
        }
        if (!target_period || !['AM', 'PM'].includes(target_period)) {
          return res
            .status(400)
            .json({ success: false, error: 'Période cible invalide (AM ou PM)' });
        }

        const entry = db.prepare('SELECT * FROM tracking_entries WHERE id = ?').get(entryId);
        if (!entry) return res.status(404).json({ success: false, error: 'Entrée introuvable' });

        const sheet = db.prepare('SELECT * FROM tracking_sheets WHERE id = ?').get(entry.sheet_id);
        if (!sheet) return res.status(404).json({ success: false, error: 'Fiche introuvable' });

        const personnel = db.prepare('SELECT * FROM personnel WHERE id = ?').get(sheet.person_id);
        if (!canManagePerson(personnel, req.user)) {
          return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        // Récupérer ou créer la fiche cible
        const targetSheet = getOrCreateSheet(sheet.person_id, target_date, req.user.id);
        if (!targetSheet) {
          return res
            .status(500)
            .json({ success: false, error: 'Impossible de créer la fiche cible' });
        }

        // Insérer la nouvelle entrée sur la fiche cible
        const newComment = `Reporté depuis ${sheet.date} (${entry.period || target_period})${entry.comment ? ' — ' + entry.comment : ''}`;
        const insertResult = db
          .prepare(
            `INSERT INTO tracking_entries (sheet_id, period, title, time_spent, comment, completed, recurring_task_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))`,
          )
          .run(targetSheet.id, target_period, entry.title, entry.time_spent || 0, newComment);

        // Mettre à jour l'entrée originale pour indiquer le report
        const updatedComment = `→ Reporté au ${target_date} (${target_period})${entry.comment ? ' — ' + entry.comment : ''}`;
        db.prepare(
          `UPDATE tracking_entries SET comment = ?, completed = 0, updated_at = datetime('now') WHERE id = ?`,
        ).run(updatedComment, entryId);

        // Mettre à jour modified_at de la fiche source
        db.prepare(`UPDATE tracking_sheets SET modified_at = datetime('now') WHERE id = ?`).run(
          sheet.id,
        );

        res.json({
          success: true,
          new_entry_id: insertResult.lastInsertRowid,
          target_date,
          target_period,
          updated_comment: updatedComment,
        });
      } catch (err) {
        logger.error('Erreur route postpone entry:', err);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ─── GET /api/suivi/:personnelId/:date ─── Récupérer ou créer la fiche du jour
  app.get('/api/suivi/:personnelId/:date', authenticateToken, (req, res) => {
    try {
      const { personnelId, date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide (YYYY-MM-DD)' });
      }

      const person = db.prepare('SELECT id FROM persons WHERE id = ?').get(personnelId);
      if (!person) {
        return res.status(404).json({ success: false, error: 'Personnel non trouvé' });
      }

      const sheet = getOrCreateSheet(Number(personnelId), date, req.user.id);
      const full = getSheetWithEntries(sheet.id);
      res.json(enrichSheetWithDayContext(full));
    } catch (error) {
      logger.error('GET /api/suivi/:personnelId/:date error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/suivi/:personnelId/:date ─── Mise à jour complète de la fiche
  app.post(
    '/api/suivi/:personnelId/:date',
    authenticateToken,
    validate(sheetUpdateSchema),
    (req, res) => {
      try {
        const { personnelId, date } = req.params;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ success: false, error: 'Format date invalide' });
        }

        const sheet = getOrCreateSheet(Number(personnelId), date, req.user.id);

        // Vérification des droits : propriétaire ou admin
        const person = db.prepare('SELECT user_id FROM persons WHERE id = ?').get(personnelId);
        const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (currentUser?.is_admin !== 1 && person?.user_id !== req.user.id) {
          return res
            .status(403)
            .json({ success: false, error: 'Vous ne pouvez modifier que vos propres fiches' });
        }

        const { status, notes, entries } = req.body;

        // Mettre à jour la fiche
        const updates = [];
        const params = [];
        if (status) {
          updates.push('status = ?');
          params.push(status);
        }
        if (notes !== undefined) {
          updates.push('notes = ?');
          params.push(notes);
        }
        updates.push('modified_by = ?', "modified_at = datetime('now')");
        params.push(req.user.id);

        if (updates.length > 0) {
          db.prepare(`UPDATE tracking_sheets SET ${updates.join(', ')} WHERE id = ?`).run(
            ...params,
            sheet.id,
          );
        }

        // Remplacer les entrées de manière atomique pour éviter toute perte en cas d'erreur
        const replaceEntries = db.transaction((items) => {
          db.prepare('DELETE FROM tracking_entries WHERE sheet_id = ?').run(sheet.id);

          if (!items || items.length === 0) return;

          const insert = db.prepare(
            `INSERT INTO tracking_entries (
              id, sheet_id, period, task, time_spent, comment, completed,
              task_assignment_id, recurring_task_id, sort_order
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          );

          for (let i = 0; i < items.length; i++) {
            const e = items[i];
            const entryId = e.id || crypto.randomUUID().replace(/-/g, '');
            // `completed` est NOT NULL en base: toute valeur non "fait" est stockée à 0.
            const completed = e.completed === 1 ? 1 : 0;

            insert.run(
              entryId,
              sheet.id,
              e.period,
              e.task || '',
              e.time_spent || 0,
              e.comment || '',
              completed,
              e.task_assignment_id || null,
              e.recurring_task_id || null,
              e.sort_order ?? i,
            );
          }

          // Synchroniser le statut des tâches planifiées liées
          for (const e of items) {
            if (e.task_assignment_id) {
              const newStatus = e.completed === 1 ? 'done' : 'pending';
              db.prepare('UPDATE task_assignments SET status = ? WHERE id = ?').run(
                newStatus,
                e.task_assignment_id,
              );
            }
          }
        });
        replaceEntries(entries || []);

        const full = getSheetWithEntries(sheet.id);
        res.json(enrichSheetWithDayContext(full));
      } catch (error) {
        logger.error('POST /api/suivi/:personnelId/:date error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/suivi/:ficheId/pdf ─── Export PDF individuel
  app.get('/api/suivi/:ficheId/pdf', authenticateToken, (req, res) => {
    try {
      const full = getSheetWithEntries(req.params.ficheId);
      if (!full) {
        return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
      }
      generateSheetPdf(enrichSheetWithDayContext(full), res);
    } catch (error) {
      logger.error('GET /api/suivi/:ficheId/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── PUT /api/suivi/:ficheId/validate ─── Valider une fiche (admin)
  app.put(
    '/api/suivi/:ficheId/validate',
    authenticateToken,
    requireAdmin,
    invalidateOnSuccess(suiviPersonnelCache),
    (req, res) => {
      try {
        const sheet = db
          .prepare('SELECT * FROM tracking_sheets WHERE id = ?')
          .get(req.params.ficheId);
        if (!sheet) {
          return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
        }

        db.prepare(
          `UPDATE tracking_sheets SET status = 'validated', validated_by = ?, validated_at = datetime('now'), modified_by = ?, modified_at = datetime('now') WHERE id = ?`,
        ).run(req.user.id, req.user.id, sheet.id);

        const full = getSheetWithEntries(sheet.id);
        res.json(full);
      } catch (error) {
        logger.error('PUT /api/suivi/:ficheId/validate error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );
}
