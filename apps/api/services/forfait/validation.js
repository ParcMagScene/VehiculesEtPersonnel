// services/forfait/validation.js
// Contrôles conventionnels art. 5.7.3 : pose de repos, prévenance,
// max consécutifs, journée type (1/2j si ≤ 4h).
// Fonctions pures — pas d'accès direct à la DB (le repo fournit les données).

/**
 * Défauts conventionnels (art. 5.7.3 3°b).
 */
export const REST_POSE_DEFAULTS = Object.freeze({
  NOTICE_MIN_DAYS: 14, // prévenance min. 2 semaines
  MAX_CONSECUTIVE_WORKED_DAYS: 5, // pas plus de 5 jours consécutifs
  HALF_DAY_HOURS_THRESHOLD: 4, // ≤ 4h = 1/2 journée
  YEAR_END_MONTH: 12,
  YEAR_END_DAY: 31,
});

/**
 * Convertit un nombre d'heures travaillées en équivalent jours (0.5 ou 1).
 * Réf. art. 5.7.3 3°b : "toute journée dont la durée est ≤ 4h équivaut à une
 * demi-journée".
 * @param {number|null|undefined} hoursWorked
 * @returns {0 | 0.5 | 1}
 */
export function hoursToWorkedDays(hoursWorked) {
  const h = Number(hoursWorked);
  if (!Number.isFinite(h) || h <= 0) return 0;
  return h <= REST_POSE_DEFAULTS.HALF_DAY_HOURS_THRESHOLD ? 0.5 : 1;
}

/**
 * Nombre de jours calendaires entre deux dates ISO (YYYY-MM-DD).
 */
export function daysBetween(fromISO, toISO) {
  const from = new Date(`${fromISO}T00:00:00Z`);
  const to = new Date(`${toISO}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Vérifie le respect du délai de prévenance (art. 5.7.3 3°b).
 * @param {string} scheduledDate  ISO YYYY-MM-DD — date à laquelle le repos est posé
 * @param {string} requestDate    ISO YYYY-MM-DD — date à laquelle la demande est faite
 * @param {number} [minDays=14]   Délai minimum
 * @returns {{ ok: boolean, delayDays: number, minDays: number, code?: string }}
 */
export function validateNoticeDelay(
  scheduledDate,
  requestDate,
  minDays = REST_POSE_DEFAULTS.NOTICE_MIN_DAYS,
) {
  const delay = daysBetween(requestDate, scheduledDate);
  const ok = delay >= minDays;
  return { ok, delayDays: delay, minDays, ...(ok ? {} : { code: 'NOTICE_TOO_SHORT' }) };
}

/**
 * Vérifie que le jour posé est avant le 31/12 de l'année (art. 5.7.3 3°b).
 */
export function validateBeforeYearEnd(scheduledDate) {
  const d = new Date(`${scheduledDate}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const deadline = new Date(Date.UTC(year, 11, 31)); // 31/12
  const ok = d.getTime() <= deadline.getTime();
  return { ok, year, deadline: `${year}-12-31`, ...(ok ? {} : { code: 'POSE_AFTER_YEAR_END' }) };
}

/**
 * Vérifie qu'après la pose, la personne n'aura pas travaillé plus de N jours
 * consécutifs sans jour de repos (art. 5.7.3 3°b).
 *
 * @param {object} params
 * @param {string} params.scheduledDate  Date de la pose de repos envisagée (ISO)
 * @param {Array<{date: string, isWorked: boolean}>} params.dailyWork
 *   Historique/prévisionnel autour de la date (au moins ±N jours), trié par date asc.
 *   isWorked = true si la personne travaille ce jour-là (weekend/férié/repos = false).
 * @param {number} [params.maxConsecutive=5]
 * @returns {{ ok: boolean, maxRun: number, limit: number, code?: string }}
 */
export function validateMaxConsecutiveWorked({
  scheduledDate,
  dailyWork,
  maxConsecutive = REST_POSE_DEFAULTS.MAX_CONSECUTIVE_WORKED_DAYS,
}) {
  // On simule la pose : le jour scheduledDate devient un repos (isWorked=false).
  const simulated = dailyWork.map((d) =>
    d.date === scheduledDate ? { ...d, isWorked: false } : d,
  );
  let maxRun = 0;
  let run = 0;
  for (const d of simulated) {
    if (d.isWorked) {
      run += 1;
      if (run > maxRun) maxRun = run;
    } else {
      run = 0;
    }
  }
  const ok = maxRun <= maxConsecutive;
  return {
    ok,
    maxRun,
    limit: maxConsecutive,
    ...(ok ? {} : { code: 'MAX_CONSECUTIVE_EXCEEDED' }),
  };
}

/**
 * Agrégat : combine les 3 validations ci-dessus. Ne lance pas d'exception :
 * retourne { ok, failures[], warnings[] } pour permettre à l'UI de tout afficher.
 */
export function validateRestPose({
  scheduledDate,
  requestDate,
  dailyWork,
  minNoticeDays,
  maxConsecutive,
}) {
  const notice = validateNoticeDelay(scheduledDate, requestDate, minNoticeDays);
  const yearEnd = validateBeforeYearEnd(scheduledDate);
  const consecutive = dailyWork
    ? validateMaxConsecutiveWorked({ scheduledDate, dailyWork, maxConsecutive })
    : { ok: true, maxRun: 0, limit: maxConsecutive ?? 5 };

  const failures = [];
  if (!notice.ok) failures.push({ code: notice.code, detail: notice });
  if (!yearEnd.ok) failures.push({ code: yearEnd.code, detail: yearEnd });
  if (!consecutive.ok) failures.push({ code: consecutive.code, detail: consecutive });

  return {
    ok: failures.length === 0,
    checks: { notice, yearEnd, consecutive },
    failures,
  };
}

/**
 * Éligibilité forfait-jours (art. 5.7.1 champ d'application).
 * @param {object} p
 * @param {string} p.type
 * @param {number|null} p.classificationLevel
 * @param {number|null} p.annualSalary
 * @param {number|null} p.minCategorySalary
 * @param {number} [p.premiumPct=20]  % de majoration sur salaire min
 */
export function checkForfaitEligibility({
  type,
  classificationLevel,
  annualSalary,
  minCategorySalary,
  premiumPct = 20,
}) {
  const errors = [];
  if (type !== 'permanent') errors.push({ code: 'NOT_PERMANENT', field: 'type' });
  if (classificationLevel == null || classificationLevel < 4) {
    errors.push({ code: 'CLASSIFICATION_TOO_LOW', field: 'classificationLevel', min: 4 });
  }
  if (minCategorySalary != null && annualSalary != null) {
    const required = minCategorySalary * (1 + premiumPct / 100);
    if (annualSalary < required) {
      errors.push({
        code: 'SALARY_BELOW_MIN',
        field: 'annualSalary',
        required: Math.round(required * 100) / 100,
        actual: annualSalary,
        premiumPct,
      });
    }
  }
  return { ok: errors.length === 0, errors };
}
