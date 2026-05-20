// ═══════════════════════════════════════════════════════════════
// Module Planning — Routes BL/BP imports
// Extrait de planningRoutes.js — Sprint 2
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { invalidateEntity, listCache } from '../cache.js';
import db from '../database.js';
import logger from '../logger.js';
import { uploadBL } from '../middleware/upload.js';
import { validate } from '../schemas/imports.js';
import { bpItemMatchArticleSchema, bpItemMatchSchema } from '../schemas/planning.js';
import { recordAffaireHistory } from '../services/affaireHistory.js';
import { extractDatesFromParsedData } from '../services/blDateExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════
// HELPERS — Enrichissement fournisseur items BL/BP
// ═══════════════════════════════════════════════

/**
 * Enrichit les items d'un BL/BP en extrayant le fournisseur depuis la description.
 * Pattern 1 : "MARQUE • description…" (marque avant bullet)
 * Pattern 2 : "description…•MARQUE" (marque après bullet)
 * Modifie les items in-place.
 */
function enrichItemsFournisseur(items) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item.fournisseur) continue;
    const desc = item.description || '';
    const before = desc.match(/^([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9\s&'./-]{0,30}?)\s*[•·]/);
    if (before) {
      item.fournisseur = before[1].trim();
    } else {
      const after = desc.match(/[•·]\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9\s&'./-]{1,30})\s*$/);
      if (after) item.fournisseur = after[1].trim();
    }
  }
}

const attachmentsBase = path.join(__dirname, '..', '..', '..', 'public', 'attachments');

/**
 * Copie un BL/BP importé dans le dossier pièces jointes de l'affaire.
 * Permet de retrouver le PDF original depuis la fiche affaire.
 */
function copyBLToAttachments(file, affaireId) {
  if (!file || !affaireId) return;
  try {
    const safeId = affaireId.replace(/[^a-zA-Z0-9À-ÿ\s\-_().]/g, '');
    if (!safeId) return;
    const destDir = path.join(attachmentsBase, safeId);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const srcPath = path.join(__dirname, '..', '..', '..', 'public', 'bl-imports', file.filename);
    const destName = file.originalname;
    const destPath = path.join(destDir, destName);
    // Ne pas écraser si le fichier existe déjà (réimport)
    if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  } catch (err) {
    logger.error('Erreur copie BL → attachments:', err.message);
  }
}

export function setupBLImportRoutes(app, authenticateToken) {
  // ═══════════════════════════════════════════════
  // IMPORTS BL — CRUD
  // ═══════════════════════════════════════════════

  // ─── GET /api/planning/bl-imports ───
  app.get('/api/planning/bl-imports', authenticateToken, (req, res) => {
    try {
      let query = `SELECT id, affaire_id, filename, file_path, mime_type, parsed_data, status,
      affaire_type, doc_type, confidence_score, sections_data, field_confidence,
      created_by, created_at FROM bl_imports WHERE 1=1`;
      const params = [];

      if (req.query.affaire_id) {
        query += ' AND affaire_id = ?';
        params.push(req.query.affaire_id);
      }
      if (req.query.status) {
        query += ' AND status = ?';
        params.push(req.query.status);
      }

      query += ' ORDER BY created_at DESC';

      const imports = db.prepare(query).all(...params);
      res.json(imports);
    } catch (error) {
      logger.error('GET /api/planning/bl-imports error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/planning/bl-imports/:id ───
  app.get('/api/planning/bl-imports/:id', authenticateToken, (req, res) => {
    try {
      const blImport = db.prepare('SELECT * FROM bl_imports WHERE id = ?').get(req.params.id);
      if (!blImport) return res.status(404).json({ success: false, error: 'Import BL non trouvé' });
      res.json(blImport);
    } catch (error) {
      logger.error('GET /api/planning/bl-imports/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/planning/bl-imports ───
  // Multipart : fichier BL + champs parsed_data, affaire_id, etc.
  // Auto-crée l'affaire si elle n'existe pas, ou lie au BL si elle existe
  app.post('/api/planning/bl-imports', authenticateToken, uploadBL.single('file'), (req, res) => {
    try {
      const { affaire_id, affaire_type, raw_text, parsed_data, status } = req.body;
      const file = req.file;

      if (!file && !raw_text) {
        return res
          .status(400)
          .json({ success: false, error: 'Un fichier ou du texte extrait est requis' });
      }

      // [AUDIT FIX I3] Valider parsed_data si présent
      if (parsed_data) {
        try {
          const test = typeof parsed_data === 'string' ? JSON.parse(parsed_data) : parsed_data;
          if (test && typeof test !== 'object') {
            return res
              .status(400)
              .json({ success: false, error: 'parsed_data doit être un objet JSON' });
          }
        } catch {
          return res
            .status(400)
            .json({ success: false, error: "parsed_data n'est pas du JSON valide" });
        }
      }

      const id = crypto.randomUUID().replace(/-/g, '');

      // Extraire les métadonnées enrichies du parsed_data
      let pd = null;
      let affaireTypeResolved = affaire_type || null;
      let docType = null,
        confidenceScore = null,
        sectionsData = null,
        fieldConfidence = null;
      if (parsed_data) {
        try {
          pd = typeof parsed_data === 'string' ? JSON.parse(parsed_data) : parsed_data;
          if (!affaireTypeResolved) affaireTypeResolved = pd.type || null;
          docType = pd.docType || null;
          // Fallback type depuis docType si non résolu
          if (!affaireTypeResolved && docType === 'bl_vente') affaireTypeResolved = 'Vente';
          if (!affaireTypeResolved && docType === 'bon_preparation')
            affaireTypeResolved = 'Prestation';
          confidenceScore = pd.confidence || null;
          sectionsData = pd.sections && pd.sections.length > 0 ? JSON.stringify(pd.sections) : null;
          fieldConfidence = pd._fieldConfidence ? JSON.stringify(pd._fieldConfidence) : null;
          // Enrichir les fournisseurs depuis les descriptions
          if (pd.items) enrichItemsFournisseur(pd.items);
        } catch (_) {
          /* ignore parse errors */
        }
      }
      // Fallback : utiliser pd.numero si affaire_id non fourni
      let linkedAffaireId = affaire_id || pd?.numero || null;
      let affaireCreated = false;
      let finalId,
        updated = false,
        bpItemsCount = 0;

      // [PHASE 4] Transaction atomique : affaire + bl_import + bp_items
      const atomicImport = db.transaction(() => {
        if (linkedAffaireId) {
          const existingAffaire = db
            .prepare('SELECT id, numero_affaire FROM affaires WHERE numero_affaire = ?')
            .get(linkedAffaireId);
          if (!existingAffaire) {
            // Créer l'affaire automatiquement à partir des données parsées
            try {
              const today = new Date().toISOString().slice(0, 10);

              // Extraire date_debut et date_fin depuis les sections si disponibles
              const { dateDebut, dateFin } = extractDatesFromParsedData(pd);

              const insertResult = db
                .prepare(
                  `
            INSERT INTO affaires (numero_affaire, type, client, interlocuteur, tel, fax,
              date_debut, date_fin, devis, adresse_livraison, titre, description,
              created_by, modified_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
                )
                .run(
                  linkedAffaireId,
                  affaireTypeResolved || 'Prestation',
                  pd?.client || '',
                  pd?.interlocuteur || '',
                  pd?.tel || '',
                  pd?.fax || '',
                  dateDebut || today,
                  dateFin || '',
                  pd?.devis || '',
                  pd?.adresse || '',
                  pd?.nomAffaire || pd?.objet || '',
                  `Créée automatiquement depuis l'import BL ${file ? file.originalname : 'text-import'}`,
                  req.user.id,
                  req.user.id,
                );
              affaireCreated = true;
              // L6 — historique
              const newAffaireId = Number(insertResult.lastInsertRowid);
              if (newAffaireId > 0) {
                recordAffaireHistory(db, {
                  affaire_id: newAffaireId,
                  event_type: 'affaire_created',
                  source: 'bl_import',
                  source_ref: id,
                  field_name: 'numero_affaire',
                  new_value: linkedAffaireId,
                  user_id: req.user.id,
                  notes: `Import ${file ? file.originalname : 'text-import'}${dateDebut ? ` — dates ${dateDebut}${dateFin ? ' → ' + dateFin : ''}` : ''}`,
                });
              }
              // Invalider les caches pour que GET /api/affaires et planning-affaires retournent la nouvelle affaire
              invalidateEntity('affaires');
              listCache.invalidatePattern(/^planning-affaires/);
            } catch (affaireErr) {
              // Si erreur UNIQUE constraint (race condition), l'affaire a été créée entre-temps → OK
              if (!affaireErr.message?.includes('UNIQUE')) {
                logger.error('Erreur création auto affaire:', affaireErr.message);
              }
            }
          } else {
            // L6 — tracer le rattachement à une affaire existante
            recordAffaireHistory(db, {
              affaire_id: existingAffaire.id,
              event_type: 'bl_import_linked',
              source: 'bl_import',
              source_ref: id,
              user_id: req.user.id,
              notes: `Import ${file ? file.originalname : 'text-import'} rattaché`,
            });
          }
        }

        // ── Dédoublonnage : si un import avec le même filename + affaire existe déjà, on le met à jour ──
        const existingFilename = file ? file.originalname : 'text-import';
        const existingImport = linkedAffaireId
          ? db
              .prepare('SELECT id FROM bl_imports WHERE affaire_id = ? AND filename = ?')
              .get(linkedAffaireId, existingFilename)
          : null;

        if (existingImport) {
          // ── UPDATE : mettre à jour l'import existant ──
          finalId = existingImport.id;
          updated = true;

          db.prepare(
            `
        UPDATE bl_imports SET
          file_path = ?, mime_type = ?, raw_text = ?, parsed_data = ?,
          status = ?, affaire_type = ?, doc_type = ?, confidence_score = ?,
          sections_data = ?, field_confidence = ?, created_by = ?, created_at = datetime('now')
        WHERE id = ?
      `,
          ).run(
            file ? file.filename : null,
            file ? file.mimetype : 'text/plain',
            raw_text || null,
            pd ? JSON.stringify(pd) : null,
            status || 'validated',
            affaireTypeResolved,
            docType,
            confidenceScore,
            sectionsData,
            fieldConfidence,
            req.user.id,
            finalId,
          );

          // Supprimer les anciens bp_items pour cet import
          db.prepare('DELETE FROM bp_items WHERE bl_import_id = ?').run(finalId);
        } else {
          // ── INSERT : nouvel import ──
          finalId = id;

          const stmt = db.prepare(`
        INSERT INTO bl_imports (id, affaire_id, filename, file_path, mime_type, raw_text, parsed_data, status, affaire_type, doc_type, confidence_score, sections_data, field_confidence, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

          stmt.run(
            finalId,
            linkedAffaireId,
            existingFilename,
            file ? file.filename : null,
            file ? file.mimetype : 'text/plain',
            raw_text || null,
            pd ? JSON.stringify(pd) : null,
            status || 'validated',
            affaireTypeResolved,
            docType,
            confidenceScore,
            sectionsData,
            fieldConfidence,
            req.user.id,
          );
        }

        // ═══ Auto-persist BP items with equipment matching ═══
        if (pd && Array.isArray(pd.items) && pd.items.length > 0) {
          try {
            const insertItem = db.prepare(`
          INSERT INTO bp_items (bl_import_id, equipment_id, reference, description, section, quantity, poids, volume, match_status, match_confidence, item_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
            // Matching contre la table equipment (matériel réel)
            const findExact = db.prepare('SELECT id FROM equipment WHERE reference = ? LIMIT 1');
            const findNorm = db.prepare(
              "SELECT id FROM equipment WHERE REPLACE(REPLACE(reference, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '') LIMIT 1",
            );
            // Matching partiel : ref BP contenue dans les refs equipment (ex: "DXR12" → "DXR12-")
            const findPartial = db.prepare(
              "SELECT id FROM equipment WHERE reference LIKE ? || '%' LIMIT 1",
            );

            const insertMany = db.transaction((items) => {
              for (const item of items) {
                const ref = (item.reference || item.code || '').trim();
                let equipmentId = null;
                let matchStatus = 'unmatched';
                let matchConf = 0;

                if (ref) {
                  // 1. Exact match
                  const exact = findExact.get(ref);
                  if (exact) {
                    equipmentId = exact.id;
                    matchStatus = 'matched';
                    matchConf = 1.0;
                  } else {
                    // 2. Normalized (sans tirets/espaces)
                    const norm = findNorm.get(ref);
                    if (norm) {
                      equipmentId = norm.id;
                      matchStatus = 'matched';
                      matchConf = 0.8;
                    } else {
                      // 3. Partial prefix match (ex: "DXR12" → "DXR12-")
                      const partial = findPartial.get(ref);
                      if (partial) {
                        equipmentId = partial.id;
                        matchStatus = 'matched';
                        matchConf = 0.7;
                      } else if (ref.includes(' ')) {
                        // 4. Ref multi-mots : essayer chaque segment (ex: "YAMAHA QL5" → "QL5")
                        const parts = ref.split(/\s+/).filter((p) => p.length > 2);
                        for (const part of parts) {
                          const seg =
                            findExact.get(part) || findNorm.get(part) || findPartial.get(part);
                          if (seg) {
                            equipmentId = seg.id;
                            matchStatus = 'matched';
                            matchConf = 0.6;
                            break;
                          }
                        }
                      }
                    }
                  }
                }

                // Déterminer le type : 'article' si section VENTE/VTE, sinon 'materiel'
                const sectionUpper = (item.section || '').toUpperCase();
                const itemType =
                  sectionUpper === 'VENTE' || sectionUpper === 'VTE' ? 'article' : 'materiel';

                insertItem.run(
                  finalId,
                  equipmentId,
                  ref || null,
                  item.description || null,
                  item.section || null,
                  item.quantity || 1,
                  item.poids || null,
                  item.volume || null,
                  matchStatus,
                  matchConf,
                  itemType,
                );
              }
            });

            insertMany(pd.items);
            bpItemsCount = pd.items.length;
          } catch (bpErr) {
            logger.error('Erreur insertion bp_items:', bpErr.message);
          }
        }
      }); // fin atomicImport
      atomicImport();

      // Copier le PDF en pièce jointe de l'affaire (opération fichier, hors transaction)
      if (file && linkedAffaireId) copyBLToAttachments(file, linkedAffaireId);

      const created = db.prepare('SELECT * FROM bl_imports WHERE id = ?').get(finalId);
      res.status(updated ? 200 : 201).json({
        ...created,
        affaire_created: affaireCreated,
        bp_items_count: bpItemsCount,
        updated,
      });
    } catch (error) {
      logger.error('POST /api/planning/bl-imports error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── DELETE /api/planning/bl-imports/:id ───
  app.delete('/api/planning/bl-imports/:id', authenticateToken, (req, res) => {
    try {
      const existing = db.prepare('SELECT * FROM bl_imports WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ success: false, error: 'Import BL non trouvé' });

      // Supprimer le fichier physique s'il existe
      if (existing.file_path) {
        const filePath = path.join(
          __dirname,
          '..',
          '..',
          'public',
          'bl-imports',
          existing.file_path,
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      db.prepare('DELETE FROM bl_imports WHERE id = ?').run(req.params.id);
      res.json({ success: true, message: 'Import BL supprimé' });
    } catch (error) {
      logger.error('DELETE /api/planning/bl-imports/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/planning/bl-imports/batch ───
  // Import multiple BL/BP en une seule requête
  // Multipart : fichiers dans "files", métadonnées dans "items" (JSON array)
  // Chaque item: { index, affaire_id, affaire_type, parsed_data, status }
  // index = position dans le tableau files[] (correspondance fichier ↔ métadonnées)
  app.post(
    '/api/planning/bl-imports/batch',
    authenticateToken,
    uploadBL.array('files', 50),
    (req, res) => {
      try {
        let items = [];
        try {
          items = JSON.parse(req.body.items || '[]');
        } catch {
          /* ignore */
        }

        if (!req.files?.length && !items.length) {
          return res
            .status(400)
            .json({ success: false, error: 'Aucun fichier ou métadonnées fourni' });
        }

        // [AUDIT FIX I4] Valider que items est un tableau d'objets avec des champs attendus
        if (!Array.isArray(items)) {
          return res.status(400).json({ success: false, error: 'items doit être un tableau JSON' });
        }
        if (items.length > 50) {
          return res.status(400).json({ success: false, error: 'Maximum 50 items par batch' });
        }
        for (const item of items) {
          if (item.parsed_data) {
            try {
              const pd =
                typeof item.parsed_data === 'string'
                  ? JSON.parse(item.parsed_data)
                  : item.parsed_data;
              if (pd && typeof pd !== 'object') {
                return res
                  .status(400)
                  .json({ success: false, error: 'parsed_data doit être un objet JSON' });
              }
            } catch {
              return res
                .status(400)
                .json({ success: false, error: 'parsed_data invalide dans un des items' });
            }
          }
        }

        const results = [];
        const filesMap = {};
        (req.files || []).forEach((f, idx) => {
          filesMap[idx] = f;
        });

        // Equipment matching queries (réutilisé pour chaque import)
        const findExact = db.prepare('SELECT id FROM equipment WHERE reference = ? LIMIT 1');
        const findNorm = db.prepare(
          "SELECT id FROM equipment WHERE REPLACE(REPLACE(reference, '-', ''), ' ', '') = REPLACE(REPLACE(?, '-', ''), ' ', '') LIMIT 1",
        );
        const findPartial = db.prepare(
          "SELECT id FROM equipment WHERE reference LIKE ? || '%' LIMIT 1",
        );
        const insertBPItem = db.prepare(`
      INSERT INTO bp_items (bl_import_id, equipment_id, reference, description, section, quantity, poids, volume, match_status, match_confidence, item_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const file = filesMap[item.index ?? i];

          try {
            const { affaire_id, affaire_type, parsed_data, status } = item;
            const id = crypto.randomUUID().replace(/-/g, '');

            // Parse des données
            let pd = null;
            let affaireTypeResolved = affaire_type || null;
            let docType = null,
              confidenceScore = null,
              sectionsData = null,
              fieldConfidence = null;
            if (parsed_data) {
              try {
                pd = typeof parsed_data === 'string' ? JSON.parse(parsed_data) : parsed_data;
                if (!affaireTypeResolved) affaireTypeResolved = pd.type || null;
                docType = pd.docType || null;
                confidenceScore = pd.confidence || null;
                sectionsData = pd.sections?.length > 0 ? JSON.stringify(pd.sections) : null;
                fieldConfidence = pd._fieldConfidence ? JSON.stringify(pd._fieldConfidence) : null;
                // Enrichir les fournisseurs depuis les descriptions
                if (pd.items) enrichItemsFournisseur(pd.items);
              } catch (_) {
                /* ignore */
              }
            }

            // Auto-création / mise à jour affaire
            let linkedAffaireId = affaire_id || pd?.numero || null;
            let affaireCreated = false;
            let affaireUpdated = false;
            let finalId;
            let updated = false;
            let bpItemsCount = 0;
            const existingFilename = file ? file.originalname : `text-import-${i}`;

            // [PHASE 4] Transaction atomique par item : affaire + bl_import + bp_items
            const atomicItem = db.transaction(() => {
              if (linkedAffaireId) {
                const existingAffaire = db
                  .prepare('SELECT id, numero_affaire FROM affaires WHERE numero_affaire = ?')
                  .get(linkedAffaireId);
                if (existingAffaire) {
                  // Mise à jour de l'affaire avec les nouvelles données parsées (si des champs sont vides)
                  try {
                    const { dateDebut, dateFin } = extractDatesFromParsedData(pd);
                    // Mettre à jour les champs vides de l'affaire existante
                    const aff = db
                      .prepare('SELECT * FROM affaires WHERE numero_affaire = ?')
                      .get(linkedAffaireId);
                    // [SEC] Whitelist des champs autorisés pour l'UPDATE dynamique
                    const ALLOWED_AFFAIRE_FIELDS = new Set([
                      'client',
                      'interlocuteur',
                      'tel',
                      'fax',
                      'devis',
                      'adresse_livraison',
                      'titre',
                      'type',
                      'date_debut',
                      'date_fin',
                      'modified_by',
                      'modified_at',
                    ]);
                    const updates = [];
                    const params = [];
                    if (!aff.client && pd?.client) {
                      updates.push('client = ?');
                      params.push(pd.client);
                    }
                    if (!aff.interlocuteur && pd?.interlocuteur) {
                      updates.push('interlocuteur = ?');
                      params.push(pd.interlocuteur);
                    }
                    if (!aff.tel && pd?.tel) {
                      updates.push('tel = ?');
                      params.push(pd.tel);
                    }
                    if (!aff.fax && pd?.fax) {
                      updates.push('fax = ?');
                      params.push(pd.fax);
                    }
                    if (!aff.devis && pd?.devis) {
                      updates.push('devis = ?');
                      params.push(pd.devis);
                    }
                    if (!aff.adresse_livraison && pd?.adresse) {
                      updates.push('adresse_livraison = ?');
                      params.push(pd.adresse);
                    }
                    if (!aff.titre && (pd?.nomAffaire || pd?.objet)) {
                      updates.push('titre = ?');
                      params.push(pd.nomAffaire || pd.objet);
                    }
                    // Si force_type est vrai, on met à jour le type même s'il existe déjà
                    if (
                      affaireTypeResolved &&
                      (item.force_type ? aff.type !== affaireTypeResolved : !aff.type)
                    ) {
                      updates.push('type = ?');
                      params.push(affaireTypeResolved);
                    }
                    if (dateDebut && !aff.date_debut) {
                      updates.push('date_debut = ?');
                      params.push(dateDebut);
                    }
                    if (dateFin && !aff.date_fin) {
                      updates.push('date_fin = ?');
                      params.push(dateFin);
                    }
                    if (updates.length > 0) {
                      updates.push('modified_by = ?', "modified_at = datetime('now')");
                      params.push(req.user.id);
                      params.push(linkedAffaireId);
                      // [SEC] Vérifier que tous les champs sont dans la whitelist
                      const allValid = updates.every((u) => {
                        const field = u.split(/\s*=\s*/)[0];
                        return ALLOWED_AFFAIRE_FIELDS.has(field);
                      });
                      if (!allValid) throw new Error('Champ non autorisé dans UPDATE affaire');
                      db.prepare(
                        `UPDATE affaires SET ${updates.join(', ')} WHERE numero_affaire = ?`,
                      ).run(...params);
                      affaireUpdated = true;
                      // L6 — tracer les changements de dates dans l'historique
                      if (dateDebut && !aff.date_debut) {
                        recordAffaireHistory(db, {
                          affaire_id: existingAffaire.id,
                          event_type: 'date_change',
                          source: 'batch_import',
                          source_ref: id,
                          field_name: 'date_debut',
                          old_value: aff.date_debut,
                          new_value: dateDebut,
                          user_id: req.user.id,
                          notes: `Renseignée depuis ${existingFilename}`,
                        });
                      }
                      if (dateFin && !aff.date_fin) {
                        recordAffaireHistory(db, {
                          affaire_id: existingAffaire.id,
                          event_type: 'date_change',
                          source: 'batch_import',
                          source_ref: id,
                          field_name: 'date_fin',
                          old_value: aff.date_fin,
                          new_value: dateFin,
                          user_id: req.user.id,
                          notes: `Renseignée depuis ${existingFilename}`,
                        });
                      }
                    }
                    // L6 — toujours tracer le rattachement même sans changement
                    recordAffaireHistory(db, {
                      affaire_id: existingAffaire.id,
                      event_type: 'bl_import_linked',
                      source: 'batch_import',
                      source_ref: id,
                      user_id: req.user.id,
                      notes: `Import ${existingFilename} rattaché`,
                    });
                  } catch (updErr) {
                    logger.error('Erreur update affaire batch:', updErr.message);
                  }
                } else {
                  // Créer l'affaire
                  try {
                    const today = new Date().toISOString().slice(0, 10);
                    const { dateDebut, dateFin } = extractDatesFromParsedData(pd);
                    const insertResult = db
                      .prepare(
                        `
                INSERT INTO affaires (numero_affaire, type, client, interlocuteur, tel, fax,
                  date_debut, date_fin, devis, adresse_livraison, titre, description,
                  created_by, modified_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
                      )
                      .run(
                        linkedAffaireId,
                        affaireTypeResolved || 'Prestation',
                        pd?.client || '',
                        pd?.interlocuteur || '',
                        pd?.tel || '',
                        pd?.fax || '',
                        dateDebut || today,
                        dateFin || '',
                        pd?.devis || '',
                        pd?.adresse || '',
                        pd?.nomAffaire || pd?.objet || '',
                        `Créée automatiquement — import batch BL ${file ? file.originalname : 'text-import'}`,
                        req.user.id,
                        req.user.id,
                      );
                    affaireCreated = true;
                    // L6 — historique
                    const newAffaireId = Number(insertResult.lastInsertRowid);
                    if (newAffaireId > 0) {
                      recordAffaireHistory(db, {
                        affaire_id: newAffaireId,
                        event_type: 'affaire_created',
                        source: 'batch_import',
                        source_ref: id,
                        field_name: 'numero_affaire',
                        new_value: linkedAffaireId,
                        user_id: req.user.id,
                        notes: `Batch import ${existingFilename}${dateDebut ? ` — dates ${dateDebut}${dateFin ? ' → ' + dateFin : ''}` : ''}`,
                      });
                    }
                  } catch (affErr) {
                    if (!affErr.message?.includes('UNIQUE')) {
                      logger.error('Erreur création affaire batch:', affErr.message);
                    }
                  }
                }
              }

              // Dédoublonnage BL import
              const existingImport = linkedAffaireId
                ? db
                    .prepare('SELECT id FROM bl_imports WHERE affaire_id = ? AND filename = ?')
                    .get(linkedAffaireId, existingFilename)
                : null;

              const enrichedDataStr = pd ? JSON.stringify(pd) : null;

              if (existingImport) {
                finalId = existingImport.id;
                updated = true;
                db.prepare(
                  `
            UPDATE bl_imports SET
              file_path = ?, mime_type = ?, raw_text = ?, parsed_data = ?,
              status = ?, affaire_type = ?, doc_type = ?, confidence_score = ?,
              sections_data = ?, field_confidence = ?, created_by = ?, created_at = datetime('now')
            WHERE id = ?
          `,
                ).run(
                  file ? file.filename : null,
                  file ? file.mimetype : 'text/plain',
                  item.raw_text || null,
                  enrichedDataStr,
                  status || 'validated',
                  affaireTypeResolved,
                  docType,
                  confidenceScore,
                  sectionsData,
                  fieldConfidence,
                  req.user.id,
                  finalId,
                );
                db.prepare('DELETE FROM bp_items WHERE bl_import_id = ?').run(finalId);
              } else {
                finalId = id;
                db.prepare(
                  `
            INSERT INTO bl_imports (id, affaire_id, filename, file_path, mime_type, raw_text, parsed_data, status, affaire_type, doc_type, confidence_score, sections_data, field_confidence, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `,
                ).run(
                  finalId,
                  linkedAffaireId,
                  existingFilename,
                  file ? file.filename : null,
                  file ? file.mimetype : 'text/plain',
                  item.raw_text || null,
                  enrichedDataStr,
                  status || 'validated',
                  affaireTypeResolved,
                  docType,
                  confidenceScore,
                  sectionsData,
                  fieldConfidence,
                  req.user.id,
                );
              }

              // Auto-persist BP items with equipment matching
              if (pd?.items?.length > 0) {
                try {
                  const insertMany = db.transaction((bpItems) => {
                    for (const bpItem of bpItems) {
                      const ref = (bpItem.reference || bpItem.code || '').trim();
                      let equipmentId = null,
                        matchStatus = 'unmatched',
                        matchConf = 0;
                      if (ref) {
                        const exact = findExact.get(ref);
                        if (exact) {
                          equipmentId = exact.id;
                          matchStatus = 'matched';
                          matchConf = 1.0;
                        } else {
                          const norm = findNorm.get(ref);
                          if (norm) {
                            equipmentId = norm.id;
                            matchStatus = 'matched';
                            matchConf = 0.8;
                          } else {
                            const partial = findPartial.get(ref);
                            if (partial) {
                              equipmentId = partial.id;
                              matchStatus = 'matched';
                              matchConf = 0.7;
                            }
                          }
                        }
                      }
                      insertBPItem.run(
                        finalId,
                        equipmentId,
                        ref || null,
                        bpItem.description || null,
                        bpItem.section || null,
                        bpItem.quantity || 1,
                        bpItem.poids || null,
                        bpItem.volume || null,
                        matchStatus,
                        matchConf,
                        (bpItem.section || '').toUpperCase() === 'VENTE' ||
                          (bpItem.section || '').toUpperCase() === 'VTE'
                          ? 'article'
                          : 'materiel',
                      );
                    }
                  });
                  insertMany(pd.items);
                  bpItemsCount = pd.items.length;
                } catch (bpErr) {
                  logger.error('Erreur bp_items batch:', bpErr.message);
                }
              }
            }); // fin atomicItem
            atomicItem();

            // Copier le PDF en pièce jointe de l'affaire (opération fichier, hors transaction)
            if (file && linkedAffaireId) copyBLToAttachments(file, linkedAffaireId);

            results.push({
              index: i,
              filename: existingFilename,
              affaire_id: linkedAffaireId,
              affaire_created: affaireCreated,
              affaire_updated: affaireUpdated,
              bl_import_id: finalId,
              bp_items_count: bpItemsCount,
              updated,
              success: true,
            });
          } catch (itemErr) {
            results.push({
              index: i,
              filename: file?.originalname || `item-${i}`,
              error: itemErr.message,
              success: false,
            });
          }
        }

        // Invalider les caches
        invalidateEntity('affaires');
        listCache.invalidatePattern(/^planning-affaires/);

        const created = results.filter((r) => r.success && r.affaire_created).length;
        const updatedAff = results.filter((r) => r.success && r.affaire_updated).length;
        const imported = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        res.json({
          results,
          summary: { total: items.length, imported, created, updated: updatedAff, failed },
        });
      } catch (error) {
        logger.error('POST /api/planning/bl-imports/batch error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/planning/bp-items?affaire_id=AFxxxxx ───
  // Retourne les articles BP avec leur statut de matching matériel
  app.get('/api/planning/bp-items', authenticateToken, (req, res) => {
    try {
      const { affaire_id, bl_import_id } = req.query;
      let query = `
      SELECT bp.*, 
             eq.name AS catalog_name, eq.reference AS catalog_reference,
             COALESCE(b.name, eq.brand) AS catalog_family, eq.location AS catalog_zone,
             eq.location_depot AS catalog_depot,
             sa.designation AS supplier_article_name, sa.supplier_ref AS supplier_article_ref,
             si.name AS stock_item_name, si.reference AS stock_item_ref
      FROM bp_items bp
      LEFT JOIN equipment eq ON bp.equipment_id = eq.id
      LEFT JOIN brands b ON eq.brand_id = b.id
      LEFT JOIN supplier_articles sa ON bp.supplier_article_id = sa.id
      LEFT JOIN stock_items si ON bp.stock_item_id = si.id
      JOIN bl_imports bi ON bp.bl_import_id = bi.id
    `;
      const params = [];

      if (affaire_id) {
        query += ' WHERE bi.affaire_id = ?';
        params.push(affaire_id);
      } else if (bl_import_id) {
        query += ' WHERE bp.bl_import_id = ?';
        params.push(bl_import_id);
      }

      query += ' ORDER BY bp.section, bp.id';
      const items = db.prepare(query).all(...params);

      const matched = items.filter(
        (i) => i.match_status === 'matched' || i.match_status === 'manual',
      ).length;
      const materielItems = items.filter((i) => i.item_type !== 'article');
      const articleItems = items.filter((i) => i.item_type === 'article');
      res.json({
        items,
        total: items.length,
        matched,
        unmatched: items.length - matched,
        materiel_count: materielItems.length,
        article_count: articleItems.length,
        materiel_matched: materielItems.filter(
          (i) => i.match_status === 'matched' || i.match_status === 'manual',
        ).length,
        article_matched: articleItems.filter((i) => i.supplier_article_id || i.stock_item_id)
          .length,
      });
    } catch (error) {
      logger.error('GET /api/planning/bp-items error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PUT /api/planning/bp-items/:id/match ───
  // Lier manuellement un article BP à un matériel
  app.put(
    '/api/planning/bp-items/:id/match',
    authenticateToken,
    validate(bpItemMatchSchema),
    (req, res) => {
      try {
        const { equipment_id } = req.body;
        const item = db.prepare('SELECT * FROM bp_items WHERE id = ?').get(req.params.id);
        if (!item) return res.status(404).json({ success: false, error: 'Article BP non trouvé' });

        if (equipment_id) {
          const eqItem = db.prepare('SELECT id FROM equipment WHERE id = ?').get(equipment_id);
          if (!eqItem)
            return res.status(404).json({ success: false, error: 'Matériel introuvable' });
          db.prepare(
            'UPDATE bp_items SET equipment_id = ?, match_status = ?, match_confidence = 1.0 WHERE id = ?',
          ).run(equipment_id, 'manual', req.params.id);
        } else {
          // Délier
          db.prepare(
            'UPDATE bp_items SET equipment_id = NULL, match_status = ?, match_confidence = 0 WHERE id = ?',
          ).run('unmatched', req.params.id);
        }

        const updated = db
          .prepare(
            `
      SELECT bp.*, eq.name AS catalog_name, eq.reference AS catalog_reference
      FROM bp_items bp LEFT JOIN equipment eq ON bp.equipment_id = eq.id
      WHERE bp.id = ?
    `,
          )
          .get(req.params.id);

        res.json(updated);
      } catch (error) {
        logger.error('PUT /api/planning/bp-items/:id/match error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── PUT /api/planning/bp-items/:id/match-article ───
  // Lier manuellement un article BP (type='article') à un supplier_article ou stock_item
  app.put(
    '/api/planning/bp-items/:id/match-article',
    authenticateToken,
    validate(bpItemMatchArticleSchema),
    (req, res) => {
      try {
        const { supplier_article_id, stock_item_id } = req.body;
        const item = db.prepare('SELECT * FROM bp_items WHERE id = ?').get(req.params.id);
        if (!item) return res.status(404).json({ success: false, error: 'Article BP non trouvé' });

        if (supplier_article_id) {
          const sa = db
            .prepare('SELECT id FROM supplier_articles WHERE id = ?')
            .get(supplier_article_id);
          if (!sa)
            return res
              .status(404)
              .json({ success: false, error: 'Article fournisseur introuvable' });
          db.prepare(
            'UPDATE bp_items SET supplier_article_id = ?, stock_item_id = NULL WHERE id = ?',
          ).run(supplier_article_id, req.params.id);
        } else if (stock_item_id) {
          const si = db.prepare('SELECT id FROM stock_items WHERE id = ?').get(stock_item_id);
          if (!si)
            return res.status(404).json({ success: false, error: 'Article stock introuvable' });
          db.prepare(
            'UPDATE bp_items SET stock_item_id = ?, supplier_article_id = NULL WHERE id = ?',
          ).run(stock_item_id, req.params.id);
        } else {
          // Délier
          db.prepare(
            'UPDATE bp_items SET supplier_article_id = NULL, stock_item_id = NULL WHERE id = ?',
          ).run(req.params.id);
        }

        const updated = db
          .prepare(
            `
      SELECT bp.*, sa.designation AS supplier_article_name, sa.supplier_ref AS supplier_article_ref,
             si.name AS stock_item_name, si.reference AS stock_item_ref
      FROM bp_items bp
      LEFT JOIN supplier_articles sa ON bp.supplier_article_id = sa.id
      LEFT JOIN stock_items si ON bp.stock_item_id = si.id
      WHERE bp.id = ?
    `,
          )
          .get(req.params.id);

        res.json(updated);
      } catch (error) {
        logger.error('PUT /api/planning/bp-items/:id/match-article error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );
}
