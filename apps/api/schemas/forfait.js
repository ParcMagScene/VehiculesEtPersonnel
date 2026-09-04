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
  majorationPct: z.number().min(0).max(200).optional(),
  nbJoursARacheter: z.number().int().min(1).max(50),
});

/** POST /api/forfait/calc/reduit */
export const calcReduitSchema = z.object({
  forfaitPlein: positiveInt.optional(),
  tauxPct: z.number().min(1).max(100),
});
