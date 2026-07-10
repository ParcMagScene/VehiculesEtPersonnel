// Charger le fichier .env AVANT tous les autres imports (ESM hoisting)
import { dirname as _dirname } from 'path';
import { fileURLToPath as _fileURLToPath } from 'url';

import { envFile, isDev } from './env.js';

const __serverFile = _fileURLToPath(import.meta.url);
const __serverDir = _dirname(__serverFile);

if (isDev) {
  logger.info('');
  logger.info('═══════════════════════════════════════════');
  logger.info('  🔧 MODE DÉVELOPPEMENT — Serveur isolé');
  logger.info(`  📄 Env: ${envFile}`);
  logger.info(`  🔌 Port: ${process.env.PORT || 3002}`);
  logger.info(`  💾 DB: ${process.env.DB_PATH || 'vehicules-dev.db'}`);
  logger.info("  ⚠️  La production n'est PAS affectée");
  logger.info('═══════════════════════════════════════════');
  logger.info('');
}

import compression from 'compression';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { setupAdminRoutes } from './adminRoutes.js';
import { setupAffairesRoutes } from './affairesRoutes.js';
import {
  setupAnnuaireClientsRoutes,
  setupAnnuaireContactsRoutes,
  setupAnnuaireImportRoutes,
  setupAnnuaireLookupsRoutes,
  setupAnnuaireMatchingRoutes,
  setupAnnuairePrestatairesRoutes,
  setupAnnuaireSearchRoutes,
  setupAnnuaireSuppliersRoutes,
} from './annuaireRoutes.js';
import { setupAttachmentsRoutes } from './attachmentsRoutes.js';
import { setupAuthRoutes } from './authRoutes.js';
import { setupReservationEquipmentRoutes } from './catalogRoutes.js';
// ── Routes ── [P1-15] split de l'ancien routes.js (799 lignes) en 5 modules dédiés
import { setupClientsRoutes } from './clientsRoutes.js';
import { corsMiddleware } from './config/cors.js';
// ── Configs & Middlewares extraits ──
import { helmetConditional } from './config/helmet.js';
import {
  authLimiter,
  generalLimiter,
  googleCalendarLimiter,
  personalActionsLimiter,
  sensitiveEndpointLimiter,
} from './config/rateLimiter.js';
import { setupConfigRoutes } from './configRoutes.js';
import { setupControlesPeriodiquesRoutes } from './controlesPeriodiquesRoutes.js';
import db, { checkpointDatabase, closeDatabase } from './database.js';
import { setupDisplayRoutes } from './displayRoutes.js';
import { setupDriversRoutes } from './driversRoutes.js';
import { initEmailTransporter } from './emailService.js';
import {
  setupEquipmentAssignmentsRoutes,
  setupEquipmentCategoriesRoutes,
  setupEquipmentListsRoutes,
  setupEquipmentRoutes,
  setupSavTicketsRoutes,
} from './equipmentRoutes.js';
import { startEshopCatalogAutoSync, stopEshopCatalogAutoSync } from './eshopCatalogSync.js';
import { setupEshopRoutes } from './eshopRoutes.js';
import { setupGaragesRoutes } from './garagesRoutes.js';
import { setupGoogleRoutes } from './googleRoutes.js';
import { setupInventoryRoutes } from './inventoryRoutes.js';
import { setupLabelsRoutes } from './labelsRoutes.js';
import { setupLeaveRoutes } from './leaveRoutes.js';
import { setupLocationsRoutes } from './locationsRoutes.js';
import { setupLocmatImportRoutes } from './locmatImportRoutes.js';
import logger from './logger.js';
import { setupMailingRoutes } from './mailingRoutes.js';
import { setupMessagingRoutes } from './messagingRoutes.js';
import { createAuthenticateToken } from './middleware/authenticate.js';
import {
  requireAdmin,
  requireCatalogAccess,
  requireEquipmentMaintenanceAccess,
  requireMaintenanceAccessCompat as requireMaintenanceAccess,
  requireNotReadOnly,
} from './middleware/authorize.js';
import { csrfOriginCheck } from './middleware/csrfOriginCheck.js';
import { errorHandler } from './middleware/errorHandler.js';
import { httpLogger } from './middleware/httpLogger.js';
import { xssSanitize } from './middleware/sanitize.js';
import { initSentry, sentryErrorHandler, sentryRequestHandler } from './observability/sentry.js';
import {
  setupMaterialRequestsRoutes,
  setupOrdersRoutes,
  setupQuotesRoutes,
  setupSupplierDocumentsRoutes,
  setupSuppliersRoutes,
} from './ordersRoutes.js';
import { setupPersonalActionsRoutes } from './personalActionsRoutes.js';
import {
  setupAssignmentsRoutes,
  setupAvailabilitiesRoutes,
  setupMissionsRoutes,
  setupPersonsRoutes,
  setupSkillsRoutes,
} from './personnelRoutes.js';
import { setupPhotoThumbRoutes } from './photoThumbRoutes.js';
import { setupPlanningRoutes } from './planningRoutes.js';
import { stopPlanningRolloverCron } from './planningRoutes.js';
import { setupProfileRoutes } from './profileRoutes.js';
import { setupPvImportRoutes } from './pvImportRoutes.js';
import { setupSavRoutes } from './savRoutes.js';
import { logSecurityEvent } from './securityLog.js';
import { startControlesScheduler, stopControlesScheduler } from './services/controlesScheduler.js';
import { registerDefaultPersonalActionHandlers } from './services/personalActionHandlers.js';
import { setupSonosRoutes } from './sonosRoutes.js';
import {
  setupStockCategoriesRoutes,
  setupStockImportRoutes,
  setupStockItemsRoutes,
  setupStockMovementsRoutes,
  setupStockStatsRoutes,
} from './stockRoutes.js';
import { setupSuiviRoutes } from './suiviRoutes.js';
import { setupSupplierCatalogRoutes } from './supplierCatalogRoutes.js';
import { setupTOTPRoutes } from './totpRoutes.js';
import { setupAffairesV2Routes } from './v2/affairesRoutes.js';
import { setupConflictsV2Routes } from './v2/conflictsRoutes.js';
import { setupDisplayV2Routes } from './v2/displayRoutes.js';
import { setupEquipmentUidV2Routes } from './v2/equipmentUidRoutes.js';
import { setupLeavesV2Routes } from './v2/leavesRoutes.js';
import { setupLocationsV2Routes } from './v2/locationsRoutes.js';
import { setupV2MetaRoutes } from './v2/metaRoutes.js';
import { setupPlanningV2Routes } from './v2/planningRoutes.js';
import { setupSavV2Routes } from './v2/savRoutes.js';
import { setupVehicleRoutes } from './vehicleRoutes.js';
import { setupVideoRoutes } from './videoRoutes.js';
import { attachWebSocketServer } from './ws/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // [AUDIT] Nécessaire pour rate limiter derrière reverse proxy
const PORT = process.env.PORT || 3002;
// [SEC PHASE 1] JWT_SECRET : plus de fallback inline vers une valeur connue.
// - Prod : exit si manquant/faible/par défaut.
// - Dev  : génération d'un secret éphémère fort en mémoire (les tokens déjà
//   émis seront invalidés au restart — acceptable en dev).
let JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY_DAYS = parseInt(process.env.JWT_EXPIRY_DAYS || '7', 10);

