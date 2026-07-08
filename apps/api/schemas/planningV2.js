// ═══════════════════════════════════════════════════════════════
// schemas/planningV2.js
//
// Ticket : T-P0-04 (Planning v2 — API v2 mutations)
//
// Schémas Zod pour les mutations `/api/v2/planning/tasks`.
// Validation stricte côté serveur avant tout accès DB.
//
// Rappels contrat :
//   - `date` est la seule colonne NOT NULL sans default → requise à
//     la création.
//   - `section` a un default `'manual'` en DB → optionnelle à la
//     création. Si fournie, doit appartenir à `TASK_SECTIONS`.
//   - `status` a un default `'pending'` en DB → optionnel à la
//     création. Si fourni, doit appartenir à `TASK_STATUSES`.
//   - `visible` a un default `1` en DB.
//   - `id` s'auto-génère côté SQLite (`lower(hex(randomblob(16)))`) →
//     JAMAIS accepté en input.
// ═══════════════════════════════════════════════════════════════

import { z } from 'zod';

import { TASK_SECTIONS, TASK_STATUSES } from '../services/planning/tasks.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format YYYY-MM-DD');

const isoTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'heure attendue au format HH:MM')
  .optional()
  .nullable();

const period = z.enum(['AM', 'PM']).optional().nullable();

const section = z.enum(/** @type {[string, ...string[]]} */ (TASK_SECTIONS.slice())).optional();

const status = z.enum(/** @type {[string, ...string[]]} */ (TASK_STATUSES.slice())).optional();

const sourceType = z
  .enum(['display_event', 'manual', 'google_event', 'ical_event', 'affaire'])
  .optional();

/**
 * Schéma de création d'une tâche v2.
 * L'`id` n'est pas accepté ici : SQLite l'auto-génère.
 * `date` est requis.
 */
export const createTaskSchema = z
  .object({
    date: isoDate,
    period,
    time: isoTime,
    end_time: isoTime,
    section,
    title: z.string().trim().max(500).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    person_id: z.number().int().positive().optional().nullable(),
    display_event_id: z.string().trim().min(1).max(64).optional().nullable(),
    source_type: sourceType,
    source_id: z.string().trim().min(1).max(64).optional().nullable(),
    affaire_num: z.string().trim().min(1).max(64).optional().nullable(),
    status,
    visible: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
  .strict();

/**
 * Schéma de mise à jour d'une tâche v2. Tous les champs sont
 * facultatifs, mais au moins un doit être fourni.
 */
export const updateTaskSchema = z
  .object({
    date: isoDate.optional(),
    period,
    time: isoTime,
    end_time: isoTime,
    section,
    title: z.string().trim().max(500).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    person_id: z.number().int().positive().optional().nullable(),
    display_event_id: z.string().trim().min(1).max(64).optional().nullable(),
    source_type: sourceType,
    source_id: z.string().trim().min(1).max(64).optional().nullable(),
    affaire_num: z.string().trim().min(1).max(64).optional().nullable(),
    status,
    visible: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'au moins un champ requis',
  });
