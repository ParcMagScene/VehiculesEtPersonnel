// ═══════════════════════════════════════════════════════════════
// MODULE SUIVI DU PERSONNEL — Routes API Express
// Fiches quotidiennes + synthèses + export PDF
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import PDFDocument from 'pdfkit';

import db from './database.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  entryPatchSchema,
  incidentTicketUpsertSchema,
  sheetUpdateSchema,
  suiviRecurringTaskCreateSchema,
  suiviRecurringTaskUpdateSchema,
  syntheseDateSchema,
  syntheseMonthSchema,
  syntheseWeekSchema,
  syntheseYearSchema,
} from './schemas/suivi.js';

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function getOrCreateSheet(personId, date, userId) {
  let sheet = db
    .prepare('SELECT * FROM tracking_sheets WHERE person_id = ? AND date = ?')
    .get(personId, date);

  if (!sheet) {
    const id = crypto.randomUUID().replace(/-/g, '');
    db.prepare(
      `INSERT INTO tracking_sheets (id, person_id, date, status, created_by)
       VALUES (?, ?, ?, 'draft', ?)`,
    ).run(id, personId, date, userId);
    sheet = db.prepare('SELECT * FROM tracking_sheets WHERE id = ?').get(id);
  }

  // Sync incrémentale : injecter les tâches planifiées pas encore liées à la fiche
  // Combine : assignation directe (task_assignments.person_id) + multi-affectation (planning_assignments)
  const newTasks = db
    .prepare(
      `SELECT ta.id, ta.period, ta.title, ta.notes, ta.section, ta.time, ta.end_time,
              ta.affaire_num, ta.google_event_title, ta.status
       FROM task_assignments ta
       WHERE ta.date = ? AND ta.deleted_at IS NULL
         AND (
           ta.person_id = ?
           OR ta.id IN (
             SELECT pa.entity_id FROM planning_assignments pa
             WHERE pa.entity_type = 'task' AND pa.person_id = ?
           )
         )
         AND ta.id NOT IN (
           SELECT te.task_assignment_id FROM tracking_entries te
           WHERE te.sheet_id = ? AND te.task_assignment_id IS NOT NULL
         )
       ORDER BY ta.period ASC, ta.time ASC, ta.section ASC`,
    )
    .all(date, personId, personId, sheet.id);

  if (newTasks.length > 0) {
    const maxOrder = db
      .prepare('SELECT MAX(sort_order) AS mx FROM tracking_entries WHERE sheet_id = ?')
      .get(sheet.id);
    let nextOrder = (maxOrder?.mx ?? -1) + 1;

    const insert = db.prepare(
      `INSERT INTO tracking_entries (id, sheet_id, period, task, time_spent, comment, completed, task_assignment_id, sort_order)
       VALUES (?, ?, ?, ?, 0, '', ?, ?, ?)`,
    );

    const insertMany = db.transaction((items) => {
      for (const t of items) {
        const entryId = crypto.randomUUID().replace(/-/g, '');
        const label =
          t.title || t.google_event_title || t.notes || `Tâche ${t.section || 'manuelle'}`;
        const completed = t.status === 'done' ? 1 : 0;
        insert.run(entryId, sheet.id, t.period || 'AM', label, completed, t.id, nextOrder++);
      }
    });
    insertMany(newTasks);
  }

  const recurringTasks = db
    .prepare(
      `SELECT *
       FROM tracking_recurring_tasks
       WHERE person_id = ? AND active = 1
       ORDER BY created_at ASC, id ASC`,
    )
    .all(personId);

  if (recurringTasks.length > 0) {
    const existingRecurringIds = new Set(
      db
        .prepare(
          `SELECT recurring_task_id
           FROM tracking_entries
           WHERE sheet_id = ? AND recurring_task_id IS NOT NULL`,
        )
        .all(sheet.id)
        .map((r) => r.recurring_task_id),
    );

    const maxOrderRecurring = db
      .prepare('SELECT MAX(sort_order) AS mx FROM tracking_entries WHERE sheet_id = ?')
      .get(sheet.id);
    let nextRecurringOrder = (maxOrderRecurring?.mx ?? -1) + 1;

    const insertRecurring = db.prepare(
      `INSERT INTO tracking_entries (
         id, sheet_id, period, task, time_spent, comment, completed,
         task_assignment_id, recurring_task_id, sort_order
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    );

    const insertRecurringMany = db.transaction((items) => {
      for (const rt of items) {
        if (!isRecurringDueOnDate(rt, date)) continue;
        if (existingRecurringIds.has(rt.id)) continue;

        const entryId = crypto.randomUUID().replace(/-/g, '');
        insertRecurring.run(
          entryId,
          sheet.id,
          rt.period || 'AM',
          rt.title || '',
          Number(rt.default_time_spent) || 0,
          rt.default_comment || '',
          0,
          rt.id,
          nextRecurringOrder++,
        );
      }
    });

    insertRecurringMany(recurringTasks);
  }

  return sheet;
}

function getSheetWithEntries(sheetId) {
  const sheet = db.prepare('SELECT * FROM tracking_sheets WHERE id = ?').get(sheetId);
  if (!sheet) return null;

  const entries = db
    .prepare(
      `SELECT te.*, ta.status AS task_status, ta.section AS task_section,
              ta.affaire_num, ta.google_event_title
       FROM tracking_entries te
       LEFT JOIN task_assignments ta ON te.task_assignment_id = ta.id
       WHERE te.sheet_id = ?
       ORDER BY te.period ASC, te.sort_order ASC`,
    )
    .all(sheetId);

  const person = db
    .prepare('SELECT id, first_name, last_name, type, status FROM persons WHERE id = ?')
    .get(sheet.person_id);

  return { ...sheet, entries, person };
}

function formatDateFR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isRecurringDueOnDate(task, dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;

  if (task.recurrence === 'daily') return true;
  if (task.recurrence === 'weekly') {
    if (task.day_of_week === null || task.day_of_week === undefined) return false;
    return d.getDay() === Number(task.day_of_week);
  }
  if (task.recurrence === 'monthly') {
    if (task.day_of_month === null || task.day_of_month === undefined) return false;
    return d.getDate() === Number(task.day_of_month);
  }
  return false;
}

function canManagePerson(person, user) {
  if (!person || !user) return false;
  return user.is_admin === 1 || person.user_id === user.id;
}

// Retourne true si la période (AM/PM) est déjà passée
function isPastPeriod(dateStr, period) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (dateStr < today) return true;
  if (dateStr === today && period === 'AM' && now.getHours() >= 12) return true;
  return false;
}

// Retourne true si la fiche a un contexte d'occupation (congé, mission, présence entreprise)
function hasOccupationContext(sheet) {
  const ctx = sheet.day_context || {};
  return !!(
    ctx.has_unavailability ||
    ctx.has_leave ||
    ctx.has_mission ||
    ctx.has_enterprise_presence
  );
}

const AVAILABILITY_TYPE_LABELS = {
  unavailable: 'Indisponible',
  conge_paye: 'Congé payé',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  formation: 'Formation',
  entreprise: 'Entreprise',
  workshop: 'Workshop',
  examen: 'Examen',
  rdv: 'RDV',
  repos: 'Jour de repos',
  autre: 'Autre',
};

const LEAVE_TYPES = new Set(['conge_paye', 'rtt', 'maladie', 'sans_solde']);
const NON_UNAVAILABILITY_TYPES = new Set(['entreprise']);

function enrichSheetWithDayContext(fullSheet) {
  if (!fullSheet?.person_id || !fullSheet?.date) return fullSheet;

  const availabilities = db
    .prepare(
      `SELECT a.id, a.type, a.reason, a.status, a.start_date, a.end_date, a.start_period, a.end_period
       FROM availabilities a
       WHERE a.person_id = ?
         AND a.status != 'rejected'
         AND a.start_date <= ?
         AND a.end_date >= ?
       ORDER BY a.start_date ASC, a.id ASC`,
    )
    .all(fullSheet.person_id, fullSheet.date, fullSheet.date)
    .map((a) => ({
      ...a,
      type_label: AVAILABILITY_TYPE_LABELS[a.type] || a.type,
    }));

  const missions = db
    .prepare(
      `SELECT m.id, m.title, m.affaire, m.client_name, m.location_name,
              m.start_date, m.end_date, m.status,
              ma.status AS assignment_status,
              ma.position AS assignment_position,
              a.type AS affaire_type
       FROM missions m
       JOIN mission_assignments ma ON ma.mission_id = m.id
       LEFT JOIN affaires a ON a.numero_affaire = m.affaire
       WHERE ma.person_id = ?
         AND m.start_date <= ?
         AND m.end_date >= ?
         AND m.status != 'cancelled'
       ORDER BY m.start_date ASC, m.start_time ASC, m.id ASC`,
    )
    .all(fullSheet.person_id, fullSheet.date, fullSheet.date);

  const planningAffairesRaw = db
    .prepare(
      `SELECT DISTINCT pa.entity_id AS affaire_num,
              COALESCE(NULLIF(a.titre, ''), NULLIF(a.nom, ''), pa.entity_id) AS affaire_label,
              a.type AS affaire_type,
              a.client AS affaire_client,
              a.date_debut,
              a.date_fin,
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM reservations r
                  WHERE r.affaire = pa.entity_id
                    AND r.is_tournee = 1
                    AND r.start_date <= ?
                    AND r.end_date >= ?
                ) THEN 1
                ELSE 0
              END AS is_tournee
       FROM planning_assignments pa
       LEFT JOIN affaires a ON a.numero_affaire = pa.entity_id
       WHERE pa.entity_type = 'affaire'
         AND pa.person_id = ?
         AND (
           EXISTS (
             SELECT 1 FROM task_assignments ta
             WHERE ta.affaire_num = pa.entity_id
               AND ta.date = ?
               AND ta.deleted_at IS NULL
           )
           OR EXISTS (
             SELECT 1 FROM missions m
             WHERE m.affaire = pa.entity_id
               AND m.start_date <= ?
               AND m.end_date >= ?
               AND m.status != 'cancelled'
           )
           OR (
             a.date_debut IS NOT NULL
             AND a.date_debut <= ?
             AND (a.date_fin IS NULL OR a.date_fin >= ?)
           )
         )
       ORDER BY pa.created_at ASC, pa.entity_id ASC`,
    )
    .all(
      fullSheet.date,
      fullSheet.date,
      fullSheet.person_id,
      fullSheet.date,
      fullSheet.date,
      fullSheet.date,
      fullSheet.date,
      fullSheet.date,
    );

  const planningAffairesMap = new Map();
  for (const a of planningAffairesRaw) {
    const affaireNum = String(a.affaire_num || '').trim();
    if (!affaireNum) continue;
    const existing = planningAffairesMap.get(affaireNum);
    if (!existing) {
      planningAffairesMap.set(affaireNum, {
        ...a,
        affaire_num: affaireNum,
        affaire_label: String(a.affaire_label || affaireNum).trim() || affaireNum,
        is_tournee: Boolean(a.is_tournee),
      });
      continue;
    }
    if (
      (!existing.affaire_label || existing.affaire_label === existing.affaire_num) &&
      a.affaire_label
    ) {
      existing.affaire_label = String(a.affaire_label).trim() || existing.affaire_label;
    }
    if (!existing.affaire_client && a.affaire_client) existing.affaire_client = a.affaire_client;
    if (!existing.affaire_type && a.affaire_type) existing.affaire_type = a.affaire_type;
    existing.is_tournee = Boolean(existing.is_tournee || a.is_tournee);
  }

  const planningAffaires = Array.from(planningAffairesMap.values());
  return {
    ...fullSheet,
    day_context: {
      availabilities,
      missions,
      planning_affaires: planningAffaires,
      has_unavailability: availabilities.some((a) => !NON_UNAVAILABILITY_TYPES.has(a.type)),
      has_enterprise_presence: availabilities.some((a) => a.type === 'entreprise'),
      has_leave: availabilities.some((a) => LEAVE_TYPES.has(a.type)),
      has_mission: missions.length > 0,
      has_planning_affaire: planningAffaires.length > 0,
    },
  };
}

function getWeekDates(weekStr) {
  // weekStr = "2026-W16"
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);
  // ISO: semaine 1 contient le 4 janvier
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // lundi=1
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getMonthDates(monthStr) {
  // monthStr = "2026-04"
  const [year, month] = monthStr.split('-').map(Number);
  const dates = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

function getWeekBounds(weekStr) {
  const dates = getWeekDates(weekStr);
  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

function safeJsonParseArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getAffaireIncidentBase(affaireNum) {
  const affaire = db
    .prepare(
      `SELECT numero_affaire,
              COALESCE(NULLIF(nom, ''), NULLIF(titre, ''), NULLIF(event_name, ''), numero_affaire) AS affaire_name,
              date_debut,
              date_fin
       FROM affaires
       WHERE numero_affaire = ?`,
    )
    .get(affaireNum);

  if (!affaire) {
    return {
      affaire_num: affaireNum,
      affaire_name: affaireNum,
      affaire_start_date: null,
      affaire_end_date: null,
      linked_reservations: [],
      linked_personnel: [],
      is_tournee: false,
    };
  }

  const reservations = db
    .prepare(
      `SELECT r.id,
              r.vehicle_id,
              v.name AS vehicle_name,
              r.start_date,
              r.end_date,
              r.driver_name,
              r.is_tournee
       FROM reservations r
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       WHERE r.affaire = ?
       ORDER BY r.start_date ASC, r.id ASC`,
    )
    .all(affaireNum)
    .map((r) => ({
      id: r.id,
      vehicle_id: r.vehicle_id,
      vehicle_name: r.vehicle_name || r.vehicle_id || '',
      start_date: r.start_date,
      end_date: r.end_date,
      driver_name: r.driver_name || '',
      is_tournee: Boolean(r.is_tournee),
    }));

  const linkedPersonnelMap = new Map();

  const fromTasks = db
    .prepare(
      `SELECT DISTINCT p.id, p.first_name, p.last_name
       FROM task_assignments ta
       JOIN persons p ON p.id = ta.person_id
       WHERE ta.affaire_num = ?
         AND ta.deleted_at IS NULL`,
    )
    .all(affaireNum);
  for (const p of fromTasks) {
    linkedPersonnelMap.set(`person-${p.id}`, {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      source: 'planning_task',
    });
  }

  const fromMissions = db
    .prepare(
      `SELECT DISTINCT p.id, p.first_name, p.last_name
       FROM missions m
       JOIN mission_assignments ma ON ma.mission_id = m.id
       JOIN persons p ON p.id = ma.person_id
       WHERE m.affaire = ?
         AND m.status != 'cancelled'`,
    )
    .all(affaireNum);
  for (const p of fromMissions) {
    if (!linkedPersonnelMap.has(`person-${p.id}`)) {
      linkedPersonnelMap.set(`person-${p.id}`, {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        source: 'mission',
      });
    }
  }

  for (const r of reservations) {
    const rawName = String(r.driver_name || '').trim();
    if (!rawName) continue;
    const key = `driver-${rawName.toLowerCase()}`;
    if (!linkedPersonnelMap.has(key)) {
      const parts = rawName.split(/\s+/).filter(Boolean);
      linkedPersonnelMap.set(key, {
        id: null,
        first_name: parts[0] || rawName,
        last_name: parts.slice(1).join(' ') || '',
        source: 'reservation_driver',
      });
    }
  }

  return {
    affaire_num: affaire.numero_affaire,
    affaire_name: affaire.affaire_name || affaire.numero_affaire,
    affaire_start_date: affaire.date_debut || null,
    affaire_end_date: affaire.date_fin || null,
    linked_reservations: reservations,
    linked_personnel: Array.from(linkedPersonnelMap.values()),
    is_tournee: reservations.some((r) => r.is_tournee),
  };
}

function computeIncidentSynthese(periodStart, periodEnd) {
  const tickets = db
    .prepare(
      `SELECT *
       FROM tracking_incident_tickets
       WHERE period_start_date <= ?
         AND period_end_date >= ?
       ORDER BY week_key ASC, affaire_num ASC`,
    )
    .all(periodEnd, periodStart);

  const ticketIds = tickets.map((t) => t.id);
  let entries = [];
  if (ticketIds.length > 0) {
    const placeholders = ticketIds.map(() => '?').join(',');
    entries = db
      .prepare(
        `SELECT ie.*, p.first_name, p.last_name
         FROM tracking_incident_entries ie
         LEFT JOIN persons p ON p.id = ie.reporter_person_id
         WHERE ie.ticket_id IN (${placeholders})
         ORDER BY ie.created_at ASC`,
      )
      .all(...ticketIds);
  }

  const entriesByTicket = new Map();
  for (const e of entries) {
    if (!entriesByTicket.has(e.ticket_id)) entriesByTicket.set(e.ticket_id, []);
    entriesByTicket.get(e.ticket_id).push({
      ...e,
      reporter_name:
        [e.first_name, e.last_name].filter(Boolean).join(' ').trim() ||
        e.reporter_name_snapshot ||
        '',
    });
  }

  const incidentTypeCounts = {};
  const byAffaire = new Map();
  const byWeek = new Map();

  for (const t of tickets) {
    const tEntries = entriesByTicket.get(t.id) || [];
    for (const ie of tEntries) {
      incidentTypeCounts[ie.incident_type] = (incidentTypeCounts[ie.incident_type] || 0) + 1;
    }

    const affaireKey = t.affaire_num;
    if (!byAffaire.has(affaireKey)) {
      byAffaire.set(affaireKey, {
        affaire_num: t.affaire_num,
        affaire_name: t.affaire_name || t.affaire_num,
        tickets: 0,
        incidents: 0,
        weeks: new Set(),
        is_tournee: false,
      });
    }
    const a = byAffaire.get(affaireKey);
    a.tickets += 1;
    a.incidents += tEntries.length;
    a.weeks.add(t.week_key);
    a.is_tournee = a.is_tournee || t.is_tournee === 1;

    if (!byWeek.has(t.week_key)) {
      byWeek.set(t.week_key, {
        week_key: t.week_key,
        tickets: 0,
        incidents: 0,
      });
    }
    const w = byWeek.get(t.week_key);
    w.tickets += 1;
    w.incidents += tEntries.length;
  }

  return {
    period: { start: periodStart, end: periodEnd },
    summary: {
      total_tickets: tickets.length,
      total_incidents: entries.length,
      affaires_count: byAffaire.size,
      incident_type_counts: incidentTypeCounts,
    },
    by_affaire: Array.from(byAffaire.values())
      .map((a) => ({ ...a, weeks: Array.from(a.weeks).sort() }))
      .sort((x, y) => y.incidents - x.incidents || x.affaire_num.localeCompare(y.affaire_num)),
    by_week: Array.from(byWeek.values()).sort((x, y) => x.week_key.localeCompare(y.week_key)),
  };
}

function buildSynthese(dates, personId) {
  const placeholders = dates.map(() => '?').join(',');
  let query = `
    SELECT ts.*, p.first_name, p.last_name, p.type AS person_type
    FROM tracking_sheets ts
    JOIN persons p ON p.id = ts.person_id
    WHERE ts.date IN (${placeholders})
      AND p.status = 'active'
  `;
  const params = [...dates];
  if (personId) {
    query += ' AND ts.person_id = ?';
    params.push(personId);
  }
  query += ' ORDER BY ts.date ASC, p.last_name ASC';

  const sheets = db.prepare(query).all(...params);

  // Charger les entrées pour chaque fiche
  const sheetIds = sheets.map((s) => s.id);
  let entries = [];
  if (sheetIds.length > 0) {
    const ePlaceholders = sheetIds.map(() => '?').join(',');
    entries = db
      .prepare(
        `SELECT * FROM tracking_entries WHERE sheet_id IN (${ePlaceholders}) ORDER BY period ASC, sort_order ASC`,
      )
      .all(...sheetIds);
  }

  const entriesBySheet = {};
  for (const e of entries) {
    if (!entriesBySheet[e.sheet_id]) entriesBySheet[e.sheet_id] = [];
    entriesBySheet[e.sheet_id].push(e);
  }

  // Agréger les stats
  let totalTasks = 0;
  let completedTasks = 0;
  let totalTime = 0;
  const anomalies = [];

  const enrichedSheets = sheets.map((s) => {
    const sheetEntries = entriesBySheet[s.id] || [];
    const done = sheetEntries.filter((e) => e.completed === 1).length;
    const notDone = sheetEntries.filter((e) => e.completed === 0).length;
    const time = sheetEntries.reduce((sum, e) => sum + (e.time_spent || 0), 0);

    totalTasks += sheetEntries.length;
    completedTasks += done;
    totalTime += time;

    const amEntries = sheetEntries.filter((e) => e.period === 'AM');
    const pmEntries = sheetEntries.filter((e) => e.period === 'PM');
    const unreportedAm = amEntries.length === 0 && isPastPeriod(s.date, 'AM');
    const unreportedPm = pmEntries.length === 0 && isPastPeriod(s.date, 'PM');
    const unreportedParts = [];
    if (unreportedAm) unreportedParts.push('AM');
    if (unreportedPm) unreportedParts.push('PM');

    // Enrichir avec le contexte avant de qualifier les anomalies
    const enriched = enrichSheetWithDayContext({ ...s, person_id: s.person_id, date: s.date });
    const ctx = enriched.day_context || {};
    const hasContext =
      ctx.has_unavailability || ctx.has_leave || ctx.has_mission || ctx.has_enterprise_presence;

    // Les périodes non renseignées ne sont pas des anomalies si la personne est en indispo ou en mission
    const anomalyUnreportedParts = hasContext ? [] : unreportedParts;

    if ((notDone > 0 && s.status !== 'draft') || anomalyUnreportedParts.length > 0) {
      anomalies.push({
        date: s.date,
        person: `${s.first_name} ${s.last_name}`,
        person_id: s.person_id,
        not_done: notDone,
        unreported_periods: anomalyUnreportedParts,
      });
    }

    return {
      ...s,
      entries: sheetEntries,
      day_context: ctx,
      stats: {
        total: sheetEntries.length,
        done,
        not_done: notDone,
        time,
        unreported_am: unreportedAm,
        unreported_pm: unreportedPm,
      },
    };
  });

  return {
    dates,
    sheets: enrichedSheets,
    summary: {
      total_sheets: sheets.length,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      total_time: totalTime,
      anomalies,
    },
  };
}

// ═══════════════════════════════════════
// PDF GENERATION
// ═══════════════════════════════════════

/** Convertit des heures décimales en "Xh MM" (ex: 1.5 → "1h30", 0.25 → "0h15") */
function decToHM(minutes) {
  if (!minutes) return '0h00';
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h${String(mins).padStart(2, '0')}`;
}

const PDF_MARGIN = 40;
const PDF_TABLE_LEFT = 40;
const PDF_COL_WIDTHS = [24, 250, 60, 133, 48]; // N, Tache, Temps, Commentaire, Fait
const PDF_TABLE_WIDTH = PDF_COL_WIDTHS.reduce((a, b) => a + b, 0);
const PDF_HEADERS = ['N.', 'Tache', 'Temps', 'Commentaire', 'Fait'];
const PDF_ROW_MIN_H = 22;
const PDF_TEXT_PADDING_X = 4;
const PDF_TEXT_PADDING_Y = 5;
const PDF_TABLE_BOTTOM = 760;
const PDF_WATERMARK_COLOR = '#b0b8c4';

// ─── Helpers PDF communs ───

function drawPdfHeader(doc, sheet, subtitle) {
  const dateStr = formatDateFR(sheet.date);
  const personName = sheet.person
    ? `${sheet.person.first_name} ${sheet.person.last_name}`
    : 'Personnel';

  // Date en haut à gauche
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#334155');
  doc.text(dateStr, PDF_TABLE_LEFT, PDF_MARGIN, { lineBreak: false });

  // Nom du personnel en titre principal centré
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f');
  doc.text(personName.toUpperCase(), PDF_TABLE_LEFT, PDF_MARGIN + 18, {
    width: PDF_TABLE_WIDTH,
    align: 'center',
  });

  // Sous-titre Matin/Après-midi si présent
  if (subtitle) {
    doc.moveDown(0.2);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#334155');
    doc.text(subtitle, { align: 'center' });
  }

  // Affaires planning du jour
  const affaires = sheet.day_context?.planning_affaires || [];
  if (affaires.length > 0) {
    doc.moveDown(0.4);
    const blockX = PDF_TABLE_LEFT;
    const blockW = PDF_TABLE_WIDTH;
    const blockY = doc.y;
    const labelH = 16;
    const rowH = 15;
    const totalH = labelH + affaires.length * rowH + 4;

    // Fond bleu pâle
    doc.rect(blockX, blockY, blockW, totalH).fillColor('#eef4fb').fill();
    doc.rect(blockX, blockY, blockW, totalH).lineWidth(0.5).strokeColor('#93c5fd').stroke();

    // Étiquette
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e40af');
    doc.text('Affaire(s) du planning :', blockX + 6, blockY + 4, { lineBreak: false });

    // Ligne par affaire
    doc.font('Helvetica').fillColor('#1e3a5f');
    affaires.forEach((a, idx) => {
      const rowY = blockY + labelH + idx * rowH;
      const label = a.affaire_label || a.affaire_num;
      const client = a.affaire_client ? ` — ${a.affaire_client}` : '';
      const type = a.affaire_type ? ` [${a.affaire_type}]` : '';
      doc.fontSize(8).text(`• ${label}${client}${type}`, blockX + 12, rowY, {
        width: blockW - 18,
        lineBreak: false,
        ellipsis: true,
      });
    });

    doc.y = blockY + totalH + 4;
  }

  doc.moveDown(0.4);
}

function drawPdfTableHeader(doc, y) {
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, 20).fillColor('#1e3a5f').fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  let x = PDF_TABLE_LEFT;
  for (let i = 0; i < PDF_HEADERS.length; i++) {
    const label = PDF_HEADERS[i];
    const cellWidth = PDF_COL_WIDTHS[i];
    const textWidth = doc.widthOfString(label);
    const textX = x + Math.max(3, (cellWidth - textWidth) / 2);
    doc.text(label, textX, y + 5, { lineBreak: false });
    x += PDF_COL_WIDTHS[i];
  }
  return y + 20;
}

