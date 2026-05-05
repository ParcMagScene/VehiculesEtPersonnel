// ═══════════════════════════════════════════════════════════════
// googleRoutes.js — Intégration Google Calendar via Service Account
// Flux serveur→Google, sans OAuth utilisateur ni popup frontend.
// ═══════════════════════════════════════════════════════════════

import {
  getEventById,
  getEvents,
  getGoogleServiceAccountStatus,
} from './GoogleCalendarServiceAccount.js';
import logger from './logger.js';

const gcalRoute = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const message = err?.message || 'Erreur Google Calendar';
    logger.error('[GoogleServiceAccount] Route error:', message);

    if (message.includes('Service Account non configuré')) {
      return res.status(503).json({ success: false, error: 'google_not_configured', message });
    }

    if (message.includes('Requested entity was not found')) {
      return res.status(404).json({ success: false, error: 'event_not_found', message });
    }

    if (!res.headersSent) {
      return res.status(502).json({
        success: false,
        error: 'google_unavailable',
        message: 'Service Google indisponible',
      });
    }
  }
};

function normalizeEventsQuery(query) {
  return {
    calendarId: query.calendarId,
    timeMin: query.timeMin,
    timeMax: query.timeMax,
    singleEvents:
      query.singleEvents === undefined
        ? true
        : String(query.singleEvents).toLowerCase() !== 'false',
    maxResults: query.maxResults,
    orderBy: query.orderBy,
    q: query.q,
    pageToken: query.pageToken,
  };
}

function oauthRemovedResponse(res) {
  return res.status(410).json({
    success: false,
    error: 'oauth_user_removed',
    message:
      'Le flux OAuth utilisateur a été retiré. La synchronisation utilise désormais un Service Account administrateur.',
  });
}

export function setupGoogleRoutes(app, authenticateToken) {
  // ── Nouveau flux principal ──
  app.get(
    '/api/calendar/status',
    authenticateToken,
    gcalRoute(async (_req, res) => {
      res.json(getGoogleServiceAccountStatus());
    }),
  );

  app.get(
    '/api/calendar/events',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const data = await getEvents(normalizeEventsQuery(req.query));
      res.json(data);
    }),
  );

  app.get(
    '/api/calendar/events/:eventId',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const data = await getEventById({
        eventId: req.params.eventId,
        calendarId: req.query.calendarId,
      });
      res.json(data);
    }),
  );

  // ── Alias de compatibilité (lecture seule) ──
  app.get('/api/google/status', authenticateToken, (req, res) => {
    const status = getGoogleServiceAccountStatus();
    res.json({
      connected: status.configured,
      configured: status.configured,
      mode: status.mode,
      serviceAccountEmail: status.serviceAccountEmail,
      calendarId: status.calendarId,
      canWrite: status.canWrite,
      scopes: status.scopes,
    });
  });

  app.get('/api/google/configured', authenticateToken, (_req, res) => {
    const status = getGoogleServiceAccountStatus();
    res.json({ configured: status.configured });
  });

  app.get(
    '/api/google/events',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const data = await getEvents(normalizeEventsQuery(req.query));
      res.json(data);
    }),
  );

  app.get(
    '/api/google/events/:eventId',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const data = await getEventById({
        eventId: req.params.eventId,
        calendarId: req.query.calendarId,
      });
      res.json(data);
    }),
  );

  // ── Endpoints OAuth utilisateur supprimés ──
  app.get('/api/google/auth', authenticateToken, (_req, res) => oauthRemovedResponse(res));
  app.get('/api/google/callback', (_req, res) => oauthRemovedResponse(res));
  app.delete('/api/google/disconnect', authenticateToken, (_req, res) => oauthRemovedResponse(res));
  app.get('/api/google/calendars', authenticateToken, (_req, res) => oauthRemovedResponse(res));
  app.post('/api/google/calendars', authenticateToken, (_req, res) => oauthRemovedResponse(res));
  app.post('/api/google/events', authenticateToken, (_req, res) => oauthRemovedResponse(res));
  app.patch('/api/google/events/:eventId', authenticateToken, (_req, res) =>
    oauthRemovedResponse(res),
  );
  app.delete('/api/google/events/:eventId', authenticateToken, (_req, res) =>
    oauthRemovedResponse(res),
  );
  app.post('/api/google/sync/pull-reservations', authenticateToken, (_req, res) =>
    oauthRemovedResponse(res),
  );

  logger.info('[Google] Routes Service Account montées (/api/calendar/* + alias /api/google/*)');
}
