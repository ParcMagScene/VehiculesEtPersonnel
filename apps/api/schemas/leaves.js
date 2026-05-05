import { z } from 'zod';

const optStr = (max = 255) => z.string().max(max).trim().optional().or(z.literal('')).or(z.null());

// ── Add Holiday ──
export const holidaySchema = z.object({
  date: z.string().min(1, 'Date requise').max(30),
  name: z.string().min(1, 'Nom requis').max(255).trim(),
});

// ── Calculate Working Days ──
export const calculateSchema = z.object({
  startDate: z.string().min(1, 'Dates requises').max(30),
  endDate: z.string().min(1, 'Dates requises').max(30),
  startPeriod: z.enum(['AM', 'PM']).optional(),
  endPeriod: z.enum(['AM', 'PM']).optional(),
  leaveType: optStr(50),
  exceptionalType: optStr(50),
});

// ── Create Leave Request ──
export const leaveCreateSchema = z.object({
  personId: z.coerce.number().int().positive(),
  leaveType: z.string().min(1).max(50),
  exceptionalType: optStr(50),
  startDate: z.string().min(1).max(30),
  endDate: z.string().min(1).max(30),
  startPeriod: z.enum(['AM', 'PM']).optional(),
  endPeriod: z.enum(['AM', 'PM']).optional(),
  employeeComment: optStr(5000),
  signatureEmployee: optStr(50000),
});

// ── Leave Decision ──
export const leaveDecisionSchema = z.object({
  status: z.enum(['accepted', 'refused', 'modified']),
  adminComment: optStr(5000),
  modifiedStartDate: optStr(30),
  modifiedEndDate: optStr(30),
  signatureAdmin: optStr(50000),
});

// ── Leave Sign ──
export const leaveSignSchema = z.object({
  signature: z.string().min(1, 'Signature requise'),
  role: z.enum(['employee', 'admin']),
});

// ── Justification Upload ──
export const justificationSchema = z.object({
  filename: z.string().min(1, 'Fichier requis').max(255),
  data: z.string().min(1, 'Données requises'),
});

// ── Update Balance ──
export const balanceUpdateSchema = z.object({
  personId: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  type: optStr(50),
  daysEntitled: z.coerce.number().nonnegative().optional(),
});
