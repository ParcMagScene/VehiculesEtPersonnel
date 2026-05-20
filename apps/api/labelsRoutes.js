// ═══════════════════════════════════════════════════════════════
// labelsRoutes.js
//
// Routes pour la génération d'étiquettes laser (LightBurn).
// Modèle A : 1 ligne `equipment` = 1 unité physique avec uid + serial_number
// uniques. Les anciennes routes `serialId` désignent maintenant `equipment.id`.
//
//   • GET  /api/labels/serialized        → liste des equipment avec serial_number
//   • PUT  /api/labels/serial/:id        → édite numero_mag d'un equipment
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
import { MAG_NUMBER_RE, parseMagSerial } from './services/magNumber.js';
import { buildEquipmentQrPayload } from './services/qrcodeGenerator.js';
import { safeContentDispositionName } from './utils/safeFilename.js';

// Validation du format mag_number déléguée au module partagé magNumber.js
// (LETTRES + CHIFFRES, ex VX1, E09). Tolère espaces autour, normalise UPPER.
const MAG_REGEX = MAG_NUMBER_RE;

function normalizeMagNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === '') return null;
  return s;
}

// Détecte un numéro MAG dans une chaîne serial via le module partagé.
// Séparateur STRICT : ` - ` (au moins un espace de chaque côté du tiret).
// Sans espaces autour du tiret ⇒ PAS un numéro MAG (la chaîne reste entière).
//   "T01 - 2400953513"     → { mag: 'T01', serial: '2400953513' }
//   "VX1 - 2400953513"     → { mag: 'VX1', serial: '2400953513' }
//   "T01-2400953513"       → { mag: null, serial: 'T01-2400953513' }
//   "2400953513"           → { mag: null, serial: '2400953513' }
function detectMagFromSerial(serial) {
  const { coreSerial, magNumber } = parseMagSerial(serial);
  return { mag: magNumber, serial: coreSerial };
}

