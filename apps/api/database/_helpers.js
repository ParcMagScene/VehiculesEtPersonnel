// ═══════════════════════════════════════════════════════════════
// [S2-1] Helpers de schéma extraits de database.js (refactor split monolithe)
//
// Module pur sans état : toutes les fonctions reçoivent `db` en paramètre.
// Ne déclenche AUCUN side-effect à l'import (pas d'init DB, pas de timer).
// ═══════════════════════════════════════════════════════════════

import logger from '../logger.js';

const ID_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const TYPE_RE =
  /^(INTEGER|TEXT|REAL|BLOB|NUMERIC|BOOLEAN|DATETIME|DATE)(\s+(NOT\s+NULL|UNIQUE))?$/i;

/**
 * Ajoute une colonne à une table existante de manière idempotente.
 * No-op si la colonne existe déjà.
 *
 * @param {import('better-sqlite3').Database} db   instance ouverte
 * @param {string} table        nom de table (whitelist regex anti-injection)
 * @param {string} column       nom de colonne (whitelist regex anti-injection)
 * @param {string} type         type SQLite restreint (INTEGER, TEXT, REAL, BLOB, NUMERIC, BOOLEAN, DATETIME, DATE, +NOT NULL/UNIQUE)
 * @param {*} [defaultVal]      valeur par défaut SQL (interpolée — usage interne migrations uniquement)
 * @returns {boolean}           true si la colonne a été ajoutée, false si elle existait déjà
 * @throws {Error}              si table/column/type ne respectent pas les whitelists
 */
export function safeAddColumn(db, table, column, type, defaultVal) {
  if (!ID_RE.test(table) || !ID_RE.test(column)) {
    throw new Error(`safeAddColumn: identifiant invalide (table=${table}, column=${column})`);
  }
  if (!TYPE_RE.test(String(type).trim())) {
    throw new Error(`safeAddColumn: type invalide (${type})`);
  }
  const cols = db.pragma(`table_info(${table})`).map((c) => c.name);
  if (!cols.includes(column)) {
    const defClause = defaultVal !== undefined ? ` DEFAULT ${defaultVal}` : '';
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defClause}`);
    logger.info(`  ✅ Migration: ${table}.${column} ajouté`);
    return true;
  }
  return false;
}
