// ═══════════════════════════════════════════════════════════════
// forfaitRoutes.js — API forfait-jours
// Réf : Code du travail L.3121-58 à L.3121-66.
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';
import { validate } from './schemas/imports.js';
import {
  calcEntreeSchema,
  calcRachatSchema,
  calcReduitSchema,
  calcReposAnnuelsSchema,
  calcSortieSchema,
  forfaitConfigSchema,
} from './schemas/forfait.js';
import {
  computeForfaitReduit,
  computeProrataEntree,
  computeProrataSortie,
  computeRachat,
  computeRestAnnualDays,
  CONVENTIONAL_REST_DAYS_TABLE,
  FORFAIT_DEFAULTS,
  getConventionalRestDays,
} from './services/forfait/calculators.js';
import {
  computeFrenchHolidays,
  countHolidaysExcludingWeekend,
  daysInYear,
  getHolidaysForYear,
  isLeapYear,
} from './services/forfait/holidays.js';

// Un utilisateur peut consulter/modifier sa propre config forfait si :
// - il est admin, OU
// - il est propriétaire (persons.user_id === req.user.id).
function canAccessPersonForfait(personId, user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const row = db.prepare('SELECT user_id FROM persons WHERE id = ?').get(personId);
  return row && row.user_id === user.id;
}

