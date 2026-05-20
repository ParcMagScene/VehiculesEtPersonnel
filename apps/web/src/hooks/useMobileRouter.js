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
 * Parse le hash courant pour déterminer l'écran mobile actif.
 * Gère le pattern QR : #/mobile/equipment/EMAG-XXXXX
 */
function parseHash(hash) {
  const qrMatch = hash.match(MOBILE_QR_PATTERN);
  if (qrMatch) return { screen: 'qr-landing', qrUid: qrMatch[1] };

  const path = hash.replace(/^#/, '') || '/mobile';
  return { screen: REVERSE[path] || 'home', qrUid: null };
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
            return { screen: saved, qrUid: null };
          }
        } catch {
          /* localStorage indisponible — ignore */
        }
      }
      return parsed;
    }
    window.history.replaceState(null, '', '#/mobile');
    return { screen: 'home', qrUid: null };
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

  /** Navigue vers un écran (pousse dans l'historique navigateur) */
  const navigate = useCallback((screen) => {
    const path = ROUTES[screen];
    if (path) window.location.hash = '#' + path;
  }, []);

  /** Retour à l'écran parent (replaceState pour éviter la pollution historique) */
  const goBack = useCallback(() => {
    if (state.screen === 'home') return;
    const target = BACK_TARGET[state.screen] || 'home';
    const path = ROUTES[target];
    window.history.replaceState(null, '', '#' + path);
    setState({ screen: target, qrUid: null });
  }, [state.screen]);

  return { currentScreen: state.screen, qrUid: state.qrUid, navigate, goBack };
}

/** Routes exportées pour les tests (ré-export depuis routes.config). */
export {
  MOBILE_ACTIVE_TAB_KEY as ACTIVE_TAB_STORAGE_KEY,
  MOBILE_BACK_TARGET as BACK_TARGET,
  MOBILE_ROUTES as ROUTES,
  MOBILE_TAB_SCREENS as TAB_SCREENS,
} from '../router/routes.config';
