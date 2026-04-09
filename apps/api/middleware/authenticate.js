import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../database.js';
import { authCache } from '../cache.js';

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
      return res.status(401).json({ error: 'Token manquant' });
    }

    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
      if (err) return res.status(403).json({ error: 'Token invalide' });

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);

      // [PERF] Vérifier le cache avant de requêter la DB
      const cachedSession = authCache.get(tokenHash);
      if (cachedSession !== null) {
        req.user = user;
        return next();
      }

      const session = db.prepare(
        'SELECT 1 FROM active_sessions WHERE token_hash = ? AND expires_at > datetime(\'now\')'
      ).get(tokenHash);
      if (!session) {
        return res.status(401).json({ error: 'Session expirée ou révoquée' });
      }

      // Mettre en cache le résultat positif (TTL 30s)
      authCache.set(tokenHash, true);

      // Mise à jour silencieuse de last_activity (fire-and-forget, ne bloque pas la requête)
      try {
        db.prepare('UPDATE active_sessions SET last_activity = CURRENT_TIMESTAMP WHERE token_hash = ?').run(tokenHash);
      } catch { /* silencieux */ }

      req.user = user;
      next();
    });
  };
}
