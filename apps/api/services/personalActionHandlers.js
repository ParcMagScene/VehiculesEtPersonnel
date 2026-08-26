// ═══════════════════════════════════════════════════════════════
// Handlers métier pour l'authentification éphémère (compte Équipe)
// ═══════════════════════════════════════════════════════════════
// Chaque handler reçoit un contexte normalisé :
//   { db, person, personalUser, contextUser, payload, req }
// et doit retourner :
//   { targetType, targetId, result }
//
// SÉCURITÉ — invariant clé :
//   Tous les handlers FORCENT le person_id depuis `person` (identifié
//   via PIN/mot de passe). Le payload ne peut JAMAIS surcharger cette
//   valeur. Cela évite qu'un utilisateur du compte Équipe puisse créer
//   des actions au nom d'un autre membre du personnel.
// ───────────────────────────────────────────────────────────────

import { EXCEPTIONAL_LEAVE_DURATIONS, LEAVE_TYPES } from '../leaveRoutes.js';
import logger from '../logger.js';
import {
  _clearPersonalActionHandlers,
  registerPersonalActionHandler,
} from '../personalActionsRoutes.js';

// ───────────────────────────────────────────────────────────────
// Constantes répliquées (cohérence avec personnelRoutes.js)
// ───────────────────────────────────────────────────────────────

const AUTO_APPROVED_TYPES = ['absence', 'formation', 'entreprise', 'workshop', 'examen', 'rdv'];
const APPROVAL_REQUIRED_TYPES = ['conge_paye', 'rtt', 'maladie', 'sans_solde'];
const VALID_AVAILABILITY_TYPES = [
  'unavailable',
  'absence',
  'formation',
  'entreprise',
  'workshop',
  'examen',
  'rdv',
  'conge_paye',
  'rtt',
  'maladie',
  'sans_solde',
];

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

