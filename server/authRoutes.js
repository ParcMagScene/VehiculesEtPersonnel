import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from './database.js';
import { getTransporter } from './emailService.js';
import logger from './logger.js';
import { authCache } from './cache.js';

export function setupAuthRoutes(app, authenticateToken, { JWT_SECRET, JWT_EXPIRY_DAYS, isDev }) {

// Inscription
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    
    // Vérifier si l'email est autorisé
    const authStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = ?');
    const authorized = authStmt.get(email, 'pending');
    
    if (!authorized) {
      return res.status(403).json({ error: 'Email non autorisé. Contactez un administrateur.' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Utiliser le flag is_admin de authorized_emails (ou 0 par défaut)
    const isAdmin = authorized.is_admin || 0;
    const stmt = db.prepare('INSERT INTO users (email, name, password_hash, is_admin) VALUES (?, ?, ?, ?)');
    const result = stmt.run(email, name, passwordHash, isAdmin);
    
    // Marquer l'email comme activé
    const updateStmt = db.prepare('UPDATE authorized_emails SET status = ?, activated_at = CURRENT_TIMESTAMP WHERE email = ?');
    updateStmt.run('activated', email);
    
    logger.info('✅ Nouvel utilisateur enregistré');
    
    res.json({ id: result.lastInsertRowid, email, name, isAdmin: isAdmin === 1 });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// Mot de passe oublié (self-service) — [AUDIT FIX CRIT-1] Envoie OTP par email
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);
    if (user) {
      // Générer OTP et l'envoyer par email
      const otp = String(crypto.randomInt(100000, 999999));
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      db.prepare('UPDATE users SET password_reset_required = 1, reset_token_hash = ?, reset_token_expires = ? WHERE id = ?')
        .run(otpHash, expiresAt, user.id);
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
        logger.info(`DEV OTP pour ${user.email}: ${otp}`);
      }
      logger.info('🔑 Mot de passe oublié — OTP généré');
    }

    // Toujours retourner le même message (ne pas révéler si l'email existe)
    res.json({
      message: 'Si cette adresse correspond à un compte, un code de vérification a été envoyé par email.'
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Réinitialisation directe du mot de passe (self-service, sans ancien mot de passe)
// [AUDIT FIX CRIT-1] Sécurisé : OTP 6 chiffres envoyé par email, token hashé en DB, expire en 15min
app.post('/api/auth/self-reset-password', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email et nom requis' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      // Message générique pour ne pas révéler si le compte existe
      return res.status(400).json({ error: 'Les informations saisies ne correspondent à aucun compte' });
    }

    // Vérifier que le nom correspond (insensible à la casse, trim)
    const nameMatch = user.name.trim().toLowerCase() === name.trim().toLowerCase();
    if (!nameMatch) {
      return res.status(400).json({ error: 'Les informations saisies ne correspondent à aucun compte' });
    }

    // [AUDIT FIX CRIT-1] Générer un OTP 6 chiffres et l'envoyer par email
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // Stocker le hash OTP + expiration en DB
    db.prepare('UPDATE users SET password_reset_required = 1, reset_token_hash = ?, reset_token_expires = ? WHERE id = ?')
      .run(otpHash, expiresAt, user.id);

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
      logger.warn(`🔑 OTP généré pour user ${user.id} mais email non configuré. OTP (dev): ${isDev ? otp : '[masqué]'}`);
    }

    if (isDev) {
      logger.info(`DEV OTP pour ${user.email}: ${otp}`);
    }

    res.json({
      success: true,
      message: 'Un code de vérification a été envoyé à votre adresse email.',
      requireOtp: true,
      email: user.email
    });
  } catch (error) {
    logger.error('Erreur self-reset-password:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Vérifier si une réinitialisation est requise AVANT de vérifier le mot de passe
    // (l'utilisateur a probablement oublié son ancien mot de passe)
    if (user.password_reset_required === 1) {
      return res.status(403).json({
        error: 'PASSWORD_RESET_REQUIRED',
        message: 'Votre compte a été réinitialisé. Vous devez définir un nouveau mot de passe.',
        userId: user.id,
        email: user.email
      });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    logger.info('✅ Authentification réussie');
    
    // Vérifier que l'email est autorisé
    const authorizedEmailStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = \'activated\'');
    const authorizedEmail = authorizedEmailStmt.get(email);
    
    if (!authorizedEmail) {
      return res.status(403).json({ 
        error: 'EMAIL_NOT_AUTHORIZED',
        message: 'Votre email n\'est pas autorisé à accéder à cette application. Veuillez contacter un administrateur.' 
      });
    }
    
    // PERMETTRE LES SESSIONS MULTIPLES
    // Les utilisateurs peuvent maintenant se connecter sur plusieurs appareils simultanément
    // Pas de vérification de session active, on crée simplement un nouveau token
    
    // Parser les permissions
    let perms = {};
    try { perms = user.permissions ? JSON.parse(user.permissions) : {}; } catch { perms = {}; }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1, permissions: perms },
      JWT_SECRET,
      { expiresIn: `${JWT_EXPIRY_DAYS}d` }
    );
    
    // Enregistrer la session
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
    const expiresAt = new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const insertSessionStmt = db.prepare(`
      INSERT INTO active_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `);
    insertSessionStmt.run(user.id, tokenHash, expiresAt);
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1, avatar: user.avatar || null, permissions: perms } });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Forcer une nouvelle connexion en fermant les sessions actives
app.post('/api/auth/force-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Vérifier que l'email est autorisé
    const authorizedEmailStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ? AND status = \'activated\'');
    const authorizedEmail = authorizedEmailStmt.get(email);
    
    if (!authorizedEmail) {
      return res.status(403).json({ 
        error: 'EMAIL_NOT_AUTHORIZED',
        message: 'Votre email n\'est pas autorisé à accéder à cette application. Veuillez contacter un administrateur.' 
      });
    }
    
    // Supprimer toutes les sessions actives de cet utilisateur
    const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
    deleteSessionsStmt.run(user.id);
    
    // Parser les permissions
    let forcePerms = {};
    try { forcePerms = user.permissions ? JSON.parse(user.permissions) : {}; } catch { forcePerms = {}; }

    // Créer un nouveau token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1, permissions: forcePerms },
      JWT_SECRET,
      { expiresIn: `${JWT_EXPIRY_DAYS}d` }
    );
    
    // Enregistrer la nouvelle session
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);
    const expiresAt = new Date(Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const insertSessionStmt = db.prepare(`
      INSERT INTO active_sessions (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `);
    insertSessionStmt.run(user.id, tokenHash, expiresAt);
    
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1, avatar: user.avatar || null, permissions: forcePerms },
      message: 'Toutes les autres sessions ont été fermées'
    });
  } catch (error) {
    logger.error('Erreur force-login:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
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
    
    res.json({ message: 'Déconnexion réussie', sessionsClosed: result.changes });
  } catch (error) {
    logger.error('Erreur logout:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Liste publique des utilisateurs (pour le sélecteur de connexion)
// Renvoie uniquement nom + avatar (pas d'email) — sans authentification
app.get('/api/auth/users-public', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, name, avatar FROM users ORDER BY name');
    const users = stmt.all();
    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar || null
    })));
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

} // end setupAuthRoutes
