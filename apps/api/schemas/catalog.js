import { z } from 'zod';

// ── Helpers ──
const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());
const optNum = z.coerce.number().optional().nullable();

// ── Equipment Catalog ──
export const catalogEquipmentSchema = z
  .object({
    name: z.string().min(1, 'Nom requis').max(255).trim(),
    reference: optStr(100),
    family: optStr(100),
    subfamily: optStr(100),
    category: optStr(100),
    dimensions: z.any().optional().nullable(),
    weight: optNum,
    default_flightcase_id: optStr(100),
    metadata: z.any().optional().nullable(),
    location_depot: optStr(100),
    location_zone: optStr(100),
    location_code: optStr(100),
    location_floor: optStr(100),
  })
  .passthrough();

export const catalogEquipmentUpdateSchema = catalogEquipmentSchema.partial();

export const catalogMatchReferencesSchema = z.object({
  references: z.array(z.string().max(255)).min(1).max(5000),
});

// ── Flightcases ──
export const flightcaseSchema = z
  .object({
    name: z.string().min(1, 'Nom requis').max(255).trim(),
    internal_code: optStr(100),
    dimensions: z.any().optional().nullable(),
    capacity: z.coerce.number().int().nonnegative().optional().default(1),
    category: optStr(100),
    texture: optStr(100),
    metadata: z.any().optional().nullable(),
  })
  .passthrough();

export const flightcaseUpdateSchema = flightcaseSchema.partial();

// ── Truck Models ──
export const truckModelSchema = z
  .object({
    name: z.string().min(1, 'Nom requis').max(255).trim(),
    type: z.enum(['semi', 'porteur', 'utilitaire']).optional().nullable(),
    internal_code: optStr(100),
    dimensions: z.any().optional().nullable(),
    axle_config: z.any().optional().nullable(),
    metadata: z.any().optional().nullable(),
  })
  .passthrough();

export const truckModelUpdateSchema = truckModelSchema.partial();

// ── Reservation Equipment ──
export const reservationEquipmentSchema = z
  .object({
    equipment_id: z.string().min(1, 'equipment_id requis'),
    quantity: z.coerce.number().int().nonnegative().optional().default(1),
    flightcase_id: optStr(100),
    metadata: z.any().optional().nullable(),
  })
  .passthrough();
