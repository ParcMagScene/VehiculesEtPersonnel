// apps/api/ws/auth.js
//
// Ticket : T-P1-02 (WebSocket core — auth handshake).
//
// Authentifie une requete HTTP `Upgrade: websocket` avant le
// handshake WebSocket final. Reutilise le meme cookie `auth_token`
// (JWT HS256) que le middleware `middleware/authenticate.js` afin
// de garantir une **source unique de verite** cote auth (aucune
// duplication de secret ou d'algo).
//
// Sequence :
//   1. Lit le cookie `COOKIE_NAME` depuis `req.headers.cookie` OU
//      le header `Authorization: Bearer <token>`.
//   2. Verifie la signature JWT.
//   3. Verifie la session `active_sessions` (non expiree).
//   4. Retourne `{ user, tokenHash }` ou `null`.
//
// Fonction pure : aucun effet de bord (ne mute pas la DB, ne
// touche pas au socket). L'appelant decide s'il faut fermer le
// socket ou proceder au handshake.

import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token';

/**
 * Parse un header `Cookie` de type `a=1; b=2` en objet.
 *
 * @param {string|undefined} cookieHeader
 * @returns {Record<string, string>}
 */
export function parseCookieHeader(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

/**
 * Extrait un token JWT depuis une requete HTTP (cookie, header
 * Authorization Bearer OU query string `?token=`). Retourne null
 * si aucun token trouve. La query string est prioritaire car
 * explicitement transmise par le client WebSocket.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {string|null}
 */
export function extractTokenFromRequest(req) {
  // 1. Query string (utile pour l'upgrade WS quand le cookie ne
  //    peut pas etre transmis, ex cross-origin sans withCredentials).
  if (typeof req?.url === 'string' && req.url.includes('?')) {
    try {
      const parsed = new URL(req.url, 'http://internal.local');
      const qsToken = parsed.searchParams.get('token');
      if (qsToken) return qsToken;
    } catch {
      // ignore : URL malformee -> tente les autres voies
    }
  }
  // 2. Header Authorization: Bearer <token>
  const authHeader = req?.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  // 3. Cookie httpOnly `auth_token` (nom paramétrable via COOKIE_NAME).
  const cookies = parseCookieHeader(req?.headers?.cookie);
  const cookieToken = cookies[COOKIE_NAME];
  return cookieToken || null;
}

/**
 * Verifie une requete d'upgrade WebSocket : token present, JWT
 * valide, session active en base.
 *
 * @param {object} params
 * @param {import('node:http').IncomingMessage} params.req
 * @param {string} params.jwtSecret
 * @param {import('better-sqlite3').Database} params.db
 * @returns {{
 *   user: { id: number, email?: string },
 *   tokenHash: string,
 * } | null}
 */
export function verifyWebSocketRequest({ req, jwtSecret, db } = {}) {
  if (!req || !jwtSecret || !db) return null;

  const token = extractTokenFromRequest(req);
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object' || !payload.id) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
  const session = db
    .prepare(
      "SELECT expires_at FROM active_sessions WHERE token_hash = ? AND expires_at > datetime('now')",
    )
    .get(tokenHash);
  if (!session) return null;

  return {
    user: { id: payload.id, email: payload.email },
    tokenHash,
  };
}
