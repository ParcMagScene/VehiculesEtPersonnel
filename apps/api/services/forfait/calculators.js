// ═══════════════════════════════════════════════════════════════
// services/forfait/calculators.js
// Les 5 calculateurs du système forfait-jours :
//   1. computeProrataEntree    — Entrée en cours d'année
//   2. computeProrataSortie    — Sortie en cours d'année (solde tout compte)
//   3. computeRestAnnualDays   — Nombre de jours de repos annuels (JRTT forfait)
//   4. computeRachat           — Rachat de jours de repos (art. L.3121-59)
//   5. computeForfaitReduit    — Prorata forfait réduit (temps partiel)
//
// Constantes légales :
//   - Forfait plein par défaut : 218 jours (accord de branche typique).
//   - CP légaux : 25 jours ouvrés / 30 jours ouvrables.
//   - Repos hebdomadaire : 104 jours (52 samedis + 52 dimanches).
//   - Journée de solidarité : jour supplémentaire non rémunéré.
//   - Rachat : majoration min. 10% (négociation collective).
// ═══════════════════════════════════════════════════════════════

import {
  calendarDaysInRange,
  countHolidaysExcludingWeekend,
  countHolidaysExcludingWeekendInRange,
  countWeekendDaysInRange,
  daysInYear,
  isLeapYear,
} from './holidays.js';

/**
 * Défauts métier (surchargables par contrat individuel).
 * Réf. Art. 5.7.3 de la convention (avenant n° 3 du 22-4-2025, JO 12-6-2026).
 */
export const FORFAIT_DEFAULTS = Object.freeze({
  FULL_FORFAIT_DAYS: 218,
  CP_LEGAL_DAYS_OUVRES: 25,
  RACHAT_MIN_MAJORATION_PCT: 10.0,
  RACHAT_MAX_TOTAL_DAYS: 235,
  WEEKEND_DAYS_PER_YEAR: 104,
});

/**
 * Barème conventionnel des jours de repos (art. 5.7.3 3°a).
 * Clé = nb de jours ouvrés fériés dans l'année.
 * Valeur = jours de repos pour une année complète non bissextile.
 * Année bissextile : ajouter +1 jour de repos.
 */
export const CONVENTIONAL_REST_DAYS_TABLE = Object.freeze({
  1: 17,
  2: 16,
  3: 15,
  4: 14,
  5: 13,
  6: 12,
  7: 11,
  8: 10,
  9: 9,
  10: 8,
  11: 7,
});

/**
 * Renvoie les jours de repos conventionnels selon le nombre de fériés hors WE et l'année.
 * Applique le +1 automatique pour les années bissextiles (art. 5.7.3 note (1)).
 *
 * @param {number} nbFeriesHorsWeekend
 * @param {number} year
 * @returns {number|null} null si hors barème (ex : 0 ou >11 fériés — impossible en pratique)
 */
export function getConventionalRestDays(nbFeriesHorsWeekend, year) {
  const base = CONVENTIONAL_REST_DAYS_TABLE[nbFeriesHorsWeekend];
  if (base === undefined) return null;
  return base + (isLeapYear(year) ? 1 : 0);
}

/**
 * 1. Calcul du prorata forfait pour une ENTRÉE en cours d'année.
 * Feuille "Entrée en cours d'année" du fichier Excel de référence.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.year Année N.
 * @param {number} params.reposClassiquesFullYear Jours repos annuel forfait plein (ex 9).
 * @param {string} params.dateEntree ISO YYYY-MM-DD.
 * @param {number} [params.cpAcquisAPrendre=0] CP ouvrés acquis à consommer sur période.
 * @param {number} [params.journeeSolidarite=0] Journée de solidarité (0 ou 1).
 * @returns {{ joursCalendairesRestants: number, joursWeekend: number, joursFeriesHorsWeekend: number, prorataJoursRepos: number, totalATravailler: number }}
 */
export function computeProrataEntree({
  db,
  year,
  reposClassiquesFullYear,
  dateEntree,
  cpAcquisAPrendre = 0,
  journeeSolidarite = 0,
}) {
  const dateFin = `${year}-12-31`;
  const joursCalendairesRestants = calendarDaysInRange(dateEntree, dateFin);
  const joursWeekend = countWeekendDaysInRange(dateEntree, dateFin);
  const joursFeriesHorsWeekend = countHolidaysExcludingWeekendInRange(db, dateEntree, dateFin);

  const total = daysInYear(year);
  const prorataJoursRepos = Math.round(
    (reposClassiquesFullYear * joursCalendairesRestants) / total,
  );

  const totalATravailler =
    joursCalendairesRestants -
    joursWeekend -
    joursFeriesHorsWeekend -
    cpAcquisAPrendre -
    prorataJoursRepos +
    journeeSolidarite;

  return {
    joursCalendairesRestants,
    joursWeekend,
    joursFeriesHorsWeekend,
    prorataJoursRepos,
    totalATravailler,
  };
}

