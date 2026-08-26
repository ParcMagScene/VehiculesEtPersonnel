// ═══════════════════════════════════════════════════════════════
// utils/cursor.js
//
// Ticket : T-P0-03 (Planning v2 — API v2 lecture)
//
// Encodage / décodage d'un curseur opaque base64 pour la pagination
// keyset (cursor-based). Le curseur encapsule une clé composite
// (date, id) qui garantit un ordre stable et sans dérive sous
// mutations concurrentes (contrairement à l'offset).
//
// Format en clair (avant encodage) : JSON `{ "d": "YYYY-MM-DD", "i": 123 }`.
// Format transporté : base64url (RFC 4648 §5) sans padding.
//
// Contrat :
//   - Opaque pour le client (ne surtout pas s'appuyer sur le format
//     interne côté frontend).
//   - Non chiffré, non signé : ne jamais y stocker de secret. Le curseur
//     est un simple pointeur ordonné vers une position de lecture.
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {object} CursorKey
 * @property {string} date `YYYY-MM-DD`
 * @property {number|string} id identifiant séquentiel (entier > 0) OU chaîne
 *   non vide (les tables eM@g historiques utilisent parfois des identifiants
 *   TEXT type UUID hex).
 */

/**
 * Encode base64url sans padding.
 *
 * @param {string} input
 * @returns {string}
 */
function toBase64Url(input) {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Décode base64url (avec ou sans padding).
 *
 * @param {string} input
 * @returns {string}
 */
function fromBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

/**
 * Vrai si `value` est un `YYYY-MM-DD` syntaxiquement valide.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Vrai si `value` représente un identifiant valide (entier > 0 OU chaîne
 * non vide sans caractère de contrôle).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidId(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0;
  if (typeof value === 'string') {
    if (value.length === 0) return false;
    // Refuse toute présence de caractère de contrôle (< 0x20). Écrit avec
    // charCodeAt pour éviter la règle ESLint no-control-regex.
    for (let i = 0; i < value.length; i += 1) {
      if (value.charCodeAt(i) < 0x20) return false;
    }
    return true;
  }
  return false;
}

/**
 * Encode une clé `{ date, id }` en curseur opaque.
 *
 * @param {CursorKey} key
 * @returns {string} curseur base64url
 * @throws {TypeError} si la clé n'est pas valide.
 */
export function encodeCursor(key) {
  if (!key || typeof key !== 'object') {
    throw new TypeError('encodeCursor: clé objet requise');
  }
  if (!isIsoDate(key.date)) {
    throw new TypeError('encodeCursor: date doit être au format YYYY-MM-DD');
  }
  if (!isValidId(key.id)) {
    throw new TypeError('encodeCursor: id doit être un entier > 0 ou une chaîne non vide');
  }
  return toBase64Url(JSON.stringify({ d: key.date, i: key.id }));
}

/**
 * Décode un curseur opaque en clé `{ date, id }`.
 * Renvoie `null` si le curseur est vide, absent ou syntaxiquement
 * invalide, pour permettre au handler de traiter l'absence de curseur
 * comme "première page".
 *
 * @param {unknown} cursor
 * @returns {CursorKey | null}
 */
export function decodeCursor(cursor) {
  if (cursor === undefined || cursor === null || cursor === '') return null;
  if (typeof cursor !== 'string') return null;
  try {
    const raw = fromBase64Url(cursor);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!isIsoDate(parsed.d)) return null;
    if (!isValidId(parsed.i)) return null;
    return { date: parsed.d, id: parsed.i };
  } catch (_error) {
    return null;
  }
}
