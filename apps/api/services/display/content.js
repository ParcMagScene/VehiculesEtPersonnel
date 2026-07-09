// apps/api/services/display/content.js
//
// Ticket : T-P0-15 (Display v2 DisplayService interne).
//
// Service `getPlaylistContent({ db, playlistId })` — retourne la
// playlist et ses items ordonnes avec metadonnees enrichies (nom de
// l'item selon item_type : media / message / template).
//
// Aucun ecriture DB.

import { DisplayV2NotFoundError, DisplayV2ValidationError } from './errors.js';

/**
 * Retourne le contenu d'une playlist Display v2.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number|string} params.playlistId
 * @returns {{
 *   playlist: { id: number, name: string, description: string|null, is_active: boolean },
 *   items: Array<{
 *     id: number,
 *     playlist_id: number,
 *     item_type: 'media' | 'message' | 'template',
 *     item_id: number,
 *     item_name: string|null,
 *     duration: number|null,
 *     sort_order: number,
 *     config: Record<string, unknown>
 *   }>,
 *   total: number
 * }}
 * @throws {DisplayV2ValidationError} si db ou playlistId manquant.
 * @throws {DisplayV2NotFoundError} si la playlist n'existe pas.
 */
export function getPlaylistContent({ db, playlistId } = {}) {
  if (!db) throw new DisplayV2ValidationError('db requis');
  if (playlistId === undefined || playlistId === null || playlistId === '') {
    throw new DisplayV2ValidationError('playlistId requis');
  }
  const id = Number.parseInt(playlistId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new DisplayV2ValidationError('playlistId doit etre un entier positif');
  }

  const playlist = db.prepare('SELECT * FROM display_playlists WHERE id = ?').get(id);
  if (!playlist) {
    throw new DisplayV2NotFoundError(`Playlist introuvable (id=${id})`, { playlistId: id });
  }

  const items = db
    .prepare(
      `SELECT pi.id, pi.playlist_id, pi.item_type, pi.item_id,
              pi.duration, pi.sort_order, pi.config,
              CASE
                WHEN pi.item_type = 'media'    THEN (SELECT dm.original_name FROM display_media    dm  WHERE dm.id  = pi.item_id)
                WHEN pi.item_type = 'message'  THEN (SELECT dmsg.title       FROM display_messages dmsg WHERE dmsg.id = pi.item_id)
                WHEN pi.item_type = 'template' THEN (SELECT dt.name          FROM display_templates dt  WHERE dt.id  = pi.item_id)
                ELSE NULL
              END AS item_name
       FROM display_playlist_items pi
       WHERE pi.playlist_id = ?
       ORDER BY pi.sort_order`,
    )
    .all(id)
    .map((row) => ({
      id: row.id,
      playlist_id: row.playlist_id,
      item_type: row.item_type,
      item_id: row.item_id,
      item_name: row.item_name,
      duration: row.duration ?? null,
      sort_order: row.sort_order ?? 0,
      config: safeJsonParse(row.config, {}),
    }));

  return {
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description ?? null,
      is_active: playlist.is_active === 1,
    },
    items,
    total: items.length,
  };
}

function safeJsonParse(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
