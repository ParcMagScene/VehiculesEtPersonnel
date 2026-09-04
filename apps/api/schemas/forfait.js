// Schémas Zod pour le module forfait-jours.
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');
const positiveInt = z.number().int().positive();
const positiveNum = z.number().positive();
const percent = z.number().min(0).max(100);

/** Configuration forfait sur une fiche personne. */
export const forfaitConfigSchema = z.object({
  is_forfait_jours: z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
  forfait_jours_annual: z.union([positiveInt, z.null()]).optional(),
  forfait_jours_reduced_pct: z.union([percent, z.null()]).optional(),
  forfait_annual_salary: z.union([positiveNum, z.null()]).optional(),
  forfait_rachat_majoration_pct: z.number().min(0).max(200).optional(),
  forfait_start_date: z.union([isoDate, z.null()]).optional(),
  forfait_end_date: z.union([isoDate, z.null()]).optional(),
  classification_level: z.union([z.number().int().min(1).max(15), z.null()]).optional(),
  forfait_min_annual_salary: z.union([positiveNum, z.null()]).optional(),
});

/** POST /api/forfait/calc/entree */
export const calcEntreeSchema = z.object({
  year: positiveInt,
  reposClassiquesFullYear: z.number().int().min(0).max(50),
  dateEntree: isoDate,
  cpAcquisAPrendre: z.number().int().min(0).max(60).optional(),
  journeeSolidarite: z.number().int().min(0).max(1).optional(),
});

/** POST /api/forfait/calc/sortie */
export const calcSortieSchema = z.object({
  year: positiveInt,
  forfaitPlein: positiveInt,
  cpOuvresFullYear: z.number().int().min(0).max(60),
  reposClassiquesFullYear: z.number().int().min(0).max(50),
  feriesHorsWeekendFullYear: z.number().int().min(0).max(20),
  dateSortie: isoDate,
  salaireAnnuel: positiveNum,
  cpOuvresPrisPeriode: z.number().min(0).max(60).optional(),
  salaireVerse: z.number().min(0).optional(),
});

/** POST /api/forfait/calc/repos-annuels */
export const calcReposAnnuelsSchema = z.object({
  year: positiveInt,
  cpOuvresFullYear: z.number().int().min(0).max(60).optional(),
  forfaitPlein: positiveInt.optional(),
});

/** POST /api/forfait/calc/rachat */
export const calcRachatSchema = z.object({
  year: positiveInt,
  forfaitPlein: positiveInt,
  cpOuvresFullYear: z.number().int().min(0).max(60),
  feriesHorsWeekendFullYear: z.number().int().min(0).max(20),
  salaireAnnuel: positiveNum,
  // Minimum conventionnel art. 5.7.3 4° = 10%.
  majorationPct: z.number().min(10).max(200).optional(),
  // Plafond annuel de travail : forfaitPlein + nbJoursARacheter ≤ 235 (validation runtime).
  nbJoursARacheter: z.number().int().min(1).max(50),
});

/** POST /api/forfait/calc/reduit */
export const calcReduitSchema = z.object({
  forfaitPlein: positiveInt.optional(),
  tauxPct: z.number().min(1).max(100),
});

// ═══════════════════════════════════════════════════════════════
// Couches 4 & 5 — Éligibilité, entretiens, alertes, poses de repos
// ═══════════════════════════════════════════════════════════════

/** PUT /api/forfait/config étendu : niveau + salaire mini catégorie. */
export const forfaitEligibilitySchema = z.object({
  classification_level: z.union([z.number().int().min(1).max(15), z.null()]).optional(),
  forfait_min_annual_salary: z.union([positiveNum, z.null()]).optional(),
});

/** POST /api/forfait/validate-pose */
export const validatePoseSchema = z.object({
  personId: positiveInt,
  scheduledDate: isoDate,
  requestDate: isoDate.optional(),
  period: z.enum(['AM', 'PM', 'FULL']).optional(),
});

/** POST /api/forfait/poses */
export const createPoseSchema = z.object({
  personId: positiveInt,
  poseDate: isoDate,
  period: z.enum(['AM', 'PM', 'FULL']).default('FULL'),
  poseType: z
    .enum(['repos_conv', 'rachat', 'work', 'conge', 'ferie', 'weekend'])
    .default('repos_conv'),
  hoursWorked: z.number().min(0).max(24).optional(),
  notes: z.string().max(1000).optional(),
});

/** POST /api/forfait/entretiens */
export const createEntretienSchema = z.object({
  personId: positiveInt,
  year: positiveInt,
  type: z.enum(['annuel', 'semestriel']),
  scheduledDate: isoDate.optional(),
  heldDate: isoDate.optional(),
  workloadOk: z.boolean().optional(),
  workLifeBalanceOk: z.boolean().optional(),
  compensationOk: z.boolean().optional(),
  comments: z.string().max(4000).optional(),
  nextActions: z.string().max(2000).optional(),
  documentPath: z.string().max(500).optional(),
  status: z.enum(['scheduled', 'held', 'skipped', 'overdue']).optional(),
});

/** PATCH /api/forfait/entretiens/:id */
export const updateEntretienSchema = createEntretienSchema.partial().omit({ personId: true });

/** POST /api/forfait/alerts */
export const createAlertSchema = z.object({
  personId: positiveInt,
  alertDate: isoDate.optional(),
  source: z.enum(['salarie', 'employeur', 'medecin_travail', 'crp', 'systeme']).optional(),
  category: z.enum(['charge_travail', 'amplitude', 'repos', 'deconnexion', 'autre']).optional(),
  reason: z.string().min(3).max(2000),
});

/** POST /api/forfait/alerts/:id/resolve */
export const resolveAlertSchema = z.object({
  response: z.string().max(2000),
  status: z.enum(['in_progress', 'resolved', 'closed']).optional(),
});