function drawPdfNonRenseigneeNotice(doc, y) {
  const noticeH = 26;
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, noticeH).fillColor('#fef9c3').fill();
  doc
    .rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, noticeH)
    .lineWidth(0.5)
    .strokeColor('#fbbf24')
    .stroke();
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#92400e');
  doc.text('Activite non-renseignee a ce jour pour cette periode', PDF_TABLE_LEFT + 8, y + 8, {
    width: PDF_TABLE_WIDTH - 16,
    lineBreak: false,
  });
  return y + noticeH;
}

function getPdfEntryRowHeight(doc, entry) {
  const taskWidth = PDF_COL_WIDTHS[1] - PDF_TEXT_PADDING_X * 2;
  const commentWidth = PDF_COL_WIDTHS[3] - PDF_TEXT_PADDING_X * 2;

  doc.font('Helvetica').fontSize(8);

  const taskLines = doc.heightOfString(entry.task || '', {
    width: taskWidth,
    align: 'left',
  });
  const commentLines = doc.heightOfString(entry.comment || '', {
    width: commentWidth,
    align: 'left',
  });

  const lineHeight = doc.currentLineHeight(true);
  const taskHeight = Math.max(lineHeight, Math.ceil(taskLines));
  const commentHeight = Math.max(lineHeight, Math.ceil(commentLines));

  return Math.max(
    PDF_ROW_MIN_H,
    Math.ceil(taskHeight + PDF_TEXT_PADDING_Y * 2 + 2),
    Math.ceil(commentHeight + PDF_TEXT_PADDING_Y * 2 + 2),
  );
}

