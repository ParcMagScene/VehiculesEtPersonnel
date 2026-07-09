// apps/api/services/display/config.js
//
// Ticket : T-P0-15 (Display v2 DisplayService interne).
//
// Service `getScreenConfig({ db, screenId })` — retourne la
// configuration complete d'un ecran TV pour negociation client v2 :
//
//   - screen : id, name, location, resolution, orientation, status,
//              is_active, last_heartbeat, config (JSON parse).
//   - playlist : { id, name } de la playlist affectee (ou null).
//   - appearance : merge de la table display_config (theme, couleurs,
//                  meteo, autoScroll) avec les valeurs par defaut
//                  cohérentes avec /api/display/appearance v1.
//
// Aucun ecriture DB. Aucun effet de bord.

import { DisplayV2NotFoundError, DisplayV2ValidationError } from './errors.js';

const APPEARANCE_DEFAULTS = Object.freeze({
  primaryColor: '#00e1ff',
  secondaryColor: '#000000',
  eventBgColor: '#000000',
  eventTextColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
  showWeather: false,
  autoScroll: true,
  weatherApiKey: '',
  weatherCity: 'Saint-Denis,RE,FR',
});

/**
 * Parse un blob JSON stocke en TEXT en tolerant les erreurs.
 * @param {string|null|undefined} raw
 * @param {*} fallback valeur retournee si parse impossible.
 */
function safeJsonParse(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Lit toutes les cles/valeurs de display_config et les merge avec les
 * defaults. Retourne toujours un objet complet (jamais partiel).
 * @param {import('better-sqlite3').Database} db
 * @returns {Record<string, unknown>}
 */
export function readAppearance(db) {
  const rows = db.prepare('SELECT key, value FROM display_config').all();
  const overrides = {};
  for (const row of rows) {
    overrides[row.key] = safeJsonParse(row.value, row.value);
  }
  const merged = { ...APPEARANCE_DEFAULTS };
  for (const key of Object.keys(APPEARANCE_DEFAULTS)) {
    if (overrides[key] !== undefined) merged[key] = overrides[key];
  }
  return merged;
}

/**
 * Retourne la configuration complete d'un ecran pour un client v2.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number|string} params.screenId
 * @returns {{
 *   screen: object,
 *   playlist: { id: number, name: string } | null,
 *   appearance: Record<string, unknown>
 * }}
 * @throws {DisplayV2ValidationError} si db ou screenId manquant.
 * @throws {DisplayV2NotFoundError} si l'ecran n'existe pas.
 */
export function getScreenConfig({ db, screenId } = {}) {
  if (!db) throw new DisplayV2ValidationError('db requis');
  if (screenId === undefined || screenId === null || screenId === '') {
    throw new DisplayV2ValidationError('screenId requis');
  }
  const id = Number.parseInt(screenId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new DisplayV2ValidationError('screenId doit etre un entier positif');
  }

  const row = db
    .prepare(
      `SELECT s.id, s.name, s.location, s.resolution, s.orientation, s.status,
              s.is_active, s.last_heartbeat, s.config,
              s.playlist_id, p.name AS playlist_name
       FROM display_screens s
       LEFT JOIN display_playlists p ON p.id = s.playlist_id
       WHERE s.id = ?`,
    )
    .get(id);

  if (!row) {
    throw new DisplayV2NotFoundError(`Ecran introuvable (id=${id})`, { screenId: id });
  }

  const screen = {
    id: row.id,
    name: row.name,
    location: row.location,
    resolution: row.resolution,
    orientation: row.orientation,
    status: row.status,
    is_active: row.is_active === 1,
    last_heartbeat: row.last_heartbeat,
    config: safeJsonParse(row.config, {}),
  };

  const playlist =
    row.playlist_id != null ? { id: row.playlist_id, name: row.playlist_name || '' } : null;

  const appearance = readAppearance(db);

  return { screen, playlist, appearance };
}
