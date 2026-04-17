import { z } from 'zod';

// ── Profile Name ──
export const profileNameSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255).trim(),
});

// ── Preferences (free-form JSON object) ──
export const preferencesSchema = z.record(z.string(), z.unknown()).or(z.object({}).passthrough());
