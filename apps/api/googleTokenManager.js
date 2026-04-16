// ═══════════════════════════════════════════════════════════════
// googleTokenManager.js — Gestion sécurisée des tokens Google OAuth2
// Chiffrement AES-256-GCM des refresh tokens, cache access_token en mémoire
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { google } from 'googleapis';
import db from './database.js';
import logger from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits

// Cache mémoire des access_tokens (user_id → { token, expiresAt })
const accessTokenCache = new Map();

// Marge de sécurité : renouveler 5 min avant expiration réelle
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

// ── Helpers chiffrement ──

function getEncryptionKey() {
  const hex = process.env.GOOGLE_ENCRYPTION_KEY;
  if (!hex || hex.length < 64) {
    throw new Error(
      'GOOGLE_ENCRYPTION_KEY manquante ou trop courte (64 hex chars = 32 bytes requis)',
    );
  }
  return Buffer.from(hex.slice(0, 64), 'hex');
}

/**
 * Chiffre un texte avec AES-256-GCM
 * @returns {{ encrypted: string, iv: string, tag: string }}
 */
export function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Déchiffre un texte chiffré avec AES-256-GCM
 */
export function decrypt(encrypted, ivHex, tagHex) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ── OAuth2 client factory ──

function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requis dans .env');
  }
  // Le redirect_uri est déterminé dynamiquement
  const port = process.env.PORT || 3002;
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${port}`;
  const redirectUri = `${baseUrl}/api/google/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── DB operations ──

/**
 * Stocke le refresh token chiffré + metadata pour un utilisateur
 */
export function storeRefreshToken(userId, refreshToken, googleEmail, scopes) {
  const { encrypted, iv, tag } = encrypt(refreshToken);
  db.prepare(
    `
    INSERT INTO google_oauth_tokens (user_id, refresh_token_encrypted, refresh_token_iv, refresh_token_tag, google_email, scopes, connected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      refresh_token_iv = excluded.refresh_token_iv,
      refresh_token_tag = excluded.refresh_token_tag,
      google_email = excluded.google_email,
      scopes = excluded.scopes,
      connected_at = excluded.connected_at
  `,
  ).run(userId, encrypted, iv, tag, googleEmail || null, scopes || null, Date.now());

  // Invalider le cache mémoire
  accessTokenCache.delete(userId);
  logger.info(`[Google] Refresh token stocké pour user ${userId} (${googleEmail || 'email?'})`);
}

/**
 * Récupère et déchiffre le refresh token d'un utilisateur
 * @returns {string|null}
 */
export function getRefreshToken(userId) {
  const row = db
    .prepare(
      'SELECT refresh_token_encrypted, refresh_token_iv, refresh_token_tag FROM google_oauth_tokens WHERE user_id = ?',
    )
    .get(userId);
  if (!row) return null;
  try {
    return decrypt(row.refresh_token_encrypted, row.refresh_token_iv, row.refresh_token_tag);
  } catch (err) {
    logger.error(`[Google] Échec déchiffrement refresh token user ${userId}:`, err.message);
    return null;
  }
}

/**
 * Supprime les tokens Google d'un utilisateur (déconnexion)
 */
export function deleteTokens(userId) {
  db.prepare('DELETE FROM google_oauth_tokens WHERE user_id = ?').run(userId);
  accessTokenCache.delete(userId);
  logger.info(`[Google] Tokens supprimés pour user ${userId}`);
}

/**
 * Récupère le statut de connexion Google d'un utilisateur
 */
export function getConnectionStatus(userId) {
  const row = db
    .prepare(
      'SELECT google_email, scopes, connected_at, last_sync_at FROM google_oauth_tokens WHERE user_id = ?',
    )
    .get(userId);
  if (!row) return { connected: false };
  return {
    connected: true,
    email: row.google_email,
    scopes: row.scopes,
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
  };
}

/**
 * Met à jour le timestamp de dernière synchronisation
 */
export function updateLastSync(userId) {
  db.prepare('UPDATE google_oauth_tokens SET last_sync_at = ? WHERE user_id = ?').run(
    Date.now(),
    userId,
  );
}

// ── Access token (avec refresh automatique) ──

/**
 * Obtient un access_token valide pour un utilisateur.
 * Utilise le cache mémoire si encore valide, sinon refresh via Google.
 * @returns {string|null} access_token ou null si non connecté/erreur
 */
export async function getValidAccessToken(userId) {
  // 1. Vérifier le cache mémoire
  const cached = accessTokenCache.get(userId);
  if (cached && Date.now() < cached.expiresAt - EXPIRY_MARGIN_MS) {
    return cached.token;
  }

  // 2. Récupérer le refresh token
  const refreshToken = getRefreshToken(userId);
  if (!refreshToken) return null;

  // 3. Rafraîchir via Google
  try {
    const oauth2 = createOAuth2Client();
    oauth2.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2.refreshAccessToken();
    const accessToken = credentials.access_token;
    const expiresAt = credentials.expiry_date || Date.now() + 3600 * 1000;

    // Mettre en cache
    accessTokenCache.set(userId, { token: accessToken, expiresAt });

    // Si Google a fourni un nouveau refresh_token (rotation), le stocker
    if (credentials.refresh_token && credentials.refresh_token !== refreshToken) {
      const row = db
        .prepare('SELECT google_email, scopes FROM google_oauth_tokens WHERE user_id = ?')
        .get(userId);
      storeRefreshToken(userId, credentials.refresh_token, row?.google_email, row?.scopes);
      logger.info(`[Google] Refresh token roté pour user ${userId}`);
    }

    return accessToken;
  } catch (err) {
    logger.error(`[Google] Échec refresh access_token user ${userId}:`, err.message);

    // Si le refresh token est invalide/révoqué, supprimer la connexion
    if (err.message?.includes('invalid_grant') || err.response?.status === 400) {
      deleteTokens(userId);
      logger.warn(`[Google] Connexion supprimée user ${userId} (refresh token révoqué)`);
    }

    return null;
  }
}

// ── OAuth2 flow helpers ──

/**
 * Génère l'URL d'autorisation Google OAuth2
 */
export function getAuthorizationUrl(state) {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline', // ← CRITIQUE : nécessaire pour le refresh_token
    prompt: 'consent', // Force le consentement pour obtenir le refresh_token
    scope: ['https://www.googleapis.com/auth/calendar'],
    state,
    include_granted_scopes: true,
  });
}

/**
 * Échange un authorization code contre des tokens
 * @returns {{ access_token, refresh_token, expiry_date, email }}
 */
export async function exchangeCode(code) {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  // Récupérer l'email Google via userinfo
  let email = null;
  try {
    oauth2.setCredentials(tokens);
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    email = data.email;
  } catch {
    // L'email n'est pas critique — on continue sans
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    email,
  };
}

/**
 * Révoque le token côté Google (optionnel, au cas où l'utilisateur veut couper l'accès)
 */
export async function revokeToken(userId) {
  const refreshToken = getRefreshToken(userId);
  if (refreshToken) {
    try {
      const oauth2 = createOAuth2Client();
      await oauth2.revokeToken(refreshToken);
      logger.info(`[Google] Token révoqué côté Google pour user ${userId}`);
    } catch (err) {
      // Ne pas bloquer la déconnexion locale si la révocation Google échoue
      logger.warn(`[Google] Échec révocation côté Google user ${userId}:`, err.message);
    }
  }
  deleteTokens(userId);
}

/**
 * Vérifie si le module Google OAuth est configuré (variables .env présentes)
 */
export function isGoogleOAuthConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_ENCRYPTION_KEY
  );
}
