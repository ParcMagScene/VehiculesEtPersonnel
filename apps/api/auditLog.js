// ═══════════════════════════════════════════════════════════════
// auditLog.js — Audit trail centralisé pour les opérations sensibles
// [AUDIT FIX C1] Trace toutes les opérations admin et de sécurité
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';

// Créer la table d'audit si elle n'existe pas
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    actor_id INTEGER,
    actor_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT
  )
`);

// Index pour les recherches fréquentes
db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)`);

const insertStmt = db.prepare(`
  INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, details, ip_address, user_agent)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Enregistre une entrée dans l'audit trail
 * @param {object} params
 * @param {number|null} params.actorId - ID de l'utilisateur qui fait l'action
 * @param {string|null} params.actorEmail - Email de l'acteur
 * @param {string} params.action - Type d'action (ex: 'user.create', 'user.delete', 'permissions.change')
 * @param {string|null} params.targetType - Type de cible ('user', 'session', 'config', etc.)
 * @param {string|null} params.targetId - ID de la cible
 * @param {object|null} params.details - Détails supplémentaires (sérialisé en JSON)
 * @param {object|null} params.req - Request Express pour extraire IP/user-agent
 */
export function auditLog({ actorId = null, actorEmail = null, action, targetType = null, targetId = null, details = null, req = null }) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || null) : null;
    const ua = req ? (req.headers['user-agent'] || null) : null;
    const detailsStr = details ? JSON.stringify(details) : null;

    insertStmt.run(actorId, actorEmail, action, targetType, String(targetId), detailsStr, ip, ua);
  } catch (err) {
    // Ne jamais bloquer l'opération principale si l'audit échoue
    logger.error('[AUDIT] Erreur écriture audit log:', err.message);
  }
}

/**
 * Actions d'audit standardisées
 */
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',
  PASSWORD_CHANGE: 'auth.password.change',
  PASSWORD_RESET_REQUEST: 'auth.password.reset_request',
  PASSWORD_RESET_COMPLETE: 'auth.password.reset_complete',
  
  // Admin — Users
  USER_CREATE: 'admin.user.create',
  USER_DELETE: 'admin.user.delete',
  USER_ADMIN_TOGGLE: 'admin.user.admin_toggle',
  USER_PERMISSIONS_CHANGE: 'admin.user.permissions_change',
  USER_PASSWORD_RESET: 'admin.user.password_reset',
  USER_PASSWORD_CHANGE: 'admin.user.password_change',
  USER_BLOCK: 'admin.user.block',
  
  // Admin — Access
  ACCESS_REQUEST_APPROVE: 'admin.access.approve',
  ACCESS_REQUEST_REJECT: 'admin.access.reject',
  AUTHORIZED_EMAIL_ADD: 'admin.email.add',
  AUTHORIZED_EMAIL_DELETE: 'admin.email.delete',
  
  // Admin — Config
  EMAIL_CONFIG_CHANGE: 'admin.config.email',
  CACHE_CLEAR: 'admin.cache.clear',
  
  // Security
  SESSION_INVALIDATED: 'security.session.invalidated',
  SESSIONS_FORCE_CLOSED: 'security.sessions.force_closed',
};

export default auditLog;
