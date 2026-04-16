import db from './database.js';
import logger from './logger.js';
import { getValidAccessToken, updateLastSync } from './googleTokenManager.js';

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GCAL_TIMEOUT_MS = 8000;
const DEFAULT_TIMEZONE = 'Europe/Paris';

function isGoogleBidirectionalSyncEnabled() {
  const val = String(process.env.GOOGLE_BIDIRECTIONAL_SYNC || '')
    .trim()
    .toLowerCase();
  return val === '1' || val === 'true' || val === 'yes' || val === 'on';
}

function getCalendarId() {
  const row = db.prepare("SELECT value FROM config WHERE key = 'google_calendar_id'").get();
  const id = (row?.value || 'primary').trim();
  if (!id || id.length > 255) return 'primary';
  return id;
}

function addDays(dateStr, days) {
  const [y, m, d] = String(dateStr || '')
    .split('-')
    .map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function toDateTime(dateStr, hhmm) {
  return `${dateStr}T${hhmm}:00`;
}

function resolveStartTime(period) {
  if (period === 'PM') return '14:00';
  return '08:00';
}

function resolveEndTime(period) {
  if (period === 'AM') return '13:00';
  return '19:00';
}

function buildReservationSummary(reservation, vehicleName) {
  const affaire = String(reservation.affaire || '').trim();
  const client = String(reservation.client_name || '').trim();
  const driver = String(reservation.driver_name || '').trim();

  if (affaire && client) return `${affaire} - ${client} (${vehicleName})`;
  if (affaire) return `${affaire} (${vehicleName})`;
  if (client) return `Reservation ${client} (${vehicleName})`;
  if (driver) return `Reservation ${driver} (${vehicleName})`;
  return `Reservation ${vehicleName}`;
}

function buildReservationDescription(reservation) {
  const lines = [];
  if (reservation.client_name) lines.push(`Client: ${reservation.client_name}`);
  if (reservation.driver_name) lines.push(`Conducteur: ${reservation.driver_name}`);
  if (reservation.location_name) lines.push(`Lieu: ${reservation.location_name}`);
  if (reservation.prestation_name) lines.push(`Prestation: ${reservation.prestation_name}`);
  if (reservation.affaire) lines.push(`Affaire: ${reservation.affaire}`);
  if (reservation.notes) {
    lines.push('');
    lines.push(String(reservation.notes));
  }
  return lines.join('\n');
}

function buildGoogleEventPayload(reservation, vehicleName) {
  const startDate = reservation.start_date;
  const endDate = reservation.end_date;
  const startPeriod = reservation.start_period || 'AM';
  const endPeriod = reservation.end_period || 'PM';

  const summary = buildReservationSummary(reservation, vehicleName || 'vehicule');
  const description = buildReservationDescription(reservation);

  // Multi-jours: en all-day pour eviter les erreurs de fuseau / heures incoherentes.
  if (startDate && endDate && startDate !== endDate) {
    return {
      summary,
      description,
      location: reservation.location_name || undefined,
      start: { date: startDate },
      end: { date: addDays(endDate, 1) },
      extendedProperties: {
        private: {
          emagReservationId: String(reservation.id || ''),
          emagVehicleId: String(reservation.vehicle_id || ''),
        },
      },
    };
  }

  const startTime = resolveStartTime(startPeriod);
  const endTime = resolveEndTime(endPeriod);

  return {
    summary,
    description,
    location: reservation.location_name || undefined,
    start: { dateTime: toDateTime(startDate, startTime), timeZone: DEFAULT_TIMEZONE },
    end: { dateTime: toDateTime(endDate || startDate, endTime), timeZone: DEFAULT_TIMEZONE },
    extendedProperties: {
      private: {
        emagReservationId: String(reservation.id || ''),
        emagVehicleId: String(reservation.vehicle_id || ''),
      },
    },
  };
}

async function googleRequest(userId, method, url, body) {
  const token = await getValidAccessToken(userId);
  if (!token) return { skipped: true, reason: 'google_not_connected' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GCAL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const isNoContent = response.status === 204;
    const raw = isNoContent ? '' : await response.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }
    }

    if (!response.ok) {
      return { ok: false, status: response.status, data };
    }

    updateLastSync(userId);
    return { ok: true, data };
  } catch (error) {
    if (error?.name === 'AbortError')
      return { ok: false, status: 504, data: { message: 'timeout' } };
    return { ok: false, status: 502, data: { message: error?.message || 'google_request_failed' } };
  } finally {
    clearTimeout(timer);
  }
}

