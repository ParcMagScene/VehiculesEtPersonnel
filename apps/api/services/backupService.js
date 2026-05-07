/**
 * Service de lecture du système de backups eM@g.
 *
 * 100 % lecture seule — n'écrit jamais en DB ni sur le système de fichiers.
 * Expose le manifest JSON, le dernier statut depuis backup.log et la liste
 * brute des fichiers présents dans backups/{db,media}.
 *
 * Cf. scripts/backup/ pour la génération.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import logger from '../logger.js';

const PROJECT_ROOT = path.resolve(process.cwd());
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups');
const MANIFEST_PATH = path.join(BACKUPS_DIR, 'manifest.json');
const LOG_PATH = path.join(BACKUPS_DIR, 'backup.log');

/**
 * Liste récursive des fichiers d'un dossier (best-effort, silencieux).
 * @param {string} dir
 * @returns {Array<{path:string,size:number,mtime:string}>}
 */
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        try {
          const st = statSync(full);
          out.push({
            path: path.relative(BACKUPS_DIR, full),
            size: st.size,
            mtime: st.mtime.toISOString(),
          });
        } catch {
          /* ignore stat errors */
        }
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * Liste les backups DB et médias présents.
 * @returns {{db:Array, media:Array}}
 */
export function listBackups() {
  const db = listFiles(path.join(BACKUPS_DIR, 'db')).filter((f) => f.path.endsWith('.db.gz'));
  const media = listFiles(path.join(BACKUPS_DIR, 'media')).filter((f) =>
    f.path.endsWith('.tar.gz'),
  );
  // Tri décroissant (plus récents en premier).
  const byMtimeDesc = (a, b) => b.mtime.localeCompare(a.mtime);
  db.sort(byMtimeDesc);
  media.sort(byMtimeDesc);
  return { db, media };
}

/**
 * Lit le manifest JSON s'il existe.
 * @returns {object|null}
 */
export function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    const raw = readFileSync(MANIFEST_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn({ err }, 'backupService: manifest illisible');
    return null;
  }
}

/**
 * Renvoie les 50 dernières lignes du log central.
 * @returns {string[]}
 */
export function getRecentLog(maxLines = 50) {
  if (!existsSync(LOG_PATH)) return [];
  try {
    const content = readFileSync(LOG_PATH, 'utf8');
    return content.split('\n').slice(-maxLines).filter(Boolean);
  } catch (err) {
    logger.warn({ err }, 'backupService: log illisible');
    return [];
  }
}

/**
 * Renvoie un résumé pour l'UI admin.
 * @returns {{lastDbBackup:object|null,lastMediaBackup:object|null,totalDbSize:number,totalMediaSize:number,manifestUpdatedAt:string|null}}
 */
export function getStatus() {
  const { db, media } = listBackups();
  const manifest = readManifest();
  const sum = (arr) => arr.reduce((acc, f) => acc + (f.size || 0), 0);
  return {
    lastDbBackup: db[0] || null,
    lastMediaBackup: media[0] || null,
    dbCount: db.length,
    mediaCount: media.length,
    totalDbSize: sum(db),
    totalMediaSize: sum(media),
    manifestUpdatedAt: manifest?.updated_at || null,
  };
}
