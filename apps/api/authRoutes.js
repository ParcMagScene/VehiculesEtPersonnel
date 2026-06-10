import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { AUDIT_ACTIONS, auditLog } from './auditLog.js';
import { authCache } from './cache.js';
import { isCaptchaEnabled, verifyCaptcha } from './captcha.js';
import db from './database.js';
import { getTransporter } from './emailService.js';
import logger from './logger.js';
import { validatePassword } from './passwordPolicy.js';
import {
  forceLoginSchema,
  forgotPasswordSchema,
  loginPinSchema,
  loginSchema,
  registerSchema,
  selfResetPasswordSchema,
  setPinSchema,
  suiviPersonalAuthSchema,
} from './schemas/auth.js';
import { validate } from './schemas/imports.js';
import { verifyPersonalCredentials } from './services/personalAuth.js';

// [AUTH] Nom du cookie JWT — paramétrable via COOKIE_NAME (défaut: auth_token).
// Permet d'éviter les collisions cross-port sur localhost (les cookies sont partagés
// entre tous les ports d'un même hôte). Configurer COOKIE_NAME=auth_token_dev en dev.
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token';

export function setupAuthRoutes(app, authenticateToken, { JWT_SECRET, JWT_EXPIRY_DAYS, isDev }) {
  // Options cookie httpOnly pour les tokens JWT
  // secure=true seulement si les clients accèdent via HTTPS
  // Détection via COOKIE_SECURE env (défaut: false car le frontend Vite preview sert en HTTP)
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  // Inscription
  app.post('/api/auth/register', validate(registerSchema), async (req, res) => {
    try {
      const { email, name, password } = req.body;

      // [AUDIT FIX HIGH-2] Validation mot de passe renforcée
      const pwError = validatePassword(password);
      if (pwError) {
        return res.status(400).json({ success: false, error: pwError });
      }

      // Vérifier si l'email est autorisé
      const authStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = ?');
      const authorized = authStmt.get(email, 'pending');

      if (!authorized) {
        return res
          .status(403)
          .json({ success: false, error: 'Email non autorisé. Contactez un administrateur.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Utiliser le flag is_admin de authorized_emails (ou 0 par défaut)
      const isAdmin = authorized.is_admin || 0;
      const stmt = db.prepare(
        'INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, ?)',
      );
      const result = stmt.run(email, name, passwordHash, isAdmin);

      // Marquer l'email comme activé
      const updateStmt = db.prepare(
        'UPDATE authorized_emails SET status = ?, activated_at = CURRENT_TIMESTAMP WHERE email = ?',
      );
      updateStmt.run('activated', email);

      logger.info('✅ Nouvel utilisateur enregistré');
      auditLog({
        actorId: result.lastInsertRowid,
        actorEmail: email,
        action: AUDIT_ACTIONS.REGISTER,
        targetType: 'user',
        targetId: result.lastInsertRowid,
        details: { name, isAdmin: isAdmin === 1 },
        req,
      });

      res.status(201).json({ id: result.lastInsertRowid, email, name, isAdmin: isAdmin === 1 });
    } catch (error) {
      logger.error(error);
      res.status(400).json({ success: false, error: "Erreur lors de l'inscription" });
    }
  });

  // Mot de passe oublié (self-service) — [AUDIT FIX CRIT-1] Envoie OTP par email
  app.post('/api/auth/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email requis' });
      }

      const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);
      if (user) {
        // Générer OTP et l'envoyer par email
        const otp = String(crypto.randomInt(100000, 999999));
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        db.prepare(
          'UPDATE users SET password_reset_required = 1, reset_token_hash = ?, reset_token_expires = ? WHERE id = ?',
        ).run(otpHash, expiresAt, user.id);
        db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(user.id);

        const { transporter, emailConfig } = getTransporter();
        if (transporter && emailConfig?.enabled) {
          try {
            await transporter.sendMail({
              from: `"${emailConfig.from_name || 'eM@g'}" <${emailConfig.smtp_user}>`,
              to: user.email,
              subject: '[eM@g] Code de réinitialisation de mot de passe',
              html: `
              <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #2563eb;">🔑 Réinitialisation de mot de passe</h2>
                <p>Bonjour <strong>${user.name}</strong>,</p>
                <p>Votre code de vérification est :</p>
                <div style="background: #f0f4ff; border: 2px solid #2563eb; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${otp}</span>
                </div>
                <p><strong>Ce code expire dans 15 minutes.</strong></p>
                <p style="color: #666; font-size: 12px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
              </div>
            `,
            });
          } catch (emailErr) {
            logger.warn('Erreur envoi OTP email:', emailErr.message);
          }
        }
        if (isDev) {
          logger.info(`DEV OTP pour ${user.email}: ${otp.slice(0, 2)}****`);
        }
        logger.info('🔑 Mot de passe oublié — OTP généré');
      }

      // Toujours retourner le même message (ne pas révéler si l'email existe)
      res.json({
        message:
          'Si cette adresse correspond à un compte, un code de vérification a été envoyé par email.',
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Réinitialisation du mot de passe (self-service)
  //
  // ⚠️ ACCEPTATION DE RISQUE EXPLICITE (CWE-640 / OWASP A07)
  // Sur demande utilisateur, ce endpoint accepte un reset DIRECT email + newPassword
  // sans facteur de vérification (pas d'OTP, pas de magic link). Toute personne
  // connaissant l'email d'un compte peut réinitialiser son mot de passe.
  // Mitigations en place :
  //   - rate-limit strict (3 tentatives / 15 min / IP) configuré dans server.js
  //   - CAPTCHA Cloudflare Turnstile si TURNSTILE_SECRET_KEY défini (mandat sécurité)
  //   - validation password policy (validatePassword)
  //   - audit log systématique (PASSWORD_RESET_REQUEST + PASSWORD_RESET_COMPLETE
  //     + PASSWORD_RESET_NOTIFICATION + CAPTCHA_FAILED)
  //   - email de notification automatique au compte cible après reset réussi
  //   - invalidation de toutes les sessions actives de l'utilisateur cible
  //   - hash bcrypt du nouveau mot de passe
  // Si `newPassword` est absent du payload → fallback sur le flow OTP historique.
  app.post('/api/auth/self-reset-password', validate(selfResetPasswordSchema), async (req, res) => {
    try {
      const { email, newPassword } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email requis' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        // Message générique pour ne pas révéler si le compte existe
        return res.status(400).json({
          success: false,
          error: 'Aucun compte associé à cette adresse email',
        });
      }

      // ── BRANCHE A : reset DIRECT (newPassword fourni) ────────────────────
      if (typeof newPassword === 'string' && newPassword.length > 0) {
        // [SECURITY] CAPTCHA obligatoire si activé via env
        if (isCaptchaEnabled()) {
          const captchaRes = await verifyCaptcha(req.body?.captchaToken, req.ip);
          if (!captchaRes.ok) {
            auditLog({
              actorId: user.id,
              actorEmail: user.email,
              action: AUDIT_ACTIONS.CAPTCHA_FAILED,
              targetType: 'user',
              targetId: user.id,
              details: { route: 'self-reset-password', reason: captchaRes.reason },
              req,
            });
            return res.status(400).json({
              success: false,
              error: 'Vérification anti-robot échouée. Réessayez.',
            });
          }
        }

        const pwError = validatePassword(newPassword);
        if (pwError) {
          auditLog({
            actorId: user.id,
            actorEmail: user.email,
            action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
            targetType: 'user',
            targetId: user.id,
            details: { mode: 'direct', outcome: 'weak_password' },
            req,
          });
          return res.status(400).json({ success: false, error: pwError });
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        db.prepare(
          'UPDATE users SET password = ?, password_reset_required = 0, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
        ).run(hashed, user.id);
        // Invalider toutes les sessions actives (force re-login partout)
        db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(user.id);
        // Invalider le cache d'auth pour cet utilisateur
        try {
          authCache?.del?.(`user:${user.id}`);
        } catch (_) {
          // cache best-effort
        }

        auditLog({
          actorId: user.id,
          actorEmail: user.email,
          action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETE,
          targetType: 'user',
          targetId: user.id,
          details: {
            mode: 'direct_no_otp',
            sessions_invalidated: true,
            captcha: isCaptchaEnabled() ? 'verified' : 'disabled',
          },
          req,
        });

        logger.warn(
          `🔓 [CWE-640 ACCEPTÉ] Reset direct sans OTP pour user ${user.id} (${user.email}) depuis IP ${req.ip}`,
        );

        // [SECURITY] Notification email post-reset (best-effort, non-bloquant)
        // Permet au légitime propriétaire du compte de détecter un reset abusif.
        try {
          const { transporter, emailConfig } = getTransporter();
          if (transporter && emailConfig?.enabled) {
            const ipDisplay = req.ip || 'inconnue';
            const uaDisplay = String(req.get?.('user-agent') || 'inconnu').slice(0, 200);
            const whenDisplay = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
            await transporter.sendMail({
              from: `"${emailConfig.from_name || 'eM@g'}" <${emailConfig.smtp_user}>`,
              to: user.email,
              subject: "[eM@g] ⚠️ Votre mot de passe vient d'être réinitialisé",
              html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
                <h2 style="color: #dc2626;">⚠️ Réinitialisation de mot de passe</h2>
                <p>Bonjour <strong>${user.name}</strong>,</p>
                <p>Le mot de passe de votre compte <strong>${user.email}</strong> vient d'être réinitialisé.</p>
                <table style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin: 16px 0; width: 100%;">
                  <tr><td style="padding: 4px 8px;"><strong>Date</strong></td><td style="padding: 4px 8px;">${whenDisplay}</td></tr>
                  <tr><td style="padding: 4px 8px;"><strong>Adresse IP</strong></td><td style="padding: 4px 8px;">${ipDisplay}</td></tr>
                  <tr><td style="padding: 4px 8px;"><strong>Navigateur</strong></td><td style="padding: 4px 8px;">${uaDisplay}</td></tr>
                </table>
                <p style="margin-top: 16px;"><strong>Si vous êtes à l'origine de ce changement</strong>, aucune action n'est nécessaire.</p>
                <p style="color: #b91c1c;"><strong>Si ce n'était pas vous</strong>, contactez immédiatement un administrateur — toutes vos sessions actives ont déjà été déconnectées.</p>
                <p style="color: #666; font-size: 12px; margin-top: 24px;">Email automatique — ne pas répondre.</p>
              </div>
            `,
            });
            auditLog({
              actorId: user.id,
              actorEmail: user.email,
              action: AUDIT_ACTIONS.PASSWORD_RESET_NOTIFICATION,
              targetType: 'user',
              targetId: user.id,
              details: { sent: true },
              req,
            });
          }
        } catch (notifErr) {
          logger.warn(`Notification post-reset non envoyée: ${notifErr.message}`);
        }

        return res.json({
          success: true,
          message: 'Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe.',
        });
      }

      // ── BRANCHE B : flow OTP historique (newPassword absent) ──────────────
      // [SECURITY] OTP obligatoire — générer et envoyer par email
      const otp = String(crypto.randomInt(100000, 999999));
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

      // Stocker le hash OTP + expiration en DB
      db.prepare(
        'UPDATE users SET password_reset_required = 1, reset_token_hash = ?, reset_token_expires = ? WHERE id = ?',
      ).run(otpHash, expiresAt, user.id);

      // Fermer toutes les sessions existantes pour forcer la re-connexion
      db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(user.id);

      // Envoyer l'OTP par email
      const { transporter, emailConfig } = getTransporter();
      if (transporter && emailConfig?.enabled) {
        try {
          await transporter.sendMail({
            from: `"${emailConfig.from_name || 'eM@g'}" <${emailConfig.smtp_user}>`,
            to: user.email,
            subject: '[eM@g] Code de réinitialisation de mot de passe',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #2563eb;">🔑 Réinitialisation de mot de passe</h2>
              <p>Bonjour <strong>${user.name}</strong>,</p>
              <p>Votre code de vérification est :</p>
              <div style="background: #f0f4ff; border: 2px solid #2563eb; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${otp}</span>
              </div>
              <p><strong>Ce code expire dans 15 minutes.</strong></p>
              <p style="color: #666; font-size: 12px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            </div>
          `,
          });
          logger.info(`🔑 OTP envoyé par email pour user ${user.id}`);
        } catch (emailErr) {
          logger.warn('Erreur envoi OTP email:', emailErr.message);
        }
      } else {
        logger.warn(
          `🔑 OTP généré pour user ${user.id} mais email non configuré. OTP (dev): ${isDev ? otp.slice(0, 2) + '****' : '[masqué]'}`,
        );
      }

      if (isDev) {
        logger.info(`DEV OTP pour ${user.email}: ${otp.slice(0, 2)}****`);
      }

      res.json({
        success: true,
        message: 'Un code de vérification a été envoyé à votre adresse email.',
        requireOtp: true,
        email: user.email,
      });
    } catch (error) {
      logger.error('Erreur self-reset-password:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Connexion
  app.post('/api/auth/login', validate(loginSchema), async (req, res) => {
    try {
      const { email, password } = req.body;

      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email);

      if (!user) {
        auditLog({
          actorId: null,
          actorEmail: email,
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          targetType: 'user',
          targetId: null,
          details: { reason: 'unknown_email' },
          req,
        });
        return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
      }

      // Vérifier si le compte est bloqué
      if (user.is_blocked) {
        auditLog({
          actorId: user.id,
          actorEmail: email,
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          targetType: 'user',
          targetId: user.id,
          details: { reason: 'account_blocked' },
          req,
        });
        return res.status(403).json({
          success: false,
          error: 'Votre compte a été bloqué. Veuillez contacter un administrateur.',
        });
      }

      // Vérifier si une réinitialisation est requise AVANT de vérifier le mot de passe
      // (l'utilisateur a probablement oublié son ancien mot de passe)
      if (user.password_reset_required === 1) {
        return res.status(403).json({
          error: 'PASSWORD_RESET_REQUIRED',
          message: 'Votre compte a été réinitialisé. Vous devez définir un nouveau mot de passe.',
          userId: user.id,
          email: user.email,
        });
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        auditLog({
          actorId: user.id,
          actorEmail: email,
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          targetType: 'user',
          targetId: user.id,
          details: { reason: 'wrong_password' },
          req,
        });
        return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
      }

      logger.info('✅ Authentification réussie');

      // Vérifier que l'email est autorisé
      const authorizedEmailStmt = db.prepare(
        "SELECT * FROM authorized_emails WHERE email = ? AND status = 'activated'",
      );
      const authorizedEmail = authorizedEmailStmt.get(email);

      if (!authorizedEmail) {
        return res.status(403).json({
          error: 'EMAIL_NOT_AUTHORIZED',
          message:
            "Votre email n'est pas autorisé à accéder à cette application. Veuillez contacter un administrateur.",
        });
      }

      // PERMETTRE LES SESSIONS MULTIPLES (max 10 par utilisateur)
      // [AUDIT FIX C2] Limite de sessions pour éviter l'accumulation
      const MAX_SESSIONS_PER_USER = 10;

      // Parser les permissions pour la réponse API (pas dans le JWT)
      let perms = {};
      try {
        perms = user.permissions ? JSON.parse(user.permissions) : {};
      } catch {
        perms = {};
      }

      // [SEC] JWT minimal — permissions résolues côté serveur via DB
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: `${JWT_EXPIRY_DAYS}d`,
      });

      // Enregistrer la session
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
      const expiresAt = new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const insertSessionStmt = db.prepare(`
      INSERT INTO active_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `);
      insertSessionStmt.run(user.id, tokenHash, expiresAt);

      // Supprimer les sessions les plus anciennes si la limite est dépassée
      const sessionCount = db
        .prepare('SELECT COUNT(*) as cnt FROM active_sessions WHERE user_id = ?')
        .get(user.id).cnt;
      if (sessionCount > MAX_SESSIONS_PER_USER) {
        db.prepare(
          `DELETE FROM active_sessions WHERE id IN (
        SELECT id FROM active_sessions WHERE user_id = ? ORDER BY last_activity ASC, expires_at ASC LIMIT ?
      )`,
        ).run(user.id, sessionCount - MAX_SESSIONS_PER_USER);
      }
      auditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        targetType: 'session',
        targetId: user.id,
        req,
      });

      // [AUDIT Phase 3] Token envoyé en cookie httpOnly (plus sûr que localStorage)
      res.cookie(COOKIE_NAME, token, cookieOptions);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.is_admin === 1,
          isTeam: user.is_team === 1,
          avatar: user.avatar || null,
          permissions: perms,
        },
        requires2FA: user.totp_enabled === 1,
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Forcer une nouvelle connexion en fermant les sessions actives
  app.post('/api/auth/force-login', validate(forceLoginSchema), async (req, res) => {
    try {
      const { email, password } = req.body;

      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email);

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
      }

      // Vérifier que l'email est autorisé
      const authorizedEmailStmt = db.prepare(
        "SELECT * FROM authorized_emails WHERE email = ? AND status = 'activated'",
      );
      const authorizedEmail = authorizedEmailStmt.get(email);

      if (!authorizedEmail) {
        return res.status(403).json({
          error: 'EMAIL_NOT_AUTHORIZED',
          message:
            "Votre email n'est pas autorisé à accéder à cette application. Veuillez contacter un administrateur.",
        });
      }

      // Supprimer toutes les sessions actives de cet utilisateur
      const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      deleteSessionsStmt.run(user.id);

      // Parser les permissions pour la réponse API
      let forcePerms = {};
      try {
        forcePerms = user.permissions ? JSON.parse(user.permissions) : {};
      } catch {
        forcePerms = {};
      }

      // [SEC] JWT minimal — permissions résolues côté serveur via DB
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: `${JWT_EXPIRY_DAYS}d`,
      });

      // Enregistrer la nouvelle session
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
      const expiresAt = new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const insertSessionStmt = db.prepare(`
      INSERT INTO active_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `);
      insertSessionStmt.run(user.id, tokenHash, expiresAt);
      auditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        targetType: 'session',
        targetId: user.id,
        details: { forceLogin: true },
        req,
      });

      // [AUDIT Phase 3] Token envoyé en cookie httpOnly
      res.cookie(COOKIE_NAME, token, cookieOptions);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.is_admin === 1,
          isTeam: user.is_team === 1,
          avatar: user.avatar || null,
          permissions: forcePerms,
        },
        requires2FA: user.totp_enabled === 1,
        message: 'Toutes les autres sessions ont été fermées',
      });
    } catch (error) {
      logger.error('Erreur force-login:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Déconnexion (nettoyer la session)
  app.post('/api/auth/logout', authenticateToken, (req, res) => {
    try {
      const userId = req.user.id;

      // Supprimer toutes les sessions de cet utilisateur
      const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      const result = deleteSessionsStmt.run(userId);

      // [PERF] Invalider le cache auth pour forcer re-vérification DB
      authCache.clear();

      logger.info(`🚪 Déconnexion: ${result.changes} session(s) fermée(s)`);
      auditLog({
        actorId: userId,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.LOGOUT,
        targetType: 'session',
        targetId: userId,
        details: { sessionsClosed: result.changes },
        req,
      });

      // [AUDIT Phase 3] Effacer le cookie httpOnly
      res.clearCookie(COOKIE_NAME, { path: '/' });
      res.json({ success: true, message: 'Déconnexion réussie', sessionsClosed: result.changes });
    } catch (error) {
      logger.error('Erreur logout:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Liste publique des utilisateurs (pour le sélecteur de connexion)
  // ⚠️  DESIGN DECISION: email exposé volontairement pour le pré-remplissage du champ login
  // Protégé par le generalLimiter (600 req/min). Pas de password_hash ni données sensibles.
  app.get('/api/auth/users-public', (req, res) => {
    try {
      const stmt = db.prepare('SELECT id, name, email, avatar FROM users ORDER BY name');
      const users = stmt.all();
      res.json(
        users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar || null,
        })),
      );
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ── Renouvellement silencieux du token JWT ──
  // Le client appelle ce endpoint périodiquement pour obtenir un nouveau token
  // sans déconnecter l'utilisateur. La session DB reste la même.
  app.post('/api/auth/refresh', authenticateToken, (req, res) => {
    try {
      const userId = req.user.id;
      logger.info(`🔄 Refresh token demandé pour user ${userId}`);

      // Récupérer les infos fraîches depuis la DB (permissions, nom, avatar peuvent avoir changé)
      const user = db
        .prepare('SELECT id, email, name, is_admin, avatar, permissions FROM users WHERE id = ?')
        .get(userId);
      if (!user) {
        logger.warn(`🔄 Refresh échoué: user ${userId} introuvable en DB`);
        return res.status(401).json({ success: false, error: 'Utilisateur introuvable' });
      }

      // Récupérer le hash du token actuel pour mettre à jour la session
      const authHeader = req.headers['authorization'];
      const currentToken = (authHeader && authHeader.split(' ')[1]) || req.cookies?.[COOKIE_NAME];
      const oldTokenHash = crypto
        .createHash('sha256')
        .update(currentToken)
        .digest('hex')
        .substring(0, 64);

      // Parser les permissions pour la réponse API
      let perms = {};
      try {
        perms = user.permissions ? JSON.parse(user.permissions) : {};
      } catch {
        perms = {};
      }

      // [SEC] JWT minimal — permissions résolues côté serveur via DB
      const newToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: `${JWT_EXPIRY_DAYS}d`,
      });

      // Mettre à jour la session : nouveau hash + nouvelle expiration + last_activity
      const newTokenHash = crypto
        .createHash('sha256')
        .update(newToken)
        .digest('hex')
        .substring(0, 64);
      const newExpiresAt = new Date(
        Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const updated = db
        .prepare(
          'UPDATE active_sessions SET token_hash = ?, expires_at = ?, last_activity = CURRENT_TIMESTAMP WHERE token_hash = ?',
        )
        .run(newTokenHash, newExpiresAt, oldTokenHash);

      if (updated.changes === 0) {
        logger.warn(
          `🔄 Refresh échoué: session introuvable pour user ${userId} (old hash prefix: ${oldTokenHash.substring(0, 8)}…)`,
        );
        return res.status(401).json({ success: false, error: 'Session introuvable' });
      }

      // Invalider le cache pour l'ancien token hash
      authCache.invalidate(oldTokenHash);

      // Envoyer le nouveau cookie
      res.cookie(COOKIE_NAME, newToken, cookieOptions);
      logger.info(`🔄 Refresh réussi pour user ${userId}`);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.is_admin === 1,
          isTeam: user.is_team === 1,
          avatar: user.avatar || null,
          permissions: perms,
        },
      });
    } catch (error) {
      logger.error('Erreur refresh token:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ── Connexion par code PIN ──────────────────────────────────────────────────
  app.post('/api/auth/login-pin', validate(loginPinSchema), async (req, res) => {
    try {
      const { email, pin } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

      if (!user || !user.pin_hash) {
        return res.status(401).json({ success: false, error: 'Code PIN incorrect' });
      }
      if (user.is_blocked) {
        return res.status(403).json({ success: false, error: 'Votre compte a été bloqué.' });
      }

      const pinMatch = await bcrypt.compare(pin, user.pin_hash);
      if (!pinMatch) {
        auditLog({
          actorId: user.id,
          actorEmail: user.email,
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          targetType: 'user',
          targetId: user.id,
          details: { reason: 'wrong_pin' },
          req,
        });
        return res.status(401).json({ success: false, error: 'Code PIN incorrect' });
      }

      // Vérifier email autorisé
      const authorized = db
        .prepare("SELECT * FROM authorized_emails WHERE email = ? AND status = 'activated'")
        .get(email);
      if (!authorized) {
        return res
          .status(403)
          .json({ error: 'EMAIL_NOT_AUTHORIZED', message: 'Email non autorisé.' });
      }

      let perms = {};
      try {
        perms = user.permissions ? JSON.parse(user.permissions) : {};
      } catch {
        perms = {};
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: `${JWT_EXPIRY_DAYS}d`,
      });
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
      const expiresAt = new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        'INSERT INTO active_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      ).run(user.id, tokenHash, expiresAt);

      // Nettoyer les vieilles sessions (max 10)
      const cnt = db
        .prepare('SELECT COUNT(*) as cnt FROM active_sessions WHERE user_id = ?')
        .get(user.id).cnt;
      if (cnt > 10) {
        db.prepare(
          'DELETE FROM active_sessions WHERE id IN (SELECT id FROM active_sessions WHERE user_id = ? ORDER BY last_activity ASC LIMIT ?)',
        ).run(user.id, cnt - 10);
      }

      auditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        targetType: 'session',
        targetId: user.id,
        details: { method: 'pin' },
        req,
      });

      res.cookie(COOKIE_NAME, token, cookieOptions);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.is_admin === 1,
          isTeam: user.is_team === 1,
          avatar: user.avatar || null,
          permissions: perms,
        },
      });
    } catch (error) {
      logger.error('Erreur login-pin:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ── Définir / modifier son code PIN ────────────────────────────────────────
  app.put('/api/auth/me/pin', authenticateToken, validate(setPinSchema), async (req, res) => {
    try {
      const userId = req.user.id;
      const { pin, currentPassword, currentPin } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

      if (!user) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });

      // Vérifier l'identité : soit le mot de passe actuel, soit le PIN actuel
      if (user.pin_hash) {
        // Il a déjà un PIN — doit fournir currentPin ou currentPassword pour le changer
        let verified = false;
        if (currentPin) {
          verified = await bcrypt.compare(currentPin, user.pin_hash);
        } else if (currentPassword) {
          verified = await bcrypt.compare(currentPassword, user.password_hash);
        }
        if (!verified) {
          return res.status(401).json({
            success: false,
            error: 'Vérification échouée — code PIN ou mot de passe incorrect',
          });
        }
      } else {
        // Pas encore de PIN — doit fournir le mot de passe
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            error: 'Le mot de passe actuel est requis pour définir un code PIN',
          });
        }
        const pwOk = await bcrypt.compare(currentPassword, user.password_hash);
        if (!pwOk) {
          return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
        }
      }

      const pinHash = await bcrypt.hash(pin, 10);
      db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pinHash, userId);

      logger.info(`🔐 PIN mis à jour pour user ${userId}`);
      res.json({ success: true, message: 'Code PIN mis à jour' });
    } catch (error) {
      logger.error('Erreur set-pin:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ── Supprimer le code PIN ───────────────────────────────────────────────────
  app.delete('/api/auth/me/pin', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      db.prepare('UPDATE users SET pin_hash = NULL WHERE id = ?').run(userId);
      logger.info(`🔐 PIN supprimé pour user ${userId}`);
      res.json({ success: true, message: 'Code PIN supprimé' });
    } catch (error) {
      logger.error('Erreur delete-pin:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ── Statut PIN (a-t-on un PIN ?) ───────────────────────────────────────────
  app.get('/api/auth/me/pin-status', authenticateToken, (req, res) => {
    try {
      const user = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(req.user.id);
      res.json({ hasPin: !!user?.pin_hash });
    } catch (error) {
      logger.error('Erreur pin-status:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ── Auth personnelle pour compte Equipe → accès Suivi ─────────────────────
  // Utilisé quand le compte commun@magsav.com veut accéder à une fiche de suivi
  // Vérifie le PIN ou mot de passe du user lié à la personne
  app.post(
    '/api/suivi/personal-auth',
    authenticateToken,
    validate(suiviPersonalAuthSchema),
    async (req, res) => {
      try {
        const { personId, pin, password } = req.body;
        const result = await verifyPersonalCredentials({ db, personId, pin, password });
        if (!result.ok) {
          return res.status(result.status).json({ success: false, error: result.error });
        }
        logger.info(`🔐 Auth suivi réussie: personne ${personId} (user ${result.user.id})`);
        res.json({
          success: true,
          person: {
            id: result.person.id,
            first_name: result.person.first_name,
            last_name: result.person.last_name,
          },
        });
      } catch (error) {
        logger.error('Erreur personal-auth:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );
} // end setupAuthRoutes