function drawPdfEntryRow(doc, entry, rowNum, y, rowHeight) {
  const bgColor = entry.completed === 1 ? '#f0fdf4' : '#ffffff';
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, rowHeight).fillColor(bgColor).fill();

  doc.lineWidth(0.5).strokeColor('#cbd5e1');
  doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, rowHeight).stroke();
  let x = PDF_TABLE_LEFT;
  for (let i = 0; i < PDF_COL_WIDTHS.length - 1; i++) {
    x += PDF_COL_WIDTHS[i];
    doc
      .moveTo(x, y)
      .lineTo(x, y + rowHeight)
      .stroke();
  }

  doc.fillColor('#111111').font('Helvetica').fontSize(8);
  x = PDF_TABLE_LEFT;
  doc.text(String(rowNum), x + 2, y + PDF_TEXT_PADDING_Y, {
    width: PDF_COL_WIDTHS[0] - 4,
    align: 'center',
  });
  x += PDF_COL_WIDTHS[0];

  doc.text(entry.task || '', x + PDF_TEXT_PADDING_X, y + PDF_TEXT_PADDING_Y, {
    width: PDF_COL_WIDTHS[1] - PDF_TEXT_PADDING_X * 2,
    align: 'left',
    lineBreak: true,
  });
  x += PDF_COL_WIDTHS[1];

  doc.text(entry.time_spent ? decToHM(entry.time_spent) : '-', x + 2, y + PDF_TEXT_PADDING_Y, {
    width: PDF_COL_WIDTHS[2] - 4,
    align: 'center',
  });
  x += PDF_COL_WIDTHS[2];

  doc.text(entry.comment || '', x + PDF_TEXT_PADDING_X, y + PDF_TEXT_PADDING_Y, {
    width: PDF_COL_WIDTHS[3] - PDF_TEXT_PADDING_X * 2,
    align: 'left',
    lineBreak: true,
  });
  x += PDF_COL_WIDTHS[3];

  doc.text(
    entry.completed === 1 ? 'Oui' : entry.completed === 0 ? 'Non' : '',
    x + 2,
    y + PDF_TEXT_PADDING_Y,
    {
      width: PDF_COL_WIDTHS[4] - 4,
      align: 'center',
    },
  );
}