const KNOWN_DEFAULT_SECRETS = [
  'your-secret-key-change-in-production',
  'CHANGEZ_CETTE_CLE',
  'dev-secret-key-not-for-production',
  'secret',
  'changeme',
];

const _jwtSecretMissing =
  !JWT_SECRET || KNOWN_DEFAULT_SECRETS.includes(JWT_SECRET) || JWT_SECRET.length < 32;

if (_jwtSecretMissing) {
  if (process.env.NODE_ENV === 'production') {
    logger.error(
      '❌ FATAL: JWT_SECRET manquant, par défaut, ou trop court (<32 chars) interdit en production. Définissez JWT_SECRET dans .env',
    );
    process.exit(1);
  }
  // Dev : secret éphémère cryptographiquement fort (jamais basé sur une valeur publique connue)
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  logger.warn(
    '⚠️  JWT_SECRET manquant/faible en dev — secret éphémère généré pour cette session uniquement (les tokens existants seront invalidés au restart). Définissez JWT_SECRET dans apps/api/.env pour persister.',
  );
}

// ── Middlewares globaux (configs extraites) ──
// [S2-4] Sentry init + requestHandler en tout début de stack (no-op si SENTRY_DSN absent)
await initSentry();
app.use(sentryRequestHandler());
app.use(compression({ threshold: 1024 }));
app.use(helmetConditional);
app.use(corsMiddleware);
app.use(cookieParser());
// [AUDIT FIX H3] Limite body JSON réduite (les imports volumineux utilisent multer)
app.use(express.json({ limit: '1mb' }));
app.use(xssSanitize);
// [SEC PHASE 1] Protection CSRF par vérification d'Origin/Referer sur les
// requêtes mutantes porteuses d'un cookie d'auth. Doit être après cookieParser.
app.use(csrfOriginCheck);
app.use(httpLogger);

