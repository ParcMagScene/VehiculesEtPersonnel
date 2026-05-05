import { z } from 'zod';

// ── Helpers ──
const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());
const optInt = z.coerce.number().int().optional().nullable();
const optNum = z.coerce.number().optional().nullable();

// ── Location ──
export const locationSchema = z
  .object({
    name: z.string().min(1, 'name requis').max(255).trim(),
    code: z.string().min(1, 'code requis').max(100).trim(),
    depot_number: z.coerce.number().int().optional().default(1),
    type: optStr(50),
    zone: optStr(100),
    floor: optStr(50),
    capacity: optInt,
    address: optStr(500),
    gps_lat: optNum,
    gps_lon: optNum,
    parent_id: optInt,
  })
  .passthrough();

export const locationUpdateSchema = locationSchema.partial().extend({
  is_active: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
});

// ── Price ──
export const priceSchema = z
  .object({
    stock_item_id: z.coerce.number().int({ message: 'stock_item_id requis' }),
    supplier_id: optInt,
    source: optStr(50),
    price_ht: z.coerce.number({ required_error: 'price_ht requis' }),
    currency: z.string().max(10).optional().default('EUR'),
    quantity_break: z.coerce.number().int().optional().default(1),
    valid_from: optStr(30),
    valid_to: optStr(30),
    reference: optStr(255),
  })
  .passthrough();

// ── Price Engine Batch ──
export const priceBatchSchema = z.object({
  item_ids: z.array(z.coerce.number().int()).min(1).max(100),
});

// ── Price Engine Fusion ──
export const priceFusionSchema = z.object({
  stock_item_id: z.coerce.number().int({ message: 'stock_item_id requis' }),
  prices: z
    .array(
      z.object({
        price_ht: z.coerce.number(),
        supplier_id: optInt,
        source: optStr(50),
        reference: optStr(255),
      }),
    )
    .min(1),
});

// ── Anomaly Update ──
export const anomalyUpdateSchema = z.object({
  status: z.enum(['acknowledged', 'resolved', 'ignored'], {
    required_error: 'Status invalide',
  }),
});

// ── Inventory Count ──
export const inventoryCountSchema = z.object({
  items: z
    .array(
      z.object({
        stock_item_id: z.coerce.number().int(),
        counted_qty: z.coerce.number().int(),
      }),
    )
    .min(1),
});
