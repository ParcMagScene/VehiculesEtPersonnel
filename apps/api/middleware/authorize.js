import db from '../database.js';
import logger from '../logger.js';

// [AUDIT FIX B1] Liste blanche des clés de permissions autorisées
const VALID_PERMISSION_KEYS = new Set([
  'can_manage_catalog',
  'can_manage_vehicle_maintenance',
  'can_manage_maintenance',
  'can_manage_equipment_maintenance',
  'can_manage_trucks',
  'can_manage_stock',
  'can_manage_orders',
  'can_manage_inventory',
  'can_manage_personnel',
  'can_manage_planning',
  'can_manage_leaves',
  'can_manage_affaires',
  'can_manage_display',
  'can_manage_mailing',
  'can_manage_annuaire',
  'can_manage_video',
  'can_manage_messaging',
  'read_only',
]);

/**
 * Résoudre permissions depuis JWT ou DB (fallback pour anciens tokens)
 */
function resolvePermissions(req) {
  if (req.user.permissions !== undefined && req.user.isAdmin !== undefined) {
    return {
      is_admin: req.user.isAdmin ? 1 : 0,
      permissions: typeof req.user.permissions === 'string'
        ? req.user.permissions
        : JSON.stringify(req.user.permissions || {})
    };
  }
  // Fallback DB pour anciens tokens sans permissions
  return db.prepare('SELECT is_admin, permissions FROM users WHERE id = ?').get(req.user.id);
}

/**
 * Parse et valide les permissions JSON depuis l'objet user DB
 * [AUDIT FIX B1] Seules les clés whitelistées sont conservées, valeurs forcées en boolean
 */
function parsePermissions(user) {
  try {
    const raw = user.permissions ? JSON.parse(user.permissions) : {};
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      logger.warn(`[AUTH] Permissions invalides (pas un objet) pour user — reset à {}`);
      return {};
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(raw)) {
      if (VALID_PERMISSION_KEYS.has(key)) {
        sanitized[key] = !!value;
      }
    }
    return sanitized;
  } catch {
    logger.warn(`[AUTH] Erreur parsing permissions JSON — reset à {}`);
    return {};
  }
}

/**
 * Middleware générique pour vérifier une permission spécifique
 * @param {string} permissionKey - Clé de permission requise (ex: 'can_manage_catalog')
 * @param {string} errorMessage - Message d'erreur personnalisé
 * @param {string} flagName - Nom du flag à ajouter sur req.user
 */
export function requirePermission(permissionKey, errorMessage, flagName) {
  return function(req, res, next) {
    const user = resolvePermissions(req);
    if (!user) return res.status(403).json({ error: 'Utilisateur non trouvé' });
    const perms = parsePermissions(user);
    if (user.is_admin || perms[permissionKey]) {
      req.user.isAdmin = !!user.is_admin;
      if (flagName) req.user[flagName] = true;
      req.user.permissions = perms;
      next();
    } else {
      return res.status(403).json({ error: errorMessage });
    }
  };
}

/**
 * Middleware admin — vérifie les droits administrateur
 */
export function requireAdmin(req, res, next) {
  const user = resolvePermissions(req);
  if (!user || !user.is_admin) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  req.user.isAdmin = true;
  req.user.permissions = parsePermissions(user);
  next();
}

/**
 * Middleware maintenance véhicules (admin OU permission spécifique)
 */
export const requireMaintenanceAccess = requirePermission(
  'can_manage_vehicle_maintenance',
  'Accès réservé — permission maintenance véhicules requise',
  'canManageMaintenance'
);

// Backward compat: can_manage_maintenance OU can_manage_vehicle_maintenance
const _originalMaintenanceAccess = requireMaintenanceAccess;
export { _originalMaintenanceAccess };
// Override to also check legacy permission name
export function requireMaintenanceAccessCompat(req, res, next) {
  const user = resolvePermissions(req);
  if (!user) return res.status(403).json({ error: 'Utilisateur non trouvé' });
  const perms = parsePermissions(user);
  if (user.is_admin || perms.can_manage_vehicle_maintenance || perms.can_manage_maintenance) {
    req.user.isAdmin = !!user.is_admin;
    req.user.canManageMaintenance = true;
    req.user.permissions = perms;
    next();
  } else {
    return res.status(403).json({ error: 'Accès réservé — permission maintenance véhicules requise' });
  }
}

/**
 * Middleware maintenance matériel (admin OU permission spécifique)
 */
export const requireEquipmentMaintenanceAccess = requirePermission(
  'can_manage_equipment_maintenance',
  'Accès réservé — permission maintenance matériel requise',
  'canManageEquipmentMaintenance'
);

/**
 * Middleware catalogue (admin OU permission spécifique)
 */
export const requireCatalogAccess = requirePermission(
  'can_manage_catalog',
  'Accès réservé — permission catalogue requise',
  'canManageCatalog'
);

/**
 * Middleware écriture générale (admin OU utilisateur non read_only)
 */
export function requireNotReadOnly(req, res, next) {
  const user = resolvePermissions(req);
  if (!user) return res.status(403).json({ error: 'Utilisateur non trouvé' });
  const perms = parsePermissions(user);

  if (user.is_admin || !perms.read_only) {
    req.user.isAdmin = !!user.is_admin;
    req.user.permissions = perms;
    return next();
  }

  return res.status(403).json({ error: 'Accès en écriture refusé (compte lecture seule)' });
}

/**
 * Middleware camions/modèles (admin OU permission spécifique)
 */
export const requireTruckAccess = requirePermission(
  'can_manage_trucks',
  'Accès réservé — permission modèles camions requise',
  'canManageTrucks'
);
