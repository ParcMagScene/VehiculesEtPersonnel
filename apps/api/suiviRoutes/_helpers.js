// ═══════════════════════════════════════════════════════════════
// [S2-1 step 3] Helpers métier extraits de suiviRoutes.js
// Fonctions pures (en grande partie) — toutes utilisent l'instance
// `db` importée du module database.js (singleton process-wide).
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';

import db from '../database.js';

const trackingIncidentColumns = db
  .prepare('PRAGMA table_info(tracking_incident_entries)')
  .all()
  .map((c) => c.name);
const hasTrackingIncidentVehicleIdText = trackingIncidentColumns.includes('vehicle_id_text');

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

export function getOrCreateSheet(personId, date, userId) {
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

export function getSheetWithEntries(sheetId) {
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

export function formatDateFR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isRecurringDueOnDate(task, dateStr) {
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

export function canManagePerson(person, user) {
  if (!person || !user) return false;
  return user.is_admin === 1 || person.user_id === user.id;
}

// Retourne true si la période (AM/PM) est déjà passée
export function isPastPeriod(dateStr, period) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (dateStr < today) return true;
  if (dateStr === today && period === 'AM' && now.getHours() >= 12) return true;
  return false;
}

function normalizeNonRenseigneLabel(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNonRenseigneePlaceholderEntry(entry) {
  const minutes = Number(entry?.time_spent) || 0;
  if (minutes !== 0) return false;
  const label = normalizeNonRenseigneLabel(entry?.task);
  return label === 'non renseigne' || label === 'non renseignee';
}

export function isUnreportedPeriodEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return true;
  return list.every((entry) => isNonRenseigneePlaceholderEntry(entry));
}

// Retourne true si la fiche a un contexte d'occupation (congé, mission, présence entreprise)
export function hasOccupationContext(sheet) {
  const ctx = sheet.day_context || {};
  return !!(
    ctx.has_unavailability ||
    ctx.has_leave ||
    ctx.has_mission ||
    ctx.has_enterprise_presence
  );
}

// Contexte exonérant le "Non renseigné" : indisponibilités métier
// (congé, formation, maladie, etc.), mission ou affaire assignée.
// Le seul contexte "Entreprise" ne doit PAS exonérer.
export function hasExcusingContextForUnreported(sheet) {
  const ctx = sheet?.day_context || {};
  return !!(ctx.has_unavailability || ctx.has_leave || ctx.has_mission || ctx.has_planning_affaire);
}

export const AVAILABILITY_TYPE_LABELS = {
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

export const LEAVE_TYPES = new Set(['conge_paye', 'rtt', 'maladie', 'sans_solde']);
export const NON_UNAVAILABILITY_TYPES = new Set(['entreprise']);

export function enrichSheetWithDayContext(fullSheet) {
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

export function getWeekDates(weekStr) {
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

export function getMonthDates(monthStr) {
  // monthStr = "2026-04"
  const [year, month] = monthStr.split('-').map(Number);
  const dates = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

export function getYearDates(yearStr) {
  const year = Number(yearStr);
  const dates = [];
  for (let month = 1; month <= 12; month++) {
    const lastDay = new Date(year, month, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  }
  return dates;
}

export function getWeekBounds(weekStr) {
  const dates = getWeekDates(weekStr);
  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

export function safeJsonParseArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAffaireIncidentBase(affaireNum) {
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

export function computeIncidentSynthese(periodStart, periodEnd) {
  const toIsoWeekKey = (dateStr) => {
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const enumerateDates = (start, end) => {
    const dates = [];
    const cur = new Date(`${start}T12:00:00`);
    const limit = new Date(`${end}T12:00:00`);
    if (Number.isNaN(cur.getTime()) || Number.isNaN(limit.getTime())) return dates;
    while (cur <= limit) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

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
        hasTrackingIncidentVehicleIdText
          ? `SELECT ie.*, p.first_name, p.last_name,
                    COALESCE(NULLIF(TRIM(ie.vehicle_id_text), ''), CAST(ie.vehicle_id AS TEXT)) AS resolved_vehicle_id_text,
                    v.name AS resolved_vehicle_name
             FROM tracking_incident_entries ie
             LEFT JOIN persons p ON p.id = ie.reporter_person_id
             LEFT JOIN vehicles v ON v.id = COALESCE(NULLIF(TRIM(ie.vehicle_id_text), ''), CAST(ie.vehicle_id AS TEXT))
             WHERE ie.ticket_id IN (${placeholders})
             ORDER BY ie.created_at ASC`
          : `SELECT ie.*, p.first_name, p.last_name,
                    CASE WHEN ie.vehicle_id IS NULL THEN NULL ELSE CAST(ie.vehicle_id AS TEXT) END AS resolved_vehicle_id_text,
                    v.name AS resolved_vehicle_name
             FROM tracking_incident_entries ie
             LEFT JOIN persons p ON p.id = ie.reporter_person_id
             LEFT JOIN vehicles v ON v.id = CAST(ie.vehicle_id AS TEXT)
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
      vehicle_id_text: String(e.resolved_vehicle_id_text || '').trim() || null,
      vehicle_name_snapshot:
        String(e.vehicle_name_snapshot || '').trim() ||
        String(e.resolved_vehicle_name || '').trim(),
      reporter_name:
        [e.first_name, e.last_name].filter(Boolean).join(' ').trim() ||
        e.reporter_name_snapshot ||
        '',
    });
  }

  const incidentTypeCounts = {};
  const byAffaire = new Map();
  const byWeek = new Map();
  const detailedTickets = [];

  for (const t of tickets) {
    const tEntries = entriesByTicket.get(t.id) || [];
    detailedTickets.push({
      ticket_id: t.id,
      week_key: t.week_key,
      affaire_num: t.affaire_num,
      affaire_name: t.affaire_name || t.affaire_num,
      notes: t.notes || '',
      incidents: tEntries.map((ie) => ({
        incident_type: ie.incident_type || '',
        description: ie.description || '',
        reporter_name: ie.reporter_name || '',
        vehicle_id_text: ie.vehicle_id_text || null,
        vehicle_name_snapshot: ie.vehicle_name_snapshot || '',
        created_at: ie.created_at || null,
      })),
    });

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

  // Incidents automatiques: périodes AM/PM non renseignées dans les fiches suivi.
  const rangeDates = enumerateDates(periodStart, periodEnd);
  let autoUnreportedIncidents = 0;
  const autoWeeksCount = new Map();
  if (rangeDates.length > 0) {
    const suiviSynthese = buildSynthese(rangeDates);
    for (const anomaly of suiviSynthese.summary?.anomalies || []) {
      const parts = Array.isArray(anomaly.unreported_periods) ? anomaly.unreported_periods : [];
      if (parts.length === 0) continue;
      autoUnreportedIncidents += parts.length;
      const wk = toIsoWeekKey(anomaly.date);
      if (wk) autoWeeksCount.set(wk, (autoWeeksCount.get(wk) || 0) + parts.length);
    }
  }

  for (const [wk, count] of autoWeeksCount.entries()) {
    if (!byWeek.has(wk)) {
      byWeek.set(wk, { week_key: wk, tickets: 0, incidents: 0 });
    }
    byWeek.get(wk).incidents += count;
  }

  if (autoUnreportedIncidents > 0) {
    byAffaire.set('__SUIVI_NON_RENSEIGNE__', {
      affaire_num: 'SUIVI-NON-RENSEIGNE',
      affaire_name: 'Suivi - Non renseigne',
      tickets: 0,
      incidents: autoUnreportedIncidents,
      weeks: new Set(autoWeeksCount.keys()),
      is_tournee: false,
    });
    incidentTypeCounts.unreported_period =
      (incidentTypeCounts.unreported_period || 0) + autoUnreportedIncidents;
  }

  return {
    period: { start: periodStart, end: periodEnd },
    summary: {
      total_tickets: tickets.length,
      total_incidents: entries.length + autoUnreportedIncidents,
      affaires_count: byAffaire.size,
      incident_type_counts: incidentTypeCounts,
      auto_unreported_incidents: autoUnreportedIncidents,
    },
    by_affaire: Array.from(byAffaire.values())
      .map((a) => ({ ...a, weeks: Array.from(a.weeks).sort() }))
      .sort((x, y) => y.incidents - x.incidents || x.affaire_num.localeCompare(y.affaire_num)),
    by_week: Array.from(byWeek.values()).sort((x, y) => x.week_key.localeCompare(y.week_key)),
    detailed_tickets: detailedTickets,
  };
}

export function buildSynthese(dates, personId) {
  const placeholders = dates.map(() => '?').join(',');
  const PERMANENT_TYPES = ['permanent', 'apprenti', 'stagiaire'];
  const personTypePlaceholders = PERMANENT_TYPES.map(() => '?').join(',');
  let query = `
    SELECT ts.*, p.first_name, p.last_name, p.type AS person_type
    FROM tracking_sheets ts
    JOIN persons p ON p.id = ts.person_id
    WHERE ts.date IN (${placeholders})
      AND p.status = 'active'
      AND p.type IN (${personTypePlaceholders})
  `;
  const params = [...dates, ...PERMANENT_TYPES];
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
    const rawUnreportedAm = isUnreportedPeriodEntries(amEntries);
    const rawUnreportedPm = isUnreportedPeriodEntries(pmEntries);
    // Enrichir avec le contexte avant de qualifier les anomalies
    const enriched = enrichSheetWithDayContext({ ...s, person_id: s.person_id, date: s.date });
    const ctx = enriched.day_context || {};
    const hasExcusingContext = hasExcusingContextForUnreported({ day_context: ctx });
    const unreportedAm = hasExcusingContext ? false : rawUnreportedAm;
    const unreportedPm = hasExcusingContext ? false : rawUnreportedPm;
    const unreportedParts = [];
    if (unreportedAm) unreportedParts.push('AM');
    if (unreportedPm) unreportedParts.push('PM');

    // Les périodes non renseignées (vide ou "Non renseigné" à 0 min) sont
    // toujours remontées comme incident/anomalie de suivi.
    if ((notDone > 0 && s.status !== 'draft') || unreportedParts.length > 0) {
      anomalies.push({
        date: s.date,
        person: `${s.first_name} ${s.last_name}`,
        person_id: s.person_id,
        not_done: notDone,
        unreported_periods: unreportedParts,
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
export function decToHM(minutes) {
  if (!minutes) return '0h00';
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h${String(mins).padStart(2, '0')}`;
}
