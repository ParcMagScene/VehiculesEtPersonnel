// ═══════════════════════════════════════════════════════════════
// middleware/featureFlag.js
//
// Ticket : T-P0-03 (Planning v2 — API v2 lecture)
//
// Middleware générique de garde par variable d'environnement.
// Utilisation typique : protéger l'accès aux routes v2 tant que
// le flag serveur `FEATURE_V2_<DOMAINE>` n'est pas explicitement
// activé.
//
// Valeurs considérées comme "ON" (case-insensitive) : "1", "true",
// "yes", "on". Toute autre valeur (y compris absence) désactive la
// route et renvoie 404 (le client ne doit pas apprendre l'existence
// de la route derrière le flag).
//
// Exemple :
//   import { createFeatureFlagGuard } from './middleware/featureFlag.js';
//   const planningV2Flag = createFeatureFlagGuard('FEATURE_V2_PLANNING');
//   app.get('/api/v2/planning/tasks', planningV2Flag, authenticateToken, handler);
// ═══════════════════════════════════════════════════════════════

/**
 * Vrai si la valeur d'environnement représente une activation.
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isFeatureFlagOn(raw) {
  if (raw === undefined || raw === null) return false;
  const str = String(raw).trim().toLowerCase();
  return str === '1' || str === 'true' || str === 'yes' || str === 'on';
}

/**
 * Crée un middleware Express qui laisse passer si la variable
 * d'environnement `envKey` est ON, et renvoie 404 sinon.
 *
 * @param {string} envKey Nom de la variable d'environnement (ex: `FEATURE_V2_PLANNING`).
 * @param {{ getEnv?: () => Record<string, string | undefined> }} [options]
 *        Injection optionnelle pour tests (par défaut : `process.env`).
 * @returns {import('express').RequestHandler}
 */
export function createFeatureFlagGuard(envKey, options = {}) {
  if (typeof envKey !== 'string' || envKey.length === 0) {
    throw new TypeError('createFeatureFlagGuard: envKey requis (chaîne non vide).');
  }
  const getEnv = options.getEnv || (() => process.env);

  return function featureFlagGuard(req, res, next) {
    const env = getEnv();
    if (isFeatureFlagOn(env[envKey])) {
      next();
      return;
    }
    res.status(404).json({
      success: false,
      error: 'Endpoint non disponible',
      code: 'FEATURE_DISABLED',
      meta: { flag: envKey },
    });
  };
}
