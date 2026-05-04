/**
 * Sprint A — Compat layer router
 *
 * Sert de FONDATION non-cassante pour la migration progressive vers React Router v6.
 *
 * Aujourd'hui, la navigation desktop repose sur `activeModule` (state React) synchronisé
 * manuellement avec `?module=xxx` via `window.history.replaceState` (App.jsx#L160-L175).
 *
 * Ce module expose deux helpers utilisables dès maintenant SANS toucher au pattern existant :
 *   - <ScrollToTopOnModuleChange /> : remet la page en haut quand `?module=` change
 *   - useModuleParam() / setModuleParam() : alternatives basées sur React Router
 *
 * Sprint B refactorera App.jsx pour utiliser `useSearchParams()` directement.
 */

import { useCallback, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Hook : lit `?module=xxx` côté React Router (équivalent moderne de URLSearchParams).
 * @returns {string | null}
 */
export function useModuleParam() {
  const [params] = useSearchParams();
  return params.get('module');
}

/**
 * Composant : scroll en haut de page à chaque changement de search param `module`.
 * Comportement standard observé sur les SPA (cf. ScrollRestoration de RR v6).
 *
 * Note : pas de scroll si l'utilisateur ouvre/ferme une modale (search params autres
 * inchangés ne déclenchent pas de scroll non plus — on observe uniquement `module`).
 */
export function ScrollToTopOnModuleChange() {
  const location = useLocation();
  const [params] = useSearchParams();
  const module = params.get('module');

  useEffect(() => {
    // Évite de perturber la navigation mobile (hash-based)
    if (location.hash && location.hash.startsWith('#/mobile')) return;
    // Scroll smooth si possible, sinon instantané
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [module, location.hash]);

  return null;
}

/**
 * Hook : `useState`-like, mais persisté dans un search param d'URL.
 *
 * - Source de vérité = URL (refresh F5 → état restauré).
 * - Accepte un set d'allowed values pour ignorer les valeurs hostiles/obsolètes.
 * - Setter compatible avec l'API `useState` (valeur ou fonction updater).
 * - `replace: true` par défaut : ne pollue PAS l'historique du navigateur
 *   (le bouton "Précédent" doit sortir de l'app, pas dérouler chaque clic d'onglet).
 *   Passer `{ replace: false }` pour les changements de page véritables.
 *
 * @template T
 * @param {string} key - nom du search param
 * @param {T} defaultValue - valeur par défaut si param absent ou invalide
 * @param {{ allowed?: Set<T>, replace?: boolean }} [options]
 * @returns {[T, (next: T | ((prev: T) => T)) => void]}
 */
export function useSearchParamState(key, defaultValue, options = {}) {
  const { allowed, replace = true } = options;
  const [params, setParams] = useSearchParams();

  const raw = params.get(key);
  const value = raw != null && (!allowed || allowed.has(raw)) ? raw : defaultValue;

  const setValue = useCallback(
    (next) => {
      setParams(
        (prev) => {
          const resolved = typeof next === 'function' ? next(value) : next;
          const updated = new URLSearchParams(prev);
          if (resolved == null || resolved === defaultValue) {
            updated.delete(key);
          } else {
            updated.set(key, String(resolved));
          }
          return updated;
        },
        { replace },
      );
    },
    [key, defaultValue, value, replace, setParams],
  );

  return [value, setValue];
}
