import cors from 'cors';

import logger from '../logger.js';

// Construire la liste d'origines autorisées à partir de ALLOWED_ORIGINS (env)
// Fallback sur localhost uniquement si rien n'est configuré
const fallbackOrigins = ['http://localhost:4173', 'http://127.0.0.1:4173'];
if (process.env.NODE_ENV === 'development') {
  fallbackOrigins.push(
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
  );
}
export const allowedOrigins = (process.env.ALLOWED_ORIGINS || fallbackOrigins.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

logger.info('🌐 Origines CORS autorisées:', allowedOrigins);

/**
 * Middleware CORS — restriction aux domaines autorisés
 */
export const corsMiddleware = cors({
  origin: function (origin, callback) {
    // Requêtes sans origin = same-origin (navigateur), curl, mobile, server-to-server
    // Les navigateurs modernes envoient TOUJOURS Origin pour les requêtes cross-origin avec credentials
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.error(
      `❌ CORS bloqué pour origin: "${origin}" — Autorisées: ${allowedOrigins.join(', ')}`,
    );
    return callback(new Error('CORS non autorisé'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
});