/**
 * 2. Calcul de proratisation SORTIE en cours d'année (solde de tout compte).
 * Feuille "Sortie en cours d'année".
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.year
 * @param {number} params.forfaitPlein Nb jours forfait annuel plein (ex 218).
 * @param {number} params.cpOuvresFullYear CP ouvrés année pleine (ex 25).
 * @param {number} params.reposClassiquesFullYear Repos forfait annuel plein (ex 9).
 * @param {number} params.feriesHorsWeekendFullYear Nb fériés hors WE année pleine.
 * @param {string} params.dateSortie ISO.
 * @param {number} params.salaireAnnuel Salaire annuel brut.
 * @param {number} [params.cpOuvresPrisPeriode=0] CP pris sur la période.
 * @param {number} [params.salaireVerse=0] Salaire déjà versé sur la période.
 * @returns {{ salaireJournalierRef: number, joursTravaillesPeriode: number, feriesHorsWeekendPeriode: number, joursARemunerer: number, remunerationDue: number, solde: number }}
 */
export function computeProrataSortie({
  db,
  year,
  forfaitPlein: _forfaitPlein,
  cpOuvresFullYear,
  reposClassiquesFullYear: _reposClassiquesFullYear,
  feriesHorsWeekendFullYear,
  dateSortie,
  salaireAnnuel,
  cpOuvresPrisPeriode = 0,
  salaireVerse = 0,
}) {
  const dateDebut = `${year}-01-01`;
  const joursCalendairesPeriode = calendarDaysInRange(dateDebut, dateSortie);
  const joursWeekendPeriode = countWeekendDaysInRange(dateDebut, dateSortie);
  const feriesHorsWeekendPeriode = countHolidaysExcludingWeekendInRange(db, dateDebut, dateSortie);

  // Base jours ouvrables théoriques (année pleine)
  const totalJoursAnneePleine = daysInYear(year);
  const baseJoursAnneePleine =
    totalJoursAnneePleine -
    FORFAIT_DEFAULTS.WEEKEND_DAYS_PER_YEAR -
    feriesHorsWeekendFullYear -
    cpOuvresFullYear;
  const salaireJournalierRef = baseJoursAnneePleine > 0 ? salaireAnnuel / baseJoursAnneePleine : 0;

  const joursTravaillesPeriode = joursCalendairesPeriode - joursWeekendPeriode;
  const joursARemunerer = joursTravaillesPeriode - feriesHorsWeekendPeriode - cpOuvresPrisPeriode;
  const remunerationDue = Math.round(joursARemunerer * salaireJournalierRef * 100) / 100;
  const solde = Math.round((remunerationDue - salaireVerse) * 100) / 100;

  return {
    salaireJournalierRef: Math.round(salaireJournalierRef * 100) / 100,
    joursTravaillesPeriode,
    feriesHorsWeekendPeriode,
    joursARemunerer,
    remunerationDue,
    solde,
  };
}

/**
 * 3. Calcul du nombre de jours de repos annuels (JRTT forfait).
 * Feuille "Calcul repos annuels".
 * Formule : Calendaires − Repos hebdo (104) − Fériés hors WE − CP légaux − Forfait plein.
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.year
 * @param {number} [params.cpOuvresFullYear=25]
 * @param {number} [params.forfaitPlein=218]
 * @returns {{ joursCalendaires: number, joursWeekend: number, feriesHorsWeekend: number, joursRepos: number }}
 */
export function computeRestAnnualDays({
  db,
  year,
  cpOuvresFullYear = FORFAIT_DEFAULTS.CP_LEGAL_DAYS_OUVRES,
  forfaitPlein = FORFAIT_DEFAULTS.FULL_FORFAIT_DAYS,
}) {
  const joursCalendaires = daysInYear(year);
  const joursWeekend = FORFAIT_DEFAULTS.WEEKEND_DAYS_PER_YEAR;
  const feriesHorsWeekend = countHolidaysExcludingWeekend(db, year);
  const joursRepos =
    joursCalendaires - joursWeekend - feriesHorsWeekend - cpOuvresFullYear - forfaitPlein;
  return { joursCalendaires, joursWeekend, feriesHorsWeekend, joursRepos };
}

