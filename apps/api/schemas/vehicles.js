import { z } from 'zod';

// ── Helpers ──
const str = (max = 255) => z.string().max(max).trim();
const optStr = (max = 255) => str(max).optional().or(z.literal('')).or(z.null());
const optInt = z.coerce.number().int().optional().nullable();
const optNum = z.coerce.number().optional().nullable();
const optDate = z.string().max(30).optional().or(z.literal('')).or(z.null());
const optBool = z.union([z.boolean(), z.literal(0), z.literal(1)]).optional();
const id = z.union([z.string().max(100), z.number()]);

// ── Vehicle Create/Update ──
export const vehicleSchema = z
  .object({
    id: id.optional(),
    name: str(255),
    type: str(50).optional().default('vehicle'),
    category: optStr(100),
    registration: optStr(50),
    brand: optStr(100),
    model: optStr(100),
    year: optInt,
    color: optStr(50),
    vin: optStr(50),
    status: z
      .enum(['available', 'reserved', 'maintenance', 'unavailable', 'archived'])
      .optional()
      .default('available'),
    notes: optStr(5000),
    photo: optStr(1000),
    last_maintenance_date: optDate,
    last_maintenance_km: optInt,
    controles_techniques: optStr(2000),
    kilometrage: optInt,
    mileage_history: optStr(10000),
    assigned_to: optStr(255),
    pupitre: optStr(100),
    is_insured: optBool,
    insurance_company: optStr(255),
    insurance_number: optStr(100),
    insurance_expiry: optDate,
    is_location: optBool,
    daily_rate: optNum,
    weekly_rate: optNum,
    monthly_rate: optNum,
    order_index: optInt,
    latitude: optNum,
    longitude: optNum,
    location_updated_at: optDate,
  })
  .passthrough();

// ── Reservation Create ──
export const reservationSchema = z
  .object({
    vehicle_id: id,
    driver_id: optInt,
    client_id: optInt,
    start_date: str(30),
    end_date: str(30),
    start_time: optStr(10),
    end_time: optStr(10),
    purpose: optStr(1000),
    notes: optStr(5000),
    status: z.enum(['active', 'completed', 'cancelled']).optional().default('active'),
    affaire: optStr(255),
    affaire_id: optInt,
    garageDepart: optStr(255),
    garageRetour: optStr(255),
    lieuIntervention: optStr(500),
    recurrence: optStr(500),
  })
  .passthrough();

// ── Maintenance Create/Update ──
export const maintenanceSchema = z
  .object({
    vehicle_id: id,
    type: str(100),
    description: optStr(5000),
    status: z
      .enum(['scheduled', 'in_progress', 'completed', 'cancelled'])
      .optional()
      .default('scheduled'),
    scheduled_date: optDate,
    completion_date: optDate,
    cost: optNum,
    provider: optStr(255),
    notes: optStr(5000),
    mileage: optInt,
  })
  .passthrough();

// ── Reservation Request ──
export const reservationRequestSchema = z
  .object({
    vehicle_id: id,
    start_date: str(30),
    end_date: str(30),
    start_time: optStr(10),
    end_time: optStr(10),
    purpose: optStr(1000),
    notes: optStr(5000),
  })
  .passthrough();