function drawPdfWatermarkRows(doc, startY, maxY) {
  let y = startY;
  let rowNum = 0;
  while (y + PDF_ROW_MIN_H <= maxY) {
    rowNum++;
    doc.lineWidth(0.5).strokeColor(PDF_WATERMARK_COLOR);
    doc.rect(PDF_TABLE_LEFT, y, PDF_TABLE_WIDTH, PDF_ROW_MIN_H).stroke();

    let x = PDF_TABLE_LEFT;
    for (let i = 0; i < PDF_COL_WIDTHS.length - 1; i++) {
      x += PDF_COL_WIDTHS[i];
      doc
        .moveTo(x, y)
        .lineTo(x, y + PDF_ROW_MIN_H)
        .stroke();
    }

    doc.fillColor(PDF_WATERMARK_COLOR).font('Helvetica').fontSize(7);
    doc.text(String(rowNum), PDF_TABLE_LEFT + 2, y + PDF_TEXT_PADDING_Y, {
      width: PDF_COL_WIDTHS[0] - 4,
      align: 'center',
    });

    y += PDF_ROW_MIN_H;
  }
  return y;
}

function drawPdfFooter(doc, entries, label) {
  const totalTime = entries.reduce((s, e) => s + (e.time_spent || 0), 0);
  const totalDone = entries.filter((e) => e.completed === 1).length;

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e3a5f');
  doc.text(
    `${totalDone}/${entries.length} effectuee(s) — ${decToHM(totalTime)}`,
    PDF_TABLE_LEFT,
    765,
    {
      width: PDF_TABLE_WIDTH * 0.5,
      lineBreak: false,
    },
  );

  doc.fontSize(8).font('Helvetica').fillColor('#475569');
  doc.text('Signature / Visa :', PDF_TABLE_LEFT + PDF_TABLE_WIDTH * 0.55, 760, {
    width: PDF_TABLE_WIDTH * 0.45,
    align: 'right',
    lineBreak: false,
  });
  doc
    .lineWidth(0.5)
    .strokeColor('#94a3b8')
    .moveTo(PDF_TABLE_LEFT + PDF_TABLE_WIDTH * 0.7, 777)
    .lineTo(PDF_TABLE_LEFT + PDF_TABLE_WIDTH, 777)
    .stroke();

  doc.fontSize(6).font('Helvetica').fillColor('#999999');
  doc.text(`Genere par eM@g -- ${new Date().toLocaleString('fr-FR')}`, PDF_TABLE_LEFT, 790, {
    align: 'center',
    width: PDF_TABLE_WIDTH,
    lineBreak: false,
  });
}

// ─── MODE NORMAL : AM + PM sur les memes pages, pas de filigrane ───

function renderNormalEntries(doc, entries, startY) {
  let y = startY;
  for (let i = 0; i < entries.length; i++) {
    const rowHeight = getPdfEntryRowHeight(doc, entries[i]);
    if (y + rowHeight > PDF_TABLE_BOTTOM) {
      drawPdfFooter(doc, entries.slice(0, i), 'Suite page suivante');
      doc.addPage();
      y = drawPdfTableHeader(doc, PDF_MARGIN);
    }
    drawPdfEntryRow(doc, entries[i], i + 1, y, rowHeight);
    y += rowHeight;
  }
  return y;
}

function generateNormalSheetPdf(sheet, doc) {
  const allEntries = sheet.entries || [];
  const amEntries = allEntries.filter((e) => e.period === 'AM');
  const pmEntries = allEntries.filter((e) => e.period === 'PM');

  drawPdfHeader(doc, sheet, null);

  // Section Matin
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#334155');
  doc.text('MATIN (AM)', PDF_TABLE_LEFT, doc.y);
  doc.moveDown(0.3);
  let y = drawPdfTableHeader(doc, doc.y);
  y = renderNormalEntries(doc, amEntries, y);
  if (amEntries.length === 0 && isPastPeriod(sheet.date, 'AM') && !hasOccupationContext(sheet)) {
    y = drawPdfNonRenseigneeNotice(doc, y);
  }

  // Section Apres-midi
  if (y + 60 > 720) {
    doc.addPage();
    y = PDF_MARGIN;
  } else {
    y += 15;
  }
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#334155');
  doc.text('APRES-MIDI (PM)', PDF_TABLE_LEFT, y);
  doc.moveDown(0.3);
  y = drawPdfTableHeader(doc, doc.y);
  y = renderNormalEntries(doc, pmEntries, y);
  if (pmEntries.length === 0 && isPastPeriod(sheet.date, 'PM') && !hasOccupationContext(sheet)) {
    y = drawPdfNonRenseigneeNotice(doc, y);
  }

  // Notes
  if (sheet.notes) {
    if (y + 30 > 760) {
      doc.addPage();
      y = PDF_MARGIN;
    } else {
      y += 10;
    }
    doc.fontSize(8).font('Helvetica').fillColor('#475569');
    doc.text(`Notes : ${sheet.notes}`, PDF_TABLE_LEFT, y, { width: PDF_TABLE_WIDTH });
  }

  drawPdfFooter(doc, allEntries, 'Total');
}

// ─── MODE IMPRESSION : Recto-verso, Matin/Apres-midi, lignes filigrane ───

function renderPrintHalfDayPage(doc, sheet, entries, subtitle, period) {
  drawPdfHeader(doc, sheet, subtitle);

  let y = drawPdfTableHeader(doc, doc.y);

  for (let i = 0; i < entries.length; i++) {
    const rowHeight = getPdfEntryRowHeight(doc, entries[i]);
    if (y + rowHeight > PDF_TABLE_BOTTOM) break;
    drawPdfEntryRow(doc, entries[i], i + 1, y, rowHeight);
    y += rowHeight;
  }

  if (
    entries.length === 0 &&
    period &&
    isPastPeriod(sheet.date, period) &&
    !hasOccupationContext(sheet)
  ) {
    y = drawPdfNonRenseigneeNotice(doc, y);
  }

  drawPdfWatermarkRows(doc, y, PDF_TABLE_BOTTOM);
  drawPdfFooter(doc, entries, subtitle);
}

// ─── Fonctions de generation finales ───

/**
 * PDF normal individuel (AM+PM ensemble, pas de filigrane)
 */
