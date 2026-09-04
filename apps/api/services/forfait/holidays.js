// ═══════════════════════════════════════════════════════════════
// services/forfait/holidays.js
// Jours fériés France : lookup depuis public_holidays + fallback
// via algorithme de Butcher (calcul de Pâques) pour toute année.
// Réf : loi française — 11 jours fériés légaux (art. L.3133-1).
// ═══════════════════════════════════════════════════════════════

/**
 * Année bissextile ? (règle grégorienne : /4 sauf /100 sauf /400).
 * @param {number} year
 * @returns {boolean}
 */
export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Nombre de jours dans l'année (365 ou 366).
 * @param {number} year
 * @returns {number}
 */
export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Calcul du dimanche de Pâques (algorithme de Butcher / Meeus-Jones).
 * Renvoie un objet Date UTC minuit.
 * @param {number} year
 * @returns {Date}
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=mars, 4=avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formate une Date UTC en YYYY-MM-DD.
 * @param {Date} d
 * @returns {string}
 */
function iso(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Ajoute n jours à une Date UTC (renvoie nouvelle Date).
 * @param {Date} d
 * @param {number} n
 * @returns {Date}
 */
function addDaysUtc(d, n) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

/**
 * Calcule les 11 jours fériés légaux France pour une année donnée.
 * Fériés fixes + Pâques (variables : lundi de Pâques, Ascension, lundi de Pentecôte).
 *
 * @param {number} year
 * @returns {Array<{ date: string, name: string }>}
 */
export function computeFrenchHolidays(year) {
  const easter = easterSunday(year);
  return [
    { date: `${year}-01-01`, name: "Jour de l'An" },
    { date: iso(addDaysUtc(easter, 1)), name: 'Lundi de Pâques' },
    { date: `${year}-05-01`, name: 'Fête du Travail' },
    { date: `${year}-05-08`, name: 'Victoire 1945' },
    { date: iso(addDaysUtc(easter, 39)), name: 'Ascension' },
    { date: iso(addDaysUtc(easter, 50)), name: 'Lundi de Pentecôte' },
    { date: `${year}-07-14`, name: 'Fête Nationale' },
    { date: `${year}-08-15`, name: 'Assomption' },
    { date: `${year}-11-01`, name: 'Toussaint' },
    { date: `${year}-11-11`, name: 'Armistice 1918' },
    { date: `${year}-12-25`, name: 'Noël' },
  ];
}

/**
 * Récupère les jours fériés pour une année :
 * 1. depuis la table public_holidays (source de vérité, éditable admin),
 * 2. sinon calcule via computeFrenchHolidays et les insère.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} year
 * @returns {Array<{ date: string, name: string }>}
 */
export function getHolidaysForYear(db, year) {
  let rows = db
    .prepare('SELECT date, name FROM public_holidays WHERE year = ? ORDER BY date')
    .all(year);
  if (rows.length === 0) {
    // Fallback : seed depuis Butcher
    const computed = computeFrenchHolidays(year);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO public_holidays (date, name, year) VALUES (?, ?, ?)',
    );
    for (const h of computed) insert.run(h.date, h.name, year);
    rows = db
      .prepare('SELECT date, name FROM public_holidays WHERE year = ? ORDER BY date')
      .all(year);
  }
  return rows;
}

/**
 * Compte les jours fériés HORS samedi/dimanche pour une année.
 * @param {import('better-sqlite3').Database} db
 * @param {number} year
 * @returns {number}
 */
export function countHolidaysExcludingWeekend(db, year) {
  const holidays = getHolidaysForYear(db, year);
  let count = 0;
  for (const h of holidays) {
    const d = new Date(`${h.date}T00:00:00Z`);
    const dow = d.getUTCDay(); // 0=dim, 6=sam
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

/**
 * Compte les jours fériés HORS samedi/dimanche entre deux dates ISO (bornes incluses).
 * @param {import('better-sqlite3').Database} db
 * @param {string} startISO YYYY-MM-DD
 * @param {string} endISO YYYY-MM-DD
 * @returns {number}
 */
export function countHolidaysExcludingWeekendInRange(db, startISO, endISO) {
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  if (end < start) return 0;
  let count = 0;
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y += 1) {
    const holidays = getHolidaysForYear(db, y);
    for (const h of holidays) {
      const d = new Date(`${h.date}T00:00:00Z`);
      if (d < start || d > end) continue;
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) count += 1;
    }
  }
  return count;
}

/**
 * Nombre de samedis et dimanches entre deux dates ISO (bornes incluses).
 * @param {string} startISO
 * @param {string} endISO
 * @returns {number}
 */
export function countWeekendDaysInRange(startISO, endISO) {
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    if (dow === 0 || dow === 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * Nombre de jours calendaires entre deux dates ISO (bornes incluses).
 * @param {string} startISO
 * @param {string} endISO
 * @returns {number}
 */
export function calendarDaysInRange(startISO, endISO) {
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  if (end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}
