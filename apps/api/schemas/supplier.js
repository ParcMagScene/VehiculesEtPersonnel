import { z } from 'zod';

// ── Helpers ──
const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());
const optInt = z.coerce.number().int().optional().nullable();

// ── Analyze ──
export const analyzeSchema = z
  .object({
    items: z.array(z.any()).min(1),
    totalLines: z.coerce.number().int().min(1),
    parserId: optStr(100),
    text: z.string().optional().default(''),
  })
  .passthrough();

// ── Taxonomy Apply ──
export const taxonomyApplySchema = z.object({
  rules: z
    .array(
      z.object({
        type: z.enum(['family', 'category']),
        from: z.string().min(1).max(255),
        to: z.string().min(1).max(255),
      }),
    )
    .min(1),
  article_ids: z.array(z.coerce.number().int()).optional(),
});

// ── Brand Resolve ──
export const brandResolveSchema = z.object({
  brand: z.string().min(1, 'brand requis').max(255).trim(),
});

// ── Brand Alias ──
export const brandAliasSchema = z.object({
  alias: z.string().min(1, 'alias requis').max(255).trim(),
});
