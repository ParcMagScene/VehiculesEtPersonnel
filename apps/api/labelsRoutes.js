// ═══════════════════════════════════════════════════════════════
// labelsRoutes.js
//
// Routes pour la génération d'étiquettes laser (LightBurn) à partir des
// numéros de série de la table `equipment_serials`.
//
//   • GET  /api/labels/serialized        → liste des serials + equipment
//   • PUT  /api/labels/serial/:id        → édite mag_number d'un serial
//   • POST /api/labels/generate          → SVG plaque 200×200 mm (download)
//   • POST /api/labels/generate-one      → SVG d'une seule étiquette (preview)
//
// Authentification : tokens classiques. Édition réservée à requireAdmin
// (cohérent avec le reste du module equipment / locmat).
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';
import { buildLabelSvg, buildPlateSvg, computeLayout } from './services/labelGenerator.js';
import {
  buildLightburnLabelSvg,
  buildLightburnPlateSvg,
  LIGHTBURN_LAYOUT,
} from './services/lightburnLabelGenerator.js';
import { buildEquipmentQrPayload } from './services/qrcodeGenerator.js';

// Validation simple du format mag_number : 1 lettre + 2 ou 3 chiffres,
// ou null/empty pour effacer. Tolérant aux espaces autour.
const MAG_REGEX = /^[A-Za-z][0-9]{2,4}$/;

function normalizeMagNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === '') return null;
  return s;
}

// Détecte un préfixe Numéro Mag dans une chaîne serial.
// Patterns supportés (case insensitive) :
//   "T01 - 2400953513"  → { mag: 'T01', serial: '2400953513' }
//   "T01-2400953513"    → idem
//   "T01 2400953513"    → idem
//   "2400953513"        → { mag: null, serial: '2400953513' } (rien à détecter)
// Le préfixe doit matcher MAG_REGEX et être suivi d'un séparateur (espace ou -).
const MAG_PREFIX_RE = /^([A-Za-z][0-9]{2,4})\s*[-\s]\s*(.+)$/;
function detectMagFromSerial(serial) {
  if (!serial) return { mag: null, serial: serial || '' };
  const m = String(serial).trim().match(MAG_PREFIX_RE);
  if (!m) return { mag: null, serial: String(serial).trim() };
  return { mag: m[1].toUpperCase(), serial: m[2].trim() };
}

