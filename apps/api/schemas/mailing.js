import { z } from 'zod';

const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());

// ── Mail Template Create/Update ──
export const mailTemplateSchema = z.object({
  name: z.string().min(1, 'Nom obligatoire').max(255).trim(),
  subject: optStr(500),
  html_body: optStr(100000),
  variables: z.array(z.string().max(100)).optional().nullable(),
  category: optStr(50),
});

// ── Send Email ──
export const mailSendSchema = z.object({
  template_id: z.coerce.number().int().positive().optional().nullable(),
  recipients: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  subject: optStr(500),
  html_body: optStr(100000),
  variables: z.record(z.string(), z.string()).optional().nullable(),
});

// ── Preview Email ──
export const mailPreviewSchema = z.object({
  template_id: z.coerce.number().int().positive().optional().nullable(),
  subject: optStr(500),
  html_body: optStr(100000),
  variables: z.record(z.string(), z.string()).optional().nullable(),
});
