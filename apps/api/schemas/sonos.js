import { z } from 'zod';

// ── Helpers ──
const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());

// ── IPv4 ──
const ipv4 = z
  .string()
  .max(45)
  .regex(
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    'IPv4 invalide (ex: 192.168.1.10)',
  );

// ── Config ──
export const sonosConfigSchema = z.object({
  sonosIP: ipv4.optional().or(z.literal('')).or(z.null()),
});

// ── Volume ──
export const sonosVolumeSchema = z.object({
  value: z.number().int().min(0).max(100, 'Volume invalide (0-100 attendu)'),
});

// ── Favorite ──
export const sonosFavoriteSchema = z.object({
  uri: z.string().min(1, 'URI du favori requis').max(2048),
  title: optStr(256),
});

// ── Seek ──
export const sonosSeekSchema = z.object({
  position: z.number().min(0).max(86400, 'Position invalide (0-86400 secondes)'),
});

// ── Shuffle ──
export const sonosShuffleSchema = z.object({
  enabled: z.boolean({ required_error: 'enabled: boolean attendu' }),
});

// ── Repeat ──
export const sonosRepeatSchema = z.object({
  mode: z.enum(['none', 'all', 'one'], { required_error: "mode: 'none' | 'all' | 'one' attendu" }),
});
