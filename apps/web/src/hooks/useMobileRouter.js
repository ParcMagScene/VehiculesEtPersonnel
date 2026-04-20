import { useCallback, useEffect, useState } from 'react';

// ═══ Mapping écran ↔ chemin hash ═══
const ROUTES = {
  home: '/mobile',
  'parc-dashboard': '/mobile/parc',
  planning: '/mobile/planning',
  reservations: '/mobile/reservations',
  maintenances: '/mobile/maintenances',
  availability: '/mobile/availability',
  affaires: '/mobile/affaires',
  tasks: '/mobile/tasks',
  personnel: '/mobile/personnel',
  messaging: '/mobile/messaging',
  equipment: '/mobile/equipment',
  sav: '/mobile/sav',
  'equipment-qr': '/mobile/equipment-qr',
  orders: '/mobile/orders',
  leaves: '/mobile/leaves',
  inventory: '/mobile/inventory',
  location: '/mobile/location',
  sonos: '/mobile/sonos',
  suivi: '/mobile/suivi',
  'dashboard-admin': '/mobile/dashboard-admin',
};

const REVERSE = Object.fromEntries(Object.entries(ROUTES).map(([s, p]) => [p, s]));

// Hiérarchie parentale pour goBack (ce qui n'est pas listé → home)
const BACK_TARGET = {
  planning: 'parc-dashboard',
  reservations: 'parc-dashboard',
  maintenances: 'parc-dashboard',
  availability: 'parc-dashboard',
  'equipment-qr': 'equipment',
  suivi: 'home',
  'dashboard-admin': 'home',
};

/**
 * Parse le hash courant pour déterminer l'écran mobile actif.
 * Gère le pattern QR : #/mobile/equipment/EMAG-XXXXX
 */
function parseHash(hash) {
  const qrMatch = hash.match(/#\/mobile\/equipment\/(EMAG-\d+)/i);
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
    if (!window.location.hash.startsWith('#/mobile')) {
      window.history.replaceState(null, '', '#/mobile');
      return { screen: 'home', qrUid: null };
    }
    return parseHash(window.location.hash);
  });

  useEffect(() => {
    const onHashChange = () => setState(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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

/** Routes exportées pour les tests */
export { BACK_TARGET, ROUTES };
