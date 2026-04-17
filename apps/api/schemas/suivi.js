import { z } from 'zod';

// ── Entrée de fiche (ligne tâche) ──
const trackingEntrySchema = z.object({
  id: z.string().optional(),
  period: z.enum(['AM', 'PM']),
  task: z.string().max(500).default(''),
  time_spent: z.coerce.number().min(0).max(24).default(0),
  comment: z.string().max(2000).default(''),
  completed: z.coerce.number().int().min(0).max(1).default(0),
  task_assignment_id: z.string().nullable().optional(),
  sort_order: z.coerce.number().int().min(0).default(0),
});

// ── Mise à jour complète d'une fiche ──
export const sheetUpdateSchema = z.object({
  status: z.enum(['draft', 'submitted', 'validated']).optional(),
  notes: z.string().max(5000).optional(),
  entries: z.array(trackingEntrySchema).min(0).max(100),
});

// ── Mise à jour d'une entrée individuelle ──
export const entryPatchSchema = z.object({
  completed: z.coerce.number().int().min(0).max(1).optional(),
  time_spent: z.coerce.number().min(0).max(24).optional(),
  comment: z.string().max(2000).optional(),
  task: z.string().max(500).optional(),
  period: z.enum(['AM', 'PM']).optional(),
});

// ── Paramètres de synthèse ──
export const syntheseDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
});

export const syntheseWeekSchema = z.object({
  week: z.string().regex(/^\d{4}-W\d{2}$/, 'Format YYYY-Wnn requis'),
});

export const syntheseMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format YYYY-MM requis'),
});

// ── Export PDF ──
export const pdfExportSchema = z.object({
  type: z.enum(['sheet', 'day', 'week', 'month']).optional(),
});
