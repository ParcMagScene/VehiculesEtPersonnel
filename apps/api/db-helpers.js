// ═══════════════════════════════════════════════════════════════
// db-helpers.js — Fonctions helper pour la base de données
// Historique des modifications, utilitaires DB communs
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';

/**
 * Ajouter une entrée dans l'historique des modifications
 */
export function addToHistory(entityType, entityId, action, changes, userId, userName) {
  if (!entityId) {
    logger.warn(`⚠️  Tentative d'ajout à l'historique sans entity_id pour ${entityType}`);
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO modification_history (entity_type, entity_id, action, changes, user_id, user_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(entityType, String(entityId), action, JSON.stringify(changes), userId, userName);
}

/**
 * Récupérer l'historique des modifications d'une entité
 */
// [AUDIT FIX LOW-03] LIMIT par défaut pour éviter les requêtes non bornées
export function getHistory(entityType, entityId, limit = 200) {
  const stmt = db.prepare(`
    SELECT * FROM modification_history 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  return stmt.all(entityType, entityId, limit);
}
