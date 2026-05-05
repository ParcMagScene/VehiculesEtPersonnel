import rateLimit from 'express-rate-limit';

/**
 * Rate limiter pour les endpoints d'authentification
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 5,
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * [AUDIT FIX MED-B4/B6] Rate limiter pour endpoints sensibles non-auth
 * (access-requests, reset-password, forgot-password)
 */
export const sensitiveEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 30 : 10,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter général pour toutes les API
 */
export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600,
  message: { error: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter pour les endpoints Google Calendar (proxy API Google)
 * 60 requêtes/min/IP max pour éviter d'épuiser le quota Google
 */
export const googleCalendarLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 120 : 60,
  message: { error: 'Trop de requêtes Google Calendar. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
