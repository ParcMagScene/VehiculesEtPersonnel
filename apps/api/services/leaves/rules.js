// apps/api/services/leaves/rules.js
//
// Ticket : T-P1-04 (Personnel v2 - solde conges cote serveur).
//
// Constantes et fonctions pures reproduisant la logique metier
// deja implementee dans `apps/api/leaveRoutes.js` (v1). Reproduites
// ici pour permettre au namespace v2 de fonctionner sans coupler
// le v1 (aucun refactor du chemin v1). Toute divergence de
// comportement entre v1 et v2 est un bug a corriger dans ce
// module.
//
// Conformite : Code du travail Art. L3141-3 (jours ouvrables lundi
// -> samedi), Art. L3142-1 (conges exceptionnels), IDCC 3252.

/** Acquisition annuelle. */
export const DAYS_PER_YEAR = 30;

/** Periode de reference : 1er juin -> 31 mai. */
export const REF_PERIOD_START_MONTH = 6;

/** Conge principal : min 12 jours ouvrables consecutifs entre mai et octobre. */
export const MIN_CONSECUTIVE_DAYS = 12;
export const SUMMER_START_MONTH = 5;
export const SUMMER_END_MONTH = 10;

/** Date limite de pose : 28 fevrier. */
export const DEADLINE_MONTH = 2;
export const DEADLINE_DAY = 28;

/**
 * Duree legale des conges exceptionnels (jours ouvrables).
 * @type {Readonly<Record<string, { days: number, label: string, requiresJustification: boolean }>>}
 */
export const EXCEPTIONAL_LEAVE_DURATIONS = Object.freeze({
  mariage_salarie: { days: 4, label: 'Mariage du salarie', requiresJustification: true },
  pacs: { days: 4, label: "Conclusion d'un PACS", requiresJustification: true },
  mariage_enfant: { days: 1, label: "Mariage d'un enfant", requiresJustification: true },
  naissance: { days: 3, label: 'Naissance ou adoption', requiresJustification: true },
  deces_conjoint: {
    days: 3,
    label: 'Deces du conjoint/partenaire',
    requiresJustification: true,
  },
  deces_enfant: { days: 12, label: "Deces d'un enfant (< 25 ans)", requiresJustification: true },
  deces_parent: { days: 3, label: 'Deces pere/mere', requiresJustification: true },
  deces_beau_parent: {
    days: 3,
    label: 'Deces beau-pere/belle-mere',
    requiresJustification: true,
  },
  deces_frere_soeur: { days: 3, label: 'Deces frere/soeur', requiresJustification: true },
  deces_grand_parent: { days: 1, label: 'Deces grand-parent', requiresJustification: false },
  annonce_handicap: { days: 5, label: 'Annonce handicap enfant', requiresJustification: true },
  demenagement: { days: 1, label: 'Demenagement', requiresJustification: false },
});

/**
 * Calcule le nombre de jours ouvrables (lundi -> samedi) entre deux
 * dates ISO, en excluant les jours feries.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {string} params.startDate ISO date (YYYY-MM-DD).
 * @param {string} params.endDate ISO date.
 * @param {'AM'|'PM'} [params.startPeriod='AM']
 * @param {'AM'|'PM'} [params.endPeriod='PM']
 * @returns {number} Jours ouvrables (peut etre demi-jour).
 */
export function calcWorkingDays({ db, startDate, endDate, startPeriod = 'AM', endPeriod = 'PM' }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;

  const holidays = new Set();
  for (let y = start.getFullYear(); y <= end.getFullYear(); y += 1) {
    const rows = db.prepare('SELECT date FROM public_holidays WHERE year = ?').all(y);
    rows.forEach((r) => holidays.add(r.date));
  }

  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay(); // 0=dim, 1=lun, ..., 6=sam
    const dateStr = d.toISOString().split('T')[0];
    if (dow !== 0 && !holidays.has(dateStr)) count += 1;
    d.setDate(d.getDate() + 1);
  }

  if (startPeriod === 'PM' && count > 0) count -= 0.5;
  if (endPeriod === 'AM' && count > 0) count -= 0.5;
  return Math.max(0, count);
}

/**
 * Retourne la periode de reference (1er juin -> 31 mai) pour une
 * date donnee.
 *
 * @param {string} date ISO date.
 * @returns {{ start: string, end: string, label: string }}
 */
export function getReferencePeriod(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= REF_PERIOD_START_MONTH) {
    return { start: `${year}-06-01`, end: `${year + 1}-05-31`, label: `${year}/${year + 1}` };
  }
  return { start: `${year - 1}-06-01`, end: `${year}-05-31`, label: `${year - 1}/${year}` };
}

/**
 * Vrai si la date tombe dans la periode de fermeture annuelle
 * (24/12 -> 01/01).
 *
 * @param {string|Date} date
 * @returns {boolean}
 */
export function isInClosurePeriod(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return (month === 12 && day >= 24) || (month === 1 && day <= 1);
}

/**
 * Verifie la regle "12 jours consecutifs entre mai et octobre".
 *
 * @param {string} startDate
 * @param {string} endDate
 * @param {number} workingDays
 * @returns {{ valid: boolean, message: string }}
 */
export function checkMainLeaveRule(startDate, endDate, workingDays) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startMonth = start.getMonth() + 1;
  const endMonth = end.getMonth() + 1;
  if (
    startMonth >= SUMMER_START_MONTH &&
    endMonth <= SUMMER_END_MONTH &&
    workingDays >= MIN_CONSECUTIVE_DAYS
  ) {
    return { valid: true, message: 'Conforme a la regle des 12 jours consecutifs mai-octobre' };
  }
  return { valid: true, message: '' };
}

/**
 * Verifie la date limite de pose (28 fevrier de l'annee du depart).
 *
 * @param {string} requestDate ISO date.
 * @param {string} startDate
 * @returns {{ valid: boolean, message?: string }}
 */
export function checkDeadline(requestDate, startDate) {
  const start = new Date(startDate);
  const request = new Date(requestDate);
  const year = start.getFullYear();
  const deadline = new Date(`${year}-${String(DEADLINE_MONTH).padStart(2, '0')}-${DEADLINE_DAY}`);
  if (request > deadline && start.getFullYear() === request.getFullYear()) {
    return {
      valid: false,
      message: `Les conges pour ${year} doivent etre poses avant le 28 fevrier ${year}`,
    };
  }
  return { valid: true };
}
