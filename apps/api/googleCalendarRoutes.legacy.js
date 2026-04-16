// Google Calendar Proxy Routes — CRIT-11: éliminer les tokens Google du localStorage
// Tous les appels Google Calendar API passent par le backend
import db from './database.js';
import logger from './logger.js';

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GCAL_TIMEOUT_MS = 10000; // 10s timeout sur les appels Google
const GCAL_MAX_RETRIES = 2; // 1 retry sur erreurs transitoires (502, 503, 504)

// Wrapper async pour garantir qu'une erreur non catchée renvoie 502 au client
const gcalRoute = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    logger.error('Google Calendar route error:', err.message);
    if (!res.headersSent)
      res
        .status(502)
        .json({ error: 'google_unavailable', message: 'Service Google Calendar indisponible' });
  }
};

// ── Helpers ──

function getGoogleToken(userId) {
  const row = db
    .prepare('SELECT access_token, expires_at FROM google_tokens WHERE user_id = ?')
    .get(userId);
  if (!row) return null;
  if (Date.now() > row.expires_at) return null; // expiré
  return row.access_token;
}

async function googleProxy(req, res, method, url, body) {
  const token = getGoogleToken(req.user.id);
  if (!token) {
    return res.status(401).json({
      error: 'google_token_missing',
      message: 'Token Google absent ou expiré — reconnectez-vous',
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

      // Renvoyer le status code de Google tel quel
      if (!response.ok) {
        // Retry sur erreurs transitoires (sauf dernier essai)
        if ([502, 503, 504].includes(response.status) && attempt < GCAL_MAX_RETRIES) {
          continue;
        }

        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch {
          errorData = { message: text };
        }

        if (response.status === 401) {
          // Token expiré côté Google — supprimer de la DB
          db.prepare('DELETE FROM google_tokens WHERE user_id = ?').run(req.user.id);
          return res.status(401).json({
            error: 'google_token_expired',
            message: 'Token Google expiré — reconnectez-vous',
          });
        }

        return res.status(response.status).json(errorData);
      }

      // 204 No Content (ex: DELETE)
      if (response.status === 204) return res.status(204).end();

      const data = await response.json();
      return res.json(data);
    } catch (err) {
      clearTimeout(timer);
      // Retry sur timeout (sauf dernier essai)
      if (err.name === 'AbortError' && attempt < GCAL_MAX_RETRIES) {
        continue;
      }
      logger.error('Google Calendar proxy error:', err.message);
      return res
        .status(502)
        .json({ error: 'google_proxy_error', message: 'Erreur communication Google Calendar' });
    }
  }
}

function getCalendarId(req) {
  // Utiliser le calendarId passé en query, sinon celui de la config, sinon 'primary'
  if (req.query.calendarId) return req.query.calendarId;
  const row = db.prepare("SELECT value FROM config WHERE key = 'google_calendar_id'").get();
  return row?.value || 'primary';
}

// ── Setup ──

export function setupGoogleCalendarRoutes(app, authenticateToken) {
  // Créer la table si elle n'existe pas
  db.exec(`
    CREATE TABLE IF NOT EXISTS google_tokens (
      user_id INTEGER PRIMARY KEY,
      access_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  // ── Stocker/mettre à jour le token Google ──
  app.post('/api/google-calendar/token', authenticateToken, (req, res) => {
    const { accessToken, expiresAt } = req.body;
    if (!accessToken || !expiresAt) {
      return res.status(400).json({ error: 'accessToken et expiresAt requis' });
    }
    if (typeof expiresAt !== 'number' || expiresAt < Date.now()) {
      return res.status(400).json({ error: 'expiresAt doit être un timestamp futur' });
    }

    db.prepare(
      `
      INSERT INTO google_tokens (user_id, access_token, expires_at) 
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET access_token = excluded.access_token, expires_at = excluded.expires_at
    `,
    ).run(req.user.id, accessToken, expiresAt);

    res.json({ success: true });
  });

  // ── Vérifier si un token est présent et valide ──
  app.get('/api/google-calendar/token-status', authenticateToken, (req, res) => {
    const token = getGoogleToken(req.user.id);
    res.json({ hasToken: !!token });
  });

  // ── Supprimer le token (déconnexion Google) ──
  app.delete('/api/google-calendar/token', authenticateToken, (req, res) => {
    db.prepare('DELETE FROM google_tokens WHERE user_id = ?').run(req.user.id);
    res.json({ success: true });
  });

  // ── Liste des calendriers ──
  app.get(
    '/api/google-calendar/calendars',
    authenticateToken,
    gcalRoute(async (req, res) => {
      await googleProxy(req, res, 'GET', `${GOOGLE_API_BASE}/users/me/calendarList`);
    }),
  );

  // ── Ajouter un calendrier à la liste ──
  app.post(
    '/api/google-calendar/calendars',
    authenticateToken,
    gcalRoute(async (req, res) => {
      await googleProxy(req, res, 'POST', `${GOOGLE_API_BASE}/users/me/calendarList`, req.body);
    }),
  );

  // ── Lister les événements ──
  app.get(
    '/api/google-calendar/events',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const calendarId = getCalendarId(req);
      const params = new URLSearchParams();
      // Relayer les paramètres de requête Google Calendar
      for (const key of [
        'timeMin',
        'timeMax',
        'singleEvents',
        'maxResults',
        'orderBy',
        'q',
        'pageToken',
      ]) {
        if (req.query[key]) params.set(key, req.query[key]);
      }
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
      await googleProxy(req, res, 'GET', url);
    }),
  );

  // ── Obtenir un événement ──
  app.get(
    '/api/google-calendar/events/:eventId',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const calendarId = getCalendarId(req);
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(req.params.eventId)}`;
      await googleProxy(req, res, 'GET', url);
    }),
  );

  // ── Créer un événement ──
  app.post(
    '/api/google-calendar/events',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const calendarId = getCalendarId(req);
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
      await googleProxy(req, res, 'POST', url, req.body);
    }),
  );

  // ── Mettre à jour un événement ──
  app.patch(
    '/api/google-calendar/events/:eventId',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const calendarId = getCalendarId(req);
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(req.params.eventId)}`;
      await googleProxy(req, res, 'PATCH', url, req.body);
    }),
  );

  // ── Supprimer un événement ──
  app.delete(
    '/api/google-calendar/events/:eventId',
    authenticateToken,
    gcalRoute(async (req, res) => {
      const calendarId = getCalendarId(req);
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(req.params.eventId)}`;
      await googleProxy(req, res, 'DELETE', url);
    }),
  );
}
