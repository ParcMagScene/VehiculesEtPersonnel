// ═══════════════════════════════════════════════════════════════
// forfaitRoutes.js — API forfait-jours
// Réf : Code du travail L.3121-58 à L.3121-66.
// ═══════════════════════════════════════════════════════════════

import db from './database.js';
import logger from './logger.js';
import {
  calcEntreeSchema,
  calcRachatSchema,
  calcReduitSchema,
  calcReposAnnuelsSchema,
  calcSortieSchema,
  createAlertSchema,
  createEntretienSchema,
  createPoseSchema,
  forfaitConfigSchema,
  resolveAlertSchema,
  updateEntretienSchema,
  validatePoseSchema,
} from './schemas/forfait.js';
import { validate } from './schemas/imports.js';
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
import {
  countPosesByType,
  createAlert,
  createEntretien,
  createRestPose,
  getEntretienComplianceForYear,
  listAlerts,
  listEntretiens,
  listRestPoses,
  resolveAlert,
  updateEntretien,
} from './services/forfait/repository.js';
import {
  checkForfaitEligibility,
  hoursToWorkedDays,
  REST_POSE_DEFAULTS,
  validateRestPose,
} from './services/forfait/validation.js';

// Un utilisateur peut consulter/modifier sa propre config forfait si :
// - il est admin, OU
// - il est propriétaire (persons.user_id === req.user.id).
// Note : le JWT actuel ne contient pas is_admin ; on relit is_admin depuis la DB.
function canAccessPersonForfait(personId, user) {
  if (!user) return false;
  if (user.isAdmin) return true;
  const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id);
  if (admin?.is_admin) {
    user.isAdmin = true;
    return true;
  }
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
                  classification_level, forfait_min_annual_salary,
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
          classificationLevel: row.classification_level,
          forfaitMinAnnualSalary: row.forfait_min_annual_salary,
        },
        defaults: FORFAIT_DEFAULTS,
        restPoseDefaults: REST_POSE_DEFAULTS,
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

        // Éligibilité conventionnelle (art. 5.7.1) : niveau ≥ 4 + rémunération ≥ min+20%.
        // Vérifiée uniquement lors d'une activation. On combine les valeurs du body
        // (mise à jour en cours) et celles déjà en DB, car les nouvelles colonnes
        // ne sont pas encore appliquées à cet instant.
        if (body.is_forfait_jours === 1 || body.is_forfait_jours === true) {
          const eligRow = db
            .prepare(
              `SELECT classification_level, forfait_min_annual_salary, forfait_annual_salary
                 FROM persons WHERE id = ?`,
            )
            .get(personId);
          const classificationLevel =
            body.classification_level !== undefined
              ? body.classification_level
              : eligRow?.classification_level;
          const annualSalary =
            body.forfait_annual_salary !== undefined
              ? body.forfait_annual_salary
              : eligRow?.forfait_annual_salary;
          const minCategorySalary =
            body.forfait_min_annual_salary !== undefined
              ? body.forfait_min_annual_salary
              : eligRow?.forfait_min_annual_salary;
          const eligibility = checkForfaitEligibility({
            type: existing.type,
            classificationLevel,
            annualSalary,
            minCategorySalary,
          });
          if (!eligibility.ok) {
            return res.status(400).json({
              success: false,
              error: 'Conditions conventionnelles non remplies',
              eligibility,
            });
          }
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
             classification_level = COALESCE(?, classification_level),
             forfait_min_annual_salary = COALESCE(?, forfait_min_annual_salary),
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
          body.classification_level !== undefined ? body.classification_level : null,
          body.forfait_min_annual_salary !== undefined ? body.forfait_min_annual_salary : null,
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

  // ═══════════════════════════════════════════════════════════════
  // Couches 4 & 5 — Poses, entretiens, alertes
  // ═══════════════════════════════════════════════════════════════

  // ─── POST /api/forfait/validate-pose ─────────────────────────
  // Vérifie prévenance (14 j), plafond 5 j consécutifs, échéance 31/12.
  app.post(
    '/api/forfait/validate-pose',
    authenticateToken,
    validate(validatePoseSchema),
    (req, res) => {
      try {
        const { personId, scheduledDate, requestDate } = req.body;
        if (!canAccessPersonForfait(personId, req.user))
          return res.status(403).json({ success: false, error: 'Accès refusé' });

        // Construction de dailyWork sur ±10 jours autour de la pose.
        const from = new Date(`${scheduledDate}T00:00:00Z`);
        from.setUTCDate(from.getUTCDate() - 10);
        const to = new Date(`${scheduledDate}T00:00:00Z`);
        to.setUTCDate(to.getUTCDate() + 10);
        const fromISO = from.toISOString().slice(0, 10);
        const toISO = to.toISOString().slice(0, 10);
        const poses = listRestPoses(db, personId, { fromDate: fromISO, toDate: toISO });
        const posesByDate = new Map();
        for (const p of poses) posesByDate.set(p.pose_date, p);

        const dailyWork = [];
        for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
          const iso = d.toISOString().slice(0, 10);
          const wd = d.getUTCDay();
          const isWeekend = wd === 0 || wd === 6;
          const pose = posesByDate.get(iso);
          const isRest = pose && ['repos_conv', 'conge', 'ferie'].includes(pose.pose_type);
          dailyWork.push({ date: iso, isWorked: !isWeekend && !isRest });
        }

        const result = validateRestPose({
          scheduledDate,
          requestDate: requestDate || new Date().toISOString().slice(0, 10),
          dailyWork,
        });
        res.json(result);
      } catch (error) {
        logger.error('POST forfait/validate-pose error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ─── GET /api/forfait/poses/:personId ─────────────────────────
  app.get('/api/forfait/poses/:personId', authenticateToken, (req, res) => {
    try {
      const personId = Number(req.params.personId);
      if (!canAccessPersonForfait(personId, req.user))
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      const { from, to, type } = req.query;
      const poses = listRestPoses(db, personId, { fromDate: from, toDate: to, type });
      res.json({ poses });
    } catch (error) {
      logger.error('GET forfait/poses error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── POST /api/forfait/poses ─────────────────────────────────
  app.post('/api/forfait/poses', authenticateToken, validate(createPoseSchema), (req, res) => {
    try {
      const body = req.body;
      if (!canAccessPersonForfait(body.personId, req.user))
        return res.status(403).json({ success: false, error: 'Accès refusé' });

      // Journée type : > 4h = 1 jour, ≤ 4h = 1/2 (art. 5.7.3 3°b).
      const workedEquiv =
        body.hoursWorked != null ? hoursToWorkedDays(body.hoursWorked) : undefined;
      const pose = createRestPose(db, { ...body, workedDaysEquiv: workedEquiv }, req.user.id);
      res.status(201).json({ success: true, pose });
    } catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res
          .status(409)
          .json({ success: false, error: 'Une pose existe déjà à cette date/période' });
      }
      logger.error('POST forfait/poses error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── GET /api/forfait/entretiens/:personId ───────────────────
  app.get('/api/forfait/entretiens/:personId', authenticateToken, (req, res) => {
    try {
      const personId = Number(req.params.personId);
      if (!canAccessPersonForfait(personId, req.user))
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      const year = req.query.year ? Number(req.query.year) : null;
      const entretiens = listEntretiens(db, personId, year);
      const compliance = year ? getEntretienComplianceForYear(db, personId, year) : null;
      res.json({ entretiens, compliance });
    } catch (error) {
      logger.error('GET forfait/entretiens error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── POST /api/forfait/entretiens ────────────────────────────
  app.post(
    '/api/forfait/entretiens',
    authenticateToken,
    requireAdmin,
    validate(createEntretienSchema),
    (req, res) => {
      try {
        const entretien = createEntretien(db, req.body, req.user.id);
        res.status(201).json({ success: true, entretien });
      } catch (error) {
        logger.error('POST forfait/entretiens error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ─── PATCH /api/forfait/entretiens/:id ───────────────────────
  app.patch(
    '/api/forfait/entretiens/:id',
    authenticateToken,
    requireAdmin,
    validate(updateEntretienSchema),
    (req, res) => {
      try {
        const id = Number(req.params.id);
        const entretien = updateEntretien(db, id, req.body, req.user.id);
        if (!entretien)
          return res.status(404).json({ success: false, error: 'Entretien introuvable' });
        res.json({ success: true, entretien });
      } catch (error) {
        logger.error('PATCH forfait/entretiens error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ─── GET /api/forfait/alerts/:personId ───────────────────────
  app.get('/api/forfait/alerts/:personId', authenticateToken, (req, res) => {
    try {
      const personId = Number(req.params.personId);
      if (!canAccessPersonForfait(personId, req.user))
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      const { status, year } = req.query;
      const alerts = listAlerts(db, personId, { status, year: year ? Number(year) : null });
      res.json({ alerts });
    } catch (error) {
      logger.error('GET forfait/alerts error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── POST /api/forfait/alerts ────────────────────────────────
  // Un salarié peut déclencher une alerte pour lui-même (droit d'alerte).
  app.post('/api/forfait/alerts', authenticateToken, validate(createAlertSchema), (req, res) => {
    try {
      const body = req.body;
      if (!canAccessPersonForfait(body.personId, req.user))
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      const alert = createAlert(db, body, req.user.id);
      res.status(201).json({ success: true, alert });
    } catch (error) {
      logger.error('POST forfait/alerts error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── POST /api/forfait/alerts/:id/resolve ────────────────────
  app.post(
    '/api/forfait/alerts/:id/resolve',
    authenticateToken,
    requireAdmin,
    validate(resolveAlertSchema),
    (req, res) => {
      try {
        const id = Number(req.params.id);
        const alert = resolveAlert(db, id, req.body, req.user.id);
        if (!alert) return res.status(404).json({ success: false, error: 'Alerte introuvable' });
        res.json({ success: true, alert });
      } catch (error) {
        logger.error('POST forfait/alerts/resolve error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
      }
    },
  );

  // ─── GET /api/forfait/compliance/:personId/:year ─────────────
  // Bilan de conformité entretiens + alertes ouvertes + charge de poses.
  app.get('/api/forfait/compliance/:personId/:year', authenticateToken, (req, res) => {
    try {
      const personId = Number(req.params.personId);
      const year = Number(req.params.year);
      if (!canAccessPersonForfait(personId, req.user))
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      const entretiens = getEntretienComplianceForYear(db, personId, year);
      const alertsOpen = listAlerts(db, personId, { status: 'open', year });
      const posesByType = countPosesByType(db, personId, `${year}-01-01`, `${year}-12-31`);
      res.json({ year, entretiens, alertsOpen, posesByType });
    } catch (error) {
      logger.error('GET forfait/compliance error:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}