// Rate limiting
app.use('/api/', generalLimiter);

// ─────────────────────────────────────────────────────────────
// S1-05 — Timeout global par requête (30s)
// Évite les connexions zombies qui saturent l'event loop SQLite single-thread.
// Exclusions : SSE, uploads, imports volumineux (long polling légitime).
// ─────────────────────────────────────────────────────────────
const REQ_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 30_000;
app.use((req, res, next) => {
  const p = req.path || '';
  if (
    p.startsWith('/api/messaging/stream') ||
    p.startsWith('/api/messaging/sse') ||
    p.startsWith('/api/sse') ||
    p.startsWith('/api/uploads/') ||
    p.startsWith('/api/imports/') ||
    p.startsWith('/api/sav/import') ||
    p.startsWith('/api/locmat/import')
  ) {
    return next();
  }
  req.setTimeout(REQ_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      logger.warn(`⏱ Request timeout (${REQ_TIMEOUT_MS}ms): ${req.method} ${p}`);
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  next();
});

// [PHASE 6] Health check — pas d'auth, utilisé par PM2/monitoring
const startedAt = Date.now();
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, uptime: Math.floor((Date.now() - startedAt) / 1000), db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'error', error: err.message });
  }
});

// Renvoie les IPv4 LAN du serveur (utilisé par l'écran "Accès mobile"
// pour générer un QR code utilisable depuis un téléphone, même quand
// l'admin consulte l'app via http://localhost).
// [SEC PHASE 3] Endpoint de réception des rapports CSP (Report-Only).
// Accepte les deux formats : application/csp-report (legacy) et application/json.
// Pas de PII collectée ici, juste la directive violée + l'URL bloquée.
app.post(
  '/api/security/csp-report',
  express.json({ type: ['application/csp-report', 'application/json'], limit: '32kb' }),
  (req, res) => {
    try {
      const report = req.body?.['csp-report'] || req.body || {};
      logSecurityEvent('csp.report', {
        ip: req.ip,
        documentUri: report['document-uri'],
        blockedUri: report['blocked-uri'],
        violatedDirective: report['violated-directive'] || report['effective-directive'],
        sourceFile: report['source-file'],
        lineNumber: report['line-number'],
      });
    } catch {
      /* ignore */
    }
    res.status(204).end();
  },
);

// Rate limiters auth
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/force-login', authLimiter);
app.use('/api/auth/register', authLimiter);
// [SEC PHASE 2] Bruteforce PIN : limite stricte (PIN = 4 chiffres, brute trivial sans rate-limit)
app.use('/api/auth/login-pin', authLimiter);
app.use('/api/auth/forgot-password', sensitiveEndpointLimiter);
// [SEC PHASE 2] Auth personnelle (PIN/password vérifié côté serveur) sur /suivi/personal-auth
app.use('/api/suivi/personal-auth', authLimiter);
// Auth éphémère (compte Equipe → actions personnelles)
app.use('/api/personal-actions', personalActionsLimiter);
// [SEC-9.1] Rate limiters sur endpoints sensibles publics
// [CWE-640 MITIGATION] Le reset direct a été retiré : self-reset-password ne fait
// plus que demander un OTP (flow par code obligatoire côté API).
// On applique un rate-limit qui compte aussi les succès sur tout le flow public
// de réinitialisation pour réduire l'énumération et l'abus de déclenchements OTP.
app.use('/api/auth/self-reset-password', sensitiveEndpointLimiter);
app.use('/api/auth/check-reset', sensitiveEndpointLimiter);
app.use('/api/auth/set-new-password', sensitiveEndpointLimiter);
// Les GET /api/access-requests/* sont protégés par authenticateToken+requireAdmin
app.post('/api/access-requests', sensitiveEndpointLimiter);
app.post('/api/access-requests/check-email', sensitiveEndpointLimiter);

