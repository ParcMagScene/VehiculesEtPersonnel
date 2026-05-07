/**
 * ═══════════════════════════════════════════════════════════════
 * [S2-4] Observabilité — Sentry stub
 * ═══════════════════════════════════════════════════════════════
 *
 * Module no-op tant que SENTRY_DSN n'est pas défini. Quand le DSN
 * est présent ET que le SDK `@sentry/node` est installé, on délègue
 * réellement à Sentry. Sinon on log au démarrage et on fournit des
 * middlewares Express transparents.
 *
 * Variables d'environnement :
 *   SENTRY_DSN              DSN Sentry (vide = désactivé)
 *   SENTRY_ENVIRONMENT      ex: production, staging, dev (défaut: NODE_ENV)
 *   SENTRY_TRACES_RATE      0..1 sample rate des traces (défaut: 0.1)
 *   SENTRY_RELEASE          version applicative (défaut: package.json#version)
 *
 * Usage côté server.js :
 *   import { initSentry, sentryRequestHandler, sentryErrorHandler, captureException } from './observability/sentry.js';
 *   await initSentry();                          // après chargement env
 *   app.use(sentryRequestHandler());             // tout début de stack
 *   ...
 *   app.use(sentryErrorHandler());               // AVANT errorHandler centralisé
 */

import logger from '../logger.js';

let SentrySdk = null;
let initialized = false;
let enabled = false;

/**
 * Initialise Sentry si le DSN est présent et le SDK installé.
 * No-op idempotent dans tous les autres cas.
 * @returns {Promise<boolean>} true si activé, false sinon
 */
async function initSentry() {
  if (initialized) return enabled;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('[S2-4] Sentry désactivé (SENTRY_DSN absent)');
    return false;
  }

  try {
    SentrySdk = await import('@sentry/node');
  } catch {
    logger.warn(
      '[S2-4] SENTRY_DSN défini mais @sentry/node non installé — observabilité désactivée. Installer avec: npm i @sentry/node',
    );
    return false;
  }

  try {
    SentrySdk.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_RATE || '0.1'),
      // Filtre les erreurs côté client/4xx (gérées par errorHandler) — on garde les vraies anomalies
      beforeSend(event) {
        const status = event.contexts?.response?.status_code;
        if (typeof status === 'number' && status >= 400 && status < 500) return null;
        return event;
      },
    });
    enabled = true;
    logger.info('[S2-4] Sentry initialisé');
    return true;
  } catch (err) {
    logger.error('[S2-4] Echec init Sentry:', err.message);
    return false;
  }
}

/** Middleware Express : trace de requête (no-op si désactivé). */
function sentryRequestHandler() {
  return (req, _res, next) => {
    if (enabled && SentrySdk?.Handlers?.requestHandler) {
      // Délègue au middleware officiel (créé à la volée pour éviter coût si désactivé)
      return SentrySdk.Handlers.requestHandler()(req, _res, next);
    }
    return next();
  };
}

/** Middleware Express : capture erreurs (no-op si désactivé). À placer AVANT errorHandler. */
function sentryErrorHandler() {
  return (err, req, res, next) => {
    if (enabled && SentrySdk?.Handlers?.errorHandler) {
      return SentrySdk.Handlers.errorHandler()(err, req, res, next);
    }
    return next(err);
  };
}

/**
 * Capture manuelle d'une exception (background jobs, catch silencieux, etc.).
 * @param {Error} err
 * @param {Record<string, any>} [context]
 */
function captureException(err, context) {
  if (!enabled || !SentrySdk) return;
  try {
    if (context) SentrySdk.setContext('extra', context);
    SentrySdk.captureException(err);
  } catch {
    /* swallow : observabilité ne doit jamais casser la requête */
  }
}

/** Capture manuelle d'un message (warn/info important). */
function captureMessage(message, level = 'info') {
  if (!enabled || !SentrySdk) return;
  try {
    SentrySdk.captureMessage(message, level);
  } catch {
    /* swallow */
  }
}

/** Pour tests : retourne l'état interne sans exposer le SDK */
function _getSentryState() {
  return { initialized, enabled, hasDsn: Boolean(process.env.SENTRY_DSN) };
}

/** Pour tests : reset complet (utilisé dans NODE_ENV=test). */
function _resetSentryForTests() {
  SentrySdk = null;
  initialized = false;
  enabled = false;
}

export {
  _getSentryState,
  _resetSentryForTests,
  captureException,
  captureMessage,
  initSentry,
  sentryErrorHandler,
  sentryRequestHandler,
};