export async function syncReservationToGoogle({ reservation, vehicleName, userId }) {
  if (!isGoogleBidirectionalSyncEnabled()) return { skipped: true, reason: 'feature_disabled' };
  if (
    !reservation?.id ||
    !reservation?.vehicle_id ||
    !reservation?.start_date ||
    !reservation?.end_date
  ) {
    return { skipped: true, reason: 'invalid_reservation_payload' };
  }

  const calendarId = getCalendarId();
  const payload = buildGoogleEventPayload(reservation, vehicleName);
  const eventId = String(reservation.google_event_id || '').trim();

  if (eventId) {
    const patchUrl = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const patchResult = await googleRequest(userId, 'PATCH', patchUrl, payload);

    if (patchResult.ok) return { synced: true, action: 'updated', eventId };

    // Si l'event n'existe plus, on le recrée proprement.
    if (patchResult.status === 404) {
      logger.warn(
        `[GoogleSync] Event ${eventId} introuvable pour reservation ${reservation.id}, recreation.`,
      );
    } else {
      logger.warn(
        `[GoogleSync] Echec update reservation ${reservation.id} -> Google (${patchResult.status})`,
      );
      return { skipped: true, reason: 'update_failed', details: patchResult };
    }
  }

  const createUrl = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const createResult = await googleRequest(userId, 'POST', createUrl, payload);
  if (!createResult.ok) {
    logger.warn(
      `[GoogleSync] Echec create reservation ${reservation.id} -> Google (${createResult.status})`,
    );
    return { skipped: true, reason: 'create_failed', details: createResult };
  }

  const newEventId = createResult?.data?.id;
  if (!newEventId) {
    return { skipped: true, reason: 'missing_event_id' };
  }

  return { synced: true, action: 'created', eventId: newEventId };
}

export async function deleteReservationFromGoogle({ googleEventId, userId }) {
  if (!isGoogleBidirectionalSyncEnabled()) return { skipped: true, reason: 'feature_disabled' };

  const eventId = String(googleEventId || '').trim();
  if (!eventId) return { skipped: true, reason: 'missing_event_id' };

  const calendarId = getCalendarId();
  const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const result = await googleRequest(userId, 'DELETE', url);

  if (result.ok || result.status === 404) return { synced: true, action: 'deleted', eventId };

  logger.warn(`[GoogleSync] Echec suppression event ${eventId} (${result.status})`);
  return { skipped: true, reason: 'delete_failed', details: result };
}

// ═══════════════════════════════════════════════════════════════
// Phase 2.9.2 — Pull Google → eM@g (réconciliation)
// ═══════════════════════════════════════════════════════════════

/**
 * Extrait la période (AM/PM) à partir d'une chaîne dateTime Google.
 * Google renvoie "YYYY-MM-DDTHH:MM:SS+02:00" pour Europe/Paris.
 * L'heure locale Paris est directement lisible dans la chaîne.
 */
function parsePeriodFromDateTime(dateTimeStr) {
  if (!dateTimeStr) return 'AM';
  const match = dateTimeStr.match(/T(\d{2}):/);
  if (!match) return 'AM';
  const hour = parseInt(match[1], 10);
  return hour >= 12 ? 'PM' : 'AM';
}

/**
 * Convertit un événement Google en champs date/période eM@g.
 * @returns {{ startDate, endDate, startPeriod, endPeriod } | null}
 */
function parseGoogleEventDates(event) {
  // All-day (start.date présent)
  if (event.start?.date) {
    const startDate = event.start.date;
    // Google stocke la fin en exclu — on revient en inclusif
    const endDate = event.end?.date ? addDays(event.end.date, -1) : startDate;
    return { startDate, endDate, startPeriod: 'AM', endPeriod: 'PM' };
  }

  // Événement dateTime
  if (event.start?.dateTime) {
    const startDate = event.start.dateTime.slice(0, 10);
    const endDate = (event.end?.dateTime || event.start.dateTime).slice(0, 10);
    const startPeriod = parsePeriodFromDateTime(event.start.dateTime);
    const endPeriod = parsePeriodFromDateTime(event.end?.dateTime || event.start.dateTime);
    return { startDate, endDate, startPeriod, endPeriod };
  }

  return null;
}

/**
 * Récupère tous les événements Google d'une fenêtre temporelle (pagination automatique).
 * @returns {{ ok: boolean, events?: object[], reason?: string }}
 */
async function listGoogleEventsInWindow(userId, calendarId, timeMin, timeMax) {
  const events = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      maxResults: '250',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      orderBy: 'startTime',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    const result = await googleRequest(userId, 'GET', url);

    if (!result.ok) {
      if (result.skipped) return { ok: false, reason: result.reason };
      return { ok: false, reason: `google_error_${result.status}`, details: result.data };
    }

    const items = result.data?.items || [];
    events.push(...items);
    pageToken = result.data?.nextPageToken || null;
  } while (pageToken);

  return { ok: true, events };
}

