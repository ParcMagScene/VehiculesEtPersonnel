// ═══════════════════════════════════════════════════════════════
// googleRoutes.js — Routes Google OAuth2 Authorization Code Flow
// Phase B : remplace le flux implicite GIS par un flux serveur sécurisé
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import { google } from 'googleapis';
import db from './database.js';
import logger from './logger.js';
import {
  isGoogleOAuthConfigured,
  getAuthorizationUrl,
  exchangeCode,
  storeRefreshToken,
  getValidAccessToken,
  getConnectionStatus,
  deleteTokens,
  revokeToken,
  updateLastSync,
} from './googleTokenManager.js';
import { pullReservationsFromGoogle } from './googleBidirectionalSync.js';

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GCAL_TIMEOUT_MS = 10000;
const GCAL_MAX_RETRIES = 2;

// Wrapper async pour garantir qu'une erreur non catchée renvoie 502
const gcalRoute = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    logger.error('Google route error:', err.message);
    if (!res.headersSent)
      res.status(502).json({
        success: false,
        error: 'google_unavailable',
        message: 'Service Google Calendar indisponible',
      });
  }
};

// ── Proxy vers Google Calendar API via access_token rafraîchi ──

async function googleProxyV2(req, res, method, url, body) {
  const token = await getValidAccessToken(req.user.id);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'google_not_connected',
      message: 'Compte Google non connecté — connectez-vous via Paramètres',
    });
  }

  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';

  for (let attempt = 0; attempt <= GCAL_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GCAL_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        if ([502, 503, 504].includes(response.status) && attempt < GCAL_MAX_RETRIES) continue;

        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          errorData = { message: text };
        }

        if (response.status === 401) {
          // Token expiré malgré le refresh — forcer un nouveau refresh au prochain appel
          return res.status(401).json({
            success: false,
            error: 'google_token_expired',
            message: 'Session Google expirée — réessayez',
          });
        }

        return res.status(response.status).json(errorData);
      }

      if (response.status === 204) return res.status(204).end();
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError' && attempt < GCAL_MAX_RETRIES) continue;
      logger.error('Google Calendar proxy error:', err.message);
      return res.status(502).json({
        success: false,
        error: 'google_proxy_error',
        message: 'Erreur communication Google Calendar',
      });
    }
  }
}

function getCalendarId(req) {
  const id =
    req.query.calendarId ||
    (() => {
      const row = db.prepare("SELECT value FROM config WHERE key = 'google_calendar_id'").get();
      return row?.value || 'primary';
    })();
  // Sanitize: calendarId must be a valid email or 'primary'
  if (id !== 'primary' && !/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9.-]+$/.test(id)) {
    return 'primary';
  }
  return id;
}

// ── State CSRF (in-memory, TTL 10 min) ──
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (now - val.createdAt > STATE_TTL_MS) pendingStates.delete(key);
  }
}

// Nettoyage périodique automatique (toutes les 5 min)
setInterval(cleanExpiredStates, 5 * 60 * 1000).unref();

// Validation eventId (éviter l'injection de path)
function validateEventId(req, res) {
  const id = req.params.eventId;
  if (!id || id.length > 1024 || /[/\\]/.test(id)) {
    res
      .status(400)
      .json({ success: false, error: 'invalid_event_id', message: 'Event ID invalide' });
    return false;
  }
  return true;
}

// ── Setup ──

