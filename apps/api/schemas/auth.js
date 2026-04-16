import { z } from 'zod';

// ── Helpers ──
const email = z.string().email('Format email invalide').max(255).trim().toLowerCase();
const password = z.string().min(1, 'Mot de passe requis').max(128);
const name = z.string().min(1, 'Nom requis').max(100).trim();

// ── Register ──
export const registerSchema = z.object({
  email,
  name,
  password,
});

// ── Login ──
export const loginSchema = z.object({
  email,
  password,
});

// ── Forgot password ──
export const forgotPasswordSchema = z.object({
  email,
});

// ── Self reset password ──
export const selfResetPasswordSchema = z.object({
  email,
  name,
  newPassword: password.optional(),
});

// ── Check reset (OTP) ──
export const checkResetSchema = z.object({
  email,
  otp: z
    .string()
    .length(6, 'Code OTP à 6 chiffres')
    .regex(/^\d{6}$/, 'Code OTP invalide'),
});

// ── Set new password (after OTP) ──
export const setNewPasswordSchema = z.object({
  email,
  resetToken: z.string().min(1, 'Code de vérification requis').max(10),
  newPassword: password,
});

// ── Force login ──
export const forceLoginSchema = z.object({
  email,
  password,
});

// ── Change password (authenticated) ──
export const changePasswordSchema = z.object({
  currentPassword: password,
  newPassword: password,
});

// ── Access request (public) ──
export const accessRequestSchema = z.object({
  email,
  name,
});

// ── Check email (public) ──
export const checkEmailSchema = z.object({
  email,
});
