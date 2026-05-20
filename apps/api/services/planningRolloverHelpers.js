// ─────────────────────────────────────────────────────────────
// planningRolloverHelpers.js — L5 (méga-prompt 4.1)
// Helpers purs pour le cron rollover des tâches non validées.
// Extraits depuis planningRoutes.js pour fiabiliser via tests.
// AUCUN side effect (pas de db, pas de log).
// ─────────────────────────────────────────────────────────────

/**
 * Formate un objet Date au format ISO local `YYYY-MM-DD` en utilisant
 * les composantes locales (pas UTC). Indispensable pour comparer avec
 * les colonnes `date` stockées en local en base.
 * @param {Date} d
 * @returns {string}
 */
export function formatLocalDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new TypeError('formatLocalDate: argument doit être un Date valide');
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Renvoie la date ISO locale `YYYY-MM-DD` du jour suivant `dateStr`.
 * Gère correctement la fin de mois et l'année bissextile (via objet Date).
 * @param {string} dateStr — au format YYYY-MM-DD
 * @returns {string}
 */
export function addOneDayToDateStr(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new TypeError('addOneDayToDateStr: format attendu YYYY-MM-DD');
  }
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`addOneDayToDateStr: date invalide ${dateStr}`);
  }
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
}

/**
 * Renvoie la date ISO locale du jour précédent.
 * @param {string} dateStr — au format YYYY-MM-DD
 * @returns {string}
 */
export function subtractOneDayFromDateStr(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new TypeError('subtractOneDayFromDateStr: format attendu YYYY-MM-DD');
  }
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`subtractOneDayFromDateStr: date invalide ${dateStr}`);
  }
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

/**
 * Vrai si l'instant `now` correspond à la fenêtre de déclenchement
 * du rollover (00:00, première minute après minuit local).
 * @param {Date} now
 * @returns {boolean}
 */
export function isMidnightTick(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  return now.getHours() === 0 && now.getMinutes() === 0;
}