export function setupLabelsRoutes(app, authenticateToken, requireAdmin) {
  // ─── GET /api/labels/serialized ──────────────────────────────────────
  // Liste des serials actifs avec equipment associé. Filtres optionnels :
  //   ?equipmentId=…   → un seul produit
  //   ?withoutMag=1    → uniquement ceux sans mag_number
  //   ?search=…        → texte libre (serial, mag, nom, référence, uid)
  app.get('/api/labels/serialized', authenticateToken, (req, res) => {
    try {
      const where = ["s.status = 'active'"];
      const params = {};
      if (req.query.equipmentId) {
        where.push('s.equipment_id = @equipmentId');
        params.equipmentId = Number(req.query.equipmentId);
      }
      if (req.query.withoutMag === '1' || req.query.withoutMag === 'true') {
        where.push('(s.mag_number IS NULL OR s.mag_number = "")');
      }
      if (req.query.search) {
        where.push(
          '(UPPER(s.serial) LIKE @q OR UPPER(s.mag_number) LIKE @q' +
            ' OR UPPER(e.name) LIKE @q OR UPPER(e.reference) LIKE @q OR UPPER(e.uid) LIKE @q)',
        );
        params.q = `%${String(req.query.search).toUpperCase()}%`;
      }

      const rows = db
        .prepare(
          `SELECT s.id            AS serial_id,
                  s.equipment_id  AS equipment_id,
                  s.serial        AS serial,
                  s.mag_number    AS mag_number,
                  s.uid           AS serial_uid,
                  s.status        AS status,
                  s.created_at    AS created_at,
                  e.uid           AS equipment_uid,
                  e.reference     AS equipment_reference,
                  e.name          AS equipment_name,
                  e.numero_mag    AS equipment_numero_mag
           FROM equipment_serials s
           INNER JOIN equipment e ON e.id = s.equipment_id
           WHERE ${where.join(' AND ')}
           ORDER BY e.name COLLATE NOCASE ASC, s.serial COLLATE NOCASE ASC
           LIMIT 5000`,
        )
        .all(params);

      // Enrichit chaque row avec une suggestion auto si mag_number absent
      // et que le serial contient un préfixe détectable (ex: "T01 - 2400953513").
      const enriched = rows.map((r) => {
        if (r.mag_number) return { ...r, suggested_mag: null, suggested_serial: null };
        const det = detectMagFromSerial(r.serial);
        return {
          ...r,
          suggested_mag: det.mag,
          suggested_serial: det.mag ? det.serial : null,
        };
      });

      res.json({ items: enriched, total: enriched.length });
    } catch (e) {
      logger.error('GET /api/labels/serialized:', e.message);
      res.status(500).json({ error: 'Erreur lors du chargement', detail: e.message });
    }
  });

  // ─── PUT /api/labels/serial/:id ──────────────────────────────────────
  // Met à jour mag_number d'un serial (admin).
  app.put('/api/labels/serial/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: 'ID invalide' });
      }
      const mag = normalizeMagNumber(req.body?.mag_number);
      if (mag != null && !MAG_REGEX.test(mag)) {
        return res.status(400).json({
          error: 'Format Numéro Mag invalide',
          detail: 'Attendu : 1 lettre + 2 à 4 chiffres (ex: A12, B003)',
        });
      }
      const exists = db.prepare('SELECT id FROM equipment_serials WHERE id = ?').get(id);
      if (!exists) return res.status(404).json({ error: 'Numéro de série introuvable' });

      db.prepare('UPDATE equipment_serials SET mag_number = ? WHERE id = ?').run(mag, id);
      res.json({ success: true, id, mag_number: mag });
    } catch (e) {
      logger.error('PUT /api/labels/serial/:id:', e.message);
      res.status(500).json({ error: 'Erreur lors de la mise à jour', detail: e.message });
    }
  });

  // ─── POST /api/labels/generate ───────────────────────────────────────
  // Body : { serialIds: number[], filename?: string }
  // Réponse : SVG (image/svg+xml) en download.
  app.post('/api/labels/generate', authenticateToken, async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.serialIds) ? req.body.serialIds.map(Number) : [];
      if (ids.length === 0) {
        return res.status(400).json({ error: 'Aucun serial sélectionné' });
      }
      const layout = computeLayout();
      const max = layout.cols * layout.rows;
      if (ids.length > max) {
        return res.status(400).json({
          error: `Sélection trop grande`,
          detail: `Maximum ${max} étiquettes par plaque (reçu : ${ids.length})`,
        });
      }

      // Récupération conserve l'ordre demandé par le client
      const placeholders = ids.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT s.id, s.serial, s.mag_number, s.uid AS serial_uid,
                  e.uid AS equipment_uid, e.name AS equipment_name,
                  e.reference AS equipment_reference
           FROM equipment_serials s
           INNER JOIN equipment e ON e.id = s.equipment_id
           WHERE s.id IN (${placeholders})`,
        )
        .all(...ids);
      const byId = new Map(rows.map((r) => [r.id, r]));

      const items = ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((r) => {
          // Si pas de mag_number stocké mais serial contient un préfixe,
          // on l'utilise pour l'étiquette ET on nettoie le serial affiché.
          let mag = r.mag_number || '';
          let serial = r.serial || '';
          if (!mag) {
            const det = detectMagFromSerial(serial);
            if (det.mag) {
              mag = det.mag;
              serial = det.serial;
            }
          }
          // UID affiché : celui du SERIAL (unique par unité), sinon fallback equipment.
          // QR payload : URL absolue vers la fiche mobile de l'ÉQUIPEMENT (cohérence
          // avec EquipmentDetail / EquipmentLabelPrint / EquipmentBatchLabels).
          const unitUid = r.serial_uid || r.equipment_uid || '';
          const qrUid = r.equipment_uid || unitUid;
          return {
            reference: r.equipment_reference || '',
            uid: unitUid,
            serial,
            magNumber: mag,
            qrPayload: qrUid ? buildEquipmentQrPayload(qrUid) : '',
          };
        });

      if (items.length === 0) {
        return res.status(404).json({ error: 'Aucun serial valide trouvé' });
      }

      const svg = await buildPlateSvg(items);
      const filename = String(req.body?.filename || 'plaque-etiquettes-200x200.svg');
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(svg);
    } catch (e) {
      logger.error('POST /api/labels/generate:', e.message);
      res.status(500).json({ error: 'Erreur de génération', detail: e.message });
    }
  });

  // ─── POST /api/labels/generate-one ────────────────────────────────────
  // Body : { uid?, serial?, magNumber? } → SVG d'une étiquette (preview).
  app.post('/api/labels/generate-one', authenticateToken, async (req, res) => {
    try {
      const uid = String(req.body?.uid || '').trim();
      const serial = String(req.body?.serial || '').trim();
      // QR payload : URL absolue vers la fiche mobile (même format que les autres
      // surfaces). Si le client fournit explicitement qrPayload, on respecte sa valeur.
      const explicitPayload = String(req.body?.qrPayload || '').trim();
      const qrPayload = explicitPayload || (uid ? buildEquipmentQrPayload(uid) : serial) || ' ';
      const item = {
        uid,
        serial,
        magNumber: String(req.body?.magNumber || '').trim(),
        qrPayload,
      };
      const svg = await buildLabelSvg(item);
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.send(svg);
    } catch (e) {
      logger.error('POST /api/labels/generate-one:', e.message);
      res.status(500).json({ error: 'Erreur de génération', detail: e.message });
    }
  });

  // ═══ LightBurn (mode strict 3 calques pour gravure alu anodisé noir) ═══
  // Même payload que /api/labels/generate (serialIds[]) mais sortie SVG
  // structurée en 3 groupes nommés QR_IMAGE / TEXT_FILL / FRAME_LINE,
  // QR + logo en PNG raster fusionné. Cf. apps/api/services/LIGHTBURN-LABELS.md.
  app.post('/api/labels/lightburn/plate', authenticateToken, async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.serialIds) ? req.body.serialIds.map(Number) : [];
      if (ids.length === 0) return res.status(400).json({ error: 'Aucun serial sélectionné' });
      const max = LIGHTBURN_LAYOUT.COLS * LIGHTBURN_LAYOUT.ROWS;
      if (ids.length > max) {
        return res.status(400).json({
          error: 'Sélection trop grande',
          detail: `Maximum ${max} étiquettes par plaque LightBurn (reçu : ${ids.length})`,
        });
      }

      const placeholders = ids.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT s.id, s.serial, s.mag_number, s.uid AS serial_uid,
                  e.uid AS equipment_uid, e.name AS equipment_name,
                  e.reference AS equipment_reference
           FROM equipment_serials s
           INNER JOIN equipment e ON e.id = s.equipment_id
           WHERE s.id IN (${placeholders})`,
        )
        .all(...ids);
      const byId = new Map(rows.map((r) => [r.id, r]));

      const items = ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((r) => {
          let mag = r.mag_number || '';
          let serial = r.serial || '';
          if (!mag) {
            const det = detectMagFromSerial(serial);
            if (det.mag) {
              mag = det.mag;
              serial = det.serial;
            }
          }
          const unitUid = r.serial_uid || r.equipment_uid || '';
          const qrUid = r.equipment_uid || unitUid;
          return {
            uid: unitUid,
            serial,
            magNumber: mag,
            qrPayload: qrUid ? buildEquipmentQrPayload(qrUid) : '',
          };
        });

      if (items.length === 0) return res.status(404).json({ error: 'Aucun serial valide trouvé' });

      // Optionnel : labelH alternatif (33.33 mm) pour plaque 4 colonnes × 6 lignes
      const labelH = Number(req.body?.labelH) > 0 ? Number(req.body.labelH) : undefined;
      const opts = labelH ? { labelH } : {};
      const svg = buildLightburnPlateSvg(items, opts);

      const filename = String(req.body?.filename || 'lightburn-plaque-200x200.svg');
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(svg);
    } catch (e) {
      logger.error('POST /api/labels/lightburn/plate:', e.message);
      res.status(500).json({ error: 'Erreur de génération LightBurn', detail: e.message });
    }
  });

  // POST /api/labels/lightburn/one — preview d'une étiquette LightBurn unique.
  app.post('/api/labels/lightburn/one', authenticateToken, async (req, res) => {
    try {
      const uid = String(req.body?.uid || '').trim();
      const serial = String(req.body?.serial || '').trim();
      const explicitPayload = String(req.body?.qrPayload || '').trim();
      const qrPayload = explicitPayload || (uid ? buildEquipmentQrPayload(uid) : serial) || ' ';
      const item = {
        uid,
        serial,
        magNumber: String(req.body?.magNumber || '').trim(),
        qrPayload,
      };
      const labelH = Number(req.body?.labelH) > 0 ? Number(req.body.labelH) : undefined;
      const svg = buildLightburnLabelSvg(item, labelH ? { labelH } : {});
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.send(svg);
    } catch (e) {
      logger.error('POST /api/labels/lightburn/one:', e.message);
      res.status(500).json({ error: 'Erreur de génération LightBurn', detail: e.message });
    }
  });

  logger.info('  ✅ Routes Labels (étiquettes laser LightBurn) prêtes');
}
