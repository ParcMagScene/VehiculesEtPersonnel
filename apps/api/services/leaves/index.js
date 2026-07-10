// apps/api/services/leaves/index.js
//
// Barrel exports du domaine services Leaves v2 (T-P1-04).

export { getBalanceForPerson, resolvePersonIdFromUser } from './balance.js';
export { calculateLeavePeriod } from './calculate.js';
export { LeavesV2NotFoundError, LeavesV2ValidationError } from './errors.js';
export {
  calcWorkingDays,
  checkDeadline,
  checkMainLeaveRule,
  DAYS_PER_YEAR,
  DEADLINE_DAY,
  DEADLINE_MONTH,
  EXCEPTIONAL_LEAVE_DURATIONS,
  getReferencePeriod,
  isInClosurePeriod,
  MIN_CONSECUTIVE_DAYS,
  REF_PERIOD_START_MONTH,
  SUMMER_END_MONTH,
  SUMMER_START_MONTH,
} from './rules.js';