/** Calcule les jours ouvrables (lundi → samedi, hors fériés). */
function calcWorkingDays(db, startDate, endDate, _startPeriod = 'AM', _endPeriod = 'PM') {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;

  const holidays = new Set();
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const rows = db.prepare('SELECT date FROM public_holidays WHERE year = ?').all(y);
    rows.forEach((r) => holidays.add(r.date));
  }

  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    const dateStr = d.toISOString().split('T')[0];
    if (dow !== 0 && !holidays.has(dateStr)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

class HandlerError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ───────────────────────────────────────────────────────────────
// Handler : create_assignment
// ───────────────────────────────────────────────────────────────

export function handleCreateAssignment({ db, person, personalUser, payload }) {
  const missionId = Number(payload?.mission_id ?? payload?.missionId);
  if (!Number.isInteger(missionId) || missionId <= 0) {
    throw new HandlerError(400, 'INVALID_PAYLOAD', 'mission_id requis (entier > 0)');
  }

  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
  if (!mission) {
    throw new HandlerError(404, 'MISSION_NOT_FOUND', 'Mission non trouvée');
  }

  if (person.status && person.status !== 'active') {
    throw new HandlerError(400, 'PERSON_INACTIVE', 'Cette personne est inactive');
  }

  // Refuse les doublons : même mission + même personne déjà affectée
  const existing = db
    .prepare(
      `SELECT id FROM mission_assignments
       WHERE mission_id = ? AND person_id = ?
         AND status IN ('confirmed', 'option', 'proposed')`,
    )
    .get(missionId, person.id);
  if (existing) {
    throw new HandlerError(409, 'ASSIGNMENT_EXISTS', 'Vous êtes déjà affecté à cette mission');
  }

  const status = payload?.status === 'option' ? 'option' : 'confirmed';
  const position = payload?.position ?? mission.position ?? null;
  const comment = payload?.comment ?? null;

  const result = db
    .prepare(
      `INSERT INTO mission_assignments
       (mission_id, person_id, status, position, comment, created_by, modified_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(missionId, person.id, status, position, comment, personalUser.id, personalUser.id);

  const created = db
    .prepare('SELECT * FROM mission_assignments WHERE id = ?')
    .get(result.lastInsertRowid);

  return {
    targetType: 'mission_assignment',
    targetId: result.lastInsertRowid,
    result: created,
  };
}

// ───────────────────────────────────────────────────────────────
// Handler : request_leave
// ───────────────────────────────────────────────────────────────

export function handleRequestLeave({ db, person, personalUser, payload }) {
  const leaveType = String(payload?.leaveType ?? '').trim();
  const startDate = String(payload?.startDate ?? '').trim();
  const endDate = String(payload?.endDate ?? '').trim();
  const startPeriod = payload?.startPeriod === 'PM' ? 'PM' : 'AM';
  const endPeriod = payload?.endPeriod === 'AM' ? 'AM' : 'PM';
  const exceptionalType = payload?.exceptionalType ? String(payload.exceptionalType) : null;
  const employeeComment = payload?.employeeComment ? String(payload.employeeComment) : null;
  const signatureEmployee = payload?.signatureEmployee ? String(payload.signatureEmployee) : null;

  if (!leaveType || !LEAVE_TYPES[leaveType]) {
    throw new HandlerError(400, 'INVALID_LEAVE_TYPE', 'Type de congé invalide');
  }
  if (!startDate || !endDate) {
    throw new HandlerError(400, 'INVALID_PAYLOAD', 'startDate et endDate requis');
  }
  if (new Date(endDate) < new Date(startDate)) {
    throw new HandlerError(400, 'INVALID_DATES', 'La date de fin doit être postérieure');
  }
  if (leaveType === 'exceptionnel' && !exceptionalType) {
    throw new HandlerError(
      400,
      'EXCEPTIONAL_TYPE_REQUIRED',
      'exceptionalType requis pour un congé exceptionnel',
    );
  }

  // Calcul des jours ouvrables
  let workingDays;
  if (
    leaveType === 'exceptionnel' &&
    exceptionalType &&
    EXCEPTIONAL_LEAVE_DURATIONS[exceptionalType]
  ) {
    workingDays = EXCEPTIONAL_LEAVE_DURATIONS[exceptionalType].days;
  } else {
    workingDays = calcWorkingDays(db, startDate, endDate, startPeriod, endPeriod);
  }
  if (workingDays <= 0) {
    throw new HandlerError(
      400,
      'NO_WORKING_DAYS',
      'La période sélectionnée ne contient aucun jour ouvrable',
    );
  }

  // Conflit avec demande existante (pending/accepted)
  const overlapping = db
    .prepare(
      `SELECT id FROM leave_requests
       WHERE person_id = ? AND status IN ('pending', 'accepted')
         AND start_date <= ? AND end_date >= ?`,
    )
    .all(person.id, endDate, startDate);
  if (overlapping.length > 0) {
    throw new HandlerError(
      409,
      'LEAVE_OVERLAP',
      'Une demande de congé existe déjà pour cette période',
    );
  }

  // INSERT leave_requests
  const insertLeave = db.prepare(
    `INSERT INTO leave_requests (
       person_id, user_id, request_date, leave_type, exceptional_type,
       start_date, end_date, start_period, end_period, working_days,
       employee_comment, status, signature_employee, signature_employee_date,
       priority_score
     ) VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0)`,
  );
  const insertAvailability = db.prepare(
    `INSERT INTO availabilities (
       person_id, start_date, end_date, start_period, end_period,
       type, reason, source, status, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'leave_request', 'pending', ?)`,
  );

  const tx = db.transaction(() => {
    const r = insertLeave.run(
      person.id,
      personalUser.id,
      leaveType,
      exceptionalType,
      startDate,
      endDate,
      startPeriod,
      endPeriod,
      workingDays,
      employeeComment,
      signatureEmployee,
      signatureEmployee ? new Date().toISOString() : null,
    );
    insertAvailability.run(
      person.id,
      startDate,
      endDate,
      startPeriod,
      endPeriod,
      leaveType,
      employeeComment || `Demande de ${LEAVE_TYPES[leaveType]?.label || leaveType}`,
      personalUser.id,
    );
    return r.lastInsertRowid;
  });

  const leaveId = tx();
  const created = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId);

  return {
    targetType: 'leave_request',
    targetId: leaveId,
    result: created,
  };
}

// ───────────────────────────────────────────────────────────────
// Handler : declare_unavailability
// ───────────────────────────────────────────────────────────────

export function handleDeclareUnavailability({ db, person, personalUser, payload }) {
  const startDate = String(payload?.start_date ?? payload?.startDate ?? '').trim();
  const endDate = String(payload?.end_date ?? payload?.endDate ?? '').trim();
  const type = String(payload?.type ?? 'unavailable').trim();
  const startPeriod = (payload?.start_period ?? payload?.startPeriod) === 'PM' ? 'PM' : 'AM';
  const endPeriod = (payload?.end_period ?? payload?.endPeriod) === 'AM' ? 'AM' : 'PM';
  const reason = payload?.reason ? String(payload.reason) : null;
  const startTime = payload?.start_time ?? payload?.startTime ?? null;
  const endTime = payload?.end_time ?? payload?.endTime ?? null;
  const rdvCategory = payload?.rdv_category ?? payload?.rdvCategory ?? null;

  if (!startDate || !endDate) {
    throw new HandlerError(400, 'INVALID_PAYLOAD', 'start_date et end_date requis');
  }
  if (!VALID_AVAILABILITY_TYPES.includes(type)) {
    throw new HandlerError(400, 'INVALID_TYPE', 'Type d’indisponibilité invalide');
  }
  if (new Date(endDate) < new Date(startDate)) {
    throw new HandlerError(400, 'INVALID_DATES', 'La date de fin doit être postérieure');
  }

  // Conflit bloquant : si on demande un type "approval-required" et qu'il
  // existe déjà un congé approuvé qui chevauche → refus.
  if (APPROVAL_REQUIRED_TYPES.includes(type)) {
    const blocker = db
      .prepare(
        `SELECT id FROM availabilities
         WHERE person_id = ? AND status = 'approved'
           AND type IN ('conge_paye','rtt','maladie','sans_solde')
           AND start_date <= ? AND end_date >= ?`,
      )
      .get(person.id, endDate, startDate);
    if (blocker) {
      throw new HandlerError(
        409,
        'AVAILABILITY_BLOCKED',
        'Conflit avec un congé approuvé existant',
      );
    }
  }

  // Auto-approved si type loisir/RDV, sinon pending (demande à valider)
  const status = AUTO_APPROVED_TYPES.includes(type) ? 'approved' : 'pending';
  const approvedBy = status === 'approved' ? personalUser.id : null;
  const approvedAt = status === 'approved' ? new Date().toISOString() : null;

  const result = db
    .prepare(
      `INSERT INTO availabilities (
         person_id, start_date, end_date, start_period, end_period,
         type, reason, source, is_recurring, recurrence_rule, status,
         approved_by, approved_at, created_by,
         start_time, end_time, rdv_category, google_event_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'personal', 0, NULL, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(
      person.id,
      startDate,
      endDate,
      startPeriod,
      endPeriod,
      type,
      reason,
      status,
      approvedBy,
      approvedAt,
      personalUser.id,
      startTime,
      endTime,
      rdvCategory,
    );

  const created = db
    .prepare('SELECT * FROM availabilities WHERE id = ?')
    .get(result.lastInsertRowid);

  return {
    targetType: 'availability',
    targetId: result.lastInsertRowid,
    result: created,
  };
}

// ───────────────────────────────────────────────────────────────
// Adaptateur Express → Promise (les handlers ci-dessus sont sync,
// le dispatcher attend une Promise → on emballe).
// ───────────────────────────────────────────────────────────────

function adapt(syncHandler) {
  return async (ctx) => {
    try {
      return syncHandler(ctx);
    } catch (err) {
      if (err instanceof HandlerError) {
        const e = new Error(err.message);
        e.status = err.status;
        e.code = err.code;
        throw e;
      }
      logger.error(err);
      throw err;
    }
  };
}

// ───────────────────────────────────────────────────────────────
// Enregistrement
// ───────────────────────────────────────────────────────────────

let _registered = false;

export function registerDefaultPersonalActionHandlers() {
  if (_registered) return;
  registerPersonalActionHandler('create_assignment', adapt(handleCreateAssignment));
  registerPersonalActionHandler('request_leave', adapt(handleRequestLeave));
  registerPersonalActionHandler('declare_unavailability', adapt(handleDeclareUnavailability));
  _registered = true;
}

/** À usage des tests : remet le registre à zéro. */
export function _resetPersonalActionHandlers() {
  _clearPersonalActionHandlers();
  _registered = false;
}

export { HandlerError };
