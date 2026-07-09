// apps/api/services/display/signals.js
//
// Ticket : T-P0-15 (Display v2 DisplayService interne).
//
// Service `getSignalsForScreen({ db, screenId, now })` — retourne les
// signaux temps-reel destines a un ecran TV : messages actifs (bandeau
// d'annonce) + welcome message du creneau courant + heartbeat de
// reference de l'ecran.
//
// - Les messages actifs filtrent sur `is_active=1` et une plage
//   date_start / date_end recouvrant `now` (date locale du serveur).
// - Le welcome message est calcule via le mapping `(day, slot)` de la
//   table `display_welcome_messages`. La resolution de `day` et `slot`
//   suit une convention simple :
//     day  : nom court FR minuscule ('lun', 'mar', ...)
//     slot : 'morning' si heure < 12, 'afternoon' si heure < 18, sinon 'evening'.
//   Ce mapping est **volontairement** simple pour T-P0-15 et pourra
//   evoluer sans casser le contrat (les cles retournees sont stables).
//
// Aucun ecriture DB.

import { DisplayV2NotFoundError, DisplayV2ValidationError } from './errors.js';

const DAY_ABBREV = Object.freeze(['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']);

/**
 * Determine le slot (matin / apres-midi / soir) pour une heure donnee.
 * @param {number} hour 0..23
 * @returns {'morning' | 'afternoon' | 'evening'}
 */
export function slotForHour(hour) {
  if (!Number.isFinite(hour)) return 'morning';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Retourne les signaux temps-reel pour un ecran donne.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number|string} params.screenId
 * @param {Date} [params.now] pour test injection (defaut : new Date()).
 * @returns {{
 *   screen: { id: number, name: string, status: string, last_heartbeat: string|null },
 *   messages: Array<{ id: number, title: string, body: string|null, priority: string, date_start: string|null, date_end: string|null }>,
 *   welcome_message: { day: string, slot: string, message: string } | null,
 *   generated_at: string
 * }}
 * @throws {DisplayV2ValidationError} si db ou screenId manquant.
 * @throws {DisplayV2NotFoundError} si l'ecran n'existe pas.
 */
export function getSignalsForScreen({ db, screenId, now } = {}) {
  if (!db) throw new DisplayV2ValidationError('db requis');
  if (screenId === undefined || screenId === null || screenId === '') {
    throw new DisplayV2ValidationError('screenId requis');
  }
  const id = Number.parseInt(screenId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new DisplayV2ValidationError('screenId doit etre un entier positif');
  }

  const screenRow = db
    .prepare(`SELECT id, name, status, last_heartbeat FROM display_screens WHERE id = ?`)
    .get(id);
  if (!screenRow) {
    throw new DisplayV2NotFoundError(`Ecran introuvable (id=${id})`, { screenId: id });
  }

  const reference = now instanceof Date ? now : new Date();
  const day = DAY_ABBREV[reference.getDay()] ?? 'lun';
  const slot = slotForHour(reference.getHours());

  // Messages actifs : is_active=1 AND (date_end IS NULL OR date_end >= today).
  // On garde le meme filtre applicatif que /api/display/messages?active=1
  // pour eviter toute divergence de visibilite entre v1 et v2.
  const messages = db
    .prepare(
      `SELECT id, title, body, priority, date_start, date_end
       FROM display_messages
       WHERE is_active = 1 AND (date_end IS NULL OR date_end >= date('now'))
       ORDER BY
         CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         created_at DESC`,
    )
    .all();

  // Welcome message : mapping (day, slot). Null si non defini.
  const welcomeRow = db
    .prepare(`SELECT day, slot, message FROM display_welcome_messages WHERE day = ? AND slot = ?`)
    .get(day, slot);

  return {
    screen: {
      id: screenRow.id,
      name: screenRow.name,
      status: screenRow.status,
      last_heartbeat: screenRow.last_heartbeat,
    },
    messages,
    welcome_message: welcomeRow
      ? { day: welcomeRow.day, slot: welcomeRow.slot, message: welcomeRow.message }
      : null,
    generated_at: reference.toISOString(),
  };
}
