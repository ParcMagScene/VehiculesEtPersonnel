// [SEC PHASE 1] Protection CSRF par vérification d'Origin/Referer
// Stratégie OWASP "verify origin via standard headers" — fonctionne sans token,
// non-cassante pour SPA/TV qui sont sur des origines déjà whitelistées via CORS.
//
// Règles :
//  - Méthodes safe (GET/HEAD/OPTIONS) : passe-droit.
//  - Aucun cookie d'auth présent : passe-droit (Bearer token = pas de risque CSRF
//    car le navigateur n'attache pas Authorization automatiquement cross-origin).
//  - Routes whitelistées (login : pas encore de cookie au moment du POST) : passe-droit.
//  - Sinon : Origin OU Referer doit pointer vers une des origines autorisées.
//
// Bloque les attaques CSRF classiques par formulaire/fetch cross-site même si le
// cookie httpOnly est attaché par le navigateur.

import { allowedOrigins } from '../config/cors.js';
import logger from '../logger.js';
import { logSecurityEvent } from '../securityLog.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Routes exemptées : doivent pouvoir être appelées sans cookie d'auth préexistant
// ou par un client externe légitime (webhooks éventuels).
const EXEMPT_PATH_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/self-reset-password',
  '/api/auth/check-reset',
  '/api/auth/set-new-password',
  '/api/auth/verify-otp',
  '/api/health',
];

function originOf(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch (_) {
    return null;
  }
}

export function csrfOriginCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  // Routes exemptées (login etc. — protégées par rate-limit + bcrypt)
  const p = req.path || '';
  for (const prefix of EXEMPT_PATH_PREFIXES) {
    if (p.startsWith(prefix)) return next();
  }

  // Pas de cookie d'auth → caller hors-navigateur (Bearer/curl/server) : pas de risque CSRF
  const cookieHeader = req.headers.cookie || '';
  const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token';
  if (!cookieHeader.includes(`${COOKIE_NAME}=`)) return next();

  // Cookie d'auth présent : exiger Origin OU Referer cohérent
  const origin = req.headers.origin || null;
  const referer = req.headers.referer || null;
  const candidate = origin || referer;

  if (!candidate) {
    logger.warn(
      `🚫 CSRF: ${req.method} ${p} bloqué — cookie présent sans Origin/Referer (IP=${req.ip})`,
    );
    logSecurityEvent('csrf.missing_origin', {
      ip: req.ip,
      method: req.method,
      path: p,
      ua: req.headers['user-agent']?.slice(0, 200),
    });
    return res.status(403).json({ error: 'CSRF: Origin/Referer requis' });
  }

  const candidateOrigin = originOf(candidate);
  if (candidateOrigin && allowedOrigins.includes(candidateOrigin)) {
    return next();
  }

  logger.warn(
    `🚫 CSRF: ${req.method} ${p} bloqué — origine "${candidateOrigin}" non autorisée (IP=${req.ip})`,
  );
  logSecurityEvent('csrf.bad_origin', {
    ip: req.ip,
    method: req.method,
    path: p,
    origin: candidateOrigin,
    ua: req.headers['user-agent']?.slice(0, 200),
  });
  return res.status(403).json({ error: 'CSRF: Origin non autorisé' });
}
