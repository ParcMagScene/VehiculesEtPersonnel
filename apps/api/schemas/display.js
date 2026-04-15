import { z } from 'zod';

// ── Helpers ──
const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());
const optInt = z.coerce.number().int().optional().nullable();
const optBool = z.union([z.boolean(), z.literal(0), z.literal(1)]).optional();

// ── Screen ──
export const screenSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255).trim(),
  location: optStr(255),
  resolution: z.string().max(30).optional().default('1920x1080'),
  orientation: z.enum(['landscape', 'portrait']).optional().default('landscape'),
  playlistId: optInt,
  config: z.any().optional().nullable(),
}).passthrough();

export const screenUpdateSchema = screenSchema.partial().extend({
  isActive: optBool,
});

// ── Playlist ──
const playlistItemSchema = z.object({
  itemType: z.enum(['media', 'message', 'template', 'url']).optional().default('media'),
  itemId: optInt,
  url: optStr(2048),
  duration: z.coerce.number().int().nonnegative().optional().default(10),
  sortOrder: z.coerce.number().int().optional(),
  config: z.any().optional().nullable(),
}).passthrough();

export const playlistSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255).trim(),
  description: optStr(1000),
  transition: optStr(50),
  defaultDuration: z.coerce.number().int().nonnegative().optional().default(10),
  items: z.array(playlistItemSchema).optional(),
}).passthrough();

export const playlistUpdateSchema = z.object({
  name: optStr(255),
  description: optStr(1000),
  transition: optStr(50),
  defaultDuration: z.coerce.number().int().nonnegative().optional(),
  isActive: optBool,
}).passthrough();

export const playlistItemsSchema = z.object({
  items: z.array(playlistItemSchema),
});

// ── Message ──
export const messageSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(500).trim(),
  body: optStr(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  style: z.any().optional().nullable(),
  templateId: optInt,
  dateStart: optStr(30),
  dateEnd: optStr(30),
}).passthrough();

export const messageUpdateSchema = messageSchema.partial().extend({
  isActive: optBool,
});

// ── Template ──
export const templateSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255).trim(),
  category: optStr(100),
  description: optStr(1000),
  layout: z.any({ required_error: 'Le layout est requis' }),
}).passthrough();

export const templateUpdateSchema = templateSchema.partial().extend({
  isActive: optBool,
});

// ── Appearance ──
export const appearanceSchema = z.object({
  primaryColor: optStr(30),
  secondaryColor: optStr(30),
  eventBgColor: optStr(30),
  eventTextColor: optStr(30),
  fontFamily: optStr(100),
  showWeather: optBool,
  autoScroll: optBool,
  weatherApiKey: optStr(100),
  weatherCity: optStr(100),
}).passthrough();

// ── Welcome Messages ──
export const welcomeMessagesSchema = z.object({
  welcomeMessages: z.record(z.string(), z.record(z.string(), z.string())),
});

// ── Sidebar Config ──
export const sidebarConfigSchema = z.object({
  sections: z.array(z.string()).nullable(),
});

// ── Color Rules ──
export const colorRulesSchema = z.object({
  rules: z.array(z.object({
    keyword: z.string().max(255),
    color: z.string().max(30).optional().default('#00e1ff'),
    description: z.string().max(500).optional().default(''),
  }).passthrough()),
});

// ── Location Icon Rules ──
export const locationIconRulesSchema = z.object({
  rules: z.array(z.object({
    keyword: z.string().max(255),
    gifFilename: z.string().max(255),
  }).passthrough()),
});

// ── Sneaky Message ──
export const sneakyMessageSchema = z.object({
  message: z.string().min(1, 'Message requis').max(1000).trim(),
  duration: z.union([z.string(), z.coerce.number()]).optional().default('60'),
});

// ── Event Complete/Uncomplete ──
export const eventIdSchema = z.object({
  eventId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_\-:.]+$/, 'eventId invalide'),
});
