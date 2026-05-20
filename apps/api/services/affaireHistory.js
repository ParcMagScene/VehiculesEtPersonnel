// ═══════════════════════════════════════════════════════════════
// Helper d'historique d'affaire (L6 méga-prompt 7.1)
// Enregistre les évènements d'affaire dans la table affaire_history.
// Conçu pour ne JAMAIS faire échouer l'opération métier appelante
// (les erreurs sont logguées mais swallowed).
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

const ALLOWED_EVENT_TYPES = new Set([
  'affaire_created', // création auto depuis import
  'date_change', // modification date_debut ou date_fin
  'field_change', // autre champ (client, titre, type, ...)
  'bl_import_linked', // BL/BP rattaché à une affaire existante
]);

const ALLOWED_SOURCES = new Set([
  'bl_import', // import single
  'batch_import', // import batch
  'manual', // édition manuelle
  'system', // automatique (cron, migration...)
]);

/**
 * Enregistre un évènement dans affaire_history.
 * @param {import('better-sqlite3').Database} db
 * @param {object} params
 * @param {number} params.affaire_id - FK affaires.id (INTEGER, pas numero_affaire)
 * @param {string} params.event_type - ALLOWED_EVENT_TYPES
 * @param {string} [params.source='manual']
 * @param {string|null} [params.source_ref=null] - id BL/BP ou autre ref textuelle
 * @param {string|null} [params.field_name=null]
 * @param {string|null} [params.old_value=null]
 * @param {string|null} [params.new_value=null]
 * @param {number|null} [params.user_id=null]
 * @param {string|null} [params.notes=null]
 * @returns {number|null} - rowid inséré ou null si erreur
 */
export function recordAffaireHistory(db, params) {
  try {
    if (!db || typeof db.prepare !== 'function') {
      throw new TypeError('db invalide');
    }
    if (!params || typeof params !== 'object') {
      throw new TypeError('params requis');
    }
    const {
      affaire_id,
      event_type,
      source = 'manual',
      source_ref = null,
      field_name = null,
      old_value = null,
      new_value = null,
      user_id = null,
      notes = null,
    } = params;

    if (!Number.isInteger(affaire_id) || affaire_id <= 0) {
      throw new TypeError('affaire_id doit être un entier positif');
    }
    if (!ALLOWED_EVENT_TYPES.has(event_type)) {
      throw new TypeError(`event_type invalide: ${event_type}`);
    }
    if (!ALLOWED_SOURCES.has(source)) {
      throw new TypeError(`source invalide: ${source}`);
    }

    const stringify = (v) => (v == null ? null : String(v));

    const result = db
      .prepare(
        `INSERT INTO affaire_history
         (affaire_id, event_type, source, source_ref, field_name, old_value, new_value, user_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        affaire_id,
        event_type,
        source,
        stringify(source_ref),
        stringify(field_name),
        stringify(old_value),
        stringify(new_value),
        user_id == null ? null : Number(user_id) || null,
        stringify(notes),
      );
    return result.lastInsertRowid;
  } catch (err) {
    logger.error('recordAffaireHistory error:', err.message);
    return null;
  }
}

export { ALLOWED_EVENT_TYPES, ALLOWED_SOURCES };