// Créer le middleware d'authentification avec le secret JWT
const authenticateToken = createAuthenticateToken(JWT_SECRET);

// Renvoie les IPv4 LAN du serveur (utilisé par l'écran "Accès mobile"
// pour générer un QR code utilisable depuis un téléphone, même quand
// l'admin consulte l'app via http://localhost).
app.get('/api/network-info', authenticateToken, requireAdmin, (req, res) => {
  try {
    const ifaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(ifaces)) {
      for (const info of ifaces[name] || []) {
        if (info.family === 'IPv4' && !info.internal) {
          ips.push({ iface: name, address: info.address });
        }
      }
    }
    res.json({ success: true, ips });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// [SEC] Fichiers statiques sensibles — protégés par authentification
const attachmentsPath = path.join(__dirname, '..', '..', 'public', 'attachments');
app.use('/attachments', authenticateToken, express.static(attachmentsPath, { maxAge: '1h' }));

// [AUDIT Sprint 1] Catalogues fournisseurs PDF — protégés par authentification
const cataloguesPath = path.join(__dirname, '..', '..', 'public', 'catalogues');
app.use('/catalogues', authenticateToken, express.static(cataloguesPath, { maxAge: '1h' }));

// Servir les BL/BP importés
app.use(
  '/bl-imports',
  authenticateToken,
  express.static(path.join(__dirname, '..', '..', 'public', 'bl-imports'), { maxAge: '1h' }),
);

// Servir les PV (Procès-Verbaux de contrôle) — sensibles, protégés
const pvPath = path.join(__dirname, '..', '..', 'public', 'pv');
if (!fs.existsSync(pvPath)) fs.mkdirSync(pvPath, { recursive: true });
app.use('/pv', authenticateToken, express.static(pvPath, { maxAge: '1h' }));

// Servir les avatars
const avatarsPath = path.join(__dirname, '..', '..', 'public', 'avatars');
if (!fs.existsSync(avatarsPath)) fs.mkdirSync(avatarsPath, { recursive: true });
app.use('/avatars', express.static(avatarsPath, { maxAge: '1d' }));

// ── Client TV standalone (fusion calendar-dashboard) ──
const staticCacheOpts = { maxAge: '7d' };
app.use(
  '/display-gifs',
  express.static(path.join(__dirname, '..', '..', 'public', 'display-gifs'), staticCacheOpts),
);
app.use(
  '/display-logo',
  express.static(path.join(__dirname, '..', '..', 'public', 'display-logo'), staticCacheOpts),
);
app.use(
  '/display-sneaky',
  express.static(path.join(__dirname, '..', '..', 'public', 'display-sneaky'), staticCacheOpts),
);
app.use(
  '/display-media',
  express.static(path.join(__dirname, '..', '..', 'public', 'display-media'), staticCacheOpts),
);
app.use(
  '/Logos',
  express.static(path.join(__dirname, '..', '..', 'public', 'Logos'), staticCacheOpts),
);
app.use(
  '/radio-logos',
  express.static(path.join(__dirname, '..', '..', 'public', 'radio-logos'), staticCacheOpts),
);
app.use(
  '/sonos-logos',
  express.static(path.join(__dirname, '..', '..', 'public', 'sonos-logos'), staticCacheOpts),
);
app.get('/SNCF.wav', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'SNCF.wav'));
});
const tvClientDir = path.join(__dirname, '..', 'tv-client');
app.use(
  '/tv-client',
  (req, res, next) => {
    // Désactiver le cache pour TOUS les fichiers TV (HTML, CSS, JS)
    // pour éviter les décalages entre Pi / navigateur local
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  },
  express.static(tvClientDir),
);
app.get('/tv', (_req, res) => res.redirect('/tv-client/index.html'));

