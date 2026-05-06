// ============================================================
// SAV ROUTES — Module de synchronisation eM@g ↔ LocMat (Phase 3)
// ============================================================
// Endpoints :
//   POST /api/sav/import/preview   — upload CSV, parsing + comparaison (no-write)
//   POST /api/sav/import/confirm   — application des décisions (transaction)
//   GET  /api/sav/imports          — historique des imports
//   GET  /api/sav/imports/:id      — détails d'un import
//   GET  /api/sav/imports/:id/pdf  — rapport PDF d'un import
//   GET  /api/sav/tickets          — liste des tickets SAV (filtres statut/SN/UID/recherche)
//   GET  /api/sav/tickets/:id      — détail d'un ticket + historique
//   PATCH /api/sav/tickets/:id     — modification interne eM@g (status/notes/resolution)
// ============================================================

import multer from 'multer';
import PDFDocument from 'pdfkit';

import db from './database.js';
import logger from './logger.js';
import { addToHistory } from './db-helpers.js';
import {
  applyConfirm,
  comparePreview,
  parseLocmatCsv,
  SAV_STATUS,
  SAV_STATUS_LABELS,
  SAV_STATUS_VALUES,
} from './services/savComparator.js';

// Multer en mémoire — fichiers CSV de petite taille (< 5 Mo)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Fenêtre rétrospective sur les tickets candidats au matching (90 jours d'inactivité tolérés)
const TICKET_LOOKUP_WINDOW_DAYS = 365;