/**
 * Réconcilie les réservations eM@g avec les événements Google Calendar.
 *
 * Stratégie :
 * - Pour chaque réservation DB ayant un google_event_id :
 *   a. Si l'événement n'est plus dans Google → efface google_event_id (orphan)
 *   b. Si les dates diffèrent → met à jour les dates en DB (Google gagne)
 * - Renvoie un rapport { synced, orphaned, skipped, errors }
 *
 * @param {{ userId: string|number, days?: number }} opts
 */
export async function pullReservationsFromGoogle({ userId, days = 90 }) {
  if (!isGoogleBidirectionalSyncEnabled()) {
    return { skipped: true, reason: 'feature_disabled' };
  }

  const calendarId = getCalendarId();

  // Fenêtre : dernière semaine + N jours à venir (pour attraper les modifications récentes)
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - 7);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + Math.max(1, Math.min(365, Number(days) || 90)));

  // 1. Récupérer les événements Google pour cette fenêtre
  const listResult = await listGoogleEventsInWindow(userId, calendarId, timeMin, timeMax);
  if (!listResult.ok) {
    return { skipped: true, reason: listResult.reason, details: listResult.details };
  }

  // 2. Construire un index des événements Google par leur ID
  const googleEventMap = new Map();
  for (const ev of listResult.events) {
    if (ev.id && ev.status !== 'cancelled') {
      googleEventMap.set(ev.id, ev);
    }
  }

  // 3. Récupérer les réservations DB qui ont un google_event_id dans la fenêtre
  const dbReservations = db
    .prepare(
      `
    SELECT r.id, r.vehicle_id, r.start_date, r.end_date, r.start_period, r.end_period,
           r.google_event_id, v.name as vehicle_name
    FROM reservations r
    LEFT JOIN vehicles v ON v.id = r.vehicle_id
    WHERE r.google_event_id IS NOT NULL AND r.google_event_id != ''
      AND r.start_date >= date('now', '-7 days')
      AND r.start_date <= date('now', '+${days} days')
  `.replace('${days}', String(Math.max(1, Math.min(365, Number(days) || 90)))),
    )
    .all();

  const stmtClearEventId = db.prepare(
    `UPDATE reservations SET google_event_id = '', modified_at = CURRENT_TIMESTAMP WHERE id = ?`,
  );
  const stmtUpdateDates = db.prepare(`
    UPDATE reservations
    SET start_date = ?, start_period = ?, end_date = ?, end_period = ?,
        modified_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let synced = 0;
  let orphaned = 0;
  let skipped = 0;
  const errors = [];

  for (const res of dbReservations) {
    const googleEvent = googleEventMap.get(res.google_event_id);

    if (!googleEvent) {
      // Événement supprimé côté Google → on délie la réservation sans la supprimer
      stmtClearEventId.run(res.id);
      orphaned++;
      logger.info(
        `[GooglePull] Réservation ${res.id} déliée (event ${res.google_event_id} absent de Google)`,
      );
      continue;
    }

    // Vérifier que l'event appartient bien à cette réservation (sécurité)
    const emagId = googleEvent.extendedProperties?.private?.emagReservationId;
    if (emagId && String(emagId) !== String(res.id)) {
      // Incohérence — on ne touche pas
      errors.push({
        reservationId: res.id,
        reason: 'id_mismatch',
        googleEventId: res.google_event_id,
      });
      continue;
    }

    // Comparer les dates
    const parsed = parseGoogleEventDates(googleEvent);
    if (!parsed) {
      skipped++;
      continue;
    }

    const datesChanged =
      parsed.startDate !== res.start_date ||
      parsed.endDate !== res.end_date ||
      parsed.startPeriod !== res.start_period ||
      parsed.endPeriod !== res.end_period;

    if (datesChanged) {
      stmtUpdateDates.run(
        parsed.startDate,
        parsed.startPeriod,
        parsed.endDate,
        parsed.endPeriod,
        res.id,
      );
      synced++;
      logger.info(
        `[GooglePull] Réservation ${res.id} mise à jour: ${res.start_date}→${parsed.startDate}, ${res.end_date}→${parsed.endDate}`,
      );
    } else {
      skipped++;
    }
  }

  updateLastSync(userId);

  return {
    ok: true,
    synced,
    orphaned,
    skipped,
    errors,
    total: dbReservations.length,
    googleEventsInWindow: listResult.events.length,
  };
}
