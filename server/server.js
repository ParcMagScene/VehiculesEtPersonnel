// Charger le fichier .env approprié selon le mode
import dotenv from 'dotenv';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname, join as _join } from 'path';

const __serverFile = _fileURLToPath(import.meta.url);
const __serverDir = _dirname(__serverFile);

// Si NODE_ENV=development OU --dev flag, charger .env.development
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const envFile = isDev ? '.env.development' : '.env';
dotenv.config({ path: _join(__serverDir, envFile) });

if (isDev) {
  logger.info('');
  logger.info('═══════════════════════════════════════════');
  logger.info('  🔧 MODE DÉVELOPPEMENT — Serveur isolé');
  logger.info(`  📄 Env: ${envFile}`);
  logger.info(`  🔌 Port: ${process.env.PORT || 3003}`);
  logger.info(`  💾 DB: ${process.env.DB_PATH || 'vehicules-dev.db'}`);
  logger.info('  ⚠️  La production n\'est PAS affectée');
  logger.info('═══════════════════════════════════════════');
  logger.info('');
}

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import db, { addToHistory, getHistory, closeDatabase, checkpointDatabase } from './database.js';
import { setupClientsRoutes, setupDriversRoutes, setupLocationsRoutes, setupGaragesRoutes, setupConfigRoutes } from './routes.js';
import { setupPersonsRoutes, setupSkillsRoutes, setupAvailabilitiesRoutes, setupMissionsRoutes, setupAssignmentsRoutes } from './personnelRoutes.js';
import { setupEquipmentCategoriesRoutes, setupEquipmentRoutes, setupEquipmentAssignmentsRoutes, setupSavTicketsRoutes, setupEquipmentListsRoutes } from './equipmentRoutes.js';
import { setupSuppliersRoutes, setupOrdersRoutes, setupQuotesRoutes, setupMaterialRequestsRoutes, setupSupplierDocumentsRoutes } from './ordersRoutes.js';
import { setupMessagingRoutes } from './messagingRoutes.js';
import { setupLeaveRoutes } from './leaveRoutes.js';
import { setupCatalogRoutes, setupFlightcasesRoutes, setupTruckModelsRoutes, setupReservationEquipmentRoutes } from './catalogRoutes.js';
import { setupMailingRoutes } from './mailingRoutes.js';
import { setupStockCategoriesRoutes, setupStockItemsRoutes, setupStockMovementsRoutes, setupStockStatsRoutes } from './stockRoutes.js';
import { setupCommunicationRoutes } from './communicationRoutes.js';
import { setupDisplayRoutes } from './displayRoutes.js';
import { setupAnnuaireClientsRoutes, setupAnnuaireSuppliersRoutes, setupAnnuairePrestatairesRoutes, setupAnnuaireContactsRoutes, setupAnnuaireLookupsRoutes, setupAnnuaireSearchRoutes, setupAnnuaireImportRoutes } from './annuaireRoutes.js';
import { initEmailTransporter, alertAccessRequest, alertReservationCreated, alertAssignmentCreated, alertMaintenanceCreated } from './emailService.js';
import logger from "./logger.js";
import { authCache, statsCache, listCache, cacheMiddleware, invalidateEntity, getAllCacheStats, ALL_CACHES } from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY_DAYS = parseInt(process.env.JWT_EXPIRY_DAYS || '30', 10);

if (JWT_SECRET === 'your-secret-key-change-in-production' || JWT_SECRET === 'CHANGEZ_CETTE_CLE') {
  logger.warn('⚠️  ATTENTION: JWT_SECRET par défaut détecté ! Créez un fichier server/.env avec un secret sécurisé.');
  if (process.env.NODE_ENV === 'production') {
    logger.error('❌ FATAL: JWT_SECRET par défaut interdit en production. Définissez JWT_SECRET dans server/.env');
    process.exit(1);
  }
}

// CORS — restriction aux domaines autorisés

// Headers de sécurité HTTP
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://magsav.duckdns.org,http://magsav.duckdns.org:4173,http://magsav.duckdns.org,http://192.168.205.75:4173,http://localhost:5174,http://localhost:4173')
  .split(',')
  .map(s => s.trim());

logger.info('🌐 Origines CORS autorisées:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // Permettre les requêtes sans origin (curl, mobile, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.error(`❌ CORS bloqué pour origin: "${origin}" — Autorisées: ${allowedOrigins.join(', ')}`);
    return callback(new Error('CORS non autorisé'), false);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting — protection contre le brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 tentatives par fenêtre
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // max 600 requêtes par minute (l'app charge beaucoup de données)
  message: { error: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/force-login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/set-new-password', authLimiter);
app.use('/api/auth/self-reset-password', authLimiter);

// Servir les fichiers statiques depuis le dossier public/attachments
const attachmentsPath = path.join(__dirname, '..', 'public', 'attachments');
app.use('/attachments', express.static(attachmentsPath));

// Servir les avatars
const avatarsPath = path.join(__dirname, '..', 'public', 'avatars');
if (!fs.existsSync(avatarsPath)) fs.mkdirSync(avatarsPath, { recursive: true });
app.use('/avatars', express.static(avatarsPath));

// Middleware d'authentification — vérifie JWT + session active en DB
// [PERF] Cache LRU/TTL sur la vérification session (30s) pour éviter SHA-256 + SELECT à chaque requête
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });

    // [AUDIT FIX HIGH-1] Vérifier que la session existe encore en DB
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 64);

    // [PERF] Vérifier le cache avant de requêter la DB
    const cachedSession = authCache.get(tokenHash);
    if (cachedSession !== null) {
      req.user = user;
      return next();
    }

    const session = db.prepare(
      'SELECT 1 FROM active_sessions WHERE token_hash = ? AND expires_at > datetime(\'now\')'
    ).get(tokenHash);
    if (!session) {
      return res.status(401).json({ error: 'Session expirée ou révoquée' });
    }

    // Mettre en cache le résultat positif (TTL 30s)
    authCache.set(tokenHash, true);
    req.user = user;
    next();
  });
}

// Middleware pour vérifier les droits admin (vérifie en DB pour être sûr)
function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT is_admin, permissions FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.is_admin) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  req.user.isAdmin = true;
  try { req.user.permissions = user.permissions ? JSON.parse(user.permissions) : {}; } catch { req.user.permissions = {}; }
  next();
}

