// ═══════════════════════════════════════════════════════════════
// pvImportRoutes.js — API REST /api/pv-imports/*
//
// Workflow :
//   1. POST   /api/pv-imports/upload    (multipart 1..N PDFs)
//      → stocke fichier, calcule hash, parse, crée pv_imports
//        en status='pending_resolution', renvoie aperçu+candidats match.
//   2. POST   /api/pv-imports/:id/apply (body: {mapping})
//      → matérialise les contrôles : updates equipment_controls,
//        ajoute entries control_history avec PDF dans documents JSON,
//        ou insère ligne equipment_lots_controls pour non sérialisés,
//        ou crée nouveau equipment_controls si demandé.
//   3. DELETE /api/pv-imports/:id        → status='ignored' (audit conservé)
//   4. GET    /api/pv-imports            → liste paginée (admin)
//   5. GET    /api/pv-imports/by-equipment/:id
//   6. GET    /api/pv-imports/by-vehicle/:id
//   7. GET    /api/pv-imports/:id        → détail + parsed_data
//
// Sécurité : toutes les routes derrière authenticateToken.
// Routes d'admin (upload, apply, delete, list global) → requireAdmin.
// Lecture par entité ouverte aux utilisateurs authentifiés.
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';
import logger from './logger.js';
import { uploadPv } from './middleware/upload.js';
import { computeFileHash, parsePvPdf } from './services/pvParser.js';
import { addDays } from './services/controlesService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PV_DIR_ABS = path.join(__dirname, '..', '..', 'public', 'pv');

function safe(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      const code = e.statusCode || 500;
      if (code >= 500) logger.error('PV Import:', e);
      res.status(code).json({ success: false, error: e.message || 'Erreur serveur' });
    }
  };
}

// ─── Helpers matching ───────────────────────────────────────────

/**
 * Cherche des équipements correspondant à un n° de série / référence extraits.
 * Renvoie un tableau de candidats { id, name, reference, serial_number, source }.
 */
function findEquipmentCandidates({ serialNumber, reference }) {
  const candidates = [];
  if (serialNumber) {
    // 1. equipment_serials (table des séries actives)
    const fromSerials = db
      .prepare(
        `SELECT e.id, e.name, e.reference, e.serial_number, es.serial AS matched_serial,
                'equipment_serials' AS source
           FROM equipment_serials es
           JOIN equipment e ON e.id = es.equipment_id
          WHERE es.serial = ? AND es.status = 'active'
          LIMIT 5`,
      )
      .all(serialNumber);
    candidates.push(...fromSerials);

    // 2. equipment.serial_number (legacy direct)
    const fromDirect = db
      .prepare(
        `SELECT id, name, reference, serial_number, serial_number AS matched_serial,
                'equipment.serial_number' AS source
           FROM equipment
          WHERE serial_number = ? AND id NOT IN (
            SELECT equipment_id FROM equipment_serials WHERE serial = ? AND status='active'
          )
          LIMIT 5`,
      )
      .all(serialNumber, serialNumber);
    candidates.push(...fromDirect);
  }
  if (reference && candidates.length === 0) {
    const fromRef = db
      .prepare(
        `SELECT id, name, reference, serial_number, NULL AS matched_serial,
                'equipment.reference' AS source
           FROM equipment
          WHERE reference = ?
          LIMIT 5`,
      )
      .all(reference);
    candidates.push(...fromRef);
  }
  return candidates;
}

/**
 * Cherche des véhicules correspondants (registration ou VIN).
 */