/**
 * 4. Calcul du rachat de jours de repos (art. L.3121-59, art. 5.7.3 4°).
 * Feuille "Rachat jours de repos".
 * Formule salaire journalier réf. : Salaire annuel / (calendaires − 104 − fériés hors WE − CP).
 * Total rachat = jours × salaireJournalierRef × (1 + majoration%).
 *
 * Garde-fous conventionnels :
 *   - Majoration ≥ 10% (art. 5.7.3 4°).
 *   - forfaitPlein + nbJoursARacheter ≤ 235 (plafond annuel de travail).
 *
 * @param {object} params
 * @param {import('better-sqlite3').Database} params.db
 * @param {number} params.year
 * @param {number} params.forfaitPlein
 * @param {number} params.cpOuvresFullYear
 * @param {number} params.feriesHorsWeekendFullYear
 * @param {number} params.salaireAnnuel
 * @param {number} [params.majorationPct=10]
 * @param {number} params.nbJoursARacheter
 * @returns {{ salaireJournalierRef: number, totalRachat: number, warnings: string[] }}
 * @throws {Error} Si la majoration est inférieure au minimum conventionnel
 *                 ou si forfaitPlein + nbJoursARacheter dépasse 235.
 */
export function computeRachat({
  db: _db,
  year,
  forfaitPlein,
  cpOuvresFullYear,
  feriesHorsWeekendFullYear,
  salaireAnnuel,
  majorationPct = FORFAIT_DEFAULTS.RACHAT_MIN_MAJORATION_PCT,
  nbJoursARacheter,
}) {
  // Garde-fou majoration min. — art. 5.7.3 4°.
  if (majorationPct < FORFAIT_DEFAULTS.RACHAT_MIN_MAJORATION_PCT) {
    const err = new Error(
      `Majoration insuffisante : ${majorationPct}% < ${FORFAIT_DEFAULTS.RACHAT_MIN_MAJORATION_PCT}% (minimum conventionnel art. 5.7.3 4°).`,
    );
    err.code = 'RACHAT_MAJORATION_TOO_LOW';
    throw err;
  }
  // Garde-fou plafond annuel — art. 5.7.3 4° : max 235 jours travaillés.
  const totalJoursTravailles = forfaitPlein + nbJoursARacheter;
  if (totalJoursTravailles > FORFAIT_DEFAULTS.RACHAT_MAX_TOTAL_DAYS) {
    const err = new Error(
      `Plafond dépassé : ${forfaitPlein} + ${nbJoursARacheter} = ${totalJoursTravailles} > ${FORFAIT_DEFAULTS.RACHAT_MAX_TOTAL_DAYS} jours (max annuel conventionnel art. 5.7.3 4°).`,
    );
    err.code = 'RACHAT_TOTAL_TOO_HIGH';
    throw err;
  }

  const baseJours =
    daysInYear(year) -
    FORFAIT_DEFAULTS.WEEKEND_DAYS_PER_YEAR -
    feriesHorsWeekendFullYear -
    cpOuvresFullYear;
  const salaireJournalierRef = baseJours > 0 ? salaireAnnuel / baseJours : 0;
  const totalRachat =
    Math.round(nbJoursARacheter * salaireJournalierRef * (1 + majorationPct / 100) * 100) / 100;

  const warnings = [];
  const maxRachat = FORFAIT_DEFAULTS.RACHAT_MAX_TOTAL_DAYS - forfaitPlein;
  if (nbJoursARacheter > maxRachat / 2) {
    warnings.push(
      `Rachat élevé (${nbJoursARacheter} j sur ${maxRachat} j maximum). Vérifier l'accord écrit du salarié (art. 5.7.3 4°).`,
    );
  }

  return {
    salaireJournalierRef: Math.round(salaireJournalierRef * 100) / 100,
    totalRachat,
    warnings,
  };
}

/**
 * 5. Calcul du prorata forfait réduit (temps partiel forfait-jours).
 * Feuille "Calcul forfait jours réduit".
 *
 * @param {object} params
 * @param {number} [params.forfaitPlein=218]
 * @param {number} params.tauxPct Ex : 80 pour 80%.
 * @returns {{ prorataForfait: number }}
 */
export function computeForfaitReduit({
  forfaitPlein = FORFAIT_DEFAULTS.FULL_FORFAIT_DAYS,
  tauxPct,
}) {
  const prorataForfait = Math.round(forfaitPlein * (tauxPct / 100) * 10) / 10;
  return { prorataForfait };
}