function generateSheetPdf(sheet, res) {
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="fiche-suivi-${sheet.person?.last_name || 'personnel'}-${sheet.date}.pdf"`,
  );
  doc.pipe(res);
  generateNormalSheetPdf(sheet, doc);
  doc.end();
}

/**
 * PDF normal multi-fiches (export batch)
 */
function generateBatchPdf(sheets, res) {
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="fiches-suivi-batch.pdf"');
  doc.pipe(res);

  for (let s = 0; s < sheets.length; s++) {
    if (s > 0) doc.addPage();
    generateNormalSheetPdf(sheets[s], doc);
  }

  doc.end();
}

/**
 * PDF impression recto-verso multi-fiches (Recto=Matin, Verso=Apres-midi, lignes filigrane)
 */
function generateBatchPrintPdf(sheets, res) {
  const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="fiches-suivi-impression.pdf"');
  doc.pipe(res);

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    if (s > 0) doc.addPage();

    const amEntries = (sheet.entries || []).filter((e) => e.period === 'AM');
    const pmEntries = (sheet.entries || []).filter((e) => e.period === 'PM');

    // Recto: Matin
    renderPrintHalfDayPage(doc, sheet, amEntries, 'MATIN (AM)', 'AM');

    // Verso: Apres-midi
    doc.addPage();
    renderPrintHalfDayPage(doc, sheet, pmEntries, 'APRES-MIDI (PM)', 'PM');

    if (sheet.notes) {
      doc.fontSize(8).font('Helvetica').fillColor('#475569');
      doc.text(`Notes : ${sheet.notes}`, PDF_TABLE_LEFT, 740, { width: PDF_TABLE_WIDTH });
    }
  }

  doc.end();
}

function generateSynthesePdf(synthese, title, res) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="synthese-${title}.pdf"`);
  doc.pipe(res);

  const LEFT = 30;
  const USABLE_W = 782;
  const FOOTER_Y = 570;

  // ─── Titre ───
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .fillColor('#1e3a5f')
    .text(`SYNTHÈSE — ${title.toUpperCase()}`, { align: 'center' });
  doc.moveDown(0.2);

  const s = synthese.summary;
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#475569')
    .text(
      `${s.total_sheets} fiches  |  ${s.completed_tasks}/${s.total_tasks} tâches effectuées (${s.completion_rate}%)  |  Temps total : ${decToHM(s.total_time)}`,
      { align: 'center' },
    );
  doc.moveDown(0.8);

  // ─── Grouper par personne ───
  const byPerson = new Map();
  for (const sh of synthese.sheets) {
    if (!byPerson.has(sh.person_id)) {
      byPerson.set(sh.person_id, {
        first_name: sh.first_name,
        last_name: sh.last_name,
        sheets: [],
      });
    }
    byPerson.get(sh.person_id).sheets.push(sh);
  }
  const persons = Array.from(byPerson.values()).sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
  );

  // ─── Colonnes tableau journalier ───
  // Date | AM | PM | Total | Fait | Non fait | Temps | Alertes
  const COL = [90, 115, 115, 55, 50, 58, 65, 234];
  const COL_HEADS = ['Date', 'AM', 'PM', 'Total', 'Fait', 'Non fait', 'Temps', 'Alertes'];

  let y = doc.y;

  const ensureSpace = (needed) => {
    if (y + needed > FOOTER_Y) {
      doc.addPage();
      y = 30;
    }
  };

  const drawDayColHeaders = () => {
    doc.rect(LEFT, y, USABLE_W, 14).fillColor('#334155').fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7);
    let x = LEFT;
    for (let i = 0; i < COL_HEADS.length; i++) {
      doc.text(COL_HEADS[i], x + 2, y + 3, {
        width: COL[i] - 4,
        align: i < 3 ? 'left' : 'center',
      });
      x += COL[i];
    }
    y += 14;
  };

  // ─── Sections par Personnel ───
  for (const pg of persons) {
    const totTime = pg.sheets.reduce((acc, sh) => acc + (sh.stats?.time || 0), 0);
    const totDone = pg.sheets.reduce((acc, sh) => acc + (sh.stats?.done || 0), 0);
    const totTasks = pg.sheets.reduce((acc, sh) => acc + (sh.stats?.total || 0), 0);
    const hasWarning = pg.sheets.some((sh) => {
      const c = sh.day_context || {};
      const hasCtx =
        c.has_unavailability || c.has_leave || c.has_mission || c.has_enterprise_presence;
      return (
        sh.stats?.not_done > 0 || (!hasCtx && (sh.stats?.unreported_am || sh.stats?.unreported_pm))
      );
    });

    ensureSpace(46 + pg.sheets.length * 14);

    // En-tête personne
    const headerBg = hasWarning ? '#7f1d1d' : '#1e3a5f';
    doc.rect(LEFT, y, USABLE_W, 18).fillColor(headerBg).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text(`${pg.first_name} ${pg.last_name}`, LEFT + 6, y + 4, { width: 260 });
    doc.font('Helvetica').fontSize(8);
    doc.text(
      `${pg.sheets.length} jour(s)  |  ${totDone}/${totTasks} tâches  |  ${decToHM(totTime)}`,
      LEFT + 280,
      y + 5,
      { width: USABLE_W - 286 },
    );
    y += 18;

    // En-têtes colonnes
    drawDayColHeaders();

    // Lignes par jour
    doc.font('Helvetica').fontSize(7).fillColor('#111111');
    let odd = false;
    const sortedSheets = [...pg.sheets].sort((a, b) => a.date.localeCompare(b.date));
    for (const sh of sortedSheets) {
      const shCtx = sh.day_context || {};
      const shHasContext =
        shCtx.has_unavailability ||
        shCtx.has_leave ||
        shCtx.has_mission ||
        shCtx.has_enterprise_presence;
      const rowBg =
        sh.stats?.not_done > 0 ||
        (!shHasContext && (sh.stats?.unreported_am || sh.stats?.unreported_pm))
          ? '#fef2f2'
          : odd
            ? '#f8fafc'
            : '#ffffff';
      odd = !odd;

      const amEntries = sh.entries?.filter((e) => e.period === 'AM') || [];
      const pmEntries = sh.entries?.filter((e) => e.period === 'PM') || [];
      const amTime = amEntries.reduce((acc, e) => acc + (e.time_spent || 0), 0);
      const pmTime = pmEntries.reduce((acc, e) => acc + (e.time_spent || 0), 0);

      const ctx = sh.day_context || {};
      const hasContext =
        ctx.has_unavailability || ctx.has_leave || ctx.has_mission || ctx.has_enterprise_presence;

      const amCell =
        sh.stats?.unreported_am && !hasContext
          ? '⚠ Non renseignée'
          : `${amEntries.length} tâche(s) — ${decToHM(amTime)}`;
      const pmCell =
        sh.stats?.unreported_pm && !hasContext
          ? '⚠ Non renseignée'
          : `${pmEntries.length} tâche(s) — ${decToHM(pmTime)}`;

      const alertParts = [];
      if (sh.stats?.not_done > 0) alertParts.push(`${sh.stats.not_done} non faite(s)`);
      if (sh.stats?.unreported_am && !hasContext) alertParts.push('AM non-renseignée');
      if (sh.stats?.unreported_pm && !hasContext) alertParts.push('PM non-renseignée');
      // Contexte : indisponibilités + missions
      for (const av of ctx.availabilities || []) {
        alertParts.push(av.type_label || av.type);
      }
      for (const m of ctx.missions || []) {
        alertParts.push(m.title || m.affaire || 'Mission');
      }
      const planningAffaires = Array.isArray(ctx.planning_affaires) ? ctx.planning_affaires : [];
      for (const a of planningAffaires) {
        const num = String(a.affaire_num || '').trim();
        if (!num) continue;
        const label = String(a.affaire_label || '').trim();
        const hasDistinctLabel = label && label.toLowerCase() !== num.toLowerCase();
        const base = hasDistinctLabel ? `${num} (${label})` : num;
        alertParts.push(a.is_tournee ? `Affaire ${base} [Tournée]` : `Affaire ${base}`);
      }

      const rowVals = [
        sh.date,
        amCell,
        pmCell,
        String(sh.stats?.total ?? 0),
        String(sh.stats?.done ?? 0),
        String(sh.stats?.not_done ?? 0),
        decToHM(sh.stats?.time ?? 0),
        alertParts.join(' / ') || '—',
      ];

      doc.rect(LEFT, y, USABLE_W, 14).fillColor(rowBg).fill();
      const textColor =
        !shHasContext && (sh.stats?.unreported_am || sh.stats?.unreported_pm)
          ? '#991b1b'
          : '#111111';
      doc.fillColor(textColor);
      let x = LEFT;
      for (let i = 0; i < rowVals.length; i++) {
        doc.text(rowVals[i], x + 2, y + 3, {
          width: COL[i] - 4,
          align: i < 3 ? 'left' : 'center',
        });
        x += COL[i];
      }
      y += 14;
    }

    // Ligne résumé (total personne)
    doc.rect(LEFT, y, USABLE_W, 14).fillColor('#e2e8f0').fill();
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e3a5f');
    doc.text('TOTAL', LEFT + 2, y + 3, { width: COL[0] - 4 });
    let rx = LEFT + COL[0] + COL[1] + COL[2];
    doc.text(String(totTasks), rx + 2, y + 3, { width: COL[3] - 4, align: 'center' });
    rx += COL[3];
    doc.text(String(totDone), rx + 2, y + 3, { width: COL[4] - 4, align: 'center' });
    rx += COL[4];
    doc.text(String(totTasks - totDone), rx + 2, y + 3, { width: COL[5] - 4, align: 'center' });
    rx += COL[5];
    doc.text(decToHM(totTime), rx + 2, y + 3, { width: COL[6] - 4, align: 'center' });
    y += 14;

    y += 12; // espace entre personnes
  }

  // ─── Anomalies ───
  if (s.anomalies.length > 0) {
    ensureSpace(34 + s.anomalies.length * 12);
    y += 6;
    doc.rect(LEFT, y, USABLE_W, 16).fillColor('#dc2626').fill();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('/!\\ ANOMALIES', LEFT + 6, y + 3);
    y += 16;
    doc.font('Helvetica').fontSize(8).fillColor('#7f1d1d');
    for (const a of s.anomalies) {
      const parts = [];
      if (a.not_done > 0) parts.push(`${a.not_done} tâche(s) non effectuée(s)`);
      if (a.unreported_periods?.length > 0)
        parts.push(`Activité non renseignée : ${a.unreported_periods.join(', ')}`);
      doc.text(`• ${a.person} (${a.date}) : ${parts.join(' — ')}`, LEFT + 10, y);
      y += 12;
    }
  }

  // ─── Pied de page ───
  doc.fontSize(6).font('Helvetica').fillColor('#999999');
  doc.text(`Généré par eM@g — ${new Date().toLocaleString('fr-FR')}`, LEFT, FOOTER_Y, {
    align: 'center',
    width: USABLE_W,
  });

  doc.end();
}

// ═══════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════