function findVehicleCandidates({ serialNumber, reference }) {
  const candidates = [];
  const tokens = [serialNumber, reference].filter(Boolean);
  for (const t of tokens) {
    const rows = db
      .prepare(
        `SELECT id, name, registration, vin
           FROM vehicles
          WHERE UPPER(REPLACE(REPLACE(registration,'-',''),' ','')) = UPPER(REPLACE(REPLACE(?,'-',''),' ',''))
             OR UPPER(vin) = UPPER(?)
          LIMIT 5`,
      )
      .all(t, t);
    candidates.push(...rows);
  }
  // Dédup par id
  const seen = new Set();
  return candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

// ─── Suppression fichier sur disque (best-effort) ───────────────
function safeUnlink(relPath) {
  if (!relPath) return;
  try {
    const abs = path.join(__dirname, '..', '..', 'public', relPath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    logger.warn(`PV Import: échec suppression fichier ${relPath}:`, e.message);
  }
}

// ─── Application des résolutions (transaction) ──────────────────

/**
 * Applique le mapping utilisateur à un pv_import.
 * mapping = {
 *   action: 'attach_existing_control' | 'create_control' | 'lot' | 'vehicle_ct' | 'ignore',
 *   // attach_existing_control:
 *   equipment_control_id?: number,
 *   // create_control:
 *   entity_type?: 'equipment'|'vehicle', entity_id?: number, control_type_id?: number,
 *   // lot:
 *   equipment_id?: number|null, quantite_controlee?: number, quantite_non_controlee?: number,
 *   // commun:
 *   date_done?: 'YYYY-MM-DD', next_due_date?: 'YYYY-MM-DD',
 *   statut?: string, organisme?: string, notes?: string,
 * }
 */
function applyMapping(pvImport, mapping, user) {
  const parsed = JSON.parse(pvImport.parsed_data || '{}');
  const pdfUrl = `/${pvImport.file_path}`; // ex: /pv/pv-xxx.pdf
  const docEntry = {
    name: pvImport.original_name,
    url: pdfUrl,
    size: pvImport.file_size,
    type: pvImport.mime_type || 'application/pdf',
    pv_import_id: pvImport.id,
  };
  const dateDone =
    mapping.date_done || parsed.dateControle || new Date().toISOString().slice(0, 10);
  // next_due_date : priorité mapping explicite → valeur extraite du PV →
  // calcul dateDone + périodicité du type (control_types.default_periodicity_days).
  // Beaucoup de PV n'indiquent que la date d'intervention ; sans ce calcul,
  // les contrôles seraient créés sans échéance (bug 2026-05-28).
  let nextDue = mapping.next_due_date || parsed.prochainControle || null;
  const performedBy = user?.username || user?.name || pvImport.created_by || 'import-pv';
  const statusVal =
    (mapping.statut || parsed.statut || 'EFFECTUE') === 'NON_CONFORME' ? 'MANQUE' : 'EFFECTUE';

  const txn = db.transaction(() => {
    let matched = 0;
    let unmatched = 0;

    switch (mapping.action) {
      case 'attach_existing_control': {
        const ctrl = db
          .prepare('SELECT * FROM equipment_controls WHERE id = ?')
          .get(mapping.equipment_control_id);
        if (!ctrl) throw new Error('Contrôle cible introuvable');
        const previousDue = ctrl.next_due_date;
        if (!nextDue) {
          const periodicity =
            ctrl.periodicity_days ||
            db
              .prepare('SELECT default_periodicity_days FROM control_types WHERE id = ?')
              .get(ctrl.control_type_id)?.default_periodicity_days ||
            null;
          if (periodicity) nextDue = addDays(dateDone, periodicity);
        }
        db.prepare(
          `UPDATE equipment_controls
              SET last_done_date = ?, next_due_date = COALESCE(?, next_due_date),
                  status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
        ).run(dateDone, nextDue, statusVal === 'EFFECTUE' ? 'EFFECTUE' : 'MANQUE', ctrl.id);
        db.prepare(
          `INSERT INTO control_history
            (equipment_control_id, performed_at, performed_by, status,
             previous_due_date, next_due_date, notes, documents)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          ctrl.id,
          dateDone,
          performedBy,
          statusVal,
          previousDue,
          nextDue,
          mapping.notes || parsed.organisme || null,
          JSON.stringify([docEntry]),
        );
        matched = 1;
        break;
      }
      case 'create_control': {
        if (!mapping.entity_type || !mapping.entity_id || !mapping.control_type_id) {
          throw new Error('entity_type, entity_id et control_type_id requis pour create_control');
        }
        const typeRow = db
          .prepare('SELECT default_periodicity_days FROM control_types WHERE id = ?')
          .get(mapping.control_type_id);
        const periodicity = typeRow?.default_periodicity_days || null;
        if (!nextDue && periodicity) nextDue = addDays(dateDone, periodicity);
        const insRes = db
          .prepare(
            `INSERT INTO equipment_controls
              (entity_type, entity_id, control_type_id, periodicity_days,
               next_due_date, last_done_date, status, notes, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          )
          .run(
            mapping.entity_type,
            String(mapping.entity_id),
            mapping.control_type_id,
            periodicity,
            nextDue,
            dateDone,
            statusVal === 'EFFECTUE' ? 'EFFECTUE' : 'MANQUE',
            mapping.notes || parsed.organisme || null,
            performedBy,
          );
        db.prepare(
          `INSERT INTO control_history
            (equipment_control_id, performed_at, performed_by, status,
             previous_due_date, next_due_date, notes, documents)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          insRes.lastInsertRowid,
          dateDone,
          performedBy,
          statusVal,
          null,
          nextDue,
          mapping.notes || parsed.organisme || null,
          JSON.stringify([docEntry]),
        );
        matched = 1;
        break;
      }
      case 'lot': {
        db.prepare(
          `INSERT INTO equipment_lots_controls
            (equipment_id, reference, date_control, quantite_controlee,
             quantite_non_controlee, organisme, notes, pdf_path, pv_import_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          mapping.equipment_id || null,
          parsed.reference || null,
          dateDone,
          Number(mapping.quantite_controlee || 0),
          Number(mapping.quantite_non_controlee || 0),
          mapping.organisme || parsed.organisme || null,
          mapping.notes || null,
          pvImport.file_path,
          pvImport.id,
          performedBy,
        );
        matched = 1;
        if (Number(mapping.quantite_non_controlee || 0) > 0) unmatched = 1;

        // Création optionnelle d'un equipment_controls par équipement ciblé.
        // Nécessite mapping.equipment_ids (Array<number>) + mapping.control_type_id.
        // Pour chaque équipement : UPSERT du contrôle (entité, type) et entrée
        // d'historique avec le PDF. La prochaine échéance est calculée à partir
        // de la date PV + périodicité par défaut du type si non fournie.
        const eqIds = Array.isArray(mapping.equipment_ids)
          ? mapping.equipment_ids.filter((x) => x != null && String(x).trim() !== '')
          : [];
        if (eqIds.length > 0 && mapping.control_type_id) {
          const typeRow = db
            .prepare('SELECT default_periodicity_days FROM control_types WHERE id = ?')
            .get(mapping.control_type_id);
          const periodicity = typeRow?.default_periodicity_days || null;
          const nextDueLot = nextDue || (periodicity ? addDays(dateDone, periodicity) : null);
          const ctrlStatus = statusVal === 'EFFECTUE' ? 'EFFECTUE' : 'MANQUE';

          const findExisting = db.prepare(
            `SELECT id, next_due_date FROM equipment_controls
              WHERE entity_type = 'equipment' AND entity_id = ?
                AND control_type_id = ? AND is_active = 1
              LIMIT 1`,
          );
          const insCtrl = db.prepare(
            `INSERT INTO equipment_controls
              (entity_type, entity_id, control_type_id, periodicity_days,
               next_due_date, last_done_date, status, notes, is_active, created_by)
             VALUES ('equipment', ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          );
          const updCtrl = db.prepare(
            `UPDATE equipment_controls
                SET last_done_date = ?, next_due_date = COALESCE(?, next_due_date),
                    periodicity_days = COALESCE(periodicity_days, ?),
                    status = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
          );
          const insHist = db.prepare(
            `INSERT INTO control_history
              (equipment_control_id, performed_at, performed_by, status,
               previous_due_date, next_due_date, notes, documents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          );

          for (const rawId of eqIds) {
            const eqId = String(rawId);
            const existing = findExisting.get(eqId, mapping.control_type_id);
            let ctrlId;
            let previousDue = null;
            if (existing) {
              previousDue = existing.next_due_date;
              updCtrl.run(dateDone, nextDueLot, periodicity, ctrlStatus, existing.id);
              ctrlId = existing.id;
            } else {
              const r = insCtrl.run(
                eqId,
                mapping.control_type_id,
                periodicity,
                nextDueLot,
                dateDone,
                ctrlStatus,
                mapping.notes || parsed.organisme || null,
                performedBy,
              );
              ctrlId = r.lastInsertRowid;
            }
            insHist.run(
              ctrlId,
              dateDone,
              performedBy,
              statusVal,
              previousDue,
              nextDueLot,
              mapping.notes || parsed.organisme || null,
              JSON.stringify([docEntry]),
            );
          }
          matched = eqIds.length;
        }
        break;
      }
      case 'ignore':
        // Rien à faire — l'import sera marqué ignored ci-dessous.
        break;
      default:
        throw new Error(`Action de mapping inconnue : ${mapping.action}`);
    }

    db.prepare(
      `UPDATE pv_imports
          SET status = ?, matched_count = ?, unmatched_count = ?,
              applied_at = CURRENT_TIMESTAMP, applied_by = ?
        WHERE id = ?`,
    ).run(
      mapping.action === 'ignore' ? 'ignored' : 'applied',
      matched,
      unmatched,
      performedBy,
      pvImport.id,
    );
  });
  txn();
}

// ─── Routes ─────────────────────────────────────────────────────

export function setupPvImportRoutes(app, authenticateToken, requireAdmin) {
  // Garantit l'existence du dossier au démarrage
  if (!fs.existsSync(PV_DIR_ABS)) fs.mkdirSync(PV_DIR_ABS, { recursive: true });

  // ── 1. Upload (1..N PDFs) ─────────────────────────────────────
  app.post(
    '/api/pv-imports/upload',
    authenticateToken,
    requireAdmin,
    uploadPv.array('files', 20),
    safe(async (req, res) => {
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucun fichier reçu' });
      }
      const created = [];
      const skipped = [];
      for (const f of files) {
        const absPath = f.path;
        const relPath = path.relative(path.join(__dirname, '..', '..', 'public'), absPath);
        try {
          const hash = computeFileHash(absPath);

          // Anti-doublon
          const existing = db
            .prepare('SELECT id, status FROM pv_imports WHERE file_hash = ?')
            .get(hash);
          if (existing) {
            safeUnlink(relPath);
            skipped.push({
              original_name: f.originalname,
              reason: 'duplicate',
              existing_id: existing.id,
              existing_status: existing.status,
            });
            continue;
          }

          // Parse
          let parsed;
          let parseError = null;
          try {
            parsed = await parsePvPdf(absPath);
          } catch (e) {
            parseError = e.message;
            parsed = { rawText: '', warnings: [`Parsing échoué: ${e.message}`], confidence: 'low' };
          }

          // Candidats match
          const equipmentCandidates = findEquipmentCandidates({
            serialNumber: parsed.serialNumber,
            reference: parsed.reference,
          });
          const vehicleCandidates = findVehicleCandidates({
            serialNumber: parsed.serialNumber,
            reference: parsed.reference,
          });

          const fullParsed = { ...parsed, equipmentCandidates, vehicleCandidates };

          const result = db
            .prepare(
              `INSERT INTO pv_imports
                (file_name, original_name, file_path, file_size, file_hash, mime_type,
                 parsed_data, status, error_message, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              f.filename,
              f.originalname,
              relPath,
              f.size,
              hash,
              f.mimetype || 'application/pdf',
              JSON.stringify(fullParsed),
              parseError ? 'error' : 'pending_resolution',
              parseError,
              req.user?.username || req.user?.name || null,
            );

          created.push({
            id: result.lastInsertRowid,
            original_name: f.originalname,
            file_path: relPath,
            parsed: fullParsed,
            status: parseError ? 'error' : 'pending_resolution',
            error: parseError,
          });
        } catch (e) {
          logger.error('PV Import: échec traitement fichier', f.originalname, e);
          safeUnlink(relPath);
          skipped.push({ original_name: f.originalname, reason: 'error', error: e.message });
        }
      }
      res.json({ success: true, created, skipped });
    }),
  );

  // ── 2. Appliquer un mapping ───────────────────────────────────
  app.post(
    '/api/pv-imports/:id/apply',
    authenticateToken,
    requireAdmin,
    safe(async (req, res) => {
      const id = Number(req.params.id);
      const pv = db.prepare('SELECT * FROM pv_imports WHERE id = ?').get(id);
      if (!pv) return res.status(404).json({ success: false, error: 'Import introuvable' });
      if (pv.status === 'applied') {
        return res.status(409).json({ success: false, error: 'Déjà appliqué' });
      }
      const mapping = req.body?.mapping;
      if (!mapping?.action) {
        return res.status(400).json({ success: false, error: 'mapping.action requis' });
      }
      applyMapping(pv, mapping, req.user);
      const updated = db.prepare('SELECT * FROM pv_imports WHERE id = ?').get(id);
      res.json({ success: true, pv_import: updated });
    }),
  );

  // ── 3. Ignorer / supprimer ────────────────────────────────────
  app.delete(
    '/api/pv-imports/:id',
    authenticateToken,
    requireAdmin,
    safe(async (req, res) => {
      const id = Number(req.params.id);
      const pv = db.prepare('SELECT * FROM pv_imports WHERE id = ?').get(id);
      if (!pv) return res.status(404).json({ success: false, error: 'Import introuvable' });
      // Audit conservé : on bascule en 'ignored' et on supprime le fichier disque
      // SAUF si déjà appliqué (le PDF est référencé par control_history.documents)
      const hardDelete = req.query.hard === '1';
      if (pv.status !== 'applied' || hardDelete) {
        safeUnlink(pv.file_path);
      }
      db.prepare(
        `UPDATE pv_imports SET status = 'ignored', applied_at = CURRENT_TIMESTAMP, applied_by = ? WHERE id = ?`,
      ).run(req.user?.username || 'admin', id);
      res.json({ success: true });
    }),
  );

  // ── 4. Liste paginée (admin) ─────────────────────────────────
  app.get(
    '/api/pv-imports',
    authenticateToken,
    requireAdmin,
    safe(async (req, res) => {
      const status = req.query.status || null;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const where = status ? 'WHERE status = ?' : '';
      const params = status ? [status, limit, offset] : [limit, offset];
      const rows = db
        .prepare(
          `SELECT id, original_name, file_path, file_size, status, matched_count, unmatched_count,
                  error_message, applied_at, applied_by, created_at, created_by
             FROM pv_imports
             ${where}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
        )
        .all(...params);
      const total = db
        .prepare(`SELECT COUNT(*) AS c FROM pv_imports ${where}`)
        .get(...(status ? [status] : [])).c;
      res.json({ success: true, items: rows, total, limit, offset });
    }),
  );

  // ── 5. Détail d'un import (avec parsed_data) ─────────────────
  app.get(
    '/api/pv-imports/:id',
    authenticateToken,
    safe(async (req, res) => {
      const row = db.prepare('SELECT * FROM pv_imports WHERE id = ?').get(Number(req.params.id));
      if (!row) return res.status(404).json({ success: false, error: 'Introuvable' });
      let parsed;
      try {
        parsed = JSON.parse(row.parsed_data || '{}');
      } catch {
        parsed = {};
      }
      res.json({ success: true, pv_import: { ...row, parsed_data: parsed } });
    }),
  );

  // ── 6. Liste PV pour un équipement ───────────────────────────
  app.get(
    '/api/pv-imports/by-equipment/:id',
    authenticateToken,
    safe(async (req, res) => {
      const eqId = Number(req.params.id);
      // PV applicés via control_history.documents (LIKE sur JSON, OK ici)
      const fromControls = db
        .prepare(
          `SELECT ch.id AS history_id, ch.performed_at, ch.documents, ec.id AS control_id, ec.entity_type
             FROM control_history ch
             JOIN equipment_controls ec ON ec.id = ch.equipment_control_id
            WHERE ec.entity_type = 'equipment' AND ec.entity_id = ?
              AND ch.documents IS NOT NULL AND ch.documents != '[]'
            ORDER BY ch.performed_at DESC`,
        )
        .all(String(eqId));
      const fromLots = db
        .prepare(
          `SELECT id, date_control, quantite_controlee, quantite_non_controlee,
                  organisme, notes, pdf_path
             FROM equipment_lots_controls
            WHERE equipment_id = ?
            ORDER BY date_control DESC`,
        )
        .all(eqId);
      res.json({ success: true, controls: fromControls, lots: fromLots });
    }),
  );

  // ── 7. Liste PV pour un véhicule ─────────────────────────────
  app.get(
    '/api/pv-imports/by-vehicle/:id',
    authenticateToken,
    safe(async (req, res) => {
      const vid = Number(req.params.id);
      const rows = db
        .prepare(
          `SELECT ch.id AS history_id, ch.performed_at, ch.documents, ec.id AS control_id
             FROM control_history ch
             JOIN equipment_controls ec ON ec.id = ch.equipment_control_id
            WHERE ec.entity_type = 'vehicle' AND ec.entity_id = ?
              AND ch.documents IS NOT NULL AND ch.documents != '[]'
            ORDER BY ch.performed_at DESC`,
        )
        .all(String(vid));
      res.json({ success: true, controls: rows });
    }),
  );

  logger.info('✅ Routes PV Import enregistrées (/api/pv-imports/*)');
}
