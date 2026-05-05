// ═══════════════════════════════════════════════════════════════
// schemas/controles.js — Validation Zod du module Contrôles Périodiques
// ═══════════════════════════════════════════════════════════════
import { z } from 'zod';

const optStr = (max = 1000) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date attendu : YYYY-MM-DD');

// ── Type de contrôle ──
export const controlTypeSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .trim()
    .regex(/^[A-Z0-9_]+$/, 'Code en majuscules sans espace (A-Z, 0-9, _)'),
  name: z.string().min(1).max(255).trim(),
  description: optStr(2000),
  default_periodicity_days: z.coerce
    .number()
    .int()
    .min(1)
    .max(365 * 10),
  missed_after_days: z.coerce
    .number()
    .int()
    .min(0)
    .max(365 * 5)
    .default(30),
  is_vehicle_specific: z.coerce.number().int().min(0).max(1).default(0),
  is_active: z.coerce.number().int().min(0).max(1).default(1),
});

export const controlTypeUpdateSchema = controlTypeSchema.partial();

// ── Création / mise à jour d'un contrôle ──
export const equipmentControlCreateSchema = z.object({
  entity_type: z.enum(['vehicle', 'equipment']),
  entity_id: z.string().min(1).max(100),
  control_type_id: z.coerce.number().int().positive(),
  periodicity_days: z.coerce
    .number()
    .int()
    .min(1)
    .max(365 * 10)
    .optional(),
  next_due_date: isoDate,
  last_done_date: isoDate.optional().or(z.null()),
  assigned_to: z.coerce.number().int().positive().optional().or(z.null()),
  notes: optStr(5000),
});

export const equipmentControlUpdateSchema = z.object({
  control_type_id: z.coerce.number().int().positive().optional(),
  periodicity_days: z.coerce
    .number()
    .int()
    .min(1)
    .max(365 * 10)
    .optional(),
  next_due_date: isoDate.optional(),
  last_done_date: isoDate.optional().or(z.null()),
  assigned_to: z.coerce.number().int().positive().optional().or(z.null()),
  notes: optStr(5000),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
});

// ── Effectuer un contrôle (perform) ──
export const controlPerformSchema = z.object({
  performed_at: isoDate,
  notes: optStr(5000),
  documents: z
    .array(
      z.object({
        name: z.string().max(255),
        url: z.string().max(2000),
        size: z.coerce.number().nonnegative().optional(),
        type: z.string().max(100).optional(),
      }),
    )
    .max(20)
    .optional(),
  // Optionnel : forcer un next_due_date (sinon = performed_at + periodicity_days)
  next_due_date: isoDate.optional(),
});

// ── Middleware factory ──
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = Array.isArray(result.error?.issues) ? result.error.issues : [];
      const errors = issues.map(
        (e) => `${Array.isArray(e.path) ? e.path.join('.') : ''}: ${e.message}`,
      );
      return res.status(400).json({ success: false, error: 'Données invalides', details: errors });
    }
    req.body = result.data;
    next();
  };
}
