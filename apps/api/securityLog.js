// [SEC PHASE 2] Journal de sécurité persistant.
// Les events critiques (CSRF, échecs login, élévations privilèges, accès refusés)
// sont append-only sur disque pour survivre aux redémarrages et permettre
// l'analyse post-incident — complément des logs console.
//
// Format : 1 ligne JSON par événement (NDJSON), rotation manuelle (logrotate).
// Fichier : <repo>/logs/security.log (créé à la volée).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(__dirname, '..', '..', 'logs');
const SECURITY_LOG = path.join(LOGS_DIR, 'security.log');

let _ready = false;
function ensureReady() {
  if (_ready) return true;
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    _ready = true;
    return true;
  } catch (e) {
    logger.warn('securityLog: impossible de créer logs/', e.message);
    return false;
  }
}

/**
 * Écrit un événement de sécurité dans logs/security.log (NDJSON).
 * @param {string} event - Code court (ex: 'csrf.blocked', 'auth.login.failed')
 * @param {object} [meta] - Contexte (ip, userId, path, reason…)
 */
export function logSecurityEvent(event, meta = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...meta,
  });
  // Toujours échoer en console (visibilité immédiate)
  logger.warn(`[SECURITY] ${event}`, meta);
  if (!ensureReady()) return;
  fs.appendFile(SECURITY_LOG, line + '\n', (err) => {
    if (err) logger.warn('securityLog append error:', err.message);
  });
}

/**
 * Helper : extrait le contexte minimal d'une requête Express.
 */
export function reqContext(req) {
  return {
    ip: req.ip,
    method: req.method,
    path: req.path,
    ua: req.headers['user-agent']?.slice(0, 200),
    userId: req.user?.id ?? null,
  };
}
