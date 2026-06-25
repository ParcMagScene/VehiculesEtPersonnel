import { z } from 'zod';

const trimmed = (max = 255) => z.string().trim().max(max);
const optionalTrimmed = (max = 255) => z.string().trim().max(max).optional().nullable();
const optionalNumber = z.coerce.number().optional().nullable();

export const eshopProductIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const eshopProductSupplierIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const eshopProductCompareParamsSchema = eshopProductIdParamsSchema;

export const eshopProductListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});

export const eshopProductUpsertSchema = z.object({
  name: trimmed(255).min(1),
  description: optionalTrimmed(5000),
  category: optionalTrimmed(100),
  image_url: optionalTrimmed(2048),
  notes: optionalTrimmed(5000),
});

export const eshopProductSupplierCreateSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  supplier_id: optionalNumber,
  supplier_name: trimmed(255).min(1),
  supplier_ref: optionalTrimmed(255),
  price_ht: optionalNumber,
  external_url: optionalTrimmed(2048),
  shipping_policy: optionalTrimmed(50),
  shipping_flat_rate: optionalNumber,
  shipping_free_threshold: optionalNumber,
  notes: optionalTrimmed(5000),
});

export const eshopProductSupplierUpdateSchema = z.object({
  supplier_id: optionalNumber,
  supplier_name: trimmed(255).min(1),
  supplier_ref: optionalTrimmed(255),
  price_ht: optionalNumber,
  external_url: optionalTrimmed(2048),
  shipping_policy: optionalTrimmed(50),
  shipping_flat_rate: optionalNumber,
  shipping_free_threshold: optionalNumber,
  notes: optionalTrimmed(5000),
});

export const eshopQuotePdfSchema = z.object({
  title: z.string().trim().max(255).optional().default('Devis interne e-shops'),
  items: z
    .array(
      z.object({
        product_name: z.string().trim().max(255).optional().nullable(),
        supplier_name: z.string().trim().max(255).optional().nullable(),
        supplier_ref: z.string().trim().max(255).optional().nullable(),
        price_ht: z.coerce.number().optional().nullable(),
        shipping: z.coerce.number().optional().nullable(),
        total_ht: z.coerce.number().optional().nullable(),
        external_url: z.string().trim().max(2048).optional().nullable(),
        qty: z.coerce.number().int().min(1).max(9999).optional().default(1),
      }),
    )
    .max(500)
    .default([]),
});