// Middleware pour vérifier les droits maintenance VÉHICULES (admin OU permission spécifique)
function requireMaintenanceAccess(req, res, next) {
  const user = db.prepare('SELECT is_admin, permissions FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(403).json({ error: 'Utilisateur non trouvé' });
  let perms = {};
  try { perms = user.permissions ? JSON.parse(user.permissions) : {}; } catch { perms = {}; }
  // Backward compat: can_manage_maintenance OU can_manage_vehicle_maintenance
  if (user.is_admin || perms.can_manage_vehicle_maintenance || perms.can_manage_maintenance) {
    req.user.isAdmin = !!user.is_admin;
    req.user.canManageMaintenance = true;
    req.user.permissions = perms;
    next();
  } else {
    return res.status(403).json({ error: 'Accès réservé — permission maintenance véhicules requise' });
  }
}

// Middleware pour vérifier les droits maintenance MATÉRIEL (admin OU permission spécifique)
function requireEquipmentMaintenanceAccess(req, res, next) {
  const user = db.prepare('SELECT is_admin, permissions FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(403).json({ error: 'Utilisateur non trouvé' });
  let perms = {};
  try { perms = user.permissions ? JSON.parse(user.permissions) : {}; } catch { perms = {}; }
  if (user.is_admin || perms.can_manage_equipment_maintenance) {
    req.user.isAdmin = !!user.is_admin;
    req.user.canManageEquipmentMaintenance = true;
    req.user.permissions = perms;
    next();
  } else {
    return res.status(403).json({ error: 'Accès réservé — permission maintenance matériel requise' });
  }
}

// Middleware pour vérifier les droits CATALOGUE (admin OU permission spécifique)
function requireCatalogAccess(req, res, next) {
  const user = db.prepare('SELECT is_admin, permissions FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(403).json({ error: 'Utilisateur non trouvé' });
  let perms = {};
  try { perms = user.permissions ? JSON.parse(user.permissions) : {}; } catch { perms = {}; }
  if (user.is_admin || perms.can_manage_catalog) {
    req.user.isAdmin = !!user.is_admin;
    req.user.canManageCatalog = true;
    req.user.permissions = perms;
    next();
  } else {
    return res.status(403).json({ error: 'Accès réservé — permission catalogue requise' });
  }
}

// Middleware pour vérifier les droits CAMIONS/MODÈLES (admin OU permission spécifique)
function requireTruckAccess(req, res, next) {
  const user = db.prepare('SELECT is_admin, permissions FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(403).json({ error: 'Utilisateur non trouvé' });
  let perms = {};
  try { perms = user.permissions ? JSON.parse(user.permissions) : {}; } catch { perms = {}; }
  if (user.is_admin || perms.can_manage_trucks) {
    req.user.isAdmin = !!user.is_admin;
    req.user.canManageTrucks = true;
    req.user.permissions = perms;
    next();
  } else {
    return res.status(403).json({ error: 'Accès réservé — permission modèles camions requise' });
  }
}

// Helper : valider qu'un chemin ne sort pas du répertoire autorisé (anti path-traversal)
function sanitizePath(basePath, userInput) {
  const resolved = path.resolve(basePath, userInput);
  if (!resolved.startsWith(path.resolve(basePath))) {
    return null; // Tentative de path traversal
  }
  return resolved;
}

// Helper : valider un identifiant d'affaire (pas de caractères dangereux)
function isValidAffaireId(id) {
  return /^[a-zA-Z0-9_\-\.]+$/.test(id);
}

// Helper : parser les liens Google Drive (rétrocompatible ancien format string simple)
function parseDriveLinks(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    // Si JSON mais pas un tableau, traiter comme string
    return [{ url: value, label: '' }];
  } catch {
    // Ancien format : string simple (URL directe)
    return value.trim() ? [{ url: value.trim(), label: '' }] : [];
  }
}

// ============ AUTHENTIFICATION ============

// Inscription
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    
    // Vérifier si la colonne is_admin existe dans authorized_emails
    try {
      const columns = db.prepare("PRAGMA table_info(authorized_emails)").all();
      const hasIsAdminColumn = columns.some(col => col.name === 'is_admin');
      
      if (!hasIsAdminColumn) {
        db.prepare("ALTER TABLE authorized_emails ADD COLUMN is_admin INTEGER DEFAULT 0").run();
        logger.info('✅ Colonne is_admin ajoutée à authorized_emails');
      }
    } catch (error) {
      logger.info('Info: Colonne is_admin déjà présente');
    }
    
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

// Mot de passe oublié (self-service)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (user) {
      // Marquer le compte pour réinitialisation et fermer les sessions
      db.prepare('UPDATE users SET password_reset_required = 1 WHERE id = ?').run(user.id);
      db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(user.id);
      logger.info('🔑 Mot de passe oublié demandé');
    }

    // Toujours retourner le même message (ne pas révéler si l'email existe)
    res.json({
      message: 'Si cette adresse correspond à un compte, il a été préparé pour une réinitialisation. Reconnectez-vous pour définir un nouveau mot de passe.'
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Réinitialisation directe du mot de passe (self-service, sans ancien mot de passe)
// [AUDIT FIX CRIT-1] Sécurisé : seul un admin peut déclencher le self-reset
// L'utilisateur s'identifie avec email + nom → on positionne le flag reset
// Le nouveau MDP est choisi ensuite via set-new-password (protégé par le flag)
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

    // [AUDIT FIX] Ne PAS changer le mot de passe ici — seulement activer le flag
    db.prepare('UPDATE users SET password_reset_required = 1 WHERE id = ?').run(user.id);

    // Fermer toutes les sessions existantes pour forcer la re-connexion
    db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(user.id);

    logger.info(`🔑 Reset password demandé (self-service) pour user ${user.id}`);

    res.json({
      success: true,
      message: 'Réinitialisation activée. Veuillez définir un nouveau mot de passe.',
      requireNewPassword: true,
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
    
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
      JWT_SECRET,
      { expiresIn: `${JWT_EXPIRY_DAYS}d` }
    );
    
    // Parser les permissions
    let perms = {};
    try { perms = user.permissions ? JSON.parse(user.permissions) : {}; } catch { perms = {}; }

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
    const userEmail = req.user.email;
    
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

// Liste des utilisateurs (pour le sélecteur de connexion)
app.get('/api/auth/users', (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, avatar FROM users ORDER BY name');
    const users = stmt.all();
    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar || null
    })));
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ VÉHICULES ============

app.get('/api/vehicles', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM vehicles ORDER BY order_index');
    const vehicles = stmt.all();
    
    // Mapper snake_case vers camelCase
    const mappedVehicles = vehicles.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type,
      registration: v.registration,
      brand: v.brand,
      model: v.model,
      color: v.color,
      owner: v.owner,
      comment: v.comment,
      displayColor: v.display_color,
      photo: v.photo,
      order: v.order_index,
      isLocation: v.is_location === 1,
      kilometrage: v.kilometrage || 0,
      controlesTechniques: v.controles_techniques || '[]',
      createdBy: v.created_by,
      modifiedBy: v.modified_by,
      createdAt: v.created_at,
      modifiedAt: v.modified_at
    }));
    
    res.json(mappedVehicles);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.post('/api/vehicles', authenticateToken, requireAdmin, (req, res) => {
  try {
    const vehicle = req.body;
    const stmt = db.prepare(`
      INSERT INTO vehicles (id, name, type, registration, brand, model, color, owner, comment, 
                           display_color, photo, order_index, is_location, kilometrage, controles_techniques, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      vehicle.id, vehicle.name, vehicle.type, vehicle.registration, vehicle.brand,
      vehicle.model, vehicle.color, vehicle.owner, vehicle.comment, vehicle.displayColor,
      vehicle.photo, vehicle.order || 0, vehicle.isLocation ? 1 : 0, 
      vehicle.kilometrage || 0, vehicle.controles_techniques || '[]', req.user.id, req.user.id
    );
    
    addToHistory('vehicle', vehicle.id, 'created', vehicle, req.user.id, req.user.name);
    
    // Récupérer le véhicule créé et le mapper
    const getStmt = db.prepare('SELECT * FROM vehicles WHERE id = ?');
    const createdVehicle = getStmt.get(vehicle.id);
    
    const mappedVehicle = {
      id: createdVehicle.id,
      name: createdVehicle.name,
      type: createdVehicle.type,
      registration: createdVehicle.registration,
      brand: createdVehicle.brand,
      model: createdVehicle.model,
      color: createdVehicle.color,
      owner: createdVehicle.owner,
      comment: createdVehicle.comment,
      displayColor: createdVehicle.display_color,
      photo: createdVehicle.photo,
      order: createdVehicle.order_index,
      isLocation: createdVehicle.is_location === 1,
      kilometrage: createdVehicle.kilometrage || 0,
      controlesTechniques: createdVehicle.controles_techniques || '[]',
      createdBy: createdVehicle.created_by,
      modifiedBy: createdVehicle.modified_by,
      createdAt: createdVehicle.created_at,
      modifiedAt: createdVehicle.modified_at
    };
    
    res.json(mappedVehicle);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/vehicles/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const vehicle = req.body;
    
    // Récupérer l'ancien kilométrage avant la mise à jour
    const oldVehicle = db.prepare('SELECT kilometrage, name FROM vehicles WHERE id = ?').get(req.params.id);
    const oldKm = oldVehicle ? (oldVehicle.kilometrage || 0) : 0;
    const newKm = vehicle.kilometrage || 0;
    
    const stmt = db.prepare(`
      UPDATE vehicles 
      SET name = ?, type = ?, registration = ?, brand = ?, model = ?, color = ?,
          owner = ?, comment = ?, display_color = ?, photo = ?, order_index = ?,
          is_location = ?, kilometrage = ?, controles_techniques = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      vehicle.name, vehicle.type, vehicle.registration, vehicle.brand, vehicle.model,
      vehicle.color, vehicle.owner, vehicle.comment, vehicle.displayColor, vehicle.photo,
      vehicle.order || 0, vehicle.isLocation ? 1 : 0, 
      newKm, vehicle.controles_techniques || '[]', req.user.id, req.params.id
    );
    
    addToHistory('vehicle', req.params.id, 'updated', vehicle, req.user.id, req.user.name);
    
    // Si le kilométrage a changé, ajouter un relevé kilométrique daté dans l'historique
    if (newKm !== oldKm) {
      addToHistory('vehicle', req.params.id, 'mileage_update', JSON.stringify({
        description: 'Relevé kilométrique',
        oldKilometrage: oldKm,
        newKilometrage: newKm,
        vehicleName: oldVehicle?.name || vehicle.name,
        date: new Date().toISOString()
      }), req.user.id, req.user.name);
    }
    
    // Récupérer le véhicule mis à jour et le mapper
    const getStmt = db.prepare('SELECT * FROM vehicles WHERE id = ?');
    const updatedVehicle = getStmt.get(req.params.id);
    
    const mappedVehicle = {
      id: updatedVehicle.id,
      name: updatedVehicle.name,
      type: updatedVehicle.type,
      registration: updatedVehicle.registration,
      brand: updatedVehicle.brand,
      model: updatedVehicle.model,
      color: updatedVehicle.color,
      owner: updatedVehicle.owner,
      comment: updatedVehicle.comment,
      displayColor: updatedVehicle.display_color,
      photo: updatedVehicle.photo,
      order: updatedVehicle.order_index,
      isLocation: updatedVehicle.is_location === 1,
      kilometrage: updatedVehicle.kilometrage || 0,
      controlesTechniques: updatedVehicle.controles_techniques || '[]',
      createdBy: updatedVehicle.created_by,
      modifiedBy: updatedVehicle.modified_by,
      createdAt: updatedVehicle.created_at,
      modifiedAt: updatedVehicle.modified_at
    };
    
    res.json(mappedVehicle);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.delete('/api/vehicles/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM vehicles WHERE id = ?');
    stmt.run(req.params.id);
    
    addToHistory('vehicle', req.params.id, 'deleted', null, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ RÉSERVATIONS ============

app.get('/api/reservations', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT r.*, v.name as vehicle_name, v.type as vehicle_type, v.registration as immatriculation
      FROM reservations r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
    `);
    const reservations = stmt.all();
    
    // Mapper snake_case vers camelCase
    const mappedReservations = reservations.map(r => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      vehicleName: r.vehicle_name || '',
      vehicleType: r.vehicle_type || '',
      immatriculation: r.immatriculation || '',
      clientName: r.client_name,
      driverName: r.driver_name,
      locationName: r.location_name,
      prestationName: r.prestation_name,
      date: r.start_date,
      startDate: r.start_date,
      period: r.start_period,
      startPeriod: r.start_period,
      endDate: r.end_date,
      endPeriod: r.end_period,
      status: r.status,
      comment: r.comment,
      affaire: r.affaire,
      googleEventId: r.google_event_id,
      isTournee: r.is_tournee === 1,
      linkedEventIds: r.linked_event_ids ? JSON.parse(r.linked_event_ids) : null,
      notes: r.notes,
      googleDriveLink: r.google_drive_link || '',
      googleDriveLinks: parseDriveLinks(r.google_drive_link),
      createdBy: r.created_by,
      modifiedBy: r.modified_by,
      createdAt: r.created_at,
      modifiedAt: r.modified_at
    }));
    
    res.json(mappedReservations);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.post('/api/reservations', authenticateToken, requireAdmin, (req, res) => {
  try {
    const reservation = req.body;
    
    // Générer un ID côté serveur si non fourni ou invalide
    if (!reservation.id || reservation.id === 'null' || reservation.id === null) {
      reservation.id = `${Date.now()}.${Math.random()}`;
      logger.info('⚠️ ID manquant, génération côté serveur:', reservation.id);
    }
    
    const stmt = db.prepare(`
      INSERT INTO reservations (id, vehicle_id, start_date, start_period, end_date, end_period, 
                               client_name, driver_name, location_name, prestation_name, 
                               notes, google_event_id, google_drive_link, affaire, is_tournee, linked_event_ids, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      reservation.id,
      reservation.vehicle_id,
      reservation.start_date,
      reservation.start_period || 'AM',
      reservation.end_date,
      reservation.end_period || 'PM',
      reservation.client_name || '',
      reservation.driver_name || '',
      reservation.location_name || '',
      reservation.prestation_name || '',
      reservation.notes || '',
      reservation.google_event_id || '',
      reservation.google_drive_link || '',
      reservation.affaire || '',
      reservation.is_tournee ? 1 : 0,
      reservation.linked_event_ids ? JSON.stringify(reservation.linked_event_ids) : null,
      req.user.id,
      req.user.id
    );
    
    addToHistory('reservation', reservation.id, 'created', reservation, req.user.id, req.user.name);
    
    // Récupérer la réservation complète avec les infos du véhicule
    const createdReservation = db.prepare(`
      SELECT r.*, v.name as vehicle_name, v.type as vehicle_type, v.registration as immatriculation
      FROM reservations r
      JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ?
    `).get(reservation.id);
    
    if (!createdReservation) {
      return res.status(500).json({ error: 'Erreur lors de la récupération de la réservation créée' });
    }
    
    // Mapper au format attendu par le frontend
    const mappedReservation = {
      id: createdReservation.id,
      vehicleId: createdReservation.vehicle_id,
      vehicleName: createdReservation.vehicle_name,
      vehicleType: createdReservation.vehicle_type,
      immatriculation: createdReservation.immatriculation,
      startDate: createdReservation.start_date,
      startPeriod: createdReservation.start_period,
      endDate: createdReservation.end_date,
      endPeriod: createdReservation.end_period,
      // Rétrocompatibilité
      date: createdReservation.start_date,
      period: createdReservation.start_period,
      clientName: createdReservation.client_name,
      driverName: createdReservation.driver_name,
      locationName: createdReservation.location_name,
      prestationName: createdReservation.prestation_name,
      notes: createdReservation.notes,
      googleEventId: createdReservation.google_event_id,
      affaire: createdReservation.affaire,
      isTournee: Boolean(createdReservation.is_tournee),
      linkedEventIds: createdReservation.linked_event_ids ? JSON.parse(createdReservation.linked_event_ids) : [],
      googleDriveLink: createdReservation.google_drive_link || ''
    };
    
    // Alerte email aux admins
    alertReservationCreated(db, mappedReservation, req.user.name)
      .catch(err => logger.warn('Email alerte réservation échoué:', err.message));
    
    res.json(mappedReservation);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/reservations/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const reservation = req.body;

    // Préserver les liens Google Drive existants (gérés uniquement via PATCH depuis EventDetailsModal)
    const existing = db.prepare('SELECT google_drive_link FROM reservations WHERE id = ?').get(req.params.id);
    const existingDriveLink = existing ? existing.google_drive_link : '';

    const stmt = db.prepare(`
      UPDATE reservations 
      SET vehicle_id = ?, start_date = ?, start_period = ?, end_date = ?, end_period = ?,
          client_name = ?, driver_name = ?, location_name = ?, prestation_name = ?,
          notes = ?, google_event_id = ?, google_drive_link = ?, affaire = ?, is_tournee = ?, linked_event_ids = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      reservation.vehicleId || reservation.vehicle_id,
      reservation.date || reservation.start_date,
      reservation.period || reservation.start_period || 'AM',
      reservation.endDate || reservation.end_date,
      reservation.endPeriod || reservation.end_period || 'PM',
      reservation.clientName || reservation.client_name || '',
      reservation.driverName || reservation.driver_name || '',
      reservation.locationName || reservation.location_name || '',
      reservation.prestationName || reservation.prestation_name || '',
      reservation.notes || '',
      reservation.googleEventId || reservation.google_event_id || '',
      existingDriveLink || '',
      reservation.affaire || '',
      reservation.isTournee || reservation.is_tournee ? 1 : 0,
      (reservation.linkedEventIds || reservation.linked_event_ids) ? JSON.stringify(reservation.linkedEventIds || reservation.linked_event_ids) : null,
      req.user.id,
      req.params.id
    );
    
    addToHistory('reservation', req.params.id, 'updated', reservation, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Mise à jour partielle d'une réservation (liens Google Drive)
app.patch('/api/reservations/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { google_drive_links, google_drive_link } = req.body;
    
    // Support nouveau format (tableau) ou ancien format (string)
    let linksToStore;
    if (google_drive_links !== undefined) {
      // Nouveau format : tableau de {url, label}
      if (!Array.isArray(google_drive_links)) {
        return res.status(400).json({ error: 'google_drive_links doit être un tableau' });
      }
      linksToStore = JSON.stringify(google_drive_links);
    } else if (google_drive_link !== undefined) {
      // Ancien format rétrocompatible : string simple
      linksToStore = google_drive_link || '';
    } else {
      return res.status(400).json({ error: 'Champ manquant (google_drive_links ou google_drive_link)' });
    }
    
    const stmt = db.prepare(`
      UPDATE reservations SET google_drive_link = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(linksToStore, req.user.id, req.params.id);
    addToHistory('reservation', req.params.id, 'updated', { google_drive_links: google_drive_links || google_drive_link }, req.user.id, req.user.name);
    
    const updatedLinks = parseDriveLinks(linksToStore);
    res.json({ success: true, googleDriveLinks: updatedLinks, googleDriveLink: linksToStore });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.delete('/api/reservations/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM reservations WHERE id = ?');
    const result = stmt.run(req.params.id);
    
    addToHistory('reservation', req.params.id, 'deleted', null, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ DEMANDES DE RÉSERVATION ============

app.get('/api/reservation-requests', authenticateToken, (req, res) => {
  try {
    // Admins see all requests, regular users see only their own
    const isAdmin = req.user && req.user.isAdmin;
    let requests;
    if (isAdmin) {
      requests = db.prepare(`
        SELECT rr.*, u.name as requester_name, u.email as requester_email
        FROM reservation_requests rr
        LEFT JOIN users u ON rr.requested_by = u.id
        ORDER BY rr.requested_at DESC
      `).all();
    } else {
      requests = db.prepare(`
        SELECT rr.*, u.name as requester_name, u.email as requester_email
        FROM reservation_requests rr
        LEFT JOIN users u ON rr.requested_by = u.id
        WHERE rr.requested_by = ?
        ORDER BY rr.requested_at DESC
      `).all(req.user.id);
    }
    res.json(requests);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.post('/api/reservation-requests', authenticateToken, (req, res) => {
  try {
    const request = req.body;
    const stmt = db.prepare(`
      INSERT INTO reservation_requests (id, vehicle_id, start_date, start_period, end_date, end_period,
                                       client_name, driver_name, location_name, prestation_name, notes, requested_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      request.id,
      request.vehicle_id,
      request.start_date,
      request.start_period || 'AM',
      request.end_date,
      request.end_period || 'PM',
      request.client_name || '',
      request.driver_name || '',
      request.location_name || '',
      request.prestation_name || '',
      request.notes || '',
      req.user.id
    );
    
    res.json({ success: true, id: request.id });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/reservation-requests/:id/approve', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userStmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
    const user = userStmt.get(req.user.id);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    // Récupérer la demande
    const requestStmt = db.prepare('SELECT * FROM reservation_requests WHERE id = ?');
    const request = requestStmt.get(req.params.id);
    
    if (!request) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }

    // Créer la réservation
    const insertStmt = db.prepare(`
      INSERT INTO reservations (id, vehicle_id, start_date, start_period, end_date, end_period,
                               client_name, driver_name, location_name, prestation_name, notes,
                               created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      request.id,
      request.vehicle_id,
      request.start_date,
      request.start_period,
      request.end_date,
      request.end_period,
      request.client_name,
      request.driver_name,
      request.location_name,
      request.prestation_name,
      request.notes,
      req.user.id,
      req.user.id
    );

    // Mettre à jour le statut de la demande
    const updateStmt = db.prepare(`
      UPDATE reservation_requests 
      SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(req.user.id, req.params.id);
    
    addToHistory('reservation_request', req.params.id, 'approved', request, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/reservation-requests/:id/reject', authenticateToken, (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userStmt = db.prepare('SELECT is_admin FROM users WHERE id = ?');
    const user = userStmt.get(req.user.id);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const updateStmt = db.prepare(`
      UPDATE reservation_requests 
      SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?
      WHERE id = ?
    `);
    updateStmt.run(req.user.id, req.body.reason || '', req.params.id);
    
    addToHistory('reservation_request', req.params.id, 'rejected', { reason: req.body.reason }, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ MAINTENANCES ============

app.get('/api/maintenances', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT m.*, u.name as creator_name 
      FROM maintenances m 
      LEFT JOIN users u ON m.created_by = u.id
    `);
    const maintenances = stmt.all();
    
    // Mapper snake_case vers camelCase pour compatibilité frontend
    const mappedMaintenances = maintenances.map(m => ({
      id: m.id,
      vehicleId: m.vehicle_id,
      vehicleName: m.vehicle_name,
      type: m.type,
      status: m.status,
      date: m.date,
      startDate: m.date,
      endDate: m.end_date,
      startDatePeriod: m.start_date_period || 'AM',
      endDatePeriod: m.end_date_period || 'PM',
      description: m.description,
      garageId: m.garage_id,
      cost: m.cost,
      mileage: m.mileage,
      notes: m.notes,
      isImmobilized: m.is_immobilized,
      isQuickReport: m.is_quick_report,
      technicalControlType: m.technical_control_type,
      createdBy: m.created_by,
      creatorName: m.creator_name || 'Inconnu',
      modifiedBy: m.modified_by,
      createdAt: m.created_at,
      modifiedAt: m.modified_at
    }));
    
    res.json(mappedMaintenances);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.post('/api/maintenances', authenticateToken, (req, res) => {
  try {
    const maintenance = req.body;
    
    // Vérifier permissions (admin, can_manage_vehicle_maintenance ou legacy can_manage_maintenance)
    let canFullAccess = req.user.isAdmin;
    if (!canFullAccess) {
      const userDb = db.prepare('SELECT permissions FROM users WHERE id = ?').get(req.user.id);
      try {
        const perms = userDb?.permissions ? JSON.parse(userDb.permissions) : {};
        canFullAccess = !!perms.can_manage_vehicle_maintenance || !!perms.can_manage_maintenance;
      } catch { /* ignore */ }
    }
    
    // Les utilisateurs sans permission ne peuvent créer que des signalements
    if (!canFullAccess && maintenance.status !== 'reported') {
      return res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Vous ne pouvez que signaler des pannes. Pour programmer une intervention, contactez un administrateur.'
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO maintenances (id, vehicle_id, vehicle_name, type, status, date, end_date, 
                               start_date_period, end_date_period,
                               description, garage_id, cost, mileage, notes, is_immobilized, 
                               is_quick_report, technical_control_type, created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Résoudre les champs date (supporte camelCase ET snake_case depuis toSnakeCase)
    const resolvedDate = maintenance.start_date || maintenance.startDate || maintenance.date || null;
    const resolvedEndDate = maintenance.end_date || maintenance.endDate || resolvedDate;
    
    stmt.run(
      maintenance.id,
      maintenance.vehicle_id,
      maintenance.vehicle_name || '',
      maintenance.type || 'other',
      maintenance.status || 'pending',
      resolvedDate,
      resolvedEndDate,
      maintenance.start_date_period || 'AM',
      maintenance.end_date_period || 'PM',
      maintenance.description || '',
      maintenance.garage_id || null,
      maintenance.cost || null,
      maintenance.mileage || null,
      maintenance.notes || '',
      maintenance.is_immobilized ? 1 : 0,
      maintenance.is_quick_report ? 1 : 0,
      maintenance.technical_control_type || null,
      req.user.id,
      req.user.id
    );
    
    addToHistory('maintenance', maintenance.id, 'created', maintenance, req.user.id, req.user.name);

    // Alerte email maintenance / contrôle technique
    try {
      const veh = db.prepare('SELECT name FROM vehicles WHERE id = ?').get(maintenance.vehicle_id);
      alertMaintenanceCreated(db, maintenance, veh?.name || 'Véhicule inconnu', req.user.name);
    } catch (emailErr) { logger.warn('Alerte email maintenance:', emailErr.message); }
    
    // Si un kilométrage est renseigné, mettre à jour le véhicule et ajouter un relevé dans l'historique
    if (maintenance.mileage && parseInt(maintenance.mileage) > 0) {
      const vehicleId = maintenance.vehicle_id;
      const newKm = parseInt(maintenance.mileage);
      const oldVehicle = db.prepare('SELECT kilometrage, name FROM vehicles WHERE id = ?').get(vehicleId);
      const oldKm = oldVehicle ? (oldVehicle.kilometrage || 0) : 0;
      
      if (newKm !== oldKm) {
        db.prepare('UPDATE vehicles SET kilometrage = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newKm, req.user.id, vehicleId);
        
        addToHistory('vehicle', vehicleId, 'mileage_update', JSON.stringify({
          description: 'Relevé kilométrique (maintenance)',
          oldKilometrage: oldKm,
          newKilometrage: newKm,
          maintenanceId: maintenance.id,
          vehicleName: oldVehicle?.name || '',
          date: new Date().toISOString()
        }), req.user.id, req.user.name);
      }
    }
    
    res.json({ success: true, id: maintenance.id });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.put('/api/maintenances/:id', authenticateToken, (req, res) => {
  try {
    const maintenance = req.body;
    
    // Vérifier permissions (can_manage_vehicle_maintenance ou legacy can_manage_maintenance)
    let canFullAccess = req.user.isAdmin;
    if (!canFullAccess) {
      const userDb = db.prepare('SELECT permissions FROM users WHERE id = ?').get(req.user.id);
      try {
        const perms = userDb?.permissions ? JSON.parse(userDb.permissions) : {};
        canFullAccess = !!perms.can_manage_vehicle_maintenance || !!perms.can_manage_maintenance;
      } catch { /* ignore */ }
    }
    
    // Utilisateurs avec permission maintenance = accès complet, sinon restrictions
    if (!canFullAccess) {
      const existing = db.prepare('SELECT created_by, status FROM maintenances WHERE id = ?').get(req.params.id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Maintenance introuvable' });
      }
      
      // Les non-autorisés peuvent uniquement modifier leurs propres signalements
      if (existing.created_by !== req.user.id) {
        return res.status(403).json({ 
          error: 'Accès refusé',
          message: 'Vous ne pouvez modifier que vos propres signalements.'
        });
      }
      
      // Empêcher le changement de statut pour les non-autorisés
      if (maintenance.status !== existing.status) {
        return res.status(403).json({ 
          error: 'Accès refusé',
          message: 'Seuls les administrateurs peuvent changer le statut d\'une intervention.'
        });
      }
    }
    
    const stmt = db.prepare(`
      UPDATE maintenances 
      SET vehicle_id = ?, type = ?, status = ?, date = ?, end_date = ?, 
          start_date_period = ?, end_date_period = ?,
          description = ?, garage_id = ?, cost = ?, mileage = ?, notes = ?, is_immobilized = ?,
          is_quick_report = ?, technical_control_type = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    // Résoudre les champs date (supporte camelCase ET snake_case depuis toSnakeCase)
    const resolvedDate = maintenance.startDate || maintenance.start_date || maintenance.date || null;
    const resolvedEndDate = maintenance.endDate || maintenance.end_date || resolvedDate;
    
    stmt.run(
      maintenance.vehicleId || maintenance.vehicle_id,
      maintenance.type,
      maintenance.status,
      resolvedDate,
      resolvedEndDate,
      maintenance.startDatePeriod || maintenance.start_date_period || 'AM',
      maintenance.endDatePeriod || maintenance.end_date_period || 'PM',
      maintenance.description,
      maintenance.garageId || maintenance.garage_id || null,
      maintenance.cost || null,
      maintenance.mileage || null,
      maintenance.notes || null,
      maintenance.isImmobilized || maintenance.is_immobilized ? 1 : 0,
      maintenance.isQuickReport || maintenance.is_quick_report ? 1 : 0,
      maintenance.technicalControlType || maintenance.technical_control_type || null,
      req.user.id,
      req.params.id
    );
    
    // Si l'intervention est de type technical_inspection et passe à "completed",
    // mettre à jour la deadline du contrôle technique correspondant
    if (maintenance.type === 'technical_inspection' && 
        maintenance.status === 'completed' && 
        (maintenance.technicalControlType || maintenance.technical_control_type)) {
      
      const vehicleId = maintenance.vehicleId || maintenance.vehicle_id;
      const controlType = maintenance.technicalControlType || maintenance.technical_control_type;
      const completionDate = maintenance.endDate || maintenance.end_date || maintenance.startDate || maintenance.date;
      
      // Récupérer le véhicule pour mettre à jour ses contrôles techniques
      const vehicle = db.prepare('SELECT controles_techniques FROM vehicles WHERE id = ?').get(vehicleId);
      
      if (vehicle) {
        let controles = [];
        try {
          controles = vehicle.controles_techniques ? JSON.parse(vehicle.controles_techniques) : [];
        } catch (e) {
          logger.error('Erreur parsing controles_techniques:', e);
          controles = [];
        }
        
        // Trouver le contrôle correspondant
        const controleIndex = controles.findIndex(c => c.type === controlType);
        
        if (controleIndex >= 0) {
          // Calculer la nouvelle deadline selon le type de contrôle
          const periodicDelays = {
            'VL': 24,      // 24 mois
            'PL': 12,      // 12 mois
            'SEMI': 12,    // 12 mois
            'SCENE': 12,   // 12 mois
            'POLLUTION': 12, // 12 mois
            'HAYON': 6,    // 6 mois
            'TACHYGRAPHE': 24, // 24 mois
            'LIMITEUR': 12  // 12 mois
          };
          
          const delayMonths = periodicDelays[controlType] || 12;
          const date = new Date(completionDate);
          date.setMonth(date.getMonth() + delayMonths);
          const newDeadline = date.toISOString().split('T')[0];
          
          // Mettre à jour le contrôle
          controles[controleIndex] = {
            ...controles[controleIndex],
            date: completionDate,
            deadline: newDeadline
          };
          
          // Sauvegarder les contrôles mis à jour
          const updateStmt = db.prepare('UPDATE vehicles SET controles_techniques = ? WHERE id = ?');
          updateStmt.run(JSON.stringify(controles), vehicleId);
          
          logger.info(`✅ Deadline CT ${controlType} mise à jour pour véhicule ${vehicleId}: ${newDeadline}`);
        }
      }
    }
    
    addToHistory('maintenance', req.params.id, 'updated', maintenance, req.user.id, req.user.name);
    
    // Si un kilométrage est renseigné, mettre à jour le véhicule et ajouter un relevé dans l'historique
    if (maintenance.mileage && parseInt(maintenance.mileage) > 0) {
      const vehicleId = maintenance.vehicleId || maintenance.vehicle_id;
      const newKm = parseInt(maintenance.mileage);
      const oldVehicle = db.prepare('SELECT kilometrage, name FROM vehicles WHERE id = ?').get(vehicleId);
      const oldKm = oldVehicle ? (oldVehicle.kilometrage || 0) : 0;
      
      if (newKm !== oldKm) {
        db.prepare('UPDATE vehicles SET kilometrage = ?, modified_by = ?, modified_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newKm, req.user.id, vehicleId);
        
        addToHistory('vehicle', vehicleId, 'mileage_update', JSON.stringify({
          description: 'Relevé kilométrique (maintenance)',
          oldKilometrage: oldKm,
          newKilometrage: newKm,
          maintenanceId: req.params.id,
          vehicleName: oldVehicle?.name || '',
          date: new Date().toISOString()
        }), req.user.id, req.user.name);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

app.delete('/api/maintenances/:id', authenticateToken, requireMaintenanceAccess, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM maintenances WHERE id = ?');
    stmt.run(req.params.id);
    
    addToHistory('maintenance', req.params.id, 'deleted', null, req.user.id, req.user.name);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ HISTORIQUE ============

app.get('/api/history/:entityType/:entityId', authenticateToken, (req, res) => {
  try {
    const history = getHistory(req.params.entityType, req.params.entityId);
    res.json(history);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ GESTION DES UTILISATEURS (ADMIN) ============

// Réinitialiser le mot de passe d'un utilisateur
app.post('/api/admin/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    stmt.run(passwordHash, userId);
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Changer son propre mot de passe
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    updateStmt.run(passwordHash, req.user.id);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ============ DEMANDES D'ACCÈS ============

// Créer une demande d'accès (ou auto-approuver si email déjà autorisé)
app.post('/api/access-requests', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email et nom requis' });
    }

    // Vérifier si l'email existe déjà en tant qu'utilisateur
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà enregistré. Connectez-vous directement.' });
    }

    // Vérifier si l'email est déjà autorisé par un admin
    const authorizedEmail = db.prepare(
      'SELECT * FROM authorized_emails WHERE email = ? AND status = ?'
    ).get(email, 'pending');

    if (authorizedEmail) {
      // Email déjà autorisé → l'utilisateur peut créer son mot de passe directement
      return res.json({ 
        success: true,
        autoApproved: true,
        message: 'Votre email est déjà autorisé ! Vous pouvez créer votre mot de passe.'
      });
    }

    // Vérifier si une demande est déjà en cours
    const existingRequest = db.prepare(
      'SELECT * FROM access_requests WHERE email = ? AND status = ?'
    ).get(email, 'pending');
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Une demande est déjà en cours pour cet email' });
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
      message: 'Un email d\'activation vous sera envoyé après validation par un administrateur.',
      id: result.lastInsertRowid 
    });
  } catch (error) {
    logger.error('Erreur création demande d\'accès:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Vérifier si un email est autorisé (pour le lien direct de création de compte)
app.post('/api/access-requests/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }
    
    // Vérifier si déjà utilisateur
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.json({ authorized: false, reason: 'already_registered' });
    }
    
    // Vérifier si autorisé
    const authorized = db.prepare(
      'SELECT * FROM authorized_emails WHERE email = ? AND status = ?'
    ).get(email, 'pending');
    
    // Récupérer le nom depuis la demande d'accès si elle existe
    let name = null;
    if (authorized) {
      const request = db.prepare(
        'SELECT name FROM access_requests WHERE email = ? ORDER BY created_at DESC LIMIT 1'
      ).get(email);
      name = request?.name || null;
    }
    
    res.json({ authorized: !!authorized, name });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Approuver/rejeter une demande (admin seulement)
app.patch('/api/access-requests/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, is_admin } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status invalide' });
    }

    // Récupérer la demande
    const request = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(id);
    if (!request) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
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
      // Vérifier si la colonne is_admin existe, sinon l'ajouter
      try {
        const columns = db.prepare("PRAGMA table_info(authorized_emails)").all();
        const hasIsAdminColumn = columns.some(col => col.name === 'is_admin');
        
        if (!hasIsAdminColumn) {
          db.prepare("ALTER TABLE authorized_emails ADD COLUMN is_admin INTEGER DEFAULT 0").run();
          logger.info('✅ Colonne is_admin ajoutée à authorized_emails');
        }
      } catch (error) {
        logger.info('Info: Colonne is_admin déjà présente ou erreur:', error.message);
      }

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

    res.json({ 
      success: true, 
      message: `Demande ${status === 'approved' ? 'approuvée' : 'rejetée'}`,
      request: {
        email: request.email,
        name: request.name
      }
    });
  } catch (error) {
    logger.error('Erreur traitement demande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Compter les demandes en attente (interventions + réservations) pour badge admin
app.get('/api/pending-requests-count', authenticateToken, requireAdmin, (req, res) => {
  try {
    const interventionStmt = db.prepare("SELECT COUNT(*) as count FROM maintenances WHERE status IN ('pending', 'reported')");
    const interventionResult = interventionStmt.get();
    
    const reservationStmt = db.prepare("SELECT COUNT(*) as count FROM reservation_requests WHERE status = 'pending'");
    const reservationResult = reservationStmt.get();
    
    res.json({
      interventionRequests: interventionResult.count,
      reservationRequests: reservationResult.count,
      total: interventionResult.count + reservationResult.count
    });
  } catch (error) {
    logger.error('Erreur comptage demandes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
    res.status(500).json({ error: 'Erreur serveur' });
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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un email autorisé (admin)
app.post('/api/authorized-emails', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }
    
    // Vérifier si l'email existe déjà
    const checkStmt = db.prepare('SELECT * FROM authorized_emails WHERE email = ?');
    const existing = checkStmt.get(email);
    
    if (existing) {
      return res.status(400).json({ error: 'Cet email est déjà autorisé' });
    }
    
    const stmt = db.prepare('INSERT INTO authorized_emails (email, status) VALUES (?, ?)');
    const result = stmt.run(email, 'pending');
    
    res.json({ id: result.lastInsertRowid, email, status: 'pending' });
  } catch (error) {
    logger.error('Erreur ajout email:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un email autorisé (admin)
app.delete('/api/authorized-emails/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM authorized_emails WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur suppression email:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer tous les utilisateurs (admin uniquement)
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, is_admin, avatar, permissions, created_at FROM users ORDER BY created_at DESC');
    const users = stmt.all();
    res.json(users.map(u => {
      let perms = {};
      try { perms = u.permissions ? JSON.parse(u.permissions) : {}; } catch { perms = {}; }
      return {
        ...u,
        isAdmin: u.is_admin === 1,
        permissions: perms,
      };
    }));
  } catch (error) {
    logger.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un utilisateur (admin)
app.patch('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin, newPassword, permissions } = req.body;
    
    if (isAdmin !== undefined) {
      const stmt = db.prepare('UPDATE users SET is_admin = ? WHERE id = ?');
      stmt.run(isAdmin ? 1 : 0, id);
      
      // Invalider toutes les sessions de cet utilisateur pour qu'il se reconnecte avec le nouveau statut
      const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      const result = deleteSessionsStmt.run(id);
      logger.info(`🔄 Statut admin modifié pour user ${id} - ${result.changes} session(s) invalidée(s)`);
    }

    if (permissions !== undefined) {
      const permStr = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
      db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(permStr, id);
      // Invalider les sessions pour forcer un re-login avec les nouvelles permissions
      db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(id);
      logger.info(`🔐 Permissions modifiées pour user ${id}`);
    }
    
    if (newPassword) {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
      stmt.run(passwordHash, id);
      
      // Invalider toutes les sessions lors du changement de mot de passe
      const deleteSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
      const result = deleteSessionsStmt.run(id);
      logger.info(`🔑 Mot de passe modifié pour user ${id} - ${result.changes} session(s) invalidée(s)`);
    }
    
    res.json({ success: true, message: 'Utilisateur mis à jour. Les sessions actives ont été fermées.' });
  } catch (error) {
    logger.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
    const result = deleteSessionsStmt.run(id);
    
    // Récupérer l'email pour le retour
    const userStmt = db.prepare('SELECT email FROM users WHERE id = ?');
    const user = userStmt.get(id);
    
    logger.info(`🔄 Réinitialisation demandée pour user ${id}`);
    
    res.json({ 
      success: true, 
      message: 'Réinitialisation demandée. L\'utilisateur devra définir un nouveau mot de passe.',
      email: user?.email
    });
  } catch (error) {
    logger.error('Erreur demande réinitialisation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Vérifier si un compte nécessite une réinitialisation
app.post('/api/auth/check-reset', async (req, res) => {
  try {
    const { email } = req.body;
    
    const stmt = db.prepare('SELECT id, email, name, password_reset_required FROM users WHERE email = ?');
    const user = stmt.get(email);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({ 
      resetRequired: user.password_reset_required === 1,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    logger.error('Erreur check reset:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Définir un nouveau mot de passe après réinitialisation
app.post('/api/auth/set-new-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    if (user.password_reset_required !== 1) {
      return res.status(400).json({ error: 'Aucune réinitialisation en attente pour ce compte' });
    }
    
    // Mettre à jour le mot de passe et retirer le flag
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updateStmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_reset_required = 0 
      WHERE id = ?
    `);
    updateStmt.run(passwordHash, user.id);
    
    // Supprimer toutes les anciennes sessions avant d'en créer une nouvelle
    const deleteOldSessionsStmt = db.prepare('DELETE FROM active_sessions WHERE user_id = ?');
    deleteOldSessionsStmt.run(user.id);
    
    // Créer un token pour connecter directement l'utilisateur
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
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
    
    logger.info('✅ Nouveau mot de passe défini');
    
    res.json({ 
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1, avatar: user.avatar || null },
      message: 'Mot de passe défini avec succès'
    });
  } catch (error) {
    logger.error('Erreur définition mot de passe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un utilisateur (admin)
app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    // Empêcher la suppression de son propre compte
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
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
      'UPDATE reservation_requests SET reviewed_by = ? WHERE reviewed_by = ?'
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
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Routes pour clients, drivers, locations, garages, config
setupClientsRoutes(app, authenticateToken, requireAdmin);
setupDriversRoutes(app, authenticateToken, requireAdmin);
setupLocationsRoutes(app, authenticateToken, requireAdmin);
setupGaragesRoutes(app, authenticateToken, requireAdmin);
setupConfigRoutes(app, authenticateToken, requireAdmin);
setupMessagingRoutes(app, authenticateToken);
setupMailingRoutes(app, authenticateToken, requireAdmin);

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
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/email-config — Mettre à jour la config email (admin uniquement)
app.put('/api/email-config', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, from_name,
            alert_access_request, alert_reservation, alert_assignment, alert_overdue,
            alert_leave, alert_sav, alert_maintenance } = req.body;
    
    // Si le mot de passe est masqué, ne pas le mettre à jour
    const currentConfig = db.prepare('SELECT smtp_pass FROM email_config WHERE id = 1').get();
    const finalPass = (smtp_pass && smtp_pass !== '••••••••') ? smtp_pass : (currentConfig?.smtp_pass || '');

    db.prepare(`
      UPDATE email_config SET
        enabled = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?,
        smtp_user = ?, smtp_pass = ?, from_name = ?,
        alert_access_request = ?, alert_reservation = ?, alert_assignment = ?, alert_overdue = ?,
        alert_leave = ?, alert_sav = ?, alert_maintenance = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      enabled ? 1 : 0, smtp_host || '', smtp_port || 587, smtp_secure ? 1 : 0,
      smtp_user || '', finalPass, from_name || 'eM@g',
      alert_access_request !== false ? 1 : 0, alert_reservation !== false ? 1 : 0,
      alert_assignment !== false ? 1 : 0, alert_overdue !== false ? 1 : 0,
      alert_leave !== false ? 1 : 0, alert_sav !== false ? 1 : 0, alert_maintenance !== false ? 1 : 0
    );

    // Réinitialiser le transporteur avec la nouvelle config
    initEmailTransporter(db);

    res.json({ success: true, message: 'Configuration email mise à jour' });
  } catch (error) {
    logger.error('Erreur mise à jour config email:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/email-config/test — Envoyer un email de test
app.post('/api/email-config/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM email_config WHERE id = 1').get();
    if (!config || !config.smtp_host || !config.smtp_user) {
      return res.status(400).json({ error: 'Configuration SMTP incomplète' });
    }

    const nodemailer = (await import('nodemailer')).default;
    const testTransporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_secure === 1,
      auth: { user: config.smtp_user, pass: config.smtp_pass },
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
    res.status(500).json({ error: 'Erreur lors du test SMTP' });
  }
});

// ============ MODULE AFFAIRES ============

// GET /api/affaires — Liste des affaires enrichies (DB + auto-détection depuis réservations) [PERF] Cache 30s
app.get('/api/affaires', authenticateToken, cacheMiddleware(listCache, () => 'affaires', 30_000), (req, res) => {
  try {
    // 1. Affaires explicitement enregistrées en DB
    const dbAffaires = db.prepare('SELECT * FROM affaires ORDER BY date_debut DESC').all();

    // Statements pour compteurs
    const countReservationsStmt = db.prepare(
      'SELECT COUNT(*) as count FROM reservations WHERE affaire = ?'
    );
    const countVehiclesStmt = db.prepare(
      'SELECT COUNT(DISTINCT vehicle_id) as count FROM reservations WHERE affaire = ?'
    );
    const countPersonnelStmt = db.prepare(
      `SELECT COUNT(DISTINCT ma.person_id) as count
       FROM missions m
       JOIN mission_assignments ma ON ma.mission_id = m.id
       WHERE UPPER(m.affaire) = UPPER(?)
          OR m.reservation_id IN (SELECT id FROM reservations WHERE UPPER(affaire) = UPPER(?))`
    );

    const enriched = dbAffaires.map(a => {
      const resCount = countReservationsStmt.get(a.numero_affaire)?.count || 0;
      const vehCount = countVehiclesStmt.get(a.numero_affaire)?.count || 0;
      const persCount = countPersonnelStmt.get(a.numero_affaire, a.numero_affaire)?.count || 0;
      return {
        id: a.id,
        numeroAffaire: a.numero_affaire,
        nom: a.nom || '',
        type: a.type,
        client: a.client,
        interlocuteur: a.interlocuteur,
        tel: a.tel,
        fax: a.fax,
        dateDebut: a.date_debut,
        dateFin: a.date_fin,
        devis: a.devis,
        adresseLivraison: a.adresse_livraison,
        titre: a.titre,
        description: a.description,
        googleEventId: a.google_event_id,
        eventName: a.event_name,
        reservationCount: resCount,
        vehicleCount: vehCount,
        personnelCount: persCount,
        createdBy: a.created_by,
        createdAt: a.created_at,
        modifiedBy: a.modified_by,
        modifiedAt: a.modified_at,
        source: 'db',
      };
    });

    // 2. Affaires auto-détectées depuis les réservations (celles qui n'ont pas d'entrée en DB)
    const knownNums = new Set(dbAffaires.map(a => a.numero_affaire));
    const reservationAffaires = db.prepare(`
      SELECT affaire,
             MIN(start_date) as date_debut,
             MAX(end_date) as date_fin,
             GROUP_CONCAT(DISTINCT client_name) as clients,
             GROUP_CONCAT(DISTINCT prestation_name) as prestations,
             GROUP_CONCAT(DISTINCT google_event_id) as google_event_ids,
             COUNT(*) as reservation_count,
             COUNT(DISTINCT vehicle_id) as vehicle_count
      FROM reservations
      WHERE affaire IS NOT NULL AND affaire != ''
      GROUP BY affaire
    `).all();

    for (const ra of reservationAffaires) {
      if (knownNums.has(ra.affaire)) continue; // déjà en DB
      // Extraire le meilleur client (non vide)
      const clientList = (ra.clients || '').split(',').filter(c => c.trim());
      const client = clientList[0] || '';
      // Titre depuis le nom de prestation
      const prestationList = (ra.prestations || '').split(',').filter(p => p.trim());
      const titre = prestationList[0] || '';
      const persCount = countPersonnelStmt.get(ra.affaire, ra.affaire)?.count || 0;

      enriched.push({
        id: null, // pas d'ID en DB
        numeroAffaire: ra.affaire,
        nom: '',
        type: 'Prestation',
        client: client,
        interlocuteur: '',
        tel: '',
        fax: '',
        dateDebut: ra.date_debut,
        dateFin: ra.date_fin,
        devis: '',
        adresseLivraison: '',
        titre: titre,
        description: '',
        googleEventId: (ra.google_event_ids || '').split(',')[0] || '',
        eventName: titre,
        reservationCount: ra.reservation_count,
        vehicleCount: ra.vehicle_count,
        personnelCount: persCount,
        createdBy: null,
        createdAt: null,
        modifiedBy: null,
        modifiedAt: null,
        source: 'auto', // généré automatiquement depuis les réservations
      });
    }

    // Trier par date_debut DESC
    enriched.sort((a, b) => (b.dateDebut || '').localeCompare(a.dateDebut || ''));

    res.json(enriched);
  } catch (error) {
    logger.error('Erreur GET /api/affaires:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// GET /api/affaires/personnel-counts — Compter le personnel affecté par affaire (toutes les affaires)
app.get('/api/affaires/personnel-counts', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT UPPER(m.affaire) as affaire, COUNT(DISTINCT ma.person_id) as count
      FROM missions m
      JOIN mission_assignments ma ON ma.mission_id = m.id
      WHERE m.affaire IS NOT NULL AND m.affaire != ''
      GROUP BY UPPER(m.affaire)
    `).all();
    const counts = {};
    for (const r of rows) {
      counts[r.affaire] = r.count;
    }
    res.json(counts);
  } catch (error) {
    logger.error('Erreur GET /api/affaires/personnel-counts:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// POST /api/affaires — Créer ou mettre à jour une affaire (upsert par numero_affaire)
app.post('/api/affaires', authenticateToken, (req, res) => {
  try {
    const a = req.body;
    if (!a.numero_affaire) {
      return res.status(400).json({ error: 'Le numéro d\'affaire est requis' });
    }

    // Vérifier si l'affaire existe déjà
    const existing = db.prepare('SELECT id FROM affaires WHERE numero_affaire = ?').get(a.numero_affaire);

    if (existing) {
      // Mise à jour
      db.prepare(`
        UPDATE affaires SET
          nom = ?, type = ?, client = ?, interlocuteur = ?, tel = ?, fax = ?,
          date_debut = ?, date_fin = ?, devis = ?, adresse_livraison = ?,
          titre = ?, description = ?, google_event_id = ?, event_name = ?,
          modified_by = ?, modified_at = CURRENT_TIMESTAMP
        WHERE numero_affaire = ?
      `).run(
        a.nom || '', a.type || 'Prestation', a.client || '', a.interlocuteur || '', a.tel || '', a.fax || '',
        a.date_debut || '', a.date_fin || '', a.devis || '', a.adresse_livraison || '',
        a.titre || '', a.description || '', a.google_event_id || '', a.event_name || '',
        req.user.id, a.numero_affaire
      );
      const updated = db.prepare('SELECT * FROM affaires WHERE numero_affaire = ?').get(a.numero_affaire);
      res.json({ ...updated, id: updated.id });
    } else {
      // Création
      const result = db.prepare(`
        INSERT INTO affaires (numero_affaire, nom, type, client, interlocuteur, tel, fax,
          date_debut, date_fin, devis, adresse_livraison, titre, description,
          google_event_id, event_name, created_by, modified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        a.numero_affaire, a.nom || '', a.type || 'Prestation', a.client || '', a.interlocuteur || '', a.tel || '', a.fax || '',
        a.date_debut || '', a.date_fin || '', a.devis || '', a.adresse_livraison || '',
        a.titre || '', a.description || '', a.google_event_id || '', a.event_name || '',
        req.user.id, req.user.id
      );
      const created = db.prepare('SELECT * FROM affaires WHERE id = ?').get(result.lastInsertRowid);
      invalidateEntity('affaires');
      listCache.invalidatePattern(/^planning-affaires/);
      res.status(201).json(created);
    }
  } catch (error) {
    logger.error('Erreur POST /api/affaires:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// PUT /api/affaires/:id — Mettre à jour une affaire par ID
app.put('/api/affaires/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const a = req.body;

    db.prepare(`
      UPDATE affaires SET
        numero_affaire = ?, nom = ?, type = ?, client = ?, interlocuteur = ?, tel = ?, fax = ?,
        date_debut = ?, date_fin = ?, devis = ?, adresse_livraison = ?,
        titre = ?, description = ?, google_event_id = ?, event_name = ?,
        modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      a.numero_affaire || '', a.nom || '', a.type || 'Prestation', a.client || '', a.interlocuteur || '', a.tel || '', a.fax || '',
      a.date_debut || '', a.date_fin || '', a.devis || '', a.adresse_livraison || '',
      a.titre || '', a.description || '', a.google_event_id || '', a.event_name || '',
      req.user.id, id
    );
    const updated = db.prepare('SELECT * FROM affaires WHERE id = ?').get(id);
    if (!updated) return res.status(404).json({ error: 'Affaire non trouvée' });
    invalidateEntity('affaires');
    listCache.invalidatePattern(/^planning-affaires/);
    res.json(updated);
  } catch (error) {
    logger.error('Erreur PUT /api/affaires:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// DELETE /api/affaires/:id
app.delete('/api/affaires/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM affaires WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Affaire non trouvée' });
    db.prepare('DELETE FROM affaires WHERE id = ?').run(id);
    invalidateEntity('affaires');
    listCache.invalidatePattern(/^planning-affaires/);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur DELETE /api/affaires:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ═══ Liaisons entre affaires (Tournée ↔ affaires individuelles) ═══

// GET /api/affaires/:id/links — Récupérer les affaires liées
app.get('/api/affaires/:id/links', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    // Affaires dont cette affaire est le parent
    const children = db.prepare(`
      SELECT a.*, al.id as link_id, 'child' as link_direction
      FROM affaire_links al
      JOIN affaires a ON a.id = al.child_affaire_id
      WHERE al.parent_affaire_id = ?
      ORDER BY a.date_debut
    `).all(id);
    // Affaires dont cette affaire est un enfant
    const parents = db.prepare(`
      SELECT a.*, al.id as link_id, 'parent' as link_direction
      FROM affaire_links al
      JOIN affaires a ON a.id = al.parent_affaire_id
      WHERE al.child_affaire_id = ?
      ORDER BY a.date_debut
    `).all(id);
    res.json({ children, parents, total: children.length + parents.length });
  } catch (error) {
    logger.error('Erreur GET /api/affaires/:id/links:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// POST /api/affaires/:id/links — Lier une affaire à une autre
app.post('/api/affaires/:id/links', authenticateToken, (req, res) => {
  try {
    const parentId = parseInt(req.params.id);
    const { childAffaireId } = req.body;
    if (!childAffaireId) return res.status(400).json({ error: 'childAffaireId requis' });
    if (parentId === childAffaireId) return res.status(400).json({ error: 'Impossible de lier une affaire à elle-même' });

    const parent = db.prepare('SELECT id, numero_affaire FROM affaires WHERE id = ?').get(parentId);
    const child = db.prepare('SELECT id, numero_affaire FROM affaires WHERE id = ?').get(childAffaireId);
    if (!parent) return res.status(404).json({ error: 'Affaire parent non trouvée' });
    if (!child) return res.status(404).json({ error: 'Affaire enfant non trouvée' });

    const existing = db.prepare('SELECT id FROM affaire_links WHERE parent_affaire_id = ? AND child_affaire_id = ?').get(parentId, childAffaireId);
    if (existing) return res.json({ success: true, message: 'Lien déjà existant', linkId: existing.id });

    const result = db.prepare('INSERT INTO affaire_links (parent_affaire_id, child_affaire_id) VALUES (?, ?)').run(parentId, childAffaireId);
    logger.info(`🔗 Affaire ${parent.numero_affaire} liée → ${child.numero_affaire}`);
    res.json({ success: true, linkId: result.lastInsertRowid });
  } catch (error) {
    logger.error('Erreur POST /api/affaires/:id/links:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// DELETE /api/affaires/:id/links/:linkId — Supprimer un lien entre affaires
app.delete('/api/affaires/:id/links/:linkId', authenticateToken, (req, res) => {
  try {
    const { linkId } = req.params;
    db.prepare('DELETE FROM affaire_links WHERE id = ?').run(linkId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur DELETE affaire link:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// POST /api/affaires/sync-google-events — Détection auto : lier/créer affaires depuis événements Google
app.post('/api/affaires/sync-google-events', authenticateToken, (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.json({ created: 0, linked: 0, results: [] });
    }

    const results = [];
    const affaireRegex = /\baf\s*(\d{3,})\b/i;

    const findAffaire = db.prepare('SELECT * FROM affaires WHERE numero_affaire = ?');
    const findByGoogleEvent = db.prepare('SELECT * FROM affaires WHERE google_event_id = ?');
    const insertAffaire = db.prepare(`
      INSERT INTO affaires (numero_affaire, nom, type, client, titre, description,
        date_debut, date_fin, adresse_livraison, google_event_id, event_name,
        created_by, modified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const linkAffaire = db.prepare(`
      UPDATE affaires SET google_event_id = ?, event_name = ?,
        modified_by = ?, modified_at = CURRENT_TIMESTAMP
      WHERE numero_affaire = ? AND (google_event_id IS NULL OR google_event_id = '')
    `);

    let created = 0;
    let linked = 0;

    for (const evt of events) {
      const title = evt.summary || evt.title || '';
      const match = title.match(affaireRegex);
      if (!match) continue;

      const affaireNum = `AF${match[1]}`;
      const googleEventId = evt.id || '';
      if (!googleEventId) continue;

      // Vérifier si cet événement Google est déjà lié à une affaire
      const alreadyLinked = findByGoogleEvent.get(googleEventId);
      if (alreadyLinked) continue; // Déjà traité

      // Extraire les informations de l'événement
      const eventName = title;
      const dateStart = evt.start?.date || (evt.start?.dateTime || '').slice(0, 10) || '';
      const dateEnd = evt.end?.date || (evt.end?.dateTime || '').slice(0, 10) || '';
      const location = evt.location || '';
      const description = evt.description || '';

      // Vérifier si l'affaire existe dans la base
      const existing = findAffaire.get(affaireNum);

      if (existing) {
        // L'affaire existe → la lier à l'événement Google (si pas déjà liée)
        const changes = linkAffaire.run(googleEventId, eventName, req.user.id, affaireNum);
        if (changes.changes > 0) {
          linked++;
          results.push({ affaire: affaireNum, action: 'linked', googleEventId });
          logger.info(`🔗 Affaire ${affaireNum} liée à l'événement Google "${eventName}"`);
        }
      } else {
        // L'affaire n'existe pas → la créer
        // Tenter de détecter le type depuis le titre
        let type = 'Prestation';
        const titleLower = title.toLowerCase();
        if (/tourn[eé]e/i.test(titleLower)) type = 'Tournée';
        else if (titleLower.includes('location') || titleLower.includes('loc ')) type = 'Location';
        else if (titleLower.includes('vente') || titleLower.includes('achat')) type = 'Vente';
        else if (titleLower.includes('install')) type = 'Installation';

        // Tenter d'extraire le client (texte après le N° d'affaire, avant un séparateur)
        let client = '';
        const afterAffaire = title.slice(match.index + match[0].length).trim();
        const clientMatch = afterAffaire.match(/^[\s\-–—:]+\s*(.+?)(?:\s*[\-–—|\/]|$)/);
        if (clientMatch) {
          client = clientMatch[1].trim();
        } else if (afterAffaire && afterAffaire.length > 0 && afterAffaire.length < 60) {
          client = afterAffaire.replace(/^[\s\-–—:]+/, '').trim();
        }

        insertAffaire.run(
          affaireNum, eventName || client || '', type, client, eventName, description,
          dateStart, dateEnd, location,
          googleEventId, eventName,
          req.user.id, req.user.id
        );
        created++;
        results.push({ affaire: affaireNum, action: 'created', googleEventId, client, type });
        logger.info(`✨ Affaire ${affaireNum} créée automatiquement depuis l'événement Google "${eventName}"`);
      }
    }

    res.json({ created, linked, results });
  } catch (error) {
    logger.error('Erreur POST /api/affaires/sync-google-events:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Routes Planning Personnel — MagLog 1.0
setupPersonsRoutes(app, authenticateToken, requireAdmin);
setupSkillsRoutes(app, authenticateToken, requireAdmin);
setupAvailabilitiesRoutes(app, authenticateToken, requireAdmin);
setupMissionsRoutes(app, authenticateToken, requireAdmin);
setupAssignmentsRoutes(app, authenticateToken);

// Routes Module Congés — Code du travail / IDCC 3252
setupLeaveRoutes(app, authenticateToken, requireAdmin);

// Routes Parc Matériel + SAV
setupEquipmentCategoriesRoutes(app, authenticateToken, requireAdmin);
setupEquipmentRoutes(app, authenticateToken, requireAdmin);
setupEquipmentAssignmentsRoutes(app, authenticateToken);
setupSavTicketsRoutes(app, authenticateToken, requireAdmin, requireEquipmentMaintenanceAccess);
setupEquipmentListsRoutes(app, authenticateToken, requireAdmin);

// Routes Commandes & Ventes
setupSuppliersRoutes(app, authenticateToken, requireAdmin);
setupOrdersRoutes(app, authenticateToken, requireAdmin);
setupQuotesRoutes(app, authenticateToken, requireAdmin);
setupMaterialRequestsRoutes(app, authenticateToken, requireAdmin);
setupSupplierDocumentsRoutes(app, authenticateToken, requireAdmin);

// Routes Catalogue Matériel + Flight-Cases + Modèles Camions + Deep Linking
setupCatalogRoutes(app, authenticateToken, requireCatalogAccess);
setupFlightcasesRoutes(app, authenticateToken, requireCatalogAccess);
setupTruckModelsRoutes(app, authenticateToken, requireTruckAccess);
setupReservationEquipmentRoutes(app, authenticateToken);

// Routes Module Stock & Pièces
setupStockCategoriesRoutes(app, authenticateToken, requireAdmin);
setupStockItemsRoutes(app, authenticateToken, requireAdmin);
setupStockMovementsRoutes(app, authenticateToken, requireAdmin);
setupStockStatsRoutes(app, authenticateToken);

// Routes Module Communication (Affichage dynamique + Planification + Import BL)
setupCommunicationRoutes(app, authenticateToken, requireAdmin);

// Routes Module Dashboard — Affichage Dynamique (écrans, playlists, médias, messages, templates, logs)
setupDisplayRoutes(app, authenticateToken, requireAdmin);

// Routes Module Annuaire (Clients enrichis, Fournisseurs enrichis, Prestataires, Contacts, Référentiels, Import CSV)
setupAnnuaireClientsRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireSuppliersRoutes(app, authenticateToken, requireAdmin);
setupAnnuairePrestatairesRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireContactsRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireLookupsRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireSearchRoutes(app, authenticateToken);
setupAnnuaireImportRoutes(app, authenticateToken, requireAdmin);

// ============ PROFIL UTILISATEUR ============

// Multer pour upload d'avatars
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', 'public', 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    // Utiliser targetUserId si défini (admin edit), sinon user.id
    const userId = req.params.id || req.user.id;
    cb(null, `avatar-${userId}${ext}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont acceptées'));
    }
  }
});

// Mettre à jour son propre profil (nom)
app.patch('/api/users/me', authenticateToken, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.id);
    const updated = db.prepare('SELECT id, email, name, is_admin, avatar FROM users WHERE id = ?').get(req.user.id);
    const user = { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin === 1, avatar: updated.avatar || null };
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Erreur mise à jour profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload d'avatar
app.post('/api/users/me/avatar', authenticateToken, uploadAvatar.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoyé' });
    }
    const avatarUrl = `/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.id);
    const updated = db.prepare('SELECT id, email, name, is_admin, avatar FROM users WHERE id = ?').get(req.user.id);
    const user = { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin === 1, avatar: updated.avatar || null };
    logger.info(`\uD83D\uDCF7 Avatar mis à jour pour ${updated.name}: ${avatarUrl}`);
    res.json({ success: true, user, avatarUrl });
  } catch (error) {
    logger.error('Erreur upload avatar:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer son avatar
app.delete('/api/users/me/avatar', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id);
    if (user?.avatar) {
      const filePath = path.join(__dirname, '..', 'public', user.avatar);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(req.user.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur suppression avatar:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir ses préférences utilisateur
app.get('/api/users/me/preferences', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT preferences FROM users WHERE id = ?').get(req.user.id);
    const prefs = user?.preferences ? JSON.parse(user.preferences) : {};
    res.json(prefs);
  } catch (error) {
    logger.error('Erreur récupération préférences:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour ses préférences utilisateur
app.put('/api/users/me/preferences', authenticateToken, (req, res) => {
  try {
    const prefs = JSON.stringify(req.body || {});
    db.prepare('UPDATE users SET preferences = ? WHERE id = ?').run(prefs, req.user.id);
    res.json(req.body);
  } catch (error) {
    logger.error('Erreur sauvegarde préférences:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============ ADMIN: MODIFIER LE PROFIL D'UN UTILISATEUR ============

// Mettre à jour le nom d'un utilisateur (admin)
app.patch('/api/users/:id/profile', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), id);
    const updated = db.prepare('SELECT id, email, name, is_admin, avatar FROM users WHERE id = ?').get(id);
    const user = { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin === 1, avatar: updated.avatar || null };
    logger.info(`✏️ Admin ${req.user.id} a modifié le nom de user ${id} → ${name.trim()}`);
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Erreur mise à jour profil utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload d'avatar pour un utilisateur (admin)
app.post('/api/users/:id/avatar', authenticateToken, requireAdmin, uploadAvatar.single('avatar'), (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const avatarUrl = `/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, id);
    const updated = db.prepare('SELECT id, email, name, is_admin, avatar FROM users WHERE id = ?').get(id);
    const user = { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin === 1, avatar: updated.avatar || null };
    logger.info(`📷 Admin ${req.user.id} a modifié l'avatar de user ${id}: ${avatarUrl}`);
    res.json({ success: true, user, avatarUrl });
  } catch (error) {
    logger.error('Erreur upload avatar utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer l'avatar d'un utilisateur (admin)
app.delete('/api/users/:id/avatar', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const target = db.prepare('SELECT avatar FROM users WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    if (target.avatar) {
      const filePath = path.join(__dirname, '..', 'public', target.avatar);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(id);
    logger.info(`🗑️ Admin ${req.user.id} a supprimé l'avatar de user ${id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur suppression avatar utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour créer un dossier (sécurisé)
app.post('/api/create-folder', authenticateToken, (req, res) => {
  try {
    const { path: folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Chemin du dossier manquant' });
    }
    
    // Sécurité : vérifier que le chemin reste dans le répertoire attachments
    const safePath = sanitizePath(attachmentsPath, folderPath.replace(attachmentsPath, ''));
    if (!safePath) {
      return res.status(403).json({ error: 'Chemin non autorisé' });
    }
    
    // Créer le dossier récursivement (avec tous les parents)
    fs.mkdirSync(safePath, { recursive: true });
    
    res.json({ success: true, path: safePath });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Configuration de multer pour l'upload de fichiers
// Configuration de multer pour l'upload de fichiers - upload temporaire
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'attachments', 'TEMP');
    
    // Créer le dossier temporaire s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Nom temporaire unique
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accepter uniquement les PDF (pour l'upload de BL)
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'));
    }
  }
});

// Upload de pièces jointes génériques (tous types de fichiers acceptés)
const uploadAttachment = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: function (req, file, cb) {
    // Accepter tous les types de fichiers courants
    const allowedMimes = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'audio/mpeg', 'audio/wav',
      'application/octet-stream'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`));
    }
  }
});

// Endpoint pour uploader un BL (sécurisé)
app.post('/api/upload-bl', authenticateToken, upload.single('pdf'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    if (!req.body.affaireId) {
      return res.status(400).json({ error: 'affaireId requis' });
    }
    
    // Sécurité : valider l'identifiant
    if (!isValidAffaireId(req.body.affaireId)) {
      return res.status(400).json({ error: 'Identifiant d\'affaire invalide' });
    }
    
    // Déplacer le fichier du dossier TEMP vers le dossier de l'affaire
    const affaireDir = sanitizePath(attachmentsPath, req.body.affaireId);
    if (!affaireDir) {
      return res.status(403).json({ error: 'Chemin non autorisé' });
    }
    
    if (!fs.existsSync(affaireDir)) {
      fs.mkdirSync(affaireDir, { recursive: true });
    }
    
    // Extraire le nom de fichier original (enlever le timestamp)
    const originalName = req.file.originalname.replace(/^\d+-/, '');
    const finalPath = path.join(affaireDir, originalName);
    
    // Déplacer le fichier
    fs.renameSync(req.file.path, finalPath);
    
    const relativePath = path.join('attachments', req.body.affaireId, originalName);
    
    res.json({ 
      success: true, 
      path: relativePath,
      filename: originalName
    });
  } catch (error) {
    logger.error('❌ Erreur upload BL:', error);
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Endpoint pour uploader des pièces jointes génériques (sécurisé)
app.post('/api/upload-attachment', authenticateToken, (req, res) => {
  uploadAttachment.single('file')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }
      
      if (!req.body.affaireId) {
        return res.status(400).json({ error: 'affaireId requis' });
      }
      
      // Sécurité : valider l'identifiant
      if (!isValidAffaireId(req.body.affaireId)) {
        return res.status(400).json({ error: 'Identifiant d\'affaire invalide' });
      }
      
      // Déplacer le fichier du dossier TEMP vers le dossier de l'affaire
      const affaireDir = sanitizePath(attachmentsPath, req.body.affaireId);
      if (!affaireDir) {
        return res.status(403).json({ error: 'Chemin non autorisé' });
      }
      
      if (!fs.existsSync(affaireDir)) {
        fs.mkdirSync(affaireDir, { recursive: true });
      }
      
      // Extraire le nom de fichier original (enlever le timestamp)
      const originalName = req.file.originalname.replace(/^\d+-/, '');
      const finalPath = path.join(affaireDir, originalName);
      
      // Déplacer le fichier
      fs.renameSync(req.file.path, finalPath);
      
      const relativePath = path.join('attachments', req.body.affaireId, originalName);
      
      res.json({ 
        success: true, 
        path: relativePath,
        filename: originalName,
        url: `/attachments/${req.body.affaireId}/${originalName}`
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: 'Erreur serveur interne' });
    }
  });
});

// Endpoint pour lister les fichiers d'une affaire (sécurisé)
app.get('/api/attachments/:affaireId', authenticateToken, (req, res) => {
  try {
    const affaireId = req.params.affaireId;
    
    // Sécurité : valider l'identifiant
    if (!isValidAffaireId(affaireId)) {
      return res.status(400).json({ error: 'Identifiant d\'affaire invalide' });
    }
    
    const dirPath = sanitizePath(attachmentsPath, affaireId);
    if (!dirPath) {
      return res.status(403).json({ error: 'Chemin non autorisé' });
    }
    
    // Vérifier si le dossier existe
    if (!fs.existsSync(dirPath)) {
      return res.json({ files: [] });
    }
    
    // Fonction pour formater la taille
    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };
    
    // Lire les fichiers du dossier
    const files = fs.readdirSync(dirPath)
      .filter(file => !file.startsWith('.')) // Ignorer les fichiers cachés
      .map(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: formatSize(stats.size),
          sizeBytes: stats.size,
          url: `/attachments/${affaireId}/${file}`,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Trier par date décroissante
    
    res.json({ files });
  } catch (error) {
    logger.error('Erreur liste fichiers:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Endpoint pour lister les affaires ayant des pièces jointes (sécurisé)
app.get('/api/attachments-index', authenticateToken, (req, res) => {
  try {
    const attachDir = path.join(__dirname, '..', 'public', 'attachments');
    if (!fs.existsSync(attachDir)) {
      return res.json({ affaires: [], counts: {} });
    }
    const affaires = [];
    const counts = {};
    fs.readdirSync(attachDir).forEach(name => {
      if (name.startsWith('.') || name === 'TEMP') return;
      const subDir = path.join(attachDir, name);
      if (!fs.statSync(subDir).isDirectory()) return;
      const files = fs.readdirSync(subDir).filter(f => !f.startsWith('.'));
      if (files.length > 0) {
        affaires.push(name);
        counts[name] = files.length;
      }
    });
    res.json({ affaires, counts });
  } catch (error) {
    logger.error('Erreur attachments-index:', error);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Endpoint pour supprimer une pièce jointe (sécurisé)
app.delete('/api/attachments/:affaireId/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { affaireId, filename } = req.params;
    
    // Sécurité : valider les identifiants
    if (!isValidAffaireId(affaireId)) {
      return res.status(400).json({ error: 'Identifiant d\'affaire invalide' });
    }
    
    const safePath = sanitizePath(attachmentsPath, path.join(affaireId, filename));
    if (!safePath) {
      return res.status(403).json({ error: 'Chemin non autorisé' });
    }
    
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    
    fs.unlinkSync(safePath);
    
    res.json({ success: true, message: `${filename} supprimé` });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erreur serveur interne' });
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
    const target = stats.find(s => s.name === name);
    if (!target) return res.status(404).json({ error: `Cache '${name}' non trouvé` });
    // Clear by name
    const cache = ALL_CACHES.find(c => c.name === name);
    if (cache) cache.clear();
  } else {
    ALL_CACHES.forEach(c => c.clear());
  }
  res.json({ success: true, message: name ? `Cache '${name}' vidé` : 'Tous les caches vidés' });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Serveur backend démarré sur http://0.0.0.0:${PORT}`);
  logger.info(`📡 Accessible depuis le réseau sur http://192.168.205.75:${PORT}`);
  // Initialiser le service email
  initEmailTransporter(db);
  // Lancer le nettoyage périodique des fichiers TEMP
  cleanTempFiles();
  setInterval(cleanTempFiles, 6 * 60 * 60 * 1000); // toutes les 6h
});

/**
 * Nettoyage des fichiers temporaires > 24h dans /attachments/TEMP/
 */
function cleanTempFiles() {
  const tempDir = path.join(__dirname, '..', 'public', 'attachments', 'TEMP');
  try {
    if (!fs.existsSync(tempDir)) return;
    const files = fs.readdirSync(tempDir);
    const maxAge = 24 * 60 * 60 * 1000; // 24h
    let removed = 0;
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (Date.now() - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          removed++;
        }
      } catch { /* ignore */ }
    }
    if (removed > 0) logger.info(`🧹 TEMP cleanup: ${removed} fichier(s) supprimé(s)`);
  } catch (err) {
    logger.error('Erreur nettoyage TEMP:', err.message);
  }
}

// Gestion de l'arrêt propre du serveur
function gracefulShutdown(signal) {
  logger.info(`\n⚠️  Signal ${signal} reçu - Arrêt en cours...`);
  
  // Faire un dernier checkpoint de la base de données
  logger.info('💾 Sauvegarde finale de la base de données...');
  checkpointDatabase();
  
  // Fermer proprement la base de données
  closeDatabase();
  
  logger.info('✅ Arrêt propre terminé');
  process.exit(0);
}

// Intercept les signaux d'arrêt
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('❌ Exception non capturée:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promesse rejetée non gérée:', reason);
  gracefulShutdown('unhandledRejection');
});
