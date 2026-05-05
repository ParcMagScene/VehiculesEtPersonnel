// ═══════════════════════════════════════════════════════════════
// apps/api/services/uidCounter.js
//
// Compteur global d'UID au format strict EMAG-XXXXX (5 chiffres).
//
//   • Une seule séquence partagée pour TOUS les UID (equipment & serials).
//   • Garantit l'unicité globale : 1 UID = 1 unité physique = 1 étiquette.
//   • Synchrone (compatible better-sqlite3 transactions).
//
// Table : uid_counter (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER)
// ═══════════════════════════════════════════════════════════════

export const EMAG_UID_RE = /^EMAG-\d{5}$/;

/** Formate un nombre en UID EMAG-XXXXX. */
export function formatUid(n) {
  return 'EMAG-' + String(n).padStart(5, '0');
}

/** Extrait la partie numérique d'un UID (EMAG-XXXXX ou EMAG-SXXXXX legacy). */
export function extractUidNumber(uid) {
  if (!uid) return 0;
  const m = String(uid).match(/EMAG-S?(\d+)/i);
  return m ? Number(m[1]) : 0;
}

/**
 * S'assure que la table uid_counter existe et est initialisée.
 * À appeler une fois au boot (idempotent).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} initialValue Valeur de départ si la table est vide
 */
export function ensureUidCounter(db, initialValue = 1) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS uid_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      value INTEGER NOT NULL
    )
  `);
  const row = db.prepare('SELECT value FROM uid_counter WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO uid_counter (id, value) VALUES (1, ?)').run(initialValue);
  }
}

/**
 * Force la valeur du compteur à `value` si la valeur actuelle est inférieure.
 * Utile lors de la migration ou si on importe des UID externes.
 */
export function bumpUidCounter(db, value) {
  ensureUidCounter(db, value);
  db.prepare('UPDATE uid_counter SET value = ? WHERE id = 1 AND value < ?').run(value, value);
}

/**
 * Renvoie le prochain UID disponible au format EMAG-XXXXX.
 * Incrémente atomiquement le compteur. Vérifie l'absence de collision avec
 * equipment.uid et equipment_serials.uid (skip et retry si collision).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {string} ex: "EMAG-03423"
 */
export function getNextUid(db) {
  ensureUidCounter(db);
  const findEq = db.prepare('SELECT 1 FROM equipment WHERE uid = ? LIMIT 1');
  const findSr = db.prepare('SELECT 1 FROM equipment_serials WHERE uid = ? LIMIT 1');
  const inc = db.prepare('UPDATE uid_counter SET value = value + 1 WHERE id = 1');
  const get = db.prepare('SELECT value FROM uid_counter WHERE id = 1');

  // Boucle de sécurité : avance le compteur jusqu'à trouver un UID non utilisé.
  // Sécurité absolue contre une éventuelle collision avec un UID legacy.
  for (let i = 0; i < 10000; i++) {
    inc.run();
    const value = get.get().value;
    if (value > 99999) {
      throw new Error('UID counter overflow (> 99999) — schéma EMAG-XXXXX épuisé');
    }
    const uid = formatUid(value);
    if (!findEq.get(uid) && !findSr.get(uid)) {
      return uid;
    }
  }
  throw new Error('Impossible de générer un UID libre après 10000 tentatives');
}
