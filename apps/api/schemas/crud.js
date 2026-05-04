import { z } from 'zod';

// ── Helpers ──
const str = (max = 255) => z.string().max(max).trim();
const optStr = (max = 255) => str(max).optional().or(z.literal('')).or(z.null());
const optInt = z.coerce.number().int().optional().nullable();
const optNum = z.coerce.number().optional().nullable();
const optDate = z.string().max(30).optional().or(z.literal('')).or(z.null());

// ── Person Create/Update ──
export const personSchema = z
  .object({
    first_name: str(100),
    last_name: str(100),
    email: optStr(255),
    phone: optStr(30),
    mobile: optStr(30),
    type: optStr(50),
    status: optStr(30),
    code_libre: optStr(50),
    address: optStr(500),
    city: optStr(100),
    postal_code: optStr(10),
    photo: optStr(1000),
    notes: optStr(5000),
    license_types: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .nullable(),
    certifications: z
      .union([z.string(), z.array(z.any())])
      .optional()
      .nullable(),
    skills: z
      .union([z.string(), z.array(z.any())])
      .optional()
      .nullable(),
    contract_type: optStr(50),
    contract_start: optDate,
    contract_end: optDate,
    weekly_hours: optNum,
    position_id: optInt,
  })
  .passthrough();

// ── Equipment Item Create/Update ──
export const equipmentSchema = z
  .object({
    name: str(255),
    reference: optStr(100),
    serial_number: optStr(100),
    category_id: optInt,
    status: optStr(50),
    purchase_date: optDate,
    purchase_price: optNum,
    warranty_end: optDate,
    brand: optStr(100),
    model: optStr(100),
    notes: optStr(5000),
    location: optStr(255),
    stock_quantity: z.coerce.number().int().nonnegative().optional().default(1),
    uid: optStr(50),
    numero_mag: optStr(100),
    photo: optStr(1000),
    weight: optNum,
    dimensions: optStr(255),
  })
  .passthrough();

// ── Order Create ──
export const orderSchema = z
  .object({
    type: z.enum(['order', 'quote', 'devis']).optional().default('order'),
    affaire_id: optInt,
    supplier_id: optInt,
    status: optStr(50),
    order_date: optDate,
    expected_date: optDate,
    notes: optStr(5000),
    tva_rate: z.coerce.number().min(0).max(100).optional().default(20),
    items: z
      .array(
        z
          .object({
            designation: str(1000),
            quantity: z.coerce.number().positive(),
            unit_price_ht: z.coerce.number().nonnegative(),
            catalog_article_id: optInt,
            reference: optStr(255),
            description: optStr(2000),
            unit: optStr(20),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

// ── Message Create ──
export const messageSchema = z
  .object({
    content: str(10000),
    type: z.enum(['text', 'file', 'system']).optional().default('text'),
  })
  .passthrough();