// ── Compat port 3001 : ancien client calendar-dashboard ──
// [SEC PHASE 1] Whitelist + basename() + resolve()-startsWith en defense in depth
// pour bloquer tout path traversal même si Express ne normalise pas req.path.
const TV_LEGACY_WHITELIST = new Set(['styles.css', 'main.js', 'manifest.json']);
const _tvClientDirResolved = path.resolve(tvClientDir);
app.use((req, res, next) => {
  const port = req.socket.localPort;
  if (port === 3001 && req.path === '/') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.sendFile(path.join(tvClientDir, 'index.html'));
  }
  if (port === 3001) {
    const requested = path.basename(req.path); // strip ../ et chemins
    if (TV_LEGACY_WHITELIST.has(requested)) {
      const filePath = path.resolve(tvClientDir, requested);
      // Garde-fou : le chemin résolu doit rester sous tvClientDir
      if (
        filePath.startsWith(_tvClientDirResolved + path.sep) ||
        filePath === _tvClientDirResolved
      ) {
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
      }
    }
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
// Module SAV unifié (Phase 3 — synchro LocMat)
setupSavRoutes(app, authenticateToken, requireAdmin, requireEquipmentMaintenanceAccess);
setupEquipmentListsRoutes(app, authenticateToken, requireAdmin);
// Vignettes WebP à la volée pour /Photos/ (cache disque)
setupPhotoThumbRoutes(app);

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

// Routes Module E-shops (produits externes multi-fournisseurs)
setupEshopRoutes(app, authenticateToken, requireAdmin);

// Routes Module Stock & Pièces
setupStockCategoriesRoutes(app, authenticateToken, requireAdmin);
setupStockItemsRoutes(app, authenticateToken, requireAdmin);
setupStockMovementsRoutes(app, authenticateToken, requireAdmin);
setupStockImportRoutes(app, authenticateToken, requireAdmin);
setupLocmatImportRoutes(app, authenticateToken, requireAdmin);
setupLabelsRoutes(app, authenticateToken, requireAdmin);
setupStockStatsRoutes(app, authenticateToken);

// Routes Module Planning (Affichage dynamique + Planification + Import BL)
setupPlanningRoutes(app, authenticateToken, requireAdmin);

// [Planning v2 — T-P0-03] Namespace API v2 lecture. Protégé par
// FEATURE_V2_PLANNING (404 si off). Coexistence stricte v1/v2.
setupPlanningV2Routes(app, authenticateToken);

// [Display v2 — T-P0-14] Namespace API v2 protocol + skeleton. Protégé
// par FEATURE_V2_DISPLAY (404 si off). Coexistence stricte avec v1.
setupDisplayV2Routes(app, authenticateToken);

// [Locations v2 — T-P0-12] Namespace API v2 (depots + PATCH equipment
// location). Protégé par FEATURE_V2_LOCATIONS (404 si off). Coexistence
// stricte avec les endpoints inventaire v1.
setupLocationsV2Routes(app, authenticateToken, requireAdmin);

// [Affaires v2 — T-P0-09] Namespace API v2 (list cursor + detail + history
// + PATCH audite via affaire_history). Protégé par FEATURE_V2_AFFAIRES
// (404 si off). Coexistence stricte avec /api/affaires v1.
setupAffairesV2Routes(app, authenticateToken);

// [API v2 core — T-P1-01] Discovery global GET /api/v2/meta. Public
// (pas d'auth). Agrege les protocoles des 4 namespaces v2 avec l'etat
// reel de chaque feature flag serveur.
setupV2MetaRoutes(app);

// [Leaves v2 — T-P1-04] Namespace API v2 (calculate + balance mine +
// balance admin). Protégé par FEATURE_V2_LEAVES (404 si off).
// Coexistence stricte avec /api/leaves v1.
setupLeavesV2Routes(app, authenticateToken, requireAdmin);

// [Conflicts v2 — T-P1-05] Namespace API v2 (check des conflits
// agenda pour une personne). Protégé par FEATURE_V2_CONFLICTS
// (404 si off). Aucune ecriture, aucun bloquage sur les mutations
// v1 (availabilities, mission_assignments, task_assignments).
setupConflictsV2Routes(app, authenticateToken);

// [Equipment UID v2 — T-P1-06] Namespace API v2 (audit + regenerate
// UID). Protégé par FEATURE_V2_EQUIPMENT_UID (404 si off).
// Coexistence stricte avec /api/equipment* v1.
setupEquipmentUidV2Routes(app, authenticateToken, requireAdmin);

// [SAV v2 — T-P1-07] Namespace API v2 (parts + machine d'etat).
// Protégé par FEATURE_V2_SAV (404 si off). Coexistence stricte avec
// /api/sav* v1.
setupSavV2Routes(app, authenticateToken);

// Routes Module Dashboard — Affichage Dynamique (écrans, playlists, médias, messages, templates, logs)
setupDisplayRoutes(app, authenticateToken, requireAdmin);

// Routes Module Sonos (contrôle enceintes, zones, favoris, now-playing)
setupSonosRoutes(app, authenticateToken, requireAdmin);

// Routes Module Annuaire (Clients enrichis, Fournisseurs enrichis, Prestataires, Contacts, Référentiels, Import CSV)
setupAnnuaireClientsRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireSuppliersRoutes(app, authenticateToken, requireAdmin);
setupAnnuairePrestatairesRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireContactsRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireLookupsRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireSearchRoutes(app, authenticateToken);
setupAnnuaireImportRoutes(app, authenticateToken, requireAdmin);
setupAnnuaireMatchingRoutes(app, authenticateToken, requireAdmin);

// Routes extraites de server.js — Phase 2 Refactoring
setupAuthRoutes(app, authenticateToken, { JWT_SECRET, JWT_EXPIRY_DAYS, isDev });
setupPersonalActionsRoutes(app, authenticateToken);
registerDefaultPersonalActionHandlers();
setupVehicleRoutes(
  app,
  authenticateToken,
  requireAdmin,
  requireMaintenanceAccess,
  requireNotReadOnly,
);
setupControlesPeriodiquesRoutes(app, authenticateToken, requireAdmin);
setupPvImportRoutes(app, authenticateToken, requireAdmin);
setupAdminRoutes(app, authenticateToken, requireAdmin, { JWT_SECRET, JWT_EXPIRY_DAYS });
setupTOTPRoutes(app, authenticateToken, requireAdmin);
setupAffairesRoutes(app, authenticateToken, requireAdmin);
setupProfileRoutes(app, authenticateToken, requireAdmin);
setupAttachmentsRoutes(app, authenticateToken, requireAdmin);

// Routes Module Inventaire (emplacements, prix, anomalies, stats, ABC, exports)
setupInventoryRoutes(app, authenticateToken);

// Routes Module Surveillance Vidéo (caméras CRUD, WebRTC, PTZ, snapshots, logs)
setupVideoRoutes(app, authenticateToken, requireAdmin);

// Routes Module Suivi du Personnel (fiches quotidiennes, synthèses, PDF)
setupSuiviRoutes(app, authenticateToken, requireAdmin);

// Routes Google Calendar OAuth2 v2 (Authorization Code Flow)
app.use('/api/google', googleCalendarLimiter);
app.use('/api/calendar', googleCalendarLimiter);
setupGoogleRoutes(app, authenticateToken);

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
      const sessions = db
        .prepare(
          'SELECT id, user_id, created_at, expires_at, last_activity FROM active_sessions WHERE user_id = ?',
        )
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
// [S2-4] Sentry errorHandler AVANT le notre pour capturer toutes les exceptions
app.use(sentryErrorHandler());
app.use(errorHandler);

const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';

// ── SSL/TLS — Certificats Let's Encrypt (production uniquement) ──
const sslDir = path.join(__dirname, '..', '..', 'ssl');
const sslKeyPath = path.join(sslDir, 'privkey.pem');
const sslCertPath = path.join(sslDir, 'fullchain.pem');
const hasSSL = !isDev && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

// S1-02 — Initialisation des tâches de fond extraite, appelée dès qu'un
// listener (HTTPS ou HTTP fallback) est opérationnel. Idempotente.
// S3-1 — handles capturés pour cleanup SIGTERM/SIGINT.
let backgroundJobsBooted = false;
let cleanTempFilesTimer = null;
let cleanExpiredSessionsTimer = null;
function bootBackgroundJobs() {
  if (backgroundJobsBooted) return;
  backgroundJobsBooted = true;
  initEmailTransporter(db);
  cleanTempFiles();
  cleanTempFilesTimer = setInterval(cleanTempFiles, 6 * 60 * 60 * 1000);
  cleanExpiredSessions();
  cleanExpiredSessionsTimer = setInterval(cleanExpiredSessions, 30 * 60 * 1000);
  startEshopCatalogAutoSync();
  startControlesScheduler(db);
}

function stopBackgroundJobs() {
  if (cleanTempFilesTimer) {
    clearInterval(cleanTempFilesTimer);
    cleanTempFilesTimer = null;
  }
  if (cleanExpiredSessionsTimer) {
    clearInterval(cleanExpiredSessionsTimer);
    cleanExpiredSessionsTimer = null;
  }
  try {
    stopEshopCatalogAutoSync();
  } catch {
    /* noop */
  }
  try {
    stopControlesScheduler();
  } catch {
    /* noop */
  }
  try {
    stopPlanningRolloverCron();
  } catch {
    /* noop */
  }
  backgroundJobsBooted = false;
}

if (hasSSL) {
  const sslOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  };
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  const httpsServer = https.createServer(sslOptions, app);

  // [WebSocket core — T-P1-02] Attache le serveur WS sur l'upgrade
  // HTTP du serveur HTTPS principal. Gate par FEATURE_V2_WEBSOCKET
  // (aucun upgrade traite si off).
  attachWebSocketServer(httpsServer, { jwtSecret: JWT_SECRET, db });

  // S1-02 — Démarrage HTTPS résilient : retry sur EADDRINUSE puis fallback HTTP-only
  const MAX_HTTPS_ATTEMPTS = Number(process.env.HTTPS_MAX_RETRIES) || 3;
  let httpsAttempts = 0;
  let httpsListening = false;

  function tryListenHttps() {
    httpsServer.listen(HTTPS_PORT, '0.0.0.0');
  }

  httpsServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && httpsAttempts < MAX_HTTPS_ATTEMPTS) {
      const delay = 2000 * 2 ** httpsAttempts;
      httpsAttempts += 1;
      logger.warn(
        `⚠️ HTTPS :${HTTPS_PORT} occupé (tentative ${httpsAttempts}/${MAX_HTTPS_ATTEMPTS}) — retry dans ${delay}ms`,
      );
      setTimeout(tryListenHttps, delay);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `❌ HTTPS :${HTTPS_PORT} toujours occupé après ${MAX_HTTPS_ATTEMPTS} tentatives — bascule HTTP-only`,
      );
      // Démarre les jobs pour ne pas bloquer le reste de l'API si HTTP répond.
      bootBackgroundJobs();
      return;
    }
    logger.error('❌ Erreur serveur HTTPS:', err);
  });

  httpsServer.once('listening', () => {
    httpsListening = true;
    logger.info(`🔒 Serveur HTTPS démarré sur https://0.0.0.0:${HTTPS_PORT}`);
    logger.info(`📡 Accessible sur https://${SERVER_HOST}:${HTTPS_PORT}`);
    bootBackgroundJobs();
  });

  tryListenHttps();

  // HTTP → HTTPS redirect (port 3002 redirige vers HTTPS)
  const redirectApp = express();
  redirectApp.all('*', (req, res) => {
    const host = req.headers.host?.replace(`:${PORT}`, HTTPS_PORT === 443 ? '' : `:${HTTPS_PORT}`);
    res.redirect(301, `https://${host}${req.url}`);
  });
  const redirectServer = redirectApp.listen(PORT, '0.0.0.0', () => {
    logger.info(`🔀 HTTP :${PORT} → HTTPS :${HTTPS_PORT} (redirection)`);
  });
  // S1-02 — Si le port redirect est occupé, on log mais on ne tue pas le process.
  redirectServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`⚠️ Port HTTP redirect :${PORT} occupé — redirection désactivée`);
      // S'assurer que les jobs démarrent même si HTTPS aussi est occupé.
      if (!httpsListening) bootBackgroundJobs();
      return;
    }
    logger.error('❌ Erreur serveur HTTP redirect:', err);
  });
} else {
  logger.warn('⚠️  Certificats SSL non trouvés dans ssl/ — démarrage en HTTP uniquement');
  logger.warn(`   Attendus : ${sslKeyPath}`);
  logger.warn(`              ${sslCertPath}`);
  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Serveur HTTP démarré sur http://0.0.0.0:${PORT}`);
    logger.info(`📡 Accessible depuis le réseau sur http://${SERVER_HOST}:${PORT}`);
    bootBackgroundJobs();
  });
  // [WebSocket core — T-P1-02] Attache le serveur WS sur l'upgrade HTTP.
  // Gate par FEATURE_V2_WEBSOCKET (aucun upgrade traite si off).
  attachWebSocketServer(httpServer, { jwtSecret: JWT_SECRET, db });
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`❌ Port HTTP :${PORT} occupé — abandon (process exit 1)`);
      process.exit(1);
    }
    logger.error('❌ Erreur serveur HTTP:', err);
  });
}

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
      logger.warn(
        `⚠️  Port ${TV_PORT} déjà utilisé — le client TV reste accessible via http://${SERVER_HOST}:${PORT}/tv`,
      );
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
    const sessResult = db
      .prepare("DELETE FROM active_sessions WHERE expires_at < datetime('now')")
      .run();
    const tokenResult = db
      .prepare(
        "UPDATE users SET reset_token_hash = NULL, reset_token_expires = NULL WHERE reset_token_expires < datetime('now')",
      )
      .run();
    if (sessResult.changes > 0 || tokenResult.changes > 0) {
      logger.info(
        `🧹 Session cleanup: ${sessResult.changes} session(s), ${tokenResult.changes} token(s) expirés supprimés`,
      );
    }
  } catch (err) {
    logger.error('Erreur nettoyage sessions:', err.message);
  }
}

