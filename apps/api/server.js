// Charger le fichier .env AVANT tous les autres imports (ESM hoisting)
import { isDev, envFile } from './env.js';
import { fileURLToPath as _fileURLToPath } from 'url';
import { dirname as _dirname, join as _join } from 'path';

const __serverFile = _fileURLToPath(import.meta.url);
const __serverDir = _dirname(__serverFile);

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

import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { closeDatabase, checkpointDatabase } from './database.js';
import logger from './logger.js';

// ── Configs & Middlewares extraits ──
import { helmetConditional } from './config/helmet.js';
import { corsMiddleware } from './config/cors.js';
import { authLimiter, generalLimiter } from './config/rateLimiter.js';
import { createAuthenticateToken } from './middleware/authenticate.js';
import { requireAdmin, requireMaintenanceAccessCompat as requireMaintenanceAccess, requireEquipmentMaintenanceAccess, requireCatalogAccess, requireTruckAccess } from './middleware/authorize.js';
import { xssSanitize } from './middleware/sanitize.js';
import { errorHandler } from './middleware/errorHandler.js';

// ── Routes ──
import { setupClientsRoutes, setupDriversRoutes, setupLocationsRoutes, setupGaragesRoutes, setupConfigRoutes } from './routes.js';
import { setupPersonsRoutes, setupSkillsRoutes, setupAvailabilitiesRoutes, setupMissionsRoutes, setupAssignmentsRoutes } from './personnelRoutes.js';
import { setupEquipmentCategoriesRoutes, setupEquipmentRoutes, setupEquipmentAssignmentsRoutes, setupSavTicketsRoutes, setupEquipmentListsRoutes } from './equipmentRoutes.js';
import { setupSuppliersRoutes, setupOrdersRoutes, setupQuotesRoutes, setupMaterialRequestsRoutes, setupSupplierDocumentsRoutes } from './ordersRoutes.js';
import { setupMessagingRoutes } from './messagingRoutes.js';
import { setupLeaveRoutes } from './leaveRoutes.js';
import { setupReservationEquipmentRoutes } from './catalogRoutes.js';
import { setupMailingRoutes } from './mailingRoutes.js';
import { setupStockCategoriesRoutes, setupStockItemsRoutes, setupStockMovementsRoutes, setupStockImportRoutes, setupStockStatsRoutes } from './stockRoutes.js';
import { setupPlanningRoutes } from './planningRoutes.js';
import { setupDisplayRoutes } from './displayRoutes.js';
import { setupAnnuaireClientsRoutes, setupAnnuaireSuppliersRoutes, setupAnnuairePrestatairesRoutes, setupAnnuaireContactsRoutes, setupAnnuaireLookupsRoutes, setupAnnuaireSearchRoutes, setupAnnuaireImportRoutes } from './annuaireRoutes.js';
import { setupAuthRoutes } from './authRoutes.js';
import { setupVehicleRoutes } from './vehicleRoutes.js';
import { setupAdminRoutes } from './adminRoutes.js';
import { setupAffairesRoutes } from './affairesRoutes.js';
import { setupProfileRoutes } from './profileRoutes.js';
import { setupAttachmentsRoutes } from './attachmentsRoutes.js';
import { setupSupplierCatalogRoutes } from './supplierCatalogRoutes.js';
import { setupInventoryRoutes } from './inventoryRoutes.js';
import { setupVideoRoutes } from './videoRoutes.js';
import { setupGoogleCalendarRoutes } from './googleCalendarRoutes.js';
import { initEmailTransporter } from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // [AUDIT] Nécessaire pour rate limiter derrière reverse proxy
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

// ── Middlewares globaux (configs extraites) ──
app.use(compression({ threshold: 1024 }));
app.use(helmetConditional);
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(xssSanitize);

// Rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/force-login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/set-new-password', authLimiter);
app.use('/api/auth/self-reset-password', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Créer le middleware d'authentification avec le secret JWT
const authenticateToken = createAuthenticateToken(JWT_SECRET);

// Servir les fichiers statiques depuis le dossier public/attachments
const attachmentsPath = path.join(__dirname, '..', '..', 'public', 'attachments');
app.use('/attachments', express.static(attachmentsPath, { maxAge: '1h' }));

// Servir les BL/BP importés
app.use('/bl-imports', express.static(path.join(__dirname, '..', '..', 'public', 'bl-imports'), { maxAge: '1h' }));

// Servir les avatars
const avatarsPath = path.join(__dirname, '..', '..', 'public', 'avatars');
if (!fs.existsSync(avatarsPath)) fs.mkdirSync(avatarsPath, { recursive: true });
app.use('/avatars', express.static(avatarsPath, { maxAge: '1d' }));

// ── Client TV standalone (fusion calendar-dashboard) ──
const staticCacheOpts = { maxAge: '7d' };
app.use('/display-gifs', express.static(path.join(__dirname, '..', '..', 'public', 'display-gifs'), staticCacheOpts));
app.use('/display-logo', express.static(path.join(__dirname, '..', '..', 'public', 'display-logo'), staticCacheOpts));
app.use('/display-sneaky', express.static(path.join(__dirname, '..', '..', 'public', 'display-sneaky'), staticCacheOpts));
app.use('/display-media', express.static(path.join(__dirname, '..', '..', 'public', 'display-media'), staticCacheOpts));
app.use('/Logos', express.static(path.join(__dirname, '..', '..', 'public', 'Logos'), staticCacheOpts));
app.get('/SNCF.wav', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'SNCF.wav'));
});
const tvClientDir = path.join(__dirname, '..', 'tv-client');
app.use('/tv-client', (req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
}, express.static(tvClientDir));
app.get('/tv', (_req, res) => res.redirect('/tv-client/index.html'));

// ── Compat port 3001 : ancien client calendar-dashboard ──
app.use((req, res, next) => {
  const port = req.socket.localPort;
  if (port === 3001 && req.path === '/') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.sendFile(path.join(tvClientDir, 'index.html'));
  }
  if (port === 3001 && ['styles.css', 'main.js', 'manifest.json'].includes(req.path.slice(1))) {
    const filePath = path.join(tvClientDir, req.path.slice(1));
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
  }
  next();
});

// Routes Legacy (Clients, Conducteurs, Lieux, Garages, Config)
setupClientsRoutes(app, authenticateToken, requireAdmin);
setupDriversRoutes(app, authenticateToken, requireAdmin);
setupLocationsRoutes(app, authenticateToken, requireAdmin);
setupGaragesRoutes(app, authenticateToken, requireAdmin);
setupConfigRoutes(app, authenticateToken, requireAdmin);

// Routes Messagerie
setupMessagingRoutes(app, authenticateToken);

// Routes Mailing
setupMailingRoutes(app, authenticateToken, requireAdmin);

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

// Routes Équipements Réservations (ex-catalogRoutes — catalogue interne supprimé)
setupReservationEquipmentRoutes(app, authenticateToken);

// Routes Articles Fournisseurs (import catalogues PDF)
setupSupplierCatalogRoutes(app, authenticateToken, requireCatalogAccess);

// Routes Module Stock & Pièces
setupStockCategoriesRoutes(app, authenticateToken, requireAdmin);
setupStockItemsRoutes(app, authenticateToken, requireAdmin);
setupStockMovementsRoutes(app, authenticateToken, requireAdmin);
setupStockImportRoutes(app, authenticateToken, requireAdmin);
setupStockStatsRoutes(app, authenticateToken);

// Routes Module Planning (Affichage dynamique + Planification + Import BL)
setupPlanningRoutes(app, authenticateToken, requireAdmin);

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

// Routes extraites de server.js — Phase 2 Refactoring
setupAuthRoutes(app, authenticateToken, { JWT_SECRET, JWT_EXPIRY_DAYS, isDev });
setupVehicleRoutes(app, authenticateToken, requireAdmin, requireMaintenanceAccess);
setupAdminRoutes(app, authenticateToken, requireAdmin, { JWT_SECRET, JWT_EXPIRY_DAYS });
setupAffairesRoutes(app, authenticateToken, requireAdmin);
setupProfileRoutes(app, authenticateToken, requireAdmin);
setupAttachmentsRoutes(app, authenticateToken, requireAdmin);

