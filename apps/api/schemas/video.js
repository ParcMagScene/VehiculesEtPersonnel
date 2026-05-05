import { z } from 'zod';

const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());
const optInt = z.coerce.number().int().optional().nullable();

// ── Camera Create ──
export const cameraCreateSchema = z
  .object({
    name: z.string().min(1, 'name requis').max(255).trim(),
    brand: optStr(100),
    model: optStr(100),
    ip: z.string().min(1, 'ip requis').max(255),
    rtsp_url: optStr(1000),
    rtsp_port: z.coerce.number().int().min(1).max(65535).optional().default(554),
    http_port: z.coerce.number().int().min(1).max(65535).optional().default(80),
    username: optStr(100),
    password: optStr(255),
    ptz_supported: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
    location: optStr(255),
    affaire_id: optStr(255),
    zone: optStr(100),
    enabled: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
    stream_profile: optStr(50),
    snapshot_path: optStr(1000),
    notes: optStr(5000),
    channel: z.coerce.number().int().min(1).optional().default(1),
  })
  .passthrough();

// ── Camera Update ──
export const cameraUpdateSchema = z
  .object({
    name: optStr(255),
    brand: optStr(100),
    model: optStr(100),
    ip: optStr(255),
    rtsp_url: optStr(1000),
    rtsp_port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
    http_port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
    username: optStr(100),
    password: optStr(255),
    ptz_supported: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
    location: optStr(255),
    affaire_id: optStr(255),
    zone: optStr(100),
    enabled: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
    stream_profile: optStr(50),
    snapshot_path: optStr(1000),
    notes: optStr(5000),
    sort_order: optInt,
    channel: z.coerce.number().int().min(1).optional().nullable(),
  })
  .passthrough();

// ── WHEP (WebRTC SDP exchange) ──
export const whepSchema = z.object({
  sdp: z.string().min(1, 'SDP offer requis'),
});

// ── PTZ Command ──
export const ptzSchema = z.object({
  command: z.enum(['left', 'right', 'up', 'down', 'zoomin', 'zoomout', 'stop']),
  speed: z.coerce.number().min(0).max(10).optional(),
});

// ── Playback ──
export const playbackSchema = z.object({
  sdp: z.string().min(1, 'SDP offer requis'),
  startTime: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'Format date invalide (YYYY-MM-DD HH:MM:SS)'),
  endTime: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'Format date invalide (YYYY-MM-DD HH:MM:SS)'),
});

// ── Preset Create ──
export const presetCreateSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(255).trim(),
  camera_ids: z.array(z.coerce.number().int().positive()).min(1).max(4),
});

// ── Preset Update ──
export const presetUpdateSchema = z.object({
  name: z.string().max(255).trim().optional(),
  camera_ids: z.array(z.coerce.number().int().positive()).max(4).optional(),
});
