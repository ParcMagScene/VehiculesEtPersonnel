import { z } from 'zod';

const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());
const optInt = z.coerce.number().int().optional().nullable();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:mm)');

// ── Display Event Create ──
export const displayEventCreateSchema = z.object({
  affaire_id: optStr(255),
  bl_import_id: optInt,
  type: z.string().min(1).max(50),
  category: z.string().min(1).max(50),
  date: dateStr,
  period: optStr(10),
  time: timeStr.optional().or(z.literal('')).or(z.null()),
  comment: optStr(5000),
  client: optStr(255),
  location: optStr(255),
});

// ── Display Event Update ──
export const displayEventUpdateSchema = z
  .object({
    affaire_id: optStr(255),
    bl_import_id: optInt,
    type: optStr(50),
    category: optStr(50),
    date: dateStr.optional(),
    period: optStr(10),
    time: timeStr.optional().or(z.literal('')).or(z.null()),
    comment: optStr(5000),
    client: optStr(255),
    location: optStr(255),
    visible: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
  .passthrough();

// ── BP Item Match ──
export const bpItemMatchSchema = z.object({
  equipment_id: z.coerce.number().int().positive().optional().nullable(),
});

// ── BP Item Match Article ──
export const bpItemMatchArticleSchema = z.object({
  supplier_article_id: z.coerce.number().int().positive().optional().nullable(),
  stock_item_id: z.coerce.number().int().positive().optional().nullable(),
});

// ── Task Create ──
export const taskCreateSchema = z
  .object({
    display_event_id: optStr(255),
    person_id: optInt,
    date: dateStr,
    period: optStr(10),
    time: timeStr.optional().or(z.literal('')).or(z.null()),
    end_time: timeStr.optional().or(z.literal('')).or(z.null()),
    section: optStr(50),
    title: optStr(500),
    notes: optStr(5000),
    source_type: optStr(50),
    source_id: optStr(255),
    google_event_title: optStr(500),
    affaire_num: optStr(100),
    status: optStr(20),
    reservation_id: optInt,
    location_address: optStr(500),
    location_lat: z.coerce.number().optional().nullable(),
    location_lng: z.coerce.number().optional().nullable(),
    all_day: z
      .union([z.boolean(), z.literal(0), z.literal(1)])
      .optional()
      .nullable(),
    client_name: optStr(255),
  })
  .passthrough();

// ── Task Update ──
export const taskUpdateSchema = z
  .object({
    display_event_id: optStr(255),
    person_id: optInt,
    date: dateStr.optional(),
    period: optStr(10),
    time: timeStr.optional().or(z.literal('')).or(z.null()),
    end_time: timeStr.optional().or(z.literal('')).or(z.null()),
    section: optStr(50),
    title: optStr(500),
    notes: optStr(5000),
    source_type: optStr(50),
    source_id: optStr(255),
    google_event_title: optStr(500),
    affaire_num: optStr(100),
    status: optStr(20),
    reservation_id: optInt,
    location_address: optStr(500),
    location_lat: z.coerce.number().optional().nullable(),
    location_lng: z.coerce.number().optional().nullable(),
    all_day: z
      .union([z.boolean(), z.literal(0), z.literal(1)])
      .optional()
      .nullable(),
    client_name: optStr(255),
  })
  .passthrough();

// ── Task Batch ──
export const taskBatchSchema = z.object({
  tasks: z
    .array(taskCreateSchema.partial({ date: true }))
    .min(1)
    .max(200),
});

// ── Assign Person to Display Event ──
export const assignPersonSchema = z.object({
  person_id: optInt,
});

// ── Recurring Task Create ──
export const recurringTaskCreateSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(500).trim(),
  section: optStr(50),
  time: timeStr.optional().or(z.literal('')).or(z.null()),
  period: optStr(10),
  recurrence: z.enum(['daily', 'weekly', 'monthly']).optional().default('daily'),
  day_of_week: z.coerce.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.coerce.number().int().min(1).max(31).optional().nullable(),
  notes: optStr(5000),
});

// ── Recurring Task Update ──
export const recurringTaskUpdateSchema = z.object({
  title: z.string().max(500).trim().optional(),
  section: optStr(50),
  time: timeStr.optional().or(z.literal('')).or(z.null()),
  period: optStr(10),
  recurrence: z.enum(['daily', 'weekly', 'monthly']).optional(),
  day_of_week: z.coerce.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.coerce.number().int().min(1).max(31).optional().nullable(),
  notes: optStr(5000),
  active: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
});

// ── Date-only body schemas ──
export const dateBodySchema = z.object({
  date: dateStr,
});

export const fromDateBodySchema = z.object({
  fromDate: dateStr,
});

// ── iCal Calendar Create ──
export const icalCalendarCreateSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(255).trim(),
  url: z.string().min(1, 'URL requise').max(2000).trim(),
  color: optStr(20),
});

// ── iCal Calendar Update ──
export const icalCalendarUpdateSchema = z.object({
  name: z.string().max(255).trim().optional(),
  url: z.string().max(2000).trim().optional(),
  color: optStr(20),
  enabled: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
});

// ── Planning Assignment ──
export const planningAssignmentSchema = z.object({
  entity_type: z.string().min(1).max(50),
  entity_id: z.string().min(1).max(255),
  person_id: z.coerce.number().int().positive(),
});

// ── Export PDF ──
export const exportPdfSchema = z
  .object({
    date: dateStr.optional(),
    title: optStr(500),
    tasks: z.array(z.any()).optional(),
  })
  .passthrough();
