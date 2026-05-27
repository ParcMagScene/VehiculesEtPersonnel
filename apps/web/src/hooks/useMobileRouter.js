import { useCallback, useEffect, useState } from 'react';

import {
  MOBILE_ACTIVE_TAB_KEY as ACTIVE_TAB_STORAGE_KEY,
  MOBILE_BACK_TARGET as BACK_TARGET,
  MOBILE_QR_PATTERN,
  MOBILE_REVERSE_ROUTES as REVERSE,
  MOBILE_ROUTES as ROUTES,
  MOBILE_TAB_SCREENS as TAB_SCREENS,
} from '../router/routes.config';

/**
 * Sérialise un objet params en query string (`?a=1&b=2`), en ignorant les
 * valeurs nullish ou chaîne vide. Retourne `''` si aucun param exploitable.
 */
function buildQuery(params) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const str = sp.toString();
  return str ? '?' + str : '';
}

/** Parse une query string (sans le `?` initial) en objet plat. */
function parseQuery(queryStr) {
  if (!queryStr) return {};
  const sp = new URLSearchParams(queryStr);
  const obj = {};
  for (const [k, v] of sp) obj[k] = v;
  return obj;
}

/**
 * Parse le hash courant pour déterminer l'écran mobile actif + ses params.
 * Gère le pattern QR : #/mobile/equipment/EMAG-XXXXX(?...)
 */
function parseHash(hash) {
  const qIndex = hash.indexOf('?');
  const pathPart = qIndex >= 0 ? hash.slice(0, qIndex) : hash;
  const params = qIndex >= 0 ? parseQuery(hash.slice(qIndex + 1)) : {};

  const qrMatch = pathPart.match(MOBILE_QR_PATTERN);
  if (qrMatch) return { screen: 'qr-landing', qrUid: qrMatch[1], params };

  const path = pathPart.replace(/^#/, '') || '/mobile';
  return { screen: REVERSE[path] || 'home', qrUid: null, params };
}

/**
 * Hook de navigation hash pour l'app mobile.
 * Synchronise currentScreen ↔ window.location.hash.
 * - navigate(screen) → pousse dans l'historique (back navigateur fonctionne)
 * - goBack() → remplace l'entrée courante (pas de pollution historique)
 * - URLs bookmarkables : #/mobile/planning, #/mobile/messaging, etc.
 */
export default function useMobileRouter() {
  const [state, setState] = useState(() => {
    // 1. Si une URL hash spécifique est présente (autre que la racine), elle gagne
    const hash = window.location.hash;
    if (hash.startsWith('#/mobile/') || hash === '#/mobile') {
      const parsed = parseHash(hash);
      // 2. Si on est sur la racine et qu'un onglet est mémorisé, le restaurer
      if (parsed.screen === 'home' && hash === '#/mobile') {
        try {
          const saved = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
          if (saved && TAB_SCREENS.has(saved) && saved !== 'home') {
            const path = ROUTES[saved];
            window.history.replaceState(null, '', '#' + path);
            return { screen: saved, qrUid: null, params: {} };
          }
        } catch {
          /* localStorage indisponible — ignore */
        }
      }
      return parsed;
    }
    window.history.replaceState(null, '', '#/mobile');
    return { screen: 'home', qrUid: null, params: {} };
  });

  useEffect(() => {
    const onHashChange = () => setState(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Persiste le dernier onglet principal visité
  useEffect(() => {
    if (TAB_SCREENS.has(state.screen)) {
      try {
        window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, state.screen);
      } catch {
        /* ignore */
      }
    }
  }, [state.screen]);

  /**
   * Navigue vers un écran (pousse dans l'historique navigateur).
   * Optionnellement, sérialise des query params : `navigate('affaires', { sel: 'AF-1' })`
   * → `#/mobile/affaires?sel=AF-1`. Les valeurs `null` / `undefined` / `''` sont ignorées.
   */
  const navigate = useCallback((screen, params) => {
    const path = ROUTES[screen];
    if (!path) return;
    window.location.hash = '#' + path + buildQuery(params);
  }, []);

  /**
   * Met à jour les query params de l'URL courante (replaceState, pas pushState).
   * Accepte un objet (merge partiel) ou un updater `(prev) => next`.
   * Une valeur `null` / `undefined` / `''` supprime la clé.
   */
  const setParams = useCallback((updater) => {
    setState((prev) => {
      const merged =
        typeof updater === 'function' ? updater(prev.params) : { ...prev.params, ...updater };
      const cleaned = {};
      for (const [k, v] of Object.entries(merged)) {
        if (v === null || v === undefined || v === '') continue;
        cleaned[k] = typeof v === 'string' ? v : String(v);
      }
      const currentHash = window.location.hash;
      const qIndex = currentHash.indexOf('?');
      const pathPart = qIndex >= 0 ? currentHash.slice(0, qIndex) : currentHash;
      window.history.replaceState(null, '', pathPart + buildQuery(cleaned));
      return { ...prev, params: cleaned };
    });
  }, []);

  /** Retour à l'écran parent (replaceState pour éviter la pollution historique) */
  const goBack = useCallback(() => {
    if (state.screen === 'home') return;
    const target = BACK_TARGET[state.screen] || 'home';
    const path = ROUTES[target];
    window.history.replaceState(null, '', '#' + path);
    setState({ screen: target, qrUid: null, params: {} });
  }, [state.screen]);

  return {
    currentScreen: state.screen,
    qrUid: state.qrUid,
    params: state.params,
    navigate,
    setParams,
    goBack,
  };
}

/** Routes exportées pour les tests (ré-export depuis routes.config). */
export {
  MOBILE_ACTIVE_TAB_KEY as ACTIVE_TAB_STORAGE_KEY,
  MOBILE_BACK_TARGET as BACK_TARGET,
  MOBILE_ROUTES as ROUTES,
  MOBILE_TAB_SCREENS as TAB_SCREENS,
} from '../router/routes.config';
