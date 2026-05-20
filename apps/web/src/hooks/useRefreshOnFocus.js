/**
 * useRefreshOnFocus
 * -----------------
 * Hook qui déclenche `refreshFn()` quand l'onglet redevient visible (retour de tab,
 * sortie de veille, focus fenêtre), avec throttle anti-spam.
 *
 * Usage typique :
 *
 *   useRefreshOnFocus(loadAffaires, { minIntervalMs: 30_000 });
 *
 * - Si l'utilisateur quitte l'app puis revient < minIntervalMs plus tard, rien ne se passe.
 * - Si > minIntervalMs, refreshFn est appelée une fois.
 * - Le hook écoute `visibilitychange` (priorité) et `focus` (fallback navigateurs anciens).
 *
 * Bonnes pratiques :
 * - `refreshFn` doit être stable (useCallback) pour éviter de réattacher les listeners.
 * - Combiner avec `refreshBus.subscribe(key, refreshFn)` pour couvrir mutations intra-app.
 */

import { useEffect, useRef } from 'react';

const DEFAULT_MIN_INTERVAL_MS = 30_000;

/**
 * @param {() => void | Promise<void>} refreshFn - Fonction à exécuter au retour de focus.
 * @param {object} [options]
 * @param {number} [options.minIntervalMs=30000] - Délai min entre deux refreshs.
 * @param {boolean} [options.enabled=true] - Désactive le hook (ex: utilisateur non authentifié).
 */
export function useRefreshOnFocus(refreshFn, options = {}) {
  const { minIntervalMs = DEFAULT_MIN_INTERVAL_MS, enabled = true } = options;
  const lastRunRef = useRef(Date.now());
  const fnRef = useRef(refreshFn);

  // Garde la référence à la dernière fonction sans réattacher les listeners.
  useEffect(() => {
    fnRef.current = refreshFn;
  }, [refreshFn]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const trigger = () => {
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = now;
      try {
        const result = fnRef.current?.();
        if (result && typeof result.catch === 'function') {
          result.catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('[useRefreshOnFocus] refreshFn a rejeté :', err);
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[useRefreshOnFocus] refreshFn a levé :', err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') trigger();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', trigger);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', trigger);
    };
  }, [enabled, minIntervalMs]);
}

export default useRefreshOnFocus;
