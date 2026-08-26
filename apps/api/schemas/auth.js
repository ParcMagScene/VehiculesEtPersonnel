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
// `name` rendu optionnel : la réinitialisation se base uniquement sur l'email
// (compte autorisé) et l'OTP envoyé par email. Plus simple côté utilisateur.
export const selfResetPasswordSchema = z.object({
  email,
  name: name.optional(),
  newPassword: password.optional(),
  captchaToken: z.string().min(1).optional(),
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

// ── Login par PIN ──
export const loginPinSchema = z.object({
  email,
  pin: z
    .string()
    .length(4, 'Le code PIN doit contenir exactement 4 chiffres')
    .regex(/^\d{4}$/, 'Le code PIN doit contenir uniquement des chiffres'),
});

// ── Définir / modifier le PIN ──
export const setPinSchema = z.object({
  pin: z
    .string()
    .length(4, 'Le code PIN doit contenir exactement 4 chiffres')
    .regex(/^\d{4}$/, 'Le code PIN doit contenir uniquement des chiffres'),
  // Pour les utilisateurs qui utilisent un mot de passe, confirmation requise
  currentPassword: password.optional(),
  currentPin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/)
    .optional(),
});

// ── Auth personnel (compte Equipe → accès suivi) ──
export const suiviPersonalAuthSchema = z.object({
  personId: z.number().int().positive(),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/)
    .optional(),
  password: password.optional(),
});

// ── Auth éphémère pour actions personnelles via compte Equipe ──
// Le compte commun@magsav.com authentifie ponctuellement un personnel
// (PIN ou mot de passe) pour exécuter une action en son nom, sans
// changer de session.
export const personalActionPerformSchema = z
  .object({
    personId: z.number().int().positive(),
    pin: z
      .string()
      .length(4)
      .regex(/^\d{4}$/)
      .optional(),
    password: password.optional(),
    actionType: z.enum(['create_assignment', 'request_leave', 'declare_unavailability']),
    payload: z.record(z.string(), z.unknown()),
  })
  .refine((data) => Boolean(data.pin) || Boolean(data.password), {
    message: 'Code PIN ou mot de passe requis',
    path: ['pin'],
  });