// Routes Module Inventaire (emplacements, prix, anomalies, stats, ABC, exports)
setupInventoryRoutes(app, authenticateToken);

// Routes Module Surveillance Vidéo (caméras CRUD, WebRTC, PTZ, snapshots, logs)
setupVideoRoutes(app, authenticateToken, requireAdmin);

// Routes Google Calendar Proxy (CRIT-11: tokens Google côté serveur)
setupGoogleCalendarRoutes(app, authenticateToken);

// Debug endpoints
if (isDev) {
  app.get('/api/debug/route-test', (req, res) => {
    res.json({ ok: true, isDev, env: process.env.NODE_ENV, args: process.argv });
  });

  app.get('/api/debug/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods).join(',');
        routes.push({ path: middleware.route.path, methods });
      }
    });
    res.json({ routes });
  });
}

if (isDev) {
  app.get('/api/debug/session', authenticateToken, (req, res) => {
    try {
      const sessions = db.prepare('SELECT id, user_id, created_at, expires_at, last_activity FROM active_sessions WHERE user_id = ?')
        .all(req.user.id);
      res.json({
        user: req.user,
        sessions,
      });
    } catch (error) {
      logger.error('Erreur debug/session:', error.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
}

// Middleware centralisé de gestion d'erreurs (doit être APRÈS toutes les routes)
app.use(errorHandler);

const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Serveur backend démarré sur http://0.0.0.0:${PORT}`);
  logger.info(`📡 Accessible depuis le réseau sur http://${SERVER_HOST}:${PORT}`);
  // Initialiser le service email
  initEmailTransporter(db);
  // Lancer le nettoyage périodique des fichiers TEMP
  cleanTempFiles();
  setInterval(cleanTempFiles, 6 * 60 * 60 * 1000); // toutes les 6h

  // Nettoyage périodique des sessions expirées (toutes les 30 min)
  cleanExpiredSessions();
  setInterval(cleanExpiredSessions, 30 * 60 * 1000);
});

// ── Serveur secondaire sur port 3001 — Client TV standalone ──
// Rétrocompatibilité avec les navigateurs des écrans TV (ex calendar-dashboard)
// Sert la même app Express, les écrans existants continuent de fonctionner
// En DEV, on ne démarre PAS ce serveur pour laisser la production servir les écrans TV
if (!isDev) {
const TV_PORT = 3001;
const tvServer = http.createServer(app);
tvServer.listen(TV_PORT, '0.0.0.0', () => {
  logger.info(`📺 Client TV accessible sur http://${SERVER_HOST}:${TV_PORT}/tv-client/`);
});
tvServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.warn(`⚠️  Port ${TV_PORT} déjà utilisé — le client TV reste accessible via http://${SERVER_HOST}:${PORT}/tv`);
  } else {
    logger.error('Erreur serveur TV:', err.message);
  }
});
} else {
  logger.info('📺 Mode DEV — serveur TV (port 3001) non démarré, la production garde la main');
}

/**
 * Nettoyage des sessions expirées et tokens de reset expirés
 */
function cleanExpiredSessions() {
  try {
    const sessResult = db.prepare("DELETE FROM active_sessions WHERE expires_at < datetime('now')").run();
    const tokenResult = db.prepare("UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL WHERE reset_token_expires < datetime('now')").run();
    if (sessResult.changes > 0 || tokenResult.changes > 0) {
      logger.info(`🧹 Session cleanup: ${sessResult.changes} session(s), ${tokenResult.changes} token(s) expirés supprimés`);
    }
  } catch (err) {
    logger.error('Erreur nettoyage sessions:', err.message);
  }
}

/**
 * Nettoyage des fichiers temporaires > 24h dans /attachments/TEMP/
 */
function cleanTempFiles() {
  const tempDir = path.join(__dirname, '..', '..', 'public', 'attachments', 'TEMP');
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