export function setupForfaitRoutes(app, authenticateToken, requireAdmin) {
  // ─── GET /api/forfait/config/:personId ──────────────────────────
  app.get('/api/forfait/config/:personId', authenticateToken, (req, res) => {
    try {
      const personId = Number(req.params.personId);
      if (!Number.isFinite(personId))
        return res.status(400).json({ success: false, error: 'ID personne invalide' });
      if (!canAccessPersonForfait(personId, req.user))
        return res.status(403).json({ success: false, error: 'Accès refusé' });

      const row = db
        .prepare(
          `SELECT id, first_name, last_name, type, contract_type,
                  is_forfait_jours, forfait_jours_annual, forfait_jours_reduced_pct,
                  forfait_annual_salary, forfait_rachat_majoration_pct,
                  forfait_start_date, forfait_end_date
             FROM persons WHERE id = ?`,
        )
        .get(personId);
      if (!row) return res.status(404).json({ success: false, error: 'Personne introuvable' });

      res.json({
        person: {
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          type: row.type,
          contractType: row.contract_type,
        },
        config: {
          isForfaitJours: !!row.is_forfait_jours,
          forfaitJoursAnnual: row.forfait_jours_annual,
          forfaitJoursReducedPct: row.forfait_jours_reduced_pct,
          forfaitAnnualSalary: row.forfait_annual_salary,
          forfaitRachatMajorationPct: row.forfait_rachat_majoration_pct,
          forfaitStartDate: row.forfait_start_date,
          forfaitEndDate: row.forfait_end_date,
        },
        defaults: FORFAIT_DEFAULTS,
      });
    } catch (error) {
      logger.error('GET forfait/config error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── PUT /api/forfait/config/:personId ──────────────────────────
  // Réservé admin. Le forfait-jours n'est ouvert qu'aux cadres permanents.
  app.put(
    '/api/forfait/config/:personId',
    authenticateToken,
    requireAdmin,
    validate(forfaitConfigSchema),
    (req, res) => {
      try {
        const personId = Number(req.params.personId);
        if (!Number.isFinite(personId))
          return res.status(400).json({ success: false, error: 'ID personne invalide' });
        const existing = db
          .prepare('SELECT id, type, contract_type FROM persons WHERE id = ?')
          .get(personId);
        if (!existing)
          return res.status(404).json({ success: false, error: 'Personne introuvable' });

        const body = req.body || {};
        // Garde-fou métier : l'activation n'est autorisée que pour un permanent (cadre).
        if (
          (body.is_forfait_jours === 1 || body.is_forfait_jours === true) &&
          existing.type !== 'permanent'
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Le forfait-jours n'est activable que sur les personnels permanents (cadres autonomes ayant signé un avenant).",
          });
        }

        const toInt01 = (v) => (v === true || v === 1 ? 1 : 0);
        db.prepare(
          `UPDATE persons SET
             is_forfait_jours = COALESCE(?, is_forfait_jours),
             forfait_jours_annual = COALESCE(?, forfait_jours_annual),
             forfait_jours_reduced_pct = COALESCE(?, forfait_jours_reduced_pct),
             forfait_annual_salary = COALESCE(?, forfait_annual_salary),
             forfait_rachat_majoration_pct = COALESCE(?, forfait_rachat_majoration_pct),
             forfait_start_date = COALESCE(?, forfait_start_date),
             forfait_end_date = COALESCE(?, forfait_end_date),
             modified_by = ?,
             modified_at = datetime('now')
           WHERE id = ?`,
        ).run(
          body.is_forfait_jours !== undefined ? toInt01(body.is_forfait_jours) : null,
          body.forfait_jours_annual !== undefined ? body.forfait_jours_annual : null,
          body.forfait_jours_reduced_pct !== undefined ? body.forfait_jours_reduced_pct : null,
          body.forfait_annual_salary !== undefined ? body.forfait_annual_salary : null,
          body.forfait_rachat_majoration_pct !== undefined
            ? body.forfait_rachat_majoration_pct
            : null,
          body.forfait_start_date !== undefined ? body.forfait_start_date : null,
          body.forfait_end_date !== undefined ? body.forfait_end_date : null,
          req.user.id,
          personId,
        );
        res.json({ success: true });
      } catch (error) {
        logger.error('PUT forfait/config error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ─── GET /api/forfait/holidays/:year ──────────────────────────
  app.get('/api/forfait/holidays/:year', authenticateToken, (req, res) => {
    try {
      const year = Number(req.params.year);
      if (!Number.isFinite(year) || year < 2000 || year > 2100)
        return res.status(400).json({ success: false, error: 'Année invalide' });
      const holidays = getHolidaysForYear(db, year);
      const feriesHorsWeekend = countHolidaysExcludingWeekend(db, year);
      res.json({
        year,
        isLeap: isLeapYear(year),
        daysInYear: daysInYear(year),
        holidays,
        holidaysHorsWeekend: feriesHorsWeekend,
        conventionalRestDays: getConventionalRestDays(feriesHorsWeekend, year),
        computed: computeFrenchHolidays(year),
      });
    } catch (error) {
      logger.error('GET forfait/holidays error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── GET /api/forfait/reference-table ──────────────────────────
  // Barème conventionnel art. 5.7.3 3°a — table de référence légale.
  app.get('/api/forfait/reference-table', authenticateToken, (_req, res) => {
    res.json({
      article: 'Art. 5.7.3 3°a (avenant n° 3 du 22-4-2025)',
      formule:
        'Jours de repos = Calendaires - Repos hebdo (104) - Fériés hors WE - CP légaux (25) - Forfait (218)',
      table: CONVENTIONAL_REST_DAYS_TABLE,
      note: 'Année bissextile : +1 jour de repos (art. 5.7.3 note (1)).',
      defaults: FORFAIT_DEFAULTS,
    });
  });

  // ─── Les 5 calculateurs ──────────────────────────────────────
  app.post(
    '/api/forfait/calc/entree',
    authenticateToken,
    validate(calcEntreeSchema),
    (req, res) => {
      try {
        res.json(computeProrataEntree({ db, ...req.body }));
      } catch (error) {
        logger.error('calc entree error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  app.post(
    '/api/forfait/calc/sortie',
    authenticateToken,
    validate(calcSortieSchema),
    (req, res) => {
      try {
        res.json(computeProrataSortie({ db, ...req.body }));
      } catch (error) {
        logger.error('calc sortie error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  app.post(
    '/api/forfait/calc/repos-annuels',
    authenticateToken,
    validate(calcReposAnnuelsSchema),
    (req, res) => {
      try {
        res.json(computeRestAnnualDays({ db, ...req.body }));
      } catch (error) {
        logger.error('calc repos-annuels error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  app.post(
    '/api/forfait/calc/rachat',
    authenticateToken,
    validate(calcRachatSchema),
    (req, res) => {
      try {
        res.json(computeRachat({ db, ...req.body }));
      } catch (error) {
        if (
          error?.code === 'RACHAT_MAJORATION_TOO_LOW' ||
          error?.code === 'RACHAT_TOTAL_TOO_HIGH'
        ) {
          return res.status(400).json({ success: false, error: error.message, code: error.code });
        }
        logger.error('calc rachat error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  app.post(
    '/api/forfait/calc/reduit',
    authenticateToken,
    validate(calcReduitSchema),
    (req, res) => {
      try {
        res.json(computeForfaitReduit(req.body));
      } catch (error) {
        logger.error('calc reduit error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ─── GET /api/forfait/bilan/:personId/:year ──────────────────────────
  // Bilan annuel = repos annuels + soldes CP + jours travaillés (via availabilities).
  app.get('/api/forfait/bilan/:personId/:year', authenticateToken, (req, res) => {
    try {
      const personId = Number(req.params.personId);
      const year = Number(req.params.year);
      if (!Number.isFinite(personId) || !Number.isFinite(year))
        return res.status(400).json({ success: false, error: 'Paramètres invalides' });
      if (!canAccessPersonForfait(personId, req.user))
        return res.status(403).json({ success: false, error: 'Accès refusé' });

      const person = db
        .prepare(
          `SELECT id, first_name, last_name, is_forfait_jours, forfait_jours_annual,
                  forfait_jours_reduced_pct, forfait_annual_salary,
                  forfait_rachat_majoration_pct, forfait_start_date, forfait_end_date
             FROM persons WHERE id = ?`,
        )
        .get(personId);
      if (!person) return res.status(404).json({ success: false, error: 'Personne introuvable' });
      if (!person.is_forfait_jours)
        return res.status(400).json({
          success: false,
          error: "Cette personne n'est pas au forfait-jours",
        });

      const forfaitPlein = person.forfait_jours_annual || FORFAIT_DEFAULTS.FULL_FORFAIT_DAYS;

      // Soldes CP/repos depuis leave_balances
      const balances = db
        .prepare(
          `SELECT type, days_entitled, days_taken
             FROM leave_balances WHERE person_id = ? AND year = ?`,
        )
        .all(personId, year);
      const bal = Object.fromEntries(balances.map((b) => [b.type, b]));

      // Repos annuels calculés
      const reposAnnuels = computeRestAnnualDays({
        db,
        year,
        forfaitPlein,
      });

      // Comptage jours travaillés / absences via availabilities
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const availabilities = db
        .prepare(
          `SELECT type, start_date, end_date, start_period, end_period, status
             FROM availabilities
             WHERE person_id = ?
               AND status = 'approved'
               AND NOT (end_date < ? OR start_date > ?)`,
        )
        .all(personId, yearStart, yearEnd);

      const countHalfDays = (av) => {
        const start = new Date(`${av.start_date}T00:00:00Z`);
        const end = new Date(`${av.end_date}T00:00:00Z`);
        const yStart = new Date(`${yearStart}T00:00:00Z`);
        const yEnd = new Date(`${yearEnd}T00:00:00Z`);
        const s = start < yStart ? yStart : start;
        const e = end > yEnd ? yEnd : end;
        const days = Math.round((e - s) / 86400000) + 1;
        let halves = days * 2;
        if (start >= yStart && av.start_period === 'PM') halves -= 1;
        if (end <= yEnd && av.end_period === 'AM') halves -= 1;
        return Math.max(0, halves) / 2;
      };
      const byType = {};
      for (const av of availabilities) {
        byType[av.type] = (byType[av.type] || 0) + countHalfDays(av);
      }

      // Trimestres : approximation (ignore les dates exactes, se base sur availabilities)
      const trimestres = { T1: 0, T2: 0, T3: 0, T4: 0 };
      for (const av of availabilities) {
        if (av.type !== 'travaille' && !av.type?.includes('travail')) continue;
        const start = new Date(`${av.start_date}T00:00:00Z`);
        const m = start.getUTCMonth(); // 0-11
        const tri = m < 3 ? 'T1' : m < 6 ? 'T2' : m < 9 ? 'T3' : 'T4';
        trimestres[tri] += countHalfDays(av);
      }

      res.json({
        person: {
          id: person.id,
          firstName: person.first_name,
          lastName: person.last_name,
          forfaitJoursAnnual: forfaitPlein,
          forfaitJoursReducedPct: person.forfait_jours_reduced_pct,
        },
        year,
        isLeap: isLeapYear(year),
        forfaitPlein,
        reposAnnuels,
        soldes: {
          cp: bal.conge_paye || null,
          cpAnciennete: bal.cp_anciennete || null,
          reposForfait: bal.forfait_repos || null,
          rachat: bal.forfait_rachete || null,
        },
        absencesParType: byType,
        trimestres,
      });
    } catch (error) {
      logger.error('GET forfait/bilan error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}