function loadCandidateTickets() {
  const cutoff = new Date(Date.now() - TICKET_LOOKUP_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  return db
    .prepare(
      `SELECT id, equipment_id, locmat_code, serial_number, uid, status,
              last_modified_source, last_modified_at, opened_at, closed_at,
              created_at, updated_at, cost, title
         FROM sav_tickets
        WHERE status IN ('open','in_progress','waiting_parts')
           OR updated_at >= ?`,
    )
    .all(cutoff);
}

function loadEquipmentList() {
  return db
    .prepare(
      `SELECT id, name, reference, serial_number, uid
         FROM equipment`,
    )
    .all();
}

export function setupSavRoutes(app, authenticateToken, requireAdmin) {
  // ─────────────────────────────────────────────────────────────
  // POST /api/sav/import/preview
  // ─────────────────────────────────────────────────────────────
  app.post(
    '/api/sav/import/preview',
    authenticateToken,
    requireAdmin,
    upload.single('file'),
    (req, res) => {
      try {
        let csvContent = null;
        let filename = null;
        if (req.file) {
          csvContent = req.file.buffer.toString('utf-8');
          filename = req.file.originalname;
        } else if (req.body && typeof req.body.csv === 'string') {
          csvContent = req.body.csv;
          filename = req.body.filename || 'inline.csv';
        }
        if (!csvContent) {
          return res.status(400).json({ success: false, error: 'Aucun CSV fourni' });
        }

        const { rows, errors: parseErrors } = parseLocmatCsv(csvContent);
        if (rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Aucune ligne exploitable dans le CSV',
            parseErrors,
          });
        }

        const existingTickets = loadCandidateTickets();
        const equipmentList = loadEquipmentList();
        const importedAt = new Date().toISOString();

        const preview = comparePreview({
          rows,
          existingTickets,
          equipmentList,
          importedAt,
        });
        // Concatène erreurs de parsing avec erreurs métier
        preview.errors = [...parseErrors, ...preview.errors];
        preview.summary.errors = preview.errors.length;

        res.json({
          success: true,
          filename,
          importedAt,
          preview,
          statusLabels: SAV_STATUS_LABELS,
        });
      } catch (e) {
        logger.error('SAV import preview error:', e);
        res.status(500).json({ success: false, error: 'Erreur preview SAV', message: e.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // POST /api/sav/import/confirm
  // Body : { csv, filename, decisions: { acceptNew, acceptUpdates, acceptClosures, collisionResolutions } }
  // ─────────────────────────────────────────────────────────────
  app.post(
    '/api/sav/import/confirm',
    authenticateToken,
    requireAdmin,
    upload.single('file'),
    (req, res) => {
      try {
        let csvContent = null;
        let filename = null;
        if (req.file) {
          csvContent = req.file.buffer.toString('utf-8');
          filename = req.file.originalname;
        } else if (req.body && typeof req.body.csv === 'string') {
          csvContent = req.body.csv;
          filename = req.body.filename || 'inline.csv';
        }
        if (!csvContent) {
          return res.status(400).json({ success: false, error: 'Aucun CSV fourni' });
        }

        let decisions = {
          acceptNew: true,
          acceptUpdates: true,
          acceptClosures: false, // par défaut, pas de clôture auto sans accord explicite
          collisionResolutions: {},
        };
        if (req.body && req.body.decisions) {
          try {
            const parsed =
              typeof req.body.decisions === 'string'
                ? JSON.parse(req.body.decisions)
                : req.body.decisions;
            decisions = { ...decisions, ...parsed };
          } catch (_) {
            return res.status(400).json({ success: false, error: 'JSON decisions invalide' });
          }
        }

        const { rows, errors: parseErrors } = parseLocmatCsv(csvContent);
        const existingTickets = loadCandidateTickets();
        const equipmentList = loadEquipmentList();
        const importedAt = new Date().toISOString();

        const preview = comparePreview({
          rows,
          existingTickets,
          equipmentList,
          importedAt,
        });
        preview.errors = [...parseErrors, ...preview.errors];
        preview.summary.errors = preview.errors.length;

        const { importId, counts } = applyConfirm({
          db,
          preview,
          decisions,
          filename,
          userId: req.user ? req.user.id : null,
        });

        // ─── Audit trail global : trace de l'utilisateur qui a confirmé l'import ───
        try {
          addToHistory(
            'sav_import',
            String(importId),
            'confirmed',
            {
              filename,
              decisions: {
                acceptNew: !!decisions.acceptNew,
                acceptUpdates: !!decisions.acceptUpdates,
                acceptClosures: !!decisions.acceptClosures,
                collisionResolutionsCount: Object.keys(decisions.collisionResolutions || {}).length,
              },
              counts,
              rowsTotal: preview?.summary?.total ?? null,
            },
            req.user ? req.user.id : null,
            req.user ? req.user.email || req.user.name || null : null,
          );
        } catch (auditErr) {
          // L'échec d'audit ne doit jamais bloquer la confirmation déjà commitée
          logger.warn('SAV import audit trail skipped:', auditErr?.message);
        }

        res.json({
          success: true,
          importId,
          counts,
          summary: preview.summary,
          message: `Import #${importId} appliqué: ${counts.created} créé(s), ${counts.updated} màj, ${counts.closed} clôturé(s).`,
        });
      } catch (e) {
        logger.error('SAV import confirm error:', e);
        res.status(500).json({ success: false, error: 'Erreur confirm SAV', message: e.message });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // GET /api/sav/imports
  // ─────────────────────────────────────────────────────────────
  app.get('/api/sav/imports', authenticateToken, (req, res) => {
    try {
      const rows = db
        .prepare(
          `SELECT i.id, i.imported_at, i.filename, i.rows_total, i.rows_new,
                  i.rows_updated, i.rows_closed, i.rows_collisions, i.rows_duplicates,
                  i.rows_errors, u.name as imported_by_name
             FROM sav_imports i
             LEFT JOIN users u ON i.imported_by = u.id
            ORDER BY i.imported_at DESC
            LIMIT 200`,
        )
        .all();
      res.json({ success: true, imports: rows });
    } catch (e) {
      logger.error('SAV imports list error:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/sav/imports/:id
  // ─────────────────────────────────────────────────────────────
  app.get('/api/sav/imports/:id', authenticateToken, (req, res) => {
    try {
      const row = db
        .prepare(
          `SELECT i.*, u.name as imported_by_name
             FROM sav_imports i
             LEFT JOIN users u ON i.imported_by = u.id
            WHERE i.id = ?`,
        )
        .get(req.params.id);
      if (!row) return res.status(404).json({ success: false, error: 'Import introuvable' });
      try {
        row.summary = JSON.parse(row.summary || 'null');
      } catch (_) {
        /* ignore JSON parse errors */
      }
      try {
        row.details = JSON.parse(row.details || 'null');
      } catch (_) {
        /* ignore JSON parse errors */
      }
      res.json({ success: true, import: row });
    } catch (e) {
      logger.error('SAV import detail error:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/sav/imports/:id/pdf  — Rapport PDF d'un import
  // ─────────────────────────────────────────────────────────────
  app.get('/api/sav/imports/:id/pdf', authenticateToken, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM sav_imports WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ success: false, error: 'Import introuvable' });

      let summary = {};
      let details = {};
      try {
        summary = JSON.parse(row.summary || '{}');
      } catch (_) {
        /* ignore JSON parse errors */
      }
      try {
        details = JSON.parse(row.details || '{}');
      } catch (_) {
        /* ignore JSON parse errors */
      }

      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="rapport-import-sav-${row.id}.pdf"`);
      doc.pipe(res);

      const importedAt = new Date(row.imported_at).toLocaleString('fr-FR');
      doc.fontSize(16).font('Helvetica-Bold').text(`Rapport d'import SAV — #${row.id}`, {
        align: 'center',
      });
      doc.moveDown(0.2);
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666')
        .text(
          `Fichier: ${row.filename || '—'}    •    Importé le: ${importedAt}    •    Total: ${row.rows_total} ligne(s)`,
          { align: 'center' },
        );
      doc.fillColor('#000');
      doc.moveDown(0.6);

      // Tableau de synthèse
      const summaryRows = [
        ['Nouveaux tickets', summary.new ?? row.rows_new ?? 0],
        ['Tickets mis à jour', summary.updated ?? row.rows_updated ?? 0],
        ['Tickets clôturés', summary.closed ?? row.rows_closed ?? 0],
        ['Collisions détectées', summary.collisions ?? row.rows_collisions ?? 0],
        ['Doublons CSV', summary.duplicates ?? row.rows_duplicates ?? 0],
        ['Erreurs', summary.errors ?? row.rows_errors ?? 0],
      ];
      doc.fontSize(11).font('Helvetica-Bold').text('Synthèse');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10);
      summaryRows.forEach(([label, val]) => {
        doc.text(`  • ${label} : ${val}`);
      });
      doc.moveDown(0.5);

      // Helper pour rendre une section liste
      const renderList = (title, items, formatter) => {
        if (!items || items.length === 0) return;
        doc.addPage();
        doc.fontSize(13).font('Helvetica-Bold').text(title);
        doc.moveDown(0.3);
        doc.fontSize(8).font('Helvetica');
        items.forEach((it, i) => {
          doc.text(`${i + 1}. ${formatter(it)}`);
        });
      };

      const fmtRow = (r) =>
        `${r.locmat_code || '—'}  |  ${r.nom_article || r.code_article || '—'}  |  SN=${r.serial_number || '—'}  UID=${r.uid || '—'}  |  Statut=${SAV_STATUS_LABELS[r.status] || r.status}`;
      const fmtClosed = (r) =>
        `Ticket #${r.ticket_id}  (eq ${r.equipment_id || '—'})  ${r.locmat_code || ''}  SN=${r.serial_number || '—'}  Statut: ${SAV_STATUS_LABELS[r.current_status] || r.current_status} → ${SAV_STATUS_LABELS[r.proposed_status] || r.proposed_status}`;
      const fmtCollision = (r) =>
        `Ticket #${r.existing_ticket_id}  ${r.locmat_code || ''}  eM@g=${SAV_STATUS_LABELS[r.emag_status] || r.emag_status}  ⚠  LocMat=${SAV_STATUS_LABELS[r.locmat_status] || r.locmat_status}`;
      const fmtError = (e) => `Ligne ${e.line}: ${e.message}`;

      renderList('Nouveaux tickets', details.newTickets, fmtRow);
      renderList('Tickets mis à jour', details.updatedTickets, fmtRow);
      renderList('Tickets clôturés', details.closedTickets, fmtClosed);
      renderList('Collisions', details.collisions, fmtCollision);
      renderList('Doublons CSV', details.duplicates, fmtRow);
      renderList('Erreurs', details.errors, fmtError);

      doc.end();
    } catch (e) {
      logger.error('SAV import PDF error:', e);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/sav/tickets — Liste filtrée
  // ─────────────────────────────────────────────────────────────
  app.get('/api/sav/tickets', authenticateToken, (req, res) => {
    try {
      const { status, q, equipment_id } = req.query;
      const conds = ['1=1'];
      const params = [];
      if (status) {
        const list = String(status).split(',').filter(Boolean);
        if (list.length > 0) {
          conds.push(`st.status IN (${list.map(() => '?').join(',')})`);
          params.push(...list);
        }
      }
      if (equipment_id) {
        conds.push('st.equipment_id = ?');
        params.push(equipment_id);
      }
      if (q) {
        conds.push(
          '(st.title LIKE ? OR st.serial_number LIKE ? OR st.uid LIKE ? OR st.locmat_code LIKE ? OR e.name LIKE ?)',
        );
        const like = `%${q}%`;
        params.push(like, like, like, like, like);
      }
      const sql = `
        SELECT st.*, e.name as equipment_name, e.reference as equipment_reference,
               e.uid as equipment_uid, e.serial_number as equipment_serial_number
          FROM sav_tickets st
          LEFT JOIN equipment e ON st.equipment_id = e.id
         WHERE ${conds.join(' AND ')}
         ORDER BY st.opened_at DESC, st.created_at DESC
         LIMIT 1000
      `;
      const rows = db.prepare(sql).all(...params);
      res.json({ success: true, tickets: rows, statusLabels: SAV_STATUS_LABELS });
    } catch (e) {
      logger.error('SAV tickets list error:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/sav/tickets/:id — Détail + historique
  // ─────────────────────────────────────────────────────────────
  app.get('/api/sav/tickets/:id', authenticateToken, (req, res) => {
    try {
      const ticket = db
        .prepare(
          `SELECT st.*, e.name as equipment_name, e.reference as equipment_reference,
                  e.uid as equipment_uid, e.serial_number as equipment_serial_number
             FROM sav_tickets st
             LEFT JOIN equipment e ON st.equipment_id = e.id
            WHERE st.id = ?`,
        )
        .get(req.params.id);
      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket introuvable' });
      const history = db
        .prepare(
          `SELECT h.*, u.name as user_name
             FROM sav_ticket_history h
             LEFT JOIN users u ON h.user_id = u.id
            WHERE h.ticket_id = ?
            ORDER BY h.timestamp DESC`,
        )
        .all(req.params.id);
      res.json({ success: true, ticket, history, statusLabels: SAV_STATUS_LABELS });
    } catch (e) {
      logger.error('SAV ticket detail error:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/sav/tickets/:id — Modif interne eM@g
  // Body: { status, notes, resolution, cost }
  // ─────────────────────────────────────────────────────────────
  app.patch('/api/sav/tickets/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const ticket = db.prepare('SELECT * FROM sav_tickets WHERE id = ?').get(req.params.id);
      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket introuvable' });

      const allowed = ['status', 'notes', 'resolution', 'cost'];
      const sets = [];
      const params = [];
      const histInserts = [];

      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          if (key === 'status' && !SAV_STATUS_VALUES.includes(req.body[key])) {
            return res.status(400).json({
              success: false,
              error: `Statut invalide. Valeurs autorisées: ${SAV_STATUS_VALUES.join(', ')}`,
            });
          }
          sets.push(`${key} = ?`);
          params.push(req.body[key]);
          if (ticket[key] !== req.body[key]) {
            histInserts.push({
              field: key,
              old_value: ticket[key] != null ? String(ticket[key]) : null,
              new_value: req.body[key] != null ? String(req.body[key]) : null,
            });
          }
        }
      }
      if (sets.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
      }

      sets.push("last_modified_source = 'emag'");
      sets.push('last_modified_at = CURRENT_TIMESTAMP');
      sets.push('updated_at = CURRENT_TIMESTAMP');
      if (req.body.status === SAV_STATUS.CLOSED || req.body.status === SAV_STATUS.RESOLVED) {
        sets.push('resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)');
      }
      if (req.body.status === SAV_STATUS.CLOSED || req.body.status === SAV_STATUS.SORTIE_SAV) {
        sets.push('closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP)');
      }
      params.push(req.params.id);

      const txn = db.transaction(() => {
        db.prepare(`UPDATE sav_tickets SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        const insertH = db.prepare(
          `INSERT INTO sav_ticket_history (ticket_id, field, old_value, new_value, source, user_id)
           VALUES (?, ?, ?, ?, 'emag', ?)`,
        );
        for (const h of histInserts) {
          insertH.run(req.params.id, h.field, h.old_value, h.new_value, req.user?.id || null);
        }
      });
      txn();
      res.json({ success: true });
    } catch (e) {
      logger.error('SAV ticket patch error:', e);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}
