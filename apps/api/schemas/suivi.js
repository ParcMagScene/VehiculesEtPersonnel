import { z } from 'zod';

// ── Entrée de fiche (ligne tâche) ──
const trackingEntrySchema = z.object({
  id: z.string().optional(),
  period: z.enum(['AM', 'PM', 'Full']),
  task: z.string().max(500).default(''),
  time_spent: z.coerce.number().min(0).max(1440).default(0),
  comment: z.string().max(2000).default(''),
  completed: z.number().int().min(0).max(1).nullable().default(null),
  task_assignment_id: z.string().nullable().optional(),
  recurring_task_id: z.string().nullable().optional(),
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
  completed: z.number().int().min(0).max(1).nullable().optional(),
  time_spent: z.coerce.number().min(0).max(1440).optional(),
  comment: z.string().max(2000).optional(),
  task: z.string().max(500).optional(),
  period: z.enum(['AM', 'PM', 'Full']).optional(),
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

export const syntheseYearSchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'Format YYYY requis'),
});

const incidentEntrySchema = z.object({
  id: z.string().optional(),
  incident_type: z.enum([
    'vehicle_problem',
    'equipment_problem',
    'equipment_omission',
    'equipment_error',
    'other',
  ]),
  description: z.string().max(4000).default(''),
  reporter_person_id: z.coerce.number().int().nullable().optional(),
  vehicle_id: z
    .union([z.coerce.number().int(), z.string().trim().min(1)])
    .nullable()
    .optional(),
  vehicle_id_text: z.string().trim().min(1).nullable().optional(),
  vehicle_name_snapshot: z.string().max(255).optional(),
  linked_maintenance_id: z.string().max(64).nullable().optional(),
});

export const incidentTicketUpsertSchema = z.object({
  // Si fourni, l'API met à jour ce ticket précis ; sinon elle en crée un nouveau.
  id: z.string().min(1).max(64).optional(),
  week_key: z.string().regex(/^\d{4}-W\d{2}$/, 'Format semaine invalide (YYYY-Wnn)'),
  affaire_num: z.string().min(1).max(64),
  affaire_name: z.string().max(255).optional(),
  // Date de l'incident (YYYY-MM-DD). Optionnel : si absent, défaut = today.
  incident_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  affaire_start_date: z.string().max(30).nullable().optional(),
  affaire_end_date: z.string().max(30).nullable().optional(),
  is_tournee: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  linked_reservations: z
    .array(
      z.object({
        id: z.string(),
        vehicle_name: z.string().optional().nullable(),
        start_date: z.string().optional().nullable(),
        end_date: z.string().optional().nullable(),
        is_tournee: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
      }),
    )
    .optional(),
  linked_personnel: z
    .array(
      z.object({
        id: z.coerce.number().int().optional().nullable(),
        first_name: z.string().optional().nullable(),
        last_name: z.string().optional().nullable(),
        source: z.string().optional().nullable(),
      }),
    )
    .optional(),
  notes: z.string().max(5000).optional(),
  incidents: z.array(incidentEntrySchema).max(300).default([]),
});

// ── Export PDF ──
export const pdfExportSchema = z.object({
  type: z.enum(['sheet', 'day', 'week', 'month']).optional(),
});

// ── Tâches récurrentes (Suivi) ──
export const suiviRecurringTaskCreateSchema = z
  .object({
    title: z.string().min(1).max(500),
    period: z.enum(['AM', 'PM']).default('AM'),
    recurrence: z.enum(['daily', 'weekly', 'monthly']),
    day_of_week: z.coerce.number().int().min(0).max(6).nullable().optional(),
    day_of_month: z.coerce.number().int().min(1).max(31).nullable().optional(),
    default_time_spent: z.coerce.number().min(0).max(1440).default(0),
    default_comment: z.string().max(2000).default(''),
    active: z.coerce.number().int().min(0).max(1).default(1),
  })
  .superRefine((val, ctx) => {
    if (
      val.recurrence === 'weekly' &&
      (val.day_of_week === null || val.day_of_week === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['day_of_week'],
        message: 'day_of_week requis pour une récurrence hebdomadaire',
      });
    }
    if (
      val.recurrence === 'monthly' &&
      (val.day_of_month === null || val.day_of_month === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['day_of_month'],
        message: 'day_of_month requis pour une récurrence mensuelle',
      });
    }
  });

export const suiviRecurringTaskUpdateSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    period: z.enum(['AM', 'PM']).optional(),
    recurrence: z.enum(['daily', 'weekly', 'monthly']).optional(),
    day_of_week: z.coerce.number().int().min(0).max(6).nullable().optional(),
    day_of_month: z.coerce.number().int().min(1).max(31).nullable().optional(),
    default_time_spent: z.coerce.number().min(0).max(1440).optional(),
    default_comment: z.string().max(2000).optional(),
    active: z.coerce.number().int().min(0).max(1).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.recurrence === 'weekly' &&
      (val.day_of_week === null || val.day_of_week === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['day_of_week'],
        message: 'day_of_week requis pour une récurrence hebdomadaire',
      });
    }
    if (
      val.recurrence === 'monthly' &&
      (val.day_of_month === null || val.day_of_month === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['day_of_month'],
        message: 'day_of_month requis pour une récurrence mensuelle',
      });
    }
  });
