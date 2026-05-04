import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { authCache } from '../cache.js';
import db from '../database.js';
import logger from '../logger.js';

/**
 * Middleware d'authentification — vérifie JWT + session active en DB
 * [PERF] Cache LRU/TTL sur la vérification session (30s)
 */
export function createAuthenticateToken(JWT_SECRET) {
  return function authenticateToken(req, res, next) {
    // [AUDIT Phase 3] Lire le token depuis le header Authorization OU le cookie httpOnly
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.auth_token;

    if (!token) {
      logger.warn(`🔒 Token manquant sur ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'Token manquant' });
    }

    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
      if (err) {
        logger.warn(`🔒 Token invalide sur ${req.method} ${req.path}: ${err.message}`);
        return res.status(403).json({ error: 'Token invalide' });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);

      // [PERF] Vérifier le cache avant de requêter la DB
      const cachedSession = authCache.get(tokenHash);
      if (cachedSession !== null) {
        req.user = user;
        return next();
      }

      const session = db
        .prepare(
          "SELECT last_activity, expires_at FROM active_sessions WHERE token_hash = ? AND expires_at > datetime('now')",
        )
        .get(tokenHash);
      if (!session) {
        logger.warn(
          `🔒 Session expirée/révoquée pour user ${user.id} sur ${req.method} ${req.path} (hash prefix: ${tokenHash.substring(0, 8)}…)`,
        );
        return res.status(401).json({ error: 'Session expirée ou révoquée' });
      }

      // [SEC PHASE 3] Idle timeout : invalide les sessions inactives.
      // Configurable via SESSION_IDLE_TIMEOUT_HOURS (défaut 24h en prod, désactivé en dev).
      const idleHours = parseInt(
        process.env.SESSION_IDLE_TIMEOUT_HOURS ||
          (process.env.NODE_ENV === 'production' ? '24' : '0'),
        10,
      );
      if (idleHours > 0 && session.last_activity) {
        const lastActivityMs = Date.parse(session.last_activity + 'Z');
        if (Number.isFinite(lastActivityMs)) {
          const idleMs = Date.now() - lastActivityMs;
          if (idleMs > idleHours * 3600 * 1000) {
            logger.warn(
              `🕒 Session inactive >${idleHours}h révoquée pour user ${user.id} (idle=${Math.round(idleMs / 60000)}min)`,
            );
            try {
              db.prepare('DELETE FROM active_sessions WHERE token_hash = ?').run(tokenHash);
            } catch {
              /* silencieux */
            }
            authCache.delete?.(tokenHash);
            return res.status(401).json({ error: 'Session expirée par inactivité' });
          }
        }
      }

      // Vérifier si le compte est bloqué
      const blocked = db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(user.id);
      if (blocked && blocked.is_blocked) {
        authCache.delete(tokenHash);
        return res.status(403).json({ error: 'Votre compte a été bloqué' });
      }

      // Mettre en cache le résultat positif (TTL 30s)
      authCache.set(tokenHash, true);

      // Mise à jour silencieuse de last_activity (fire-and-forget, ne bloque pas la requête)
      try {
        db.prepare(
          'UPDATE active_sessions SET last_activity = CURRENT_TIMESTAMP WHERE token_hash = ?',
        ).run(tokenHash);
      } catch {
        /* silencieux */
      }

      req.user = user;
      next();
    });
  };
}