export function setupGoogleRoutes(app, authenticateToken) {
  // ── B1: Initier le flux OAuth2 ──
  // Redirige l'utilisateur vers Google pour autorisation
  app.get('/api/google/auth', authenticateToken, (req, res) => {
    if (!isGoogleOAuthConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'google_not_configured',
        message: 'Module Google non configuré (variables .env manquantes)',
      });
    }

    cleanExpiredStates();

    // Générer un state CSRF lié au user
    const state = crypto.randomBytes(32).toString('hex');
    pendingStates.set(state, { userId: req.user.id, createdAt: Date.now() });

    const url = getAuthorizationUrl(state);
    logger.info(`[Google] Auth initié pour user ${req.user.id}`);
    res.json({ url });
  });

  // ── B2: Callback OAuth2 ──
  // Google redirige ici après consentement
  app.get('/api/google/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn(`[Google] Callback erreur: ${error}`);
      return res.redirect('/?google_error=' + encodeURIComponent(error));
    }

    if (!code || !state) {
      return res.redirect('/?google_error=missing_params');
    }

    cleanExpiredStates();

    const pending = pendingStates.get(state);
    if (!pending) {
      logger.warn('[Google] Callback avec state invalide/expiré');
      return res.redirect('/?google_error=invalid_state');
    }
    pendingStates.delete(state);

    try {
      const result = await exchangeCode(code);

      if (!result.refresh_token) {
        logger.error(
          '[Google] Pas de refresh_token reçu — vérifiez access_type=offline et prompt=consent',
        );
        return res.redirect('/?google_error=no_refresh_token');
      }

      storeRefreshToken(
        pending.userId,
        result.refresh_token,
        result.email,
        'https://www.googleapis.com/auth/calendar',
      );

      logger.info(
        `[Google] Connexion réussie pour user ${pending.userId} (${result.email || '?'})`,
      );
      res.redirect('/?google_connected=true');
    } catch (err) {
      logger.error('[Google] Échange code échoué:', err.message);
      res.redirect('/?google_error=exchange_failed');
    }
  });

  // ── B3: Statut de connexion ──
  app.get('/api/google/status', authenticateToken, (req, res) => {
    const status = getConnectionStatus(req.user.id);
    res.json(status);
  });

  // ── B4: Déconnexion Google ──
  app.delete(
    '/api/google/disconnect',
    authenticateToken,
    gcalRoute(async (req, res) => {
      await revokeToken(req.user.id);
      res.json({ success: true, message: 'Compte Google déconnecté' });
    }),
  );

  // ── B3-bis: Vérifier si OAuth est configuré ──
  app.get('/api/google/configured', authenticateToken, (req, res) => {
    res.json({ configured: isGoogleOAuthConfigured() });
  });

  // ── B5: Proxy Google Calendar (via refresh_token) ──

  // Liste des calendriers
  app.get(
    '/api/google/calendars',
    authenticateToken,
    gcalRoute(async (req, res) => {
      await googleProxyV2(req, res, 'GET', `${GOOGLE_API_BASE}/users/me/calendarList`);
    }),
  );

  // Ajouter un calendrier
  app.post(
    '/api/google/calendars',
    authenticateToken,
    gcalRoute(async (req, res) => {
      await googleProxyV2(req, res, 'POST', `${GOOGLE_API_BASE}/users/me/calendarList`, req.body);
    }),
  );

  // Lister les événements
  app.get(
    '/api/google/events',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const calendarId = getCalendarId(req);
      const params = new URLSearchParams();
      for (const key of [
        'timeMin',
        'timeMax',
        'singleEvents',
        'maxResults',
        'orderBy',
        'q',
        'pageToken',
        'syncToken',
      ]) {
        if (req.query[key]) params.set(key, req.query[key]);
      }
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
      await googleProxyV2(req, res, 'GET', url);
      updateLastSync(req.user.id);
    }),
  );

  // Obtenir un événement
  app.get(
    '/api/google/events/:eventId',
    authenticateToken,
    gcalRoute(async (req, res) => {
      if (!validateEventId(req, res)) return;
      const calendarId = getCalendarId(req);
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(req.params.eventId)}`;
      await googleProxyV2(req, res, 'GET', url);
    }),
  );

  // Créer un événement
  app.post(
    '/api/google/events',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const calendarId = getCalendarId(req);
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
      await googleProxyV2(req, res, 'POST', url, req.body);
    }),
  );

  // Mettre à jour un événement
  app.patch(
    '/api/google/events/:eventId',
    authenticateToken,
    gcalRoute(async (req, res) => {
      if (!validateEventId(req, res)) return;
      const calendarId = getCalendarId(req);
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(req.params.eventId)}`;
      await googleProxyV2(req, res, 'PATCH', url, req.body);
    }),
  );

  // Supprimer un événement
  app.delete(
    '/api/google/events/:eventId',
    authenticateToken,
    gcalRoute(async (req, res) => {
      if (!validateEventId(req, res)) return;
      const calendarId = getCalendarId(req);
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(req.params.eventId)}`;
      await googleProxyV2(req, res, 'DELETE', url);
    }),
  );

  // ── Sync Pull : Google → eM@g (réconciliation bidirectionnelle) ──
  // Réconcilie les réservations eM@g ayant un google_event_id avec les événements Google.
  // Google gagne sur les dates si elles divergent.
  app.post(
    '/api/google/sync/pull-reservations',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const days = Math.max(
        1,
        Math.min(365, parseInt(req.query.days || req.body?.days || '90', 10)),
      );
      const result = await pullReservationsFromGoogle({ userId: req.user.id, days });
      if (result.skipped) {
        return res.status(503).json({
          success: false,
          error: result.reason,
          message: 'Synchronisation pull indisponible',
          details: result.details,
        });
      }
      res.json(result);
    }),
  );

  logger.info('[Google] Routes OAuth2 v2 montées (/api/google/*)');
}