export function setupSuiviRoutes(app, authenticateToken, requireAdmin) {
  // ─────────────────────────────────────────────────
  // Routes statiques AVANT les routes avec paramètres
  // (sinon /api/suivi/:personnelId/:date intercepterait tout)
  // ─────────────────────────────────────────────────

  // ─── GET /api/suivi/personnel ─── Liste du personnel avec stats suivi
  app.get('/api/suivi/personnel', authenticateToken, (req, res) => {
    try {
      const persons = db
        .prepare(
          `SELECT p.id, p.first_name, p.last_name, p.type, p.status,
                  COUNT(ts.id) AS total_sheets,
                  SUM(CASE WHEN ts.status = 'validated' THEN 1 ELSE 0 END) AS validated_sheets
           FROM persons p
           LEFT JOIN tracking_sheets ts ON ts.person_id = p.id
           WHERE p.status = 'active' AND p.type IN ('permanent', 'contractuel', 'stagiaire', 'apprenti')
           GROUP BY p.id
           ORDER BY p.last_name, p.first_name`,
        )
        .all();
      res.json(persons);
    } catch (error) {
      logger.error('GET /api/suivi/personnel error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/planning-tasks/:date ─── Tâches planifiées du jour (inclut terminées)
  app.get('/api/suivi/planning-tasks/:date', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide' });
      }

      // Tâches du jour (on conserve aussi les tâches terminées)
      const tasks = db
        .prepare(
          `SELECT ta.id, ta.title, ta.section, ta.period, ta.time, ta.end_time,
                  ta.affaire_num, ta.notes, ta.status, ta.google_event_title,
                  a.nom AS affaire_nom, a.titre AS affaire_titre,
                  a.type AS affaire_type, a.client AS affaire_client
           FROM task_assignments ta
           LEFT JOIN affaires a ON ta.affaire_num = a.numero_affaire
           WHERE ta.date = ? AND ta.deleted_at IS NULL
           ORDER BY ta.period ASC, ta.time ASC, ta.section ASC`,
        )
        .all(date);

      res.json(tasks);
    } catch (error) {
      logger.error('GET /api/suivi/planning-tasks error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/recurring/:personnelId ─── Liste des récurrences d'un personnel
  app.get('/api/suivi/recurring/:personnelId', authenticateToken, (req, res) => {
    try {
      const personnelId = Number(req.params.personnelId);
      const person = db.prepare('SELECT id, user_id FROM persons WHERE id = ?').get(personnelId);
      if (!person) {
        return res.status(404).json({ success: false, error: 'Personnel non trouvé' });
      }

      const currentUser = db
        .prepare('SELECT id, is_admin FROM users WHERE id = ?')
        .get(req.user.id);
      if (!canManagePerson(person, currentUser)) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }

      const rows = db
        .prepare(
          `SELECT *
           FROM tracking_recurring_tasks
           WHERE person_id = ?
           ORDER BY active DESC, created_at DESC`,
        )
        .all(personnelId);

      res.json(rows);
    } catch (error) {
      logger.error('GET /api/suivi/recurring/:personnelId error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/suivi/recurring/:personnelId ─── Créer une récurrence Suivi
  app.post(
    '/api/suivi/recurring/:personnelId',
    authenticateToken,
    validate(suiviRecurringTaskCreateSchema),
    (req, res) => {
      try {
        const personnelId = Number(req.params.personnelId);
        const person = db.prepare('SELECT id, user_id FROM persons WHERE id = ?').get(personnelId);
        if (!person) {
          return res.status(404).json({ success: false, error: 'Personnel non trouvé' });
        }

        const currentUser = db
          .prepare('SELECT id, is_admin FROM users WHERE id = ?')
          .get(req.user.id);
        if (!canManagePerson(person, currentUser)) {
          return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const {
          title,
          period,
          recurrence,
          day_of_week,
          day_of_month,
          default_time_spent,
          default_comment,
          active,
        } = req.body;

        const id = crypto.randomUUID().replace(/-/g, '');

        db.prepare(
          `INSERT INTO tracking_recurring_tasks (
             id, person_id, title, period, recurrence, day_of_week, day_of_month,
             default_time_spent, default_comment, active, created_by
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          personnelId,
          title,
          period,
          recurrence,
          recurrence === 'weekly' ? day_of_week : null,
          recurrence === 'monthly' ? day_of_month : null,
          default_time_spent || 0,
          default_comment || '',
          active ?? 1,
          req.user.id,
        );

        const created = db.prepare('SELECT * FROM tracking_recurring_tasks WHERE id = ?').get(id);
        res.status(201).json(created);
      } catch (error) {
        logger.error('POST /api/suivi/recurring/:personnelId error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── PUT /api/suivi/recurring/:id ─── Modifier une récurrence Suivi
  app.put(
    '/api/suivi/recurring/:id',
    authenticateToken,
    validate(suiviRecurringTaskUpdateSchema),
    (req, res) => {
      try {
        const recurring = db
          .prepare('SELECT * FROM tracking_recurring_tasks WHERE id = ?')
          .get(req.params.id);
        if (!recurring) {
          return res.status(404).json({ success: false, error: 'Récurrence introuvable' });
        }

        const person = db
          .prepare('SELECT id, user_id FROM persons WHERE id = ?')
          .get(recurring.person_id);
        const currentUser = db
          .prepare('SELECT id, is_admin FROM users WHERE id = ?')
          .get(req.user.id);
        if (!canManagePerson(person, currentUser)) {
          return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const data = req.body;
        const fields = [
          'title',
          'period',
          'recurrence',
          'day_of_week',
          'day_of_month',
          'default_time_spent',
          'default_comment',
          'active',
        ].filter((f) => data[f] !== undefined);

        if (fields.length === 0) {
          return res.status(400).json({ success: false, error: 'Aucun champ à mettre à jour' });
        }

        const setClause = fields.map((f) => `${f} = ?`).join(', ');
        const values = fields.map((f) => data[f]);
        db.prepare(`UPDATE tracking_recurring_tasks SET ${setClause} WHERE id = ?`).run(
          ...values,
          req.params.id,
        );

        const updated = db
          .prepare('SELECT * FROM tracking_recurring_tasks WHERE id = ?')
          .get(req.params.id);
        res.json(updated);
      } catch (error) {
        logger.error('PUT /api/suivi/recurring/:id error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── DELETE /api/suivi/recurring/:id ─── Supprimer une récurrence Suivi
  app.delete('/api/suivi/recurring/:id', authenticateToken, (req, res) => {
    try {
      const recurring = db
        .prepare('SELECT id, person_id FROM tracking_recurring_tasks WHERE id = ?')
        .get(req.params.id);
      if (!recurring) {
        return res.status(404).json({ success: false, error: 'Récurrence introuvable' });
      }

      const person = db
        .prepare('SELECT id, user_id FROM persons WHERE id = ?')
        .get(recurring.person_id);
      const currentUser = db
        .prepare('SELECT id, is_admin FROM users WHERE id = ?')
        .get(req.user.id);
      if (!canManagePerson(person, currentUser)) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }

      db.prepare('DELETE FROM tracking_recurring_tasks WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/suivi/recurring/:id error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── PATCH /api/suivi/tache/:tacheId ─── Mise à jour d'une entrée
  app.patch(
    '/api/suivi/tache/:tacheId',
    authenticateToken,
    validate(entryPatchSchema),
    (req, res) => {
      try {
        const entry = db
          .prepare(
            'SELECT te.*, ts.person_id FROM tracking_entries te JOIN tracking_sheets ts ON ts.id = te.sheet_id WHERE te.id = ?',
          )
          .get(req.params.tacheId);
        if (!entry) {
          return res.status(404).json({ success: false, error: 'Entrée non trouvée' });
        }

        // Vérification des droits
        const person = db.prepare('SELECT user_id FROM persons WHERE id = ?').get(entry.person_id);
        const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (currentUser?.is_admin !== 1 && person?.user_id !== req.user.id) {
          return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const fields = [];
        const params = [];
        for (const [key, value] of Object.entries(req.body)) {
          if (['completed', 'time_spent', 'comment', 'task', 'period'].includes(key)) {
            fields.push(`${key} = ?`);
            params.push(value);
          }
        }

        if (fields.length > 0) {
          fields.push("modified_at = datetime('now')");
          db.prepare(`UPDATE tracking_entries SET ${fields.join(', ')} WHERE id = ?`).run(
            ...params,
            req.params.tacheId,
          );

          // Synchroniser le statut de la tâche planifiée liée
          if (req.body.completed !== undefined && entry.task_assignment_id) {
            const newStatus = req.body.completed === 1 ? 'done' : 'pending';
            db.prepare('UPDATE task_assignments SET status = ? WHERE id = ?').run(
              newStatus,
              entry.task_assignment_id,
            );
          }
        }

        const updated = db
          .prepare('SELECT * FROM tracking_entries WHERE id = ?')
          .get(req.params.tacheId);
        res.json(updated);
      } catch (error) {
        logger.error('PATCH /api/suivi/tache/:tacheId error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/suivi/incidents/affaire/:affaireNum/base ─── Préremplissage ticket incident
  app.get('/api/suivi/incidents/affaire/:affaireNum/base', authenticateToken, (req, res) => {
    try {
      const affaireNum = String(req.params.affaireNum || '').trim();
      if (!affaireNum) {
        return res.status(400).json({ success: false, error: 'Numéro affaire requis' });
      }
      const base = getAffaireIncidentBase(affaireNum);
      res.json(base);
    } catch (error) {
      logger.error('GET /api/suivi/incidents/affaire/:affaireNum/base error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/incidents/tickets/:week ─── Tickets incidents d'une semaine
  app.get('/api/suivi/incidents/tickets/:week', authenticateToken, (req, res) => {
    try {
      const weekKey = String(req.params.week || '').trim();
      if (!/^\d{4}-W\d{2}$/.test(weekKey)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format semaine invalide (YYYY-Wnn)' });
      }

      const tickets = db
        .prepare(
          `SELECT *
           FROM tracking_incident_tickets
           WHERE week_key = ?
           ORDER BY affaire_num ASC`,
        )
        .all(weekKey)
        .map((t) => ({
          ...t,
          is_tournee: Boolean(t.is_tournee),
          linked_reservations: safeJsonParseArray(t.linked_reservations_json),
          linked_personnel: safeJsonParseArray(t.linked_personnel_json),
        }));

      const ticketIds = tickets.map((t) => t.id);
      let entries = [];
      if (ticketIds.length > 0) {
        const placeholders = ticketIds.map(() => '?').join(',');
        entries = db
          .prepare(
            `SELECT ie.*, p.first_name, p.last_name
             FROM tracking_incident_entries ie
             LEFT JOIN persons p ON p.id = ie.reporter_person_id
             WHERE ie.ticket_id IN (${placeholders})
             ORDER BY ie.created_at ASC`,
          )
          .all(...ticketIds)
          .map((e) => ({
            ...e,
            reporter_name:
              [e.first_name, e.last_name].filter(Boolean).join(' ').trim() ||
              e.reporter_name_snapshot ||
              '',
          }));
      }

      const entriesByTicket = new Map();
      for (const e of entries) {
        if (!entriesByTicket.has(e.ticket_id)) entriesByTicket.set(e.ticket_id, []);
        entriesByTicket.get(e.ticket_id).push(e);
      }

      const payload = tickets.map((t) => ({
        ...t,
        incidents: entriesByTicket.get(t.id) || [],
      }));
      res.json({ week_key: weekKey, tickets: payload });
    } catch (error) {
      logger.error('GET /api/suivi/incidents/tickets/:week error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/suivi/incidents/tickets ─── Création/MàJ d'un ticket hebdomadaire
  app.post(
    '/api/suivi/incidents/tickets',
    authenticateToken,
    validate(incidentTicketUpsertSchema),
    (req, res) => {
      try {
        const data = req.body;
        const weekKey = String(data.week_key || '').trim();
        const affaireNum = String(data.affaire_num || '').trim();
        if (!weekKey || !affaireNum) {
          return res.status(400).json({ success: false, error: 'week_key et affaire_num requis' });
        }

        const bounds = getWeekBounds(weekKey);
        const existing = db
          .prepare(
            `SELECT *
             FROM tracking_incident_tickets
             WHERE week_key = ? AND affaire_num = ?`,
          )
          .get(weekKey, affaireNum);

        const base = getAffaireIncidentBase(affaireNum);
        const linkedReservations = Array.isArray(data.linked_reservations)
          ? data.linked_reservations
          : base.linked_reservations;
        const linkedPersonnel = Array.isArray(data.linked_personnel)
          ? data.linked_personnel
          : base.linked_personnel;

        const ticketId = existing?.id || crypto.randomUUID().replace(/-/g, '');

        if (existing) {
          db.prepare(
            `UPDATE tracking_incident_tickets
             SET period_start_date = ?,
                 period_end_date = ?,
                 affaire_name = ?,
                 affaire_start_date = ?,
                 affaire_end_date = ?,
                 is_tournee = ?,
                 linked_reservations_json = ?,
                 linked_personnel_json = ?,
                 notes = ?,
                 modified_by = ?,
                 modified_at = datetime('now')
             WHERE id = ?`,
          ).run(
            bounds.start,
            bounds.end,
            data.affaire_name || base.affaire_name || affaireNum,
            data.affaire_start_date ?? base.affaire_start_date,
            data.affaire_end_date ?? base.affaire_end_date,
            data.is_tournee === undefined ? (base.is_tournee ? 1 : 0) : data.is_tournee ? 1 : 0,
            JSON.stringify(linkedReservations),
            JSON.stringify(linkedPersonnel),
            data.notes || '',
            req.user.id,
            ticketId,
          );
        } else {
          db.prepare(
            `INSERT INTO tracking_incident_tickets (
               id, week_key, period_start_date, period_end_date,
               affaire_num, affaire_name, affaire_start_date, affaire_end_date,
               is_tournee, linked_reservations_json, linked_personnel_json, notes,
               created_by, modified_by
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            ticketId,
            weekKey,
            bounds.start,
            bounds.end,
            affaireNum,
            data.affaire_name || base.affaire_name || affaireNum,
            data.affaire_start_date ?? base.affaire_start_date,
            data.affaire_end_date ?? base.affaire_end_date,
            data.is_tournee === undefined ? (base.is_tournee ? 1 : 0) : data.is_tournee ? 1 : 0,
            JSON.stringify(linkedReservations),
            JSON.stringify(linkedPersonnel),
            data.notes || '',
            req.user.id,
            req.user.id,
          );
        }

        db.prepare('DELETE FROM tracking_incident_entries WHERE ticket_id = ?').run(ticketId);

        const createVehicleBreakdownReportIfNeeded = (item) => {
          if (item.incident_type !== 'vehicle_problem') return item.linked_maintenance_id || null;

          const vehicleId =
            item.vehicle_id === null || item.vehicle_id === undefined
              ? null
              : Number(item.vehicle_id);

          if (!vehicleId || !Number.isFinite(vehicleId)) return item.linked_maintenance_id || null;

          const existingMaintenanceId = String(item.linked_maintenance_id || '').trim();
          if (existingMaintenanceId) {
            const existing = db
              .prepare('SELECT id FROM maintenances WHERE id = ?')
              .get(existingMaintenanceId);
            if (existing?.id) return existing.id;
          }

          const vehicle = db.prepare('SELECT id, name FROM vehicles WHERE id = ?').get(vehicleId);
          if (!vehicle?.id) return null;

          const maintenanceId = crypto.randomUUID().replace(/-/g, '');
          const reportDate = bounds.end;
          const vehicleName =
            String(item.vehicle_name_snapshot || '').trim() || String(vehicle.name || '').trim();
          const reportDescription = String(item.description || '').trim();

          db.prepare(
            `INSERT INTO maintenances (id, vehicle_id, vehicle_name, type, status, date, end_date,
                                       start_date_period, end_date_period,
                                       description, garage_id, cost, mileage, notes, is_immobilized,
                                       is_quick_report, technical_control_type, created_by, modified_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            maintenanceId,
            vehicleId,
            vehicleName,
            'other',
            'reported',
            reportDate,
            reportDate,
            'AM',
            'PM',
            reportDescription,
            null,
            null,
            null,
            `Signalement créé automatiquement depuis incident suivi (${weekKey} / ${affaireNum})`,
            0,
            1,
            null,
            req.user.id,
            req.user.id,
          );

          return maintenanceId;
        };

        const insertIncident = db.prepare(
          `INSERT INTO tracking_incident_entries (
             id, ticket_id, incident_type, description,
             reporter_person_id, reporter_name_snapshot,
             vehicle_id, vehicle_name_snapshot, linked_maintenance_id,
             created_by, modified_by
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );

        const addAll = db.transaction((items) => {
          for (const item of items) {
            const reporterId =
              item.reporter_person_id === null || item.reporter_person_id === undefined
                ? null
                : Number(item.reporter_person_id);
            let reporterSnapshot = '';
            if (reporterId) {
              const p = db
                .prepare('SELECT first_name, last_name FROM persons WHERE id = ?')
                .get(reporterId);
              reporterSnapshot = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
            }

            const vehicleId =
              item.vehicle_id === null || item.vehicle_id === undefined
                ? null
                : Number(item.vehicle_id);
            const vehicleSnapshot = String(item.vehicle_name_snapshot || '').trim();
            const linkedMaintenanceId = createVehicleBreakdownReportIfNeeded(item);

            insertIncident.run(
              crypto.randomUUID().replace(/-/g, ''),
              ticketId,
              item.incident_type,
              item.description || '',
              reporterId,
              reporterSnapshot,
              Number.isFinite(vehicleId) ? vehicleId : null,
              vehicleSnapshot,
              linkedMaintenanceId,
              req.user.id,
              req.user.id,
            );
          }
        });

        addAll(Array.isArray(data.incidents) ? data.incidents : []);

        const saved = db
          .prepare('SELECT * FROM tracking_incident_tickets WHERE id = ?')
          .get(ticketId);
        const savedEntries = db
          .prepare(
            `SELECT ie.*, p.first_name, p.last_name
             FROM tracking_incident_entries ie
             LEFT JOIN persons p ON p.id = ie.reporter_person_id
             WHERE ie.ticket_id = ?
             ORDER BY ie.created_at ASC`,
          )
          .all(ticketId)
          .map((e) => ({
            ...e,
            reporter_name:
              [e.first_name, e.last_name].filter(Boolean).join(' ').trim() ||
              e.reporter_name_snapshot ||
              '',
          }));

        res.json({
          ...saved,
          is_tournee: Boolean(saved.is_tournee),
          linked_reservations: safeJsonParseArray(saved.linked_reservations_json),
          linked_personnel: safeJsonParseArray(saved.linked_personnel_json),
          incidents: savedEntries,
        });
      } catch (error) {
        logger.error('POST /api/suivi/incidents/tickets error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── DELETE /api/suivi/incidents/tickets/:ticketId ─── Supprimer un ticket incident
  app.delete('/api/suivi/incidents/tickets/:ticketId', authenticateToken, (req, res) => {
    try {
      const ticketId = String(req.params.ticketId || '').trim();
      const existing = db
        .prepare('SELECT id FROM tracking_incident_tickets WHERE id = ?')
        .get(ticketId);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Ticket introuvable' });
      }
      db.prepare('DELETE FROM tracking_incident_tickets WHERE id = ?').run(ticketId);
      res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/suivi/incidents/tickets/:ticketId error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/incidents/synthese/semaine/:week ─── Synthèse incidents hebdomadaire
  app.get('/api/suivi/incidents/synthese/semaine/:week', authenticateToken, (req, res) => {
    try {
      const weekKey = String(req.params.week || '').trim();
      if (!/^\d{4}-W\d{2}$/.test(weekKey)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format semaine invalide (YYYY-Wnn)' });
      }
      const bounds = getWeekBounds(weekKey);
      const synthese = computeIncidentSynthese(bounds.start, bounds.end);
      res.json({ ...synthese, period_key: weekKey, mode: 'semaine' });
    } catch (error) {
      logger.error('GET /api/suivi/incidents/synthese/semaine/:week error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/incidents/synthese/mois/:month ─── Synthèse incidents mensuelle
  app.get('/api/suivi/incidents/synthese/mois/:month', authenticateToken, (req, res) => {
    try {
      const month = String(req.params.month || '').trim();
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ success: false, error: 'Format mois invalide (YYYY-MM)' });
      }
      const dates = getMonthDates(month);
      const synthese = computeIncidentSynthese(dates[0], dates[dates.length - 1]);
      res.json({ ...synthese, period_key: month, mode: 'mois' });
    } catch (error) {
      logger.error('GET /api/suivi/incidents/synthese/mois/:month error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/incidents/synthese/annee/:year ─── Synthèse incidents annuelle
  app.get('/api/suivi/incidents/synthese/annee/:year', authenticateToken, (req, res) => {
    try {
      const year = String(req.params.year || '').trim();
      const parsed = syntheseYearSchema.safeParse({ year });
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Format année invalide (YYYY)' });
      }
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const synthese = computeIncidentSynthese(start, end);
      res.json({ ...synthese, period_key: year, mode: 'annee' });
    } catch (error) {
      logger.error('GET /api/suivi/incidents/synthese/annee/:year error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/jour/:date ─── Synthèse journalière
  app.get('/api/suivi/synthese/jour/:date', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide' });
      }
      const synthese = buildSynthese([date]);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/jour/:date error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/semaine/:week ─── Synthèse hebdomadaire
  app.get('/api/suivi/synthese/semaine/:week', authenticateToken, (req, res) => {
    try {
      const { week } = req.params;
      if (!/^\d{4}-W\d{2}$/.test(week)) {
        return res
          .status(400)
          .json({ success: false, error: 'Format semaine invalide (YYYY-Wnn)' });
      }
      const dates = getWeekDates(week);
      const synthese = buildSynthese(dates);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/semaine/:week error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/mois/:month ─── Synthèse mensuelle
  app.get('/api/suivi/synthese/mois/:month', authenticateToken, (req, res) => {
    try {
      const { month } = req.params;
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ success: false, error: 'Format mois invalide (YYYY-MM)' });
      }
      const dates = getMonthDates(month);
      const synthese = buildSynthese(dates);
      res.json(synthese);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/mois/:month error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── GET /api/suivi/synthese/jour/:date/pdf ─── PDF synthèse journalière
  app.get('/api/suivi/synthese/jour/:date/pdf', authenticateToken, (req, res) => {
    try {
      const { date } = req.params;
      const synthese = buildSynthese([date]);
      generateSynthesePdf(synthese, `jour-${date}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/jour/:date/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── GET /api/suivi/synthese/semaine/:week/pdf ─── PDF synthèse hebdomadaire
  app.get('/api/suivi/synthese/semaine/:week/pdf', authenticateToken, (req, res) => {
    try {
      const { week } = req.params;
      const dates = getWeekDates(week);
      const synthese = buildSynthese(dates);
      generateSynthesePdf(synthese, `semaine-${week}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/semaine/:week/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── GET /api/suivi/synthese/mois/:month/pdf ─── PDF synthèse mensuelle
  app.get('/api/suivi/synthese/mois/:month/pdf', authenticateToken, (req, res) => {
    try {
      const { month } = req.params;
      const dates = getMonthDates(month);
      const synthese = buildSynthese(dates);
      generateSynthesePdf(synthese, `mois-${month}`, res);
    } catch (error) {
      logger.error('GET /api/suivi/synthese/mois/:month/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── POST /api/suivi/batch/pdf ─── Export PDF multi-fiches (normal, sans recto-verso)
  app.post('/api/suivi/batch/pdf', authenticateToken, (req, res) => {
    try {
      const { sheetIds } = req.body;
      if (!Array.isArray(sheetIds) || sheetIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'sheetIds requis (tableau non vide)' });
      }
      if (sheetIds.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximum 50 fiches à la fois' });
      }
      const sheets = [];
      for (const id of sheetIds) {
        const full = getSheetWithEntries(id);
        if (full) sheets.push(enrichSheetWithDayContext(full));
      }
      if (sheets.length === 0) {
        return res.status(404).json({ success: false, error: 'Aucune fiche trouvée' });
      }
      generateBatchPdf(sheets, res);
    } catch (error) {
      logger.error('POST /api/suivi/batch/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF batch' });
      }
    }
  });

  // ─── POST /api/suivi/batch/print ─── PDF impression recto-verso (Matin/Après-midi + filigrane)
  app.post('/api/suivi/batch/print', authenticateToken, (req, res) => {
    try {
      const { sheetIds } = req.body;
      if (!Array.isArray(sheetIds) || sheetIds.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: 'sheetIds requis (tableau non vide)' });
      }
      if (sheetIds.length > 50) {
        return res.status(400).json({ success: false, error: 'Maximum 50 fiches à la fois' });
      }
      const sheets = [];
      for (const id of sheetIds) {
        const full = getSheetWithEntries(id);
        if (full) sheets.push(enrichSheetWithDayContext(full));
      }
      if (sheets.length === 0) {
        return res.status(404).json({ success: false, error: 'Aucune fiche trouvée' });
      }
      generateBatchPrintPdf(sheets, res);
    } catch (error) {
      logger.error('POST /api/suivi/batch/print error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF impression' });
      }
    }
  });

  // ─────────────────────────────────────────────────
  // Routes avec paramètres dynamiques (après les statiques)

  // ─── POST /api/suivi/entries/:entryId/postpone ─── Reporter une tâche récurrente
  app.post('/api/suivi/entries/:entryId/postpone', authenticateToken, (req, res) => {
    try {
      const entryId = parseInt(req.params.entryId, 10);
      const { target_date, target_period } = req.body;

      if (!entryId || isNaN(entryId)) {
        return res.status(400).json({ success: false, error: 'ID entrée invalide' });
      }
      if (!target_date || !/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
        return res.status(400).json({ success: false, error: 'Date cible invalide (YYYY-MM-DD)' });
      }
      if (!target_period || !['AM', 'PM'].includes(target_period)) {
        return res.status(400).json({ success: false, error: 'Période cible invalide (AM ou PM)' });
      }

      const entry = db.prepare('SELECT * FROM tracking_entries WHERE id = ?').get(entryId);
      if (!entry) return res.status(404).json({ success: false, error: 'Entrée introuvable' });

      const sheet = db.prepare('SELECT * FROM tracking_sheets WHERE id = ?').get(entry.sheet_id);
      if (!sheet) return res.status(404).json({ success: false, error: 'Fiche introuvable' });

      const personnel = db.prepare('SELECT * FROM personnel WHERE id = ?').get(sheet.person_id);
      if (!canManagePerson(personnel, req.user)) {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }

      // Récupérer ou créer la fiche cible
      const targetSheet = getOrCreateSheet(sheet.person_id, target_date, req.user.id);
      if (!targetSheet) {
        return res
          .status(500)
          .json({ success: false, error: 'Impossible de créer la fiche cible' });
      }

      // Insérer la nouvelle entrée sur la fiche cible
      const newComment = `Reporté depuis ${sheet.date} (${entry.period || target_period})${entry.comment ? ' — ' + entry.comment : ''}`;
      const insertResult = db
        .prepare(
          `INSERT INTO tracking_entries (sheet_id, period, title, time_spent, comment, completed, recurring_task_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))`,
        )
        .run(targetSheet.id, target_period, entry.title, entry.time_spent || 0, newComment);

      // Mettre à jour l'entrée originale pour indiquer le report
      const updatedComment = `→ Reporté au ${target_date} (${target_period})${entry.comment ? ' — ' + entry.comment : ''}`;
      db.prepare(
        `UPDATE tracking_entries SET comment = ?, completed = 0, updated_at = datetime('now') WHERE id = ?`,
      ).run(updatedComment, entryId);

      // Mettre à jour modified_at de la fiche source
      db.prepare(`UPDATE tracking_sheets SET modified_at = datetime('now') WHERE id = ?`).run(
        sheet.id,
      );

      res.json({
        success: true,
        new_entry_id: insertResult.lastInsertRowid,
        target_date,
        target_period,
        updated_comment: updatedComment,
      });
    } catch (err) {
      console.error('Erreur route postpone entry:', err);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── GET /api/suivi/:personnelId/:date ─── Récupérer ou créer la fiche du jour
  app.get('/api/suivi/:personnelId/:date', authenticateToken, (req, res) => {
    try {
      const { personnelId, date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Format date invalide (YYYY-MM-DD)' });
      }

      const person = db.prepare('SELECT id FROM persons WHERE id = ?').get(personnelId);
      if (!person) {
        return res.status(404).json({ success: false, error: 'Personnel non trouvé' });
      }

      const sheet = getOrCreateSheet(Number(personnelId), date, req.user.id);
      const full = getSheetWithEntries(sheet.id);
      res.json(enrichSheetWithDayContext(full));
    } catch (error) {
      logger.error('GET /api/suivi/:personnelId/:date error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ─── POST /api/suivi/:personnelId/:date ─── Mise à jour complète de la fiche
  app.post(
    '/api/suivi/:personnelId/:date',
    authenticateToken,
    validate(sheetUpdateSchema),
    (req, res) => {
      try {
        const { personnelId, date } = req.params;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ success: false, error: 'Format date invalide' });
        }

        const sheet = getOrCreateSheet(Number(personnelId), date, req.user.id);

        // Vérification des droits : propriétaire ou admin
        const person = db.prepare('SELECT user_id FROM persons WHERE id = ?').get(personnelId);
        const currentUser = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
        if (currentUser?.is_admin !== 1 && person?.user_id !== req.user.id) {
          return res
            .status(403)
            .json({ success: false, error: 'Vous ne pouvez modifier que vos propres fiches' });
        }

        const { status, notes, entries } = req.body;

        // Mettre à jour la fiche
        const updates = [];
        const params = [];
        if (status) {
          updates.push('status = ?');
          params.push(status);
        }
        if (notes !== undefined) {
          updates.push('notes = ?');
          params.push(notes);
        }
        updates.push('modified_by = ?', "modified_at = datetime('now')");
        params.push(req.user.id);

        if (updates.length > 0) {
          db.prepare(`UPDATE tracking_sheets SET ${updates.join(', ')} WHERE id = ?`).run(
            ...params,
            sheet.id,
          );
        }

        // Remplacer les entrées de manière atomique pour éviter toute perte en cas d'erreur
        const replaceEntries = db.transaction((items) => {
          db.prepare('DELETE FROM tracking_entries WHERE sheet_id = ?').run(sheet.id);

          if (!items || items.length === 0) return;

          const insert = db.prepare(
            `INSERT INTO tracking_entries (
              id, sheet_id, period, task, time_spent, comment, completed,
              task_assignment_id, recurring_task_id, sort_order
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          );

          for (let i = 0; i < items.length; i++) {
            const e = items[i];
            const entryId = e.id || crypto.randomUUID().replace(/-/g, '');
            // `completed` est NOT NULL en base: toute valeur non "fait" est stockée à 0.
            const completed = e.completed === 1 ? 1 : 0;

            insert.run(
              entryId,
              sheet.id,
              e.period,
              e.task || '',
              e.time_spent || 0,
              e.comment || '',
              completed,
              e.task_assignment_id || null,
              e.recurring_task_id || null,
              e.sort_order ?? i,
            );
          }

          // Synchroniser le statut des tâches planifiées liées
          for (const e of items) {
            if (e.task_assignment_id) {
              const newStatus = e.completed === 1 ? 'done' : 'pending';
              db.prepare('UPDATE task_assignments SET status = ? WHERE id = ?').run(
                newStatus,
                e.task_assignment_id,
              );
            }
          }
        });
        replaceEntries(entries || []);

        const full = getSheetWithEntries(sheet.id);
        res.json(enrichSheetWithDayContext(full));
      } catch (error) {
        logger.error('POST /api/suivi/:personnelId/:date error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ─── GET /api/suivi/:ficheId/pdf ─── Export PDF individuel
  app.get('/api/suivi/:ficheId/pdf', authenticateToken, (req, res) => {
    try {
      const full = getSheetWithEntries(req.params.ficheId);
      if (!full) {
        return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
      }
      generateSheetPdf(enrichSheetWithDayContext(full), res);
    } catch (error) {
      logger.error('GET /api/suivi/:ficheId/pdf error:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Erreur génération PDF' });
      }
    }
  });

  // ─── PUT /api/suivi/:ficheId/validate ─── Valider une fiche (admin)
  app.put('/api/suivi/:ficheId/validate', authenticateToken, requireAdmin, (req, res) => {
    try {
      const sheet = db
        .prepare('SELECT * FROM tracking_sheets WHERE id = ?')
        .get(req.params.ficheId);
      if (!sheet) {
        return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
      }

      db.prepare(
        `UPDATE tracking_sheets SET status = 'validated', validated_by = ?, validated_at = datetime('now'), modified_by = ?, modified_at = datetime('now') WHERE id = ?`,
      ).run(req.user.id, req.user.id, sheet.id);

      const full = getSheetWithEntries(sheet.id);
      res.json(full);
    } catch (error) {
      logger.error('PUT /api/suivi/:ficheId/validate error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });
}