/**
 * Nettoyage des fichiers temporaires > 24h dans /attachments/TEMP/
 */
function cleanTempFiles() {
  const publicDir = path.join(__dirname, '..', '..', 'public');
  // Répertoires à nettoyer avec durée max de rétention
  const targets = [
    {
      dir: path.join(publicDir, 'attachments', 'TEMP'),
      maxAge: 24 * 60 * 60 * 1000,
      label: 'TEMP',
    }, // 24h
    {
      dir: path.join(publicDir, 'bl-imports'),
      maxAge: 7 * 24 * 60 * 60 * 1000,
      label: 'bl-imports',
    }, // 7 jours
    { dir: path.join(publicDir, 'imports'), maxAge: 7 * 24 * 60 * 60 * 1000, label: 'imports' }, // 7 jours
  ];

  for (const { dir, maxAge, label } of targets) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      let removed = 0;
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile() && Date.now() - stat.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
            removed++;
          }
        } catch {
          /* ignore */
        }
      }
      if (removed > 0) logger.info(`🧹 ${label} cleanup: ${removed} fichier(s) supprimé(s)`);
    } catch (err) {
      logger.error(`Erreur nettoyage ${label}:`, err.message);
    }
  }
}

// Gestion de l'arrêt propre du serveur (S3-1 : stop schedulers + DB).
let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`\n⚠️  Signal ${signal} reçu - Arrêt en cours...`);

  // Stop tous les schedulers (intervals) avant le close DB.
  try {
    stopBackgroundJobs();
  } catch (e) {
    logger.error('stopBackgroundJobs:', e);
  }

  // Faire un dernier checkpoint de la base de données
  logger.info('💾 Sauvegarde finale de la base de données...');
  try {
    checkpointDatabase();
  } catch (e) {
    logger.error('checkpointDatabase:', e);
  }

  // Fermer proprement la base de données (clear aussi le scheduling WAL)
  try {
    closeDatabase();
  } catch (e) {
    logger.error('closeDatabase:', e);
  }

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

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('❌ Promesse rejetée non gérée:', reason);
  gracefulShutdown('unhandledRejection');
});
