import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from './database.js';
import { alertAccessRequest, initEmailTransporter } from './emailService.js';
import logger from './logger.js';
import { getAllCacheStats, ALL_CACHES } from './cache.js';
import { encryptPassword, decryptPassword } from './videoProxyService.js';
import { validatePassword } from './passwordPolicy.js';
import { auditLog, AUDIT_ACTIONS } from './auditLog.js';
import { validate } from './schemas/imports.js';
import {
  accessRequestSchema,
  checkEmailSchema,
  changePasswordSchema,
  setNewPasswordSchema,
} from './schemas/auth.js';

export function setupAdminRoutes(
  app,
  authenticateToken,
  requireAdmin,
  { JWT_SECRET, JWT_EXPIRY_DAYS },
) {
  // Options cookie httpOnly pour les tokens JWT
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !process.env.ALLOW_HTTP,
    path: '/',
    maxAge: JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  // Réinitialiser le mot de passe d'un utilisateur
  app.post('/api/admin/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, newPassword } = req.body;
      // [AUDIT FIX HIGH-2] Politique de mot de passe renforcée
      const pwError = validatePassword(newPassword);
      if (pwError) {
        return res.status(400).json({ success: false, error: pwError });
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
      stmt.run(passwordHash, userId);
      auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
        targetType: 'user',
        targetId: userId,
        req,
      });
      res.json({ success: true });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // Changer son propre mot de passe
  app.post(
    '/api/auth/change-password',
    authenticateToken,
    validate(changePasswordSchema),
    async (req, res) => {
      try {
        const { currentPassword, newPassword } = req.body;

        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        const user = stmt.get(req.user.id);

        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
          return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect' });
        }

        // [AUDIT FIX HIGH-2] Politique de mot de passe renforcée
        const pwError = validatePassword(newPassword);
        if (pwError) {
          return res.status(400).json({ success: false, error: pwError });
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        updateStmt.run(passwordHash, req.user.id);
        auditLog({
          actorId: req.user.id,
          actorEmail: req.user.email,
          action: AUDIT_ACTIONS.PASSWORD_CHANGE,
          targetType: 'user',
          targetId: req.user.id,
          req,
        });

        res.json({ success: true });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, error: 'Erreur serveur interne' });
      }
    },
  );

  // ============ DEMANDES D'ACCÈS ============

  // Créer une demande d'accès (ou auto-approuver si email déjà autorisé)
  app.post('/api/access-requests', validate(accessRequestSchema), async (req, res) => {
    try {
      const { email, name } = req.body;

      if (!email || !name) {
        return res.status(400).json({ success: false, error: 'Email et nom requis' });
      }

      // Vérifier si l'email existe déjà en tant qu'utilisateur
      const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Cet email est déjà enregistré. Connectez-vous directement.',
        });
      }

      // Vérifier si l'email est déjà autorisé par un admin
      const authorizedEmail = db
        .prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = ?')
        .get(email, 'pending');

      if (authorizedEmail) {
        // Email déjà autorisé → l'utilisateur peut créer son mot de passe directement
        return res.json({
          success: true,
          autoApproved: true,
          message: 'Votre email est déjà autorisé ! Vous pouvez créer votre mot de passe.',
        });
      }

      // Vérifier si une demande est déjà en cours
      const existingRequest = db
        .prepare('SELECT * FROM access_requests WHERE email = ? AND status = ?')
        .get(email, 'pending');

      if (existingRequest) {
        return res
          .status(400)
          .json({ success: false, error: 'Une demande est déjà en cours pour cet email' });
      }

      // Créer la demande (email non autorisé → besoin approbation admin)
      const stmt = db.prepare(`
      INSERT INTO access_requests (email, name, status)
      VALUES (?, ?, 'pending')
    `);

      const result = stmt.run(email, name);

      // Alerte email aux admins
      alertAccessRequest(db, { name, email }).catch(() => {});

      res.json({
        success: true,
        autoApproved: false,
        message: "Un email d'activation vous sera envoyé après validation par un administrateur.",
        id: result.lastInsertRowid,
      });
    } catch (error) {
      logger.error("Erreur création demande d'accès:", error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Vérifier si un email est autorisé (pour le lien direct de création de compte)
  app.post('/api/access-requests/check-email', validate(checkEmailSchema), async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email requis' });
      }

      // Vérifier si déjà utilisateur
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return res.json({ authorized: false, reason: 'already_registered' });
      }

      // Vérifier si autorisé
      const authorized = db
        .prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = ?')
        .get(email, 'pending');

      // Récupérer le nom depuis la demande d'accès si elle existe
      let name = null;
      if (authorized) {
        const request = db
          .prepare(
            'SELECT name FROM access_requests WHERE email = ? ORDER BY created_at DESC LIMIT 1',
          )
          .get(email);
        name = request?.name || null;
      }

      res.json({ authorized: !!authorized, name });
    } catch (_error) {
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Lister les demandes d'accès (admin seulement)
  app.get('/api/access-requests', authenticateToken, requireAdmin, (req, res) => {
    try {
      const stmt = db.prepare(`
      SELECT ar.*, u.name as reviewed_by_name
      FROM access_requests ar
      LEFT JOIN users u ON ar.reviewed_by = u.id
      ORDER BY 
        CASE ar.status 
          WHEN 'pending' THEN 1 
          WHEN 'approved' THEN 2 
          WHEN 'rejected' THEN 3 
        END,
        ar.created_at DESC
    `);

      const requests = stmt.all();
      res.json(requests);
    } catch (error) {
      logger.error('Erreur récupération demandes:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Approuver/rejeter une demande (admin seulement)
  app.patch('/api/access-requests/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, is_admin } = req.body;

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Status invalide' });
      }

      // Récupérer la demande
      const request = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(id);
      if (!request) {
        return res.status(404).json({ success: false, error: 'Demande non trouvée' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ success: false, error: 'Cette demande a déjà été traitée' });
      }

      // Mettre à jour le statut
      const updateStmt = db.prepare(`
      UPDATE access_requests 
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

      updateStmt.run(status, req.user.id, id);

      // Si approuvée, créer l'email autorisé
      if (status === 'approved') {
        const authStmt = db.prepare(`
        INSERT INTO authorized_emails (email, status, is_admin)
        VALUES (?, 'pending', ?)
        ON CONFLICT(email) DO UPDATE SET is_admin = excluded.is_admin
      `);

        try {
          authStmt.run(request.email, is_admin ? 1 : 0);
          logger.info('✅ Email autorisé');
        } catch (error) {
          logger.error('Erreur ajout email autorisé:', error);
        }
      }

      auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action:
          status === 'approved'
            ? AUDIT_ACTIONS.ACCESS_REQUEST_APPROVE
            : AUDIT_ACTIONS.ACCESS_REQUEST_REJECT,
        targetType: 'access_request',
        targetId: id,
        details: { email: request.email, name: request.name },
        req,
      });
      res.json({
        success: true,
        message: `Demande ${status === 'approved' ? 'approuvée' : 'rejetée'}`,
        request: {
          email: request.email,
          name: request.name,
        },
      });
    } catch (error) {
      logger.error('Erreur traitement demande:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Compter les demandes en attente (admin)
  app.get('/api/access-requests/count/pending', authenticateToken, requireAdmin, (req, res) => {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM access_requests WHERE status = ?');
      const result = stmt.get('pending');
      res.json({ count: result.count });
    } catch (error) {
      logger.error('Erreur comptage demandes:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Compter les demandes en attente (interventions + réservations) pour badge admin
  app.get('/api/pending-requests-count', authenticateToken, requireAdmin, (req, res) => {
    try {
      const interventionStmt = db.prepare(
        "SELECT COUNT(*) as count FROM maintenances WHERE status IN ('pending', 'reported')",
      );
      const interventionResult = interventionStmt.get();

      const reservationStmt = db.prepare(
        "SELECT COUNT(*) as count FROM reservation_requests WHERE status = 'pending'",
      );
      const reservationResult = reservationStmt.get();

      res.json({
        interventionRequests: interventionResult.count,
        reservationRequests: reservationResult.count,
        total: interventionResult.count + reservationResult.count,
      });
    } catch (error) {
      logger.error('Erreur comptage demandes:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Récupérer les demandes de réservation en attente (pour le popup)
  app.get('/api/reservation-requests/pending', authenticateToken, requireAdmin, (req, res) => {
    try {
      const stmt = db.prepare(`
      SELECT rr.*, u.name as requester_name, v.name as vehicle_name, v.registration
      FROM reservation_requests rr
      LEFT JOIN users u ON rr.requested_by = u.id
      LEFT JOIN vehicles v ON rr.vehicle_id = v.id
      WHERE rr.status = 'pending'
      ORDER BY rr.requested_at DESC
    `);
      const requests = stmt.all();
      res.json(requests);
    } catch (error) {
      logger.error('Erreur récupération demandes:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============ GESTION DES EMAILS AUTORISÉS (ADMIN) ============

  // Récupérer tous les emails autorisés
  app.get('/api/authorized-emails', authenticateToken, requireAdmin, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM authorized_emails ORDER BY created_at DESC');
      const emails = stmt.all();
      res.json(emails);
    } catch (error) {
      logger.error('Erreur récupération emails:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Ajouter un email autorisé (admin)
  app.post('/api/authorized-emails', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email requis' });
      }

      // Vérifier si l'email existe déjà
      const checkStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ?');
      const existing = checkStmt.get(email);

      if (existing) {
        return res.status(400).json({ success: false, error: 'Cet email est déjà autorisé' });
      }

      const stmt = db.prepare('INSERT INTO authorized_emails (email, status) VALUES (?, ?)');
      const result = stmt.run(email, 'pending');
      auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.AUTHORIZED_EMAIL_ADD,
        targetType: 'email',
        targetId: result.lastInsertRowid,
        details: { email },
        req,
      });

      res.json({ id: result.lastInsertRowid, email, status: 'pending' });
    } catch (error) {
      logger.error('Erreur ajout email:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Supprimer un email autorisé (admin)
  app.delete('/api/authorized-emails/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const stmt = db.prepare('DELETE FROM authorized_emails WHERE id = ?');
      stmt.run(id);
      auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.AUTHORIZED_EMAIL_DELETE,
        targetType: 'email',
        targetId: id,
        req,
      });
      res.json({ success: true });
    } catch (error) {
      logger.error('Erreur suppression email:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // ============ GESTION DES UTILISATEURS (ADMIN) ============

  // Récupérer les noms des utilisateurs (tous les utilisateurs authentifiés)
  app.get('/api/users/names', authenticateToken, (req, res) => {
    try {
      const stmt = db.prepare('SELECT id, name, email, avatar FROM users ORDER BY name');
      const users = stmt.all();
      res.json(users);
    } catch (error) {
      logger.error('Erreur récupération noms utilisateurs:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Création directe d'un utilisateur par l'admin
  app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const {
        email,
        name,
        password,
        isAdmin = false,
        readOnly = false,
        permissions: rawPermissions,
      } = req.body;
      if (!email || !name || !password) {
        return res.status(400).json({ success: false, error: 'Email, nom et mot de passe requis' });
      }
      const pwError = validatePassword(password);
      if (pwError) return res.status(400).json({ success: false, error: pwError });

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing)
        return res
          .status(409)
          .json({ success: false, error: 'Un utilisateur avec cet email existe déjà' });

      const passwordHash = await bcrypt.hash(password, 12);
      // Construire les permissions : lecture seule OU permissions granulaires
      let permissions = {};
      if (readOnly) {
        permissions = { read_only: true };
      } else if (rawPermissions && typeof rawPermissions === 'object') {
        const allowedKeys = [
          'can_manage_vehicle_maintenance',
          'can_manage_equipment_maintenance',
          'can_manage_catalog',
          'can_manage_trucks',
          'read_only',
        ];
        for (const key of allowedKeys) {
          if (rawPermissions[key]) permissions[key] = true;
        }
      }
      const permissionsJson = JSON.stringify(permissions);

      const result = db
        .prepare(
          'INSERT INTO users (email, name, password_hash, is_admin, permissions) VALUES (?, ?, ?, ?, ?)',
        )
        .run(email, name.trim(), passwordHash, isAdmin ? 1 : 0, permissionsJson);

      // Ajouter aussi dans authorized_emails pour ne pas bloquer une future reconnexion
      const emailExists = db
        .prepare('SELECT id, status FROM authorized_emails WHERE email = ?')
        .get(email);
      if (!emailExists) {
        db.prepare(
          'INSERT INTO authorized_emails (email, status, activated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        ).run(email, 'activated');
      } else if (emailExists.status !== 'activated') {
        db.prepare(
          'UPDATE authorized_emails SET status = ?, activated_at = CURRENT_TIMESTAMP WHERE email = ?',
        ).run('activated', email);
      }

      auditLog(AUDIT_ACTIONS.USER_CREATE, req.user?.id, {
        targetUserId: result.lastInsertRowid,
        email,
      });
      res.status(201).json({ success: true, id: result.lastInsertRowid, email, name: name.trim() });
    } catch (error) {
      logger.error('Erreur création utilisateur:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Map camelCase permission keys → snake_case (legacy compat)
  const PERM_KEY_MAP = {
    canManageMaintenance: 'can_manage_vehicle_maintenance',
    canManageVehicleMaintenance: 'can_manage_vehicle_maintenance',
    canManageEquipmentMaintenance: 'can_manage_equipment_maintenance',
    canManageCatalog: 'can_manage_catalog',
    canManageTrucks: 'can_manage_trucks',
    readOnly: 'read_only',
  };
  function normalizePermissions(raw) {
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      const normalized = PERM_KEY_MAP[k] || k;
      if (v) out[normalized] = true;
    }
    return out;
  }

  app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    try {
      const stmt = db.prepare(
        'SELECT id, email, name, is_admin, is_blocked, avatar, permissions, created_at FROM users ORDER BY created_at DESC',
      );
      const users = stmt.all();
      res.json(
        users.map((u) => {
          let perms = {};
          try {
            perms = u.permissions ? JSON.parse(u.permissions) : {};
          } catch {
            /* ignored */
          }
          const normalized = normalizePermissions(perms);
          return {
            ...u,
            isAdmin: u.is_admin === 1,
            isBlocked: u.is_blocked === 1,
            permissions: normalized,
          };
        }),
      );
    } catch (error) {
      logger.error('Erreur récupération utilisateurs:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Mettre à jour un utilisateur (admin)
  app.patch('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isAdmin, newPassword, permissions, isBlocked } = req.body;

      if (isBlocked !== undefined) {
        db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(isBlocked ? 1 : 0, id);
        if (isBlocked) {
          // Invalider toutes les sessions pour déconnecter immédiatement l'utilisateur
          const result = db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(id);
          auditLog({
            actorId: req.user.id,
            actorEmail: req.user.email,
            action: AUDIT_ACTIONS.USER_BLOCK,
            targetType: 'user',
            targetId: id,
            details: { blocked: true, sessionsInvalidated: result.changes },
            req,
          });
          logger.info(`🚫 Utilisateur ${id} bloqué - ${result.changes} session(s) invalidée(s)`);
        } else {
          auditLog({
            actorId: req.user.id,
            actorEmail: req.user.email,
            action: AUDIT_ACTIONS.USER_BLOCK,
            targetType: 'user',
            targetId: id,
            details: { blocked: false },
            req,
          });
          logger.info(`✅ Utilisateur ${id} débloqué`);
        }
      }

      if (isAdmin !== undefined) {
        const stmt = db.prepare('UPDATE users SET is_admin = ? WHERE id = ?');
        stmt.run(isAdmin ? 1 : 0, id);

        // Invalider toutes les sessions de cet utilisateur pour qu'il se reconnecte avec le nouveau statut
        const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
        const result = deleteSessionsStmt.run(id);
        auditLog({
          actorId: req.user.id,
          actorEmail: req.user.email,
          action: AUDIT_ACTIONS.USER_ADMIN_TOGGLE,
          targetType: 'user',
          targetId: id,
          details: { isAdmin, sessionsInvalidated: result.changes },
          req,
        });
        logger.info(
          `🔄 Statut admin modifié pour user ${id} - ${result.changes} session(s) invalidée(s)`,
        );
      }

      if (permissions !== undefined) {
        const normalized =
          typeof permissions === 'string'
            ? normalizePermissions(JSON.parse(permissions))
            : normalizePermissions(permissions);
        const permStr = JSON.stringify(normalized);
        db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(permStr, id);
        // Invalider les sessions pour forcer un re-login avec les nouvelles permissions
        db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(id);
        auditLog({
          actorId: req.user.id,
          actorEmail: req.user.email,
          action: AUDIT_ACTIONS.USER_PERMISSIONS_CHANGE,
          targetType: 'user',
          targetId: id,
          details: { permissions: normalized },
          req,
        });
        logger.info(`🔐 Permissions modifiées pour user ${id}`);
      }

      if (newPassword) {
        // [AUDIT FIX HIGH-2] Politique de mot de passe renforcée
        const pwError = validatePassword(newPassword);
        if (pwError) {
          return res.status(400).json({ success: false, error: pwError });
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        stmt.run(passwordHash, id);

        // Invalider toutes les sessions lors du changement de mot de passe
        const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
        const result = deleteSessionsStmt.run(id);
        auditLog({
          actorId: req.user.id,
          actorEmail: req.user.email,
          action: AUDIT_ACTIONS.USER_PASSWORD_CHANGE,
          targetType: 'user',
          targetId: id,
          details: { sessionsInvalidated: result.changes },
          req,
        });
        logger.info(
          `🔑 Mot de passe modifié pour user ${id} - ${result.changes} session(s) invalidée(s)`,
        );
      }

      res.json({
        success: true,
        message: 'Utilisateur mis à jour. Les sessions actives ont été fermées.',
      });
    } catch (error) {
      logger.error('Erreur mise à jour utilisateur:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Demander une réinitialisation de mot de passe (admin)
  app.post('/api/users/:id/reset-password', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;

      // Marquer le compte comme nécessitant une réinitialisation
      const stmt = db.prepare('UPDATE users SET password_reset_required = 1 WHERE id = ?');
      stmt.run(id);

      // Invalider toutes les sessions
      const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      deleteSessionsStmt.run(id);

      // Récupérer l'email pour le retour
      const userStmt = db.prepare('SELECT email FROM users WHERE id = ?');
      const user = userStmt.get(id);

      auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
        targetType: 'user',
        targetId: id,
        details: { email: user?.email },
        req,
      });
      logger.info(`🔄 Réinitialisation demandée pour user ${id}`);

      res.json({
        success: true,
        message: "Réinitialisation demandée. L'utilisateur devra définir un nouveau mot de passe.",
        email: user?.email,
      });
    } catch (error) {
      logger.error('Erreur demande réinitialisation:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Vérifier si un compte nécessite une réinitialisation
  // [SEC FIX] Ne renvoie que le strict nécessaire (pas id/name) pour limiter l'info leak
  app.post('/api/auth/check-reset', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email requis' });
      }

      const stmt = db.prepare(
        'SELECT id, name, password_reset_required FROM users WHERE email = ?',
      );
      const user = stmt.get(email);

      if (!user) {
        // [SEC] Réponse uniforme pour éviter l'énumération d'emails
        return res.json({ resetRequired: false });
      }

      res.json({
        resetRequired: user.password_reset_required === 1,
        user: { name: user.name },
      });
    } catch (error) {
      logger.error('Erreur check reset:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Définir un nouveau mot de passe après réinitialisation
  // [AUDIT FIX CRIT-1] Exige un token OTP valide (envoyé par email) en plus de l'email
  app.post('/api/auth/set-new-password', validate(setNewPasswordSchema), async (req, res) => {
    try {
      const { email, newPassword, resetToken } = req.body;

      // [AUDIT FIX HIGH-2] Politique de mot de passe renforcée
      const pwError = validatePassword(newPassword);
      if (pwError) {
        return res.status(400).json({ success: false, error: pwError });
      }

      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email);

      if (!user) {
        return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
      }

      if (user.password_reset_required !== 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Aucune réinitialisation en attente pour ce compte' });
      }

      // [AUDIT FIX CRIT-1] Vérifier le token OTP
      if (!resetToken) {
        return res.status(400).json({ success: false, error: 'Code de vérification requis' });
      }

      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      if (!user.reset_token_hash || tokenHash !== user.reset_token_hash) {
        return res.status(400).json({ success: false, error: 'Code de vérification invalide' });
      }

      // Vérifier l'expiration du token
      if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
        // Nettoyer le token expiré
        db.prepare(
          'UPDATE users SET password_reset_required = 0, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
        ).run(user.id);
        return res.status(400).json({
          success: false,
          error: 'Code de vérification expiré. Veuillez refaire une demande.',
        });
      }

      // Mettre à jour le mot de passe et retirer le flag + token
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const updateStmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_reset_required = 0, reset_token_hash = NULL, reset_token_expires = NULL
      WHERE id = ?
    `);
      updateStmt.run(passwordHash, user.id);

      // Supprimer toutes les anciennes sessions avant d'en créer une nouvelle
      const deleteOldSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      deleteOldSessionsStmt.run(user.id);

      // Créer un token pour connecter directement l'utilisateur
      let resetPerms = {};
      try {
        resetPerms = user.permissions ? JSON.parse(user.permissions) : {};
      } catch {
        resetPerms = {};
      }
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.is_admin === 1,
          permissions: resetPerms,
        },
        JWT_SECRET,
        { expiresIn: `${JWT_EXPIRY_DAYS}d` },
      );

      // Enregistrer la session
      const sessionHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
      const expiresAt = new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const insertSessionStmt = db.prepare(`
      INSERT INTO active_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `);
      insertSessionStmt.run(user.id, sessionHash, expiresAt);
      auditLog({
        actorId: user.id,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETE,
        targetType: 'user',
        targetId: user.id,
        req,
      });

      logger.info('✅ Nouveau mot de passe défini');

      // [AUDIT Phase 3] Token envoyé en cookie httpOnly
      res.cookie('auth_token', token, cookieOptions);
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.is_admin === 1,
          avatar: user.avatar || null,
        },
        message: 'Mot de passe défini avec succès',
      });
    } catch (error) {
      logger.error('Erreur définition mot de passe:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // Supprimer un utilisateur (admin)
  app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;

      // Empêcher la suppression de son propre compte
      if (parseInt(id) === req.user.id) {
        return res
          .status(400)
          .json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' });
      }

      // Avant de supprimer l'utilisateur, réassigner toutes ses données à l'admin qui fait la suppression
      const userId = parseInt(id);
      const adminId = req.user.id;

      // Réassigner les enregistrements dans toutes les tables qui référencent l'utilisateur
      const reassignQueries = [
        'UPDATE access_requests SET reviewed_by = ? WHERE reviewed_by = ?',
        'UPDATE vehicles SET created_by = ? WHERE created_by = ?',
        'UPDATE vehicles SET modified_by = ? WHERE modified_by = ?',
        'UPDATE reservations SET created_by = ? WHERE created_by = ?',
        'UPDATE reservations SET modified_by = ? WHERE modified_by = ?',
        'UPDATE clients SET created_by = ? WHERE created_by = ?',
        'UPDATE clients SET modified_by = ? WHERE modified_by = ?',
        'UPDATE drivers SET created_by = ? WHERE created_by = ?',
        'UPDATE drivers SET modified_by = ? WHERE modified_by = ?',
        'UPDATE locations SET created_by = ? WHERE created_by = ?',
        'UPDATE locations SET modified_by = ? WHERE modified_by = ?',
        'UPDATE garages SET created_by = ? WHERE created_by = ?',
        'UPDATE garages SET modified_by = ? WHERE modified_by = ?',
        'UPDATE maintenances SET reported_by = ? WHERE reported_by = ?',
        'UPDATE maintenances SET created_by = ? WHERE created_by = ?',
        'UPDATE maintenances SET modified_by = ? WHERE modified_by = ?',
        'UPDATE modification_history SET user_id = ? WHERE user_id = ?',
        'UPDATE config SET modified_by = ? WHERE modified_by = ?',
        'UPDATE reservation_requests SET requested_by = ? WHERE requested_by = ?',
        'UPDATE reservation_requests SET reviewed_by = ? WHERE reviewed_by = ?',
      ];

      // Exécuter toutes les mises à jour dans une transaction
      const transaction = db.transaction(() => {
        for (const query of reassignQueries) {
          const stmt = db.prepare(query);
          stmt.run(adminId, userId);
        }

        // Supprimer les sessions actives de l'utilisateur
        const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
        deleteSessionsStmt.run(userId);

        // Enfin supprimer l'utilisateur
        const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');
        deleteUserStmt.run(userId);
      });

      transaction();
      auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.USER_DELETE,
        targetType: 'user',
        targetId: id,
        details: { reassignedTo: adminId },
        req,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Erreur suppression utilisateur:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur interne' });
    }
  });

  // ═══ CONFIGURATION EMAIL ═══

  // GET /api/email-config — Récupérer la config email (admin uniquement, masque le mot de passe)
  app.get('/api/email-config', authenticateToken, requireAdmin, (req, res) => {
    try {
      const config = db.prepare('SELECT * FROM email_config WHERE id = 1').get();
      if (config) {
        // Masquer le mot de passe SMTP
        config.smtp_pass = config.smtp_pass ? '••••••••' : '';
      }
      res.json(config || {});
    } catch (error) {
      logger.error('Erreur lecture config email:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // PUT /api/email-config — Mettre à jour la config email (admin uniquement)
  app.put('/api/email-config', authenticateToken, requireAdmin, (req, res) => {
    try {
      const {
        enabled,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_pass,
        from_name,
        alert_access_request,
        alert_reservation,
        alert_assignment,
        alert_overdue,
        alert_leave,
        alert_sav,
        alert_maintenance,
      } = req.body;

      // Si le mot de passe est masqué, ne pas le mettre à jour
      const currentConfig = db.prepare('SELECT smtp_pass FROM email_config WHERE id = 1').get();
      const rawPass = smtp_pass && smtp_pass !== '••••••••' ? smtp_pass : null;
      // Si nouveau mot de passe fourni, le chiffrer ; sinon garder l'existant (déjà chiffré)
      const finalPass = rawPass ? encryptPassword(rawPass) : currentConfig?.smtp_pass || '';

      db.prepare(
        `
      UPDATE email_config SET
        enabled = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?,
        smtp_user = ?, smtp_pass = ?, from_name = ?,
        alert_access_request = ?, alert_reservation = ?, alert_assignment = ?, alert_overdue = ?,
        alert_leave = ?, alert_sav = ?, alert_maintenance = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `,
      ).run(
        enabled ? 1 : 0,
        smtp_host || '',
        smtp_port || 587,
        smtp_secure ? 1 : 0,
        smtp_user || '',
        finalPass,
        from_name || 'eM@g',
        alert_access_request !== false ? 1 : 0,
        alert_reservation !== false ? 1 : 0,
        alert_assignment !== false ? 1 : 0,
        alert_overdue !== false ? 1 : 0,
        alert_leave !== false ? 1 : 0,
        alert_sav !== false ? 1 : 0,
        alert_maintenance !== false ? 1 : 0,
      );

      // Réinitialiser le transporteur avec la nouvelle config
      initEmailTransporter(db);
      auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: AUDIT_ACTIONS.EMAIL_CONFIG_CHANGE,
        targetType: 'config',
        targetId: 'email',
        details: { smtp_host, smtp_port, smtp_user, enabled },
        req,
      });

      res.json({ success: true, message: 'Configuration email mise à jour' });
    } catch (error) {
      logger.error('Erreur mise à jour config email:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  // POST /api/email-config/test — Envoyer un email de test
  app.post('/api/email-config/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const config = db.prepare('SELECT * FROM email_config WHERE id = 1').get();
      if (!config || !config.smtp_host || !config.smtp_user) {
        return res.status(400).json({ success: false, error: 'Configuration SMTP incomplète' });
      }

      const nodemailer = (await import('nodemailer')).default;
      const testTransporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port || 587,
        secure: config.smtp_secure === 1,
        auth: {
          user: config.smtp_user,
          pass: (() => {
            const decrypted = decryptPassword(config.smtp_pass);
            if (!decrypted) throw new Error('SMTP password decryption failed');
            return decrypted;
          })(),
        },
      });

      await testTransporter.sendMail({
        from: `"${config.from_name || 'eM@g'}" <${config.smtp_user}>`,
        to: req.user.email,
        subject: '[eM@g] Email de test',
        html: '<div style="font-family:Arial;padding:20px;"><h2>✅ Configuration email fonctionnelle !</h2><p>Cet email confirme que la configuration SMTP est correcte.</p></div>',
      });

      res.json({ success: true, message: `Email de test envoyé à ${req.user.email}` });
    } catch (error) {
      logger.error('Erreur test email:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du test SMTP' });
    }
  });

  // ─── Cache monitoring endpoint (admin only) ───
  app.get('/api/cache/stats', authenticateToken, requireAdmin, (req, res) => {
    res.json(getAllCacheStats());
  });
  app.post('/api/cache/clear', authenticateToken, requireAdmin, (req, res) => {
    const { name } = req.body || {};
    if (name) {
      const stats = getAllCacheStats();
      const target = stats.find((s) => s.name === name);
      if (!target)
        return res.status(404).json({ success: false, error: `Cache '${name}' non trouvé` });
      // Clear by name
      const cache = ALL_CACHES.find((c) => c.name === name);
      if (cache) cache.clear();
    } else {
      ALL_CACHES.forEach((c) => c.clear());
    }
    auditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.CACHE_CLEAR,
      targetType: 'cache',
      targetId: name || 'all',
      req,
    });
    res.json({ success: true, message: name ? `Cache '${name}' vidé` : 'Tous les caches vidés' });
  });
} // end setupAdminRoutes