export function setupLabelsRoutes(app, authenticateToken, requireAdmin) {
  // ─── GET /api/labels/serialized ──────────────────────────────────────
  // Liste des serials actifs avec equipment associé. Filtres optionnels :
  //   ?equipmentId=…   → un seul produit
  //   ?withoutMag=1    → uniquement ceux sans mag_number
  //   ?search=…        → texte libre (serial, mag, nom, référence, uid)
  app.get('/api/labels/serialized', authenticateToken, (req, res) => {
    try {
      // Modèle A : on cible les equipment qui ont un serial_number (= unités
      // physiques migrées) et qui ne sont pas des catalogues archivés.
      // [BUG-DOUBLONS] On exclut aussi les lignes status='removed' (legacy
      // LocMat archivées) qui polluaient la liste avec des serials non splittés
      // type "G01 - 2400947145". Pour les voir : ?includeRemoved=1.
      const includeRemoved =
        req.query.includeRemoved === '1' || req.query.includeRemoved === 'true';
      const where = [
        'e.serial_number IS NOT NULL',
        "e.serial_number != ''",
        "e.name NOT LIKE '%[archive]%'",
      ];
      if (!includeRemoved) {
        where.push("(e.status IS NULL OR e.status != 'removed')");
      }
      const params = {};
      if (req.query.equipmentId) {
        where.push('e.id = @equipmentId');
        params.equipmentId = Number(req.query.equipmentId);
      }
      if (req.query.withoutMag === '1' || req.query.withoutMag === 'true') {
        where.push("(e.numero_mag IS NULL OR e.numero_mag = '')");
      }
      if (req.query.search) {
        where.push(
          '(UPPER(e.serial_number) LIKE @q OR UPPER(e.numero_mag) LIKE @q' +
            ' OR UPPER(e.name) LIKE @q OR UPPER(e.reference) LIKE @q OR UPPER(e.uid) LIKE @q)',
        );
        params.q = `%${String(req.query.search).toUpperCase()}%`;
      }

      const rows = db
        .prepare(
          `SELECT e.id            AS serial_id,
                  e.id            AS equipment_id,
                  e.serial_number AS serial,
                  e.numero_mag    AS mag_number,
                  e.uid           AS serial_uid,
                  'active'        AS status,
                  e.created_at    AS created_at,
                  e.uid           AS equipment_uid,
                  e.reference     AS equipment_reference,
                  e.name          AS equipment_name,
                  e.numero_mag    AS equipment_numero_mag
           FROM equipment e
           WHERE ${where.join(' AND ')}
           ORDER BY e.name COLLATE NOCASE ASC, e.serial_number COLLATE NOCASE ASC
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
      const exists = db.prepare('SELECT id, serial_number FROM equipment WHERE id = ?').get(id);
      if (!exists) return res.status(404).json({ error: 'Équipement introuvable' });

      // Normalisation symétrique : si le serial_number contient encore le préfixe
      // MAG (cas legacy / import Locmat brut), on le sépare pour ne garder que
      // le coreSerial côté serial_number et le mag côté numero_mag.
      //   "G08 - 2300890619" + mag=G08 → serial_number='2300890619'
      // On n'écrase JAMAIS le serial_number si le MAG détecté dans la chaîne
      // diffère du MAG demandé (sécurité contre les conflits).
      let nextSerial = exists.serial_number;
      if (exists.serial_number) {
        const det = parseMagSerial(exists.serial_number);
        if (det.magNumber && (!mag || det.magNumber === mag)) {
          nextSerial = det.coreSerial;
        }
      }
      const serialChanged = nextSerial !== exists.serial_number;
      if (serialChanged) {
        db.prepare(
          `UPDATE equipment
             SET numero_mag = ?, serial_number = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        ).run(mag, nextSerial, id);
      } else {
        db.prepare(
          'UPDATE equipment SET numero_mag = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ).run(mag, id);
      }
      res.json({ success: true, id, mag_number: mag, serial: nextSerial });
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
          `SELECT e.id, e.serial_number AS serial, e.numero_mag AS mag_number, e.uid AS serial_uid,
                  e.uid AS equipment_uid, e.name AS equipment_name,
                  e.reference AS equipment_reference
           FROM equipment e
           WHERE e.id IN (${placeholders})`,
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
          // UID unique de l'unité physique : serial_uid si équipement sérialisé,
          // sinon equipment_uid (équipements non sérialisés = 1 UID par référence).
          // Le même UID est gravé sur l'étiquette ET encodé dans le QR.
          const qrUid = r.serial_uid || r.equipment_uid || '';
          return {
            reference: r.equipment_reference || '',
            uid: qrUid,
            serial,
            magNumber: mag,
            qrPayload: qrUid ? buildEquipmentQrPayload(qrUid) : '',
          };
        });

      if (items.length === 0) {
        return res.status(404).json({ error: 'Aucun serial valide trouvé' });
      }

      const svg = await buildPlateSvg(items);
      const filename = safeContentDispositionName(
        req.body?.filename,
        'plaque-etiquettes-200x200.svg',
      );
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
          `SELECT e.id, e.serial_number AS serial, e.numero_mag AS mag_number, e.uid AS serial_uid,
                  e.uid AS equipment_uid, e.name AS equipment_name,
                  e.reference AS equipment_reference
           FROM equipment e
           WHERE e.id IN (${placeholders})`,
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
          // UID unique de l'unité physique : serial_uid si sérialisé, sinon equipment_uid.
          // Même UID gravé sur l'étiquette ET encodé dans le QR.
          const qrUid = r.serial_uid || r.equipment_uid || '';
          return {
            reference: r.equipment_reference || '',
            uid: qrUid,
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

      const filename = safeContentDispositionName(
        req.body?.filename,
        'lightburn-plaque-200x200.svg',
      );
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
