import cors from 'cors';
import logger from '../logger.js';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://magsav.duckdns.org,http://magsav.duckdns.org:4173,http://magsav.duckdns.org,http://192.168.205.75:4173,http://localhost:5174,http://localhost:4173')
  .split(',')
  .map(s => s.trim());

logger.info('🌐 Origines CORS autorisées:', allowedOrigins);

/**
 * Middleware CORS — restriction aux domaines autorisés
 */
export const corsMiddleware = cors({
  origin: function(origin, callback) {
    // Permettre les requêtes sans origin (curl, mobile, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.error(`❌ CORS bloqué pour origin: "${origin}" — Autorisées: ${allowedOrigins.join(', ')}`);
    return callback(new Error('CORS non autorisé'), false);
  },
  credentials: true
});
