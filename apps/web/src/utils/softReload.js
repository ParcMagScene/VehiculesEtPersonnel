/**
 * softReload
 * ----------
 * Centralise tous les `window.location.reload()` de l'application web.
 *
 * Objectifs :
 *   1. Tracer la raison du reload pour debug (console + custom event).
 *   2. Offrir un point d'extension unique pour migrer plus tard vers une
 *      réinitialisation SPA (vidage de caches React + reset stores) au lieu
 *      d'un hard reload navigateur.
 *   3. Faciliter le mock en environnement de test.
 *
 * Usage :
 *   import { softReload } from '../utils/softReload';
 *   softReload('auth-session-expired');
 *
 * Convention de raisons (à enrichir) :
 *   - 'auth-session-expired'   : session expirée, refresh KO
 *   - 'auth-token-invalid'     : JWT corrompu
 *   - 'error-boundary'         : recovery depuis ErrorBoundary
 *   - 'account-created'        : compte créé, re-auth nécessaire
 *   - 'backup-restored'        : restauration backup, state local invalide
 *   - 'user-switch'            : changement d'utilisateur (mobile)
 *
 * Note : ce helper conserve le comportement actuel (hard reload). Les
 * appelants ne doivent pas dépendre du fait que la page recharge réellement
 * — le contrat est "remettre l'app dans un état frais".
 */

const SOFT_RELOAD_EVENT = 'app:soft-reload';

/**
 * Force un rafraîchissement complet de l'application.
 * @param {string} reason - Identifiant court de la cause (cf. JSDoc ci-dessus).
 * @param {object} [options]
 * @param {number} [options.delayMs=0] - Délai avant reload (ms).
 */
export function softReload(reason, options = {}) {
  const safeReason = typeof reason === 'string' && reason.length > 0 ? reason : 'unspecified';
  const delayMs = Number.isFinite(options.delayMs) && options.delayMs > 0 ? options.delayMs : 0;

  // eslint-disable-next-line no-console
  console.warn(`[softReload] reason=${safeReason} delayMs=${delayMs}`);

  // Émet un event pour permettre à des listeners (analytics, cleanup) de réagir
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(SOFT_RELOAD_EVENT, { detail: { reason: safeReason } }));
    } catch {
      /* CustomEvent absent (vieux navigateurs / jsdom) — on ignore. */
    }
  }

  const doReload = () => {
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    }
  };

  if (delayMs > 0) {
    setTimeout(doReload, delayMs);
  } else {
    doReload();
  }
}

export const SOFT_RELOAD_EVENT_NAME = SOFT_RELOAD_EVENT;
