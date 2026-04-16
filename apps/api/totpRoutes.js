// ═══════════════════════════════════════════════════════════════
// totpRoutes.js — Routes 2FA/TOTP pour les administrateurs
// [AUDIT FIX C5] Authentification forte pour les opérations admin
// ═══════════════════════════════════════════════════════════════

import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import db from './database.js';
import logger from './logger.js';
import { auditLog, AUDIT_ACTIONS } from './auditLog.js';

const TOTP_ISSUER = 'eM@g';

/**
 * Génère un secret TOTP et un QR code pour l'enrôlement
 */
function generateTOTPSecret(email) {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

/**
 * Vérifie un code TOTP
 */
function verifyTOTPCode(secret, code) {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // window=1 autorise ±1 période (±30s) pour tolérer les décalages d'horloge
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export function setupTOTPRoutes(app, authenticateToken, requireAdmin) {
  // ─── Étape 1 : Initier le setup 2FA (génère secret + QR) ───
  app.post('/api/auth/2fa/setup', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const user = db
        .prepare('SELECT id, email, totp_enabled FROM users WHERE id = ?')
        .get(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
      }

      if (user.totp_enabled === 1) {
        return res.status(400).json({
          success: false,
          error: "2FA déjà activé. Désactivez-le d'abord pour le reconfigurer.",
        });
      }

      const { secret, uri } = generateTOTPSecret(user.email);

      // Stocker le secret temporairement (pas encore confirmé)
      db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, user.id);

      // Générer le QR code en data URL
      const qrDataUrl = await QRCode.toDataURL(uri);

      res.json({
        secret,
        qrCode: qrDataUrl,
        message:
          "Scannez le QR code avec votre application d'authentification (Google Authenticator, Authy, etc.), puis confirmez avec un code.",
      });
    } catch (error) {
      logger.error('Erreur setup 2FA:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── Étape 2 : Confirmer l'activation 2FA avec un code valide ───
  app.post('/api/auth/2fa/confirm', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, error: 'Code de vérification requis' });
      }

      const user = db
        .prepare('SELECT id, email, totp_secret, totp_enabled FROM users WHERE id = ?')
        .get(req.user.id);
      if (!user || !user.totp_secret) {
        return res.status(400).json({
          success: false,
          error: "Aucun setup 2FA en cours. Lancez /api/auth/2fa/setup d'abord.",
        });
      }

      if (user.totp_enabled === 1) {
        return res.status(400).json({ success: false, error: '2FA déjà activé.' });
      }

      if (!verifyTOTPCode(user.totp_secret, code)) {
        return res.status(400).json({
          success: false,
          error: "Code invalide. Vérifiez l'heure de votre appareil et réessayez.",
        });
      }

      db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
      auditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: 'security.2fa.enabled',
        targetType: 'user',
        targetId: user.id,
        req,
      });

      logger.info(`🔐 2FA activé pour ${user.email}`);
      res.json({ success: true, message: '2FA activé avec succès.' });
    } catch (error) {
      logger.error('Erreur confirm 2FA:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── Désactiver le 2FA ───
  app.post('/api/auth/2fa/disable', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res
          .status(400)
          .json({ success: false, error: 'Code TOTP requis pour désactiver le 2FA' });
      }

      const user = db
        .prepare('SELECT id, email, totp_secret, totp_enabled FROM users WHERE id = ?')
        .get(req.user.id);
      if (!user || user.totp_enabled !== 1) {
        return res.status(400).json({ success: false, error: '2FA non activé.' });
      }

      if (!verifyTOTPCode(user.totp_secret, code)) {
        return res.status(400).json({ success: false, error: 'Code invalide.' });
      }

      db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(user.id);
      auditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: 'security.2fa.disabled',
        targetType: 'user',
        targetId: user.id,
        req,
      });

      logger.info(`🔓 2FA désactivé pour ${user.email}`);
      res.json({ success: true, message: '2FA désactivé.' });
    } catch (error) {
      logger.error('Erreur disable 2FA:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── Statut 2FA ───
  app.get('/api/auth/2fa/status', authenticateToken, (req, res) => {
    try {
      const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.id);
      res.json({ enabled: user?.totp_enabled === 1 });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ─── Vérification 2FA au login (appelé après login classique si 2FA activé) ───
  app.post('/api/auth/2fa/verify', authenticateToken, (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, error: 'Code TOTP requis' });
      }

      const user = db
        .prepare('SELECT id, email, totp_secret, totp_enabled FROM users WHERE id = ?')
        .get(req.user.id);
      if (!user || user.totp_enabled !== 1) {
        return res.json({ success: true, message: '2FA non requis.' });
      }

      if (!verifyTOTPCode(user.totp_secret, code)) {
        auditLog({
          actorId: user.id,
          actorEmail: user.email,
          action: 'security.2fa.verify_failed',
          targetType: 'user',
          targetId: user.id,
          req,
        });
        return res.status(401).json({ success: false, error: 'Code 2FA invalide.' });
      }

      auditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: 'security.2fa.verify_success',
        targetType: 'user',
        targetId: user.id,
        req,
      });
      res.json({ success: true, message: '2FA vérifié.' });
    } catch (error) {
      logger.error('Erreur verify 2FA:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });
}

export { verifyTOTPCode };
