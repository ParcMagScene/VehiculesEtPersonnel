import fs from 'fs';

import { google } from 'googleapis';

import db from './database.js';

const CALENDAR_READ_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

function parseServiceAccountJsonFromEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  const candidates = [raw];
  // Support base64 for secret managers that store JSON as encoded text.
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    // ignore
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed?.client_email && parsed?.private_key) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON invalide: JSON non parsable');
}

function parseServiceAccountJsonFromFile() {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!filePath) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);
  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH invalide: client_email/private_key manquants');
  }
  return parsed;
}

function resolveServiceAccountCredentials() {
  const fromEnv = parseServiceAccountJsonFromEnv();
  if (fromEnv) return fromEnv;
  const fromFile = parseServiceAccountJsonFromFile();
  if (fromFile) return fromFile;
  return null;
}

function resolveCalendarId(overrideCalendarId) {
  const requested = String(overrideCalendarId || '').trim();
  if (requested) return requested;

  const row = db.prepare("SELECT value FROM config WHERE key = 'google_calendar_id'").get();
  return String(row?.value || process.env.GOOGLE_CALENDAR_ID || '').trim() || 'primary';
}

function toPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export function getGoogleServiceAccountStatus() {
  const creds = resolveServiceAccountCredentials();
  const calendarId = resolveCalendarId();
  return {
    configured: !!creds,
    mode: 'service_account',
    serviceAccountEmail: creds?.client_email || null,
    calendarId,
    scopes: [CALENDAR_READ_SCOPE],
    canWrite: false,
  };
}

function buildJwtClient() {
  const creds = resolveServiceAccountCredentials();
  if (!creds) {
    throw new Error(
      'Service Account non configuré: renseignez GOOGLE_SERVICE_ACCOUNT_JSON (ou GOOGLE_SERVICE_ACCOUNT_KEY_PATH)',
    );
  }

  return new google.auth.JWT({
    email: creds.client_email,
    key: String(creds.private_key).replace(/\\n/g, '\n'),
    scopes: [CALENDAR_READ_SCOPE],
  });
}

export async function getEvents({
  calendarId,
  timeMin,
  timeMax,
  singleEvents = true,
  maxResults = 2500,
  orderBy = 'startTime',
  q,
  pageToken,
} = {}) {
  const auth = buildJwtClient();
  await auth.authorize();

  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.events.list({
    calendarId: resolveCalendarId(calendarId),
    timeMin,
    timeMax,
    singleEvents: singleEvents !== false,
    maxResults: toPositiveInt(maxResults, 2500, 2500),
    orderBy,
    q,
    pageToken,
  });

  return response.data;
}

export async function getEventById({ eventId, calendarId } = {}) {
  if (!eventId) throw new Error('eventId requis');

  const auth = buildJwtClient();
  await auth.authorize();

  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.events.get({
    calendarId: resolveCalendarId(calendarId),
    eventId,
  });

  return response.data;
}
