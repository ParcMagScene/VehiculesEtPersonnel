/**
 * Schémas Zod pour validation des paramètres de route
 * Utilisés comme middleware validate() sur toutes les routes mutation
 */

import { z } from 'zod';

// ── Schémas unitaires de paramètres ──

/**
 * ID numérique positif (INTEGER PRIMARY KEY).
 * Utilisé pour affaire_id, person_id, location_id, etc.
 */
export const numericIdSchema = z.object({
  id: z.coerce.number().int('ID doit être un nombre entier').positive('ID doit être positif'),
});

/**
 * ID textuel (STRING PRIMARY KEY).
 * Utilisé pour vehicle_id, reservation_id, maintenance_id (tous TEXT dans SQLite).
 * Pattern: alphanumériques + tirets (ex: "EMAG-12345", "RES-2026-001").
 */
export const textIdSchema = z.object({
  id: z
    .string()
    .min(1, 'ID ne peut pas être vide')
    .regex(/^[A-Z0-9-]+$/i, 'ID doit contenir uniquement des lettres, chiffres et tirets')
    .max(50, 'ID trop long'),
});

/**
 * ID entité arbitraire — accepte aussi bien entiers que texte.
 * À utiliser seulement si la route gère les deux types.
 */
export const flexIdSchema = z.object({
  id: z.union([
    z.coerce.number().int('ID doit être un nombre entier').positive(),
    z
      .string()
      .min(1, 'ID ne peut pas être vide')
      .regex(/^[A-Z0-9-]+$/i, 'Format ID invalide')
      .max(50),
  ]),
});

/**
 * UUID v4 (GUID).
 * Utilisé si des ressources sont identifiées par UUID dans les futures migrations.
 */
export const uuidSchema = z.object({
  id: z.string().uuid('ID doit être un UUID valide v4'),
});

/**
 * Email comme paramètre (rare, mais utilisé par certaines routes spéciales).
 */
export const emailParamSchema = z.object({
  email: z.string().email('Email invalide'),
});

/**
 * Affaire ID — format strict AFxxxxx (numériques sauf préfixe AF).
 * Validé strictement car lié au processus métier de numérotation.
 */
export const affaireIdSchema = z.object({
  id: z
    .string()
    .regex(/^AF\d+$/i, 'Affaire ID doit être au format AFxxxxx')
    .max(20),
});

/**
 * UUID équipement (UID) — format EMAG-XXXXX (5 chiffres).
 */
export const equipmentUidSchema = z.object({
  uid: z.string().regex(/^EMAG-\d{5}$/i, 'UID équipement invalide — format: EMAG-XXXXX'),
});

/**
 * Paires de paramètres courants
 */
export const idAndPaginationSchema = z.object({
  id: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().positive().default(50).optional(),
  offset: z.coerce.number().int().nonnegative().default(0).optional(),
});

/**
 * Recherche/filtre dans un ID numérateur (ex: person_id).
 */
export const personIdParamSchema = numericIdSchema.extend({
  person_id: z.coerce.number().int().positive(),
});

/**
 * Validation pour query params de pagination.
 * À utiliser sur les routes GET /api/resource?limit=XX&offset=YY.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
});
