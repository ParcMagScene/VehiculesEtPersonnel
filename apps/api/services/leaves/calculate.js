// apps/api/services/leaves/calculate.js
//
// Ticket : T-P1-04. Service `calculateLeavePeriod` : orchestre
// `calcWorkingDays` + jours feries + warnings legaux. Miroir strict
// du POST /api/leaves/calculate v1.

import { LeavesV2ValidationError } from './errors.js';
import {
  calcWorkingDays,
  checkDeadline,
  checkMainLeaveRule,
  EXCEPTIONAL_LEAVE_DURATIONS,
  getReferencePeriod,
  isInClosurePeriod,
} from './rules.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = new Set(['AM', 'PM']);

/**
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.startDate ISO date.
 * @param {string} params.endDate ISO date.
 * @param {'AM'|'PM'} [params.startPeriod='AM']
 * @param {'AM'|'PM'} [params.endPeriod='PM']
 * @param {string} [params.leaveType] Ex : conge_paye, exceptionnel...
 * @param {string} [params.exceptionalType] Ex : mariage_salarie.
 * @param {string} [params.requestDate] ISO date (defaut : aujourd'hui).
 * @returns {{
 *   workingDays: number,
 *   holidaysInPeriod: Array<{ date: string, name: string }>,
 *   warnings: string[],
 *   referencePeriod: { start: string, end: string, label: string },
 *   isExceptional?: boolean,
 *   fixedDuration?: boolean,
 *   label?: string,
 *   requiresJustification?: boolean,
 * }}
 */
export function calculateLeavePeriod({
  db,
  startDate,
  endDate,
  startPeriod = 'AM',
  endPeriod = 'PM',
  leaveType,
  exceptionalType,
  requestDate,
} = {}) {
  if (!db) throw new LeavesV2ValidationError('db requis');
  if (!ISO_DATE_RE.test(String(startDate))) {
    throw new LeavesV2ValidationError('startDate au format YYYY-MM-DD requis');
  }
  if (!ISO_DATE_RE.test(String(endDate))) {
    throw new LeavesV2ValidationError('endDate au format YYYY-MM-DD requis');
  }
  if (!PERIODS.has(startPeriod)) {
    throw new LeavesV2ValidationError('startPeriod doit valoir AM ou PM');
  }
  if (!PERIODS.has(endPeriod)) {
    throw new LeavesV2ValidationError('endPeriod doit valoir AM ou PM');
  }

  // Conges exceptionnels : duree legale fixe (aucun calcul de plage).
  if (
    leaveType === 'exceptionnel' &&
    exceptionalType &&
    EXCEPTIONAL_LEAVE_DURATIONS[exceptionalType]
  ) {
    const info = EXCEPTIONAL_LEAVE_DURATIONS[exceptionalType];
    return {
      workingDays: info.days,
      holidaysInPeriod: [],
      warnings: [],
      referencePeriod: getReferencePeriod(startDate),
      isExceptional: true,
      fixedDuration: true,
      label: info.label,
      requiresJustification: info.requiresJustification,
    };
  }

  const workingDays = calcWorkingDays({ db, startDate, endDate, startPeriod, endPeriod });

  const holidaysInPeriod = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let y = start.getFullYear(); y <= end.getFullYear(); y += 1) {
    const rows = db
      .prepare('SELECT date, name FROM public_holidays WHERE year = ? AND date >= ? AND date <= ?')
      .all(y, startDate, endDate);
    holidaysInPeriod.push(...rows);
  }

  const warnings = [];
  const today = requestDate || new Date().toISOString().split('T')[0];
  const deadlineCheck = checkDeadline(today, startDate);
  if (!deadlineCheck.valid) warnings.push(deadlineCheck.message);

  const d = new Date(startDate);
  while (d <= end) {
    if (isInClosurePeriod(d)) {
      warnings.push(
        'Cette periode chevauche la fermeture annuelle (24/12 -> 01/01). Les conges y sont imposes.',
      );
      break;
    }
    d.setDate(d.getDate() + 1);
  }

  const mainLeaveCheck = checkMainLeaveRule(startDate, endDate, workingDays);
  if (mainLeaveCheck.message) warnings.push(mainLeaveCheck.message);

  return {
    workingDays,
    holidaysInPeriod,
    warnings,
    referencePeriod: getReferencePeriod(startDate),
  };
}
