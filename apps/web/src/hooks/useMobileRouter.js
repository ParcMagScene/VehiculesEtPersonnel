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
 * Décode la query string d'un hash mobile en objet plat string→string.
 * Renvoie {} si la chaîne est vide ou si URLSearchParams échoue.
 */
function parseQueryString(qs) {
  if (!qs) return {};
  try {
    const out = {};
    for (const [k, v] of new URLSearchParams(qs)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/**
 * Construit le hash final depuis un screen + un objet de params.
 * - Les valeurs `null`, `undefined`, `''` sont supprimées (clé absente).
 * - Les valeurs non-string sont stringifiées.
 * Retourne `null` si le screen n'est pas connu.
 */
function buildHash(screen, params) {
  const path = ROUTES[screen];
  if (!path) return null;

  if (!params || typeof params !== 'object') return '#' + path;

  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    usp.set(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `#${path}?${qs}` : `#${path}`;
}

/**
 * Parse le hash courant pour déterminer l'écran mobile actif et ses params.
 * Gère le pattern QR : #/mobile/equipment/EMAG-XXXXX (avec params éventuels).
 */
function parseHash(hash) {
  const qIdx = hash.indexOf('?');
  const pathPart = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
  const params = qIdx >= 0 ? parseQueryString(hash.slice(qIdx + 1)) : {};

  // QR : le pattern matche aussi avec un ?xxx en queue (regex sans $).
  // On laisse les params traverser — utile pour MobileEquipmentQR (?step=).
  const qrMatch = hash.match(MOBILE_QR_PATTERN);
  if (qrMatch) return { screen: 'qr-landing', qrUid: qrMatch[1], params };

  const path = pathPart.replace(/^#/, '') || '/mobile';
  return { screen: REVERSE[path] || 'home', qrUid: null, params };
}

/**
 * Hook de navigation hash pour l'app mobile.
 *
 * Synchronise currentScreen ↔ window.location.hash et expose désormais
 * `params` (query string décodée), `setParams()` et un `navigate(screen, params)`
 * étendu — voir docs/04-Operations/audits/2026-05/AUDIT-MOBILE-PERSISTENCE.
 *
 * Compat : `navigate(screen)` à 1 argument reste valide (params optionnels).
 *
 * - navigate(screen, params?) → pousse dans l'historique (back navigateur fonctionne)
 * - setParams(updater)       → merge partiel + replaceState (pas de pushState)
 * - goBack()                 → remplace l'entrée courante et reset les params
 * - URLs bookmarkables : #/mobile/affaires?sel=AF-2026-001
 */
export default function useMobileRouter() {
  const [state, setState] = useState(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/mobile/') || hash === '#/mobile') {
      const parsed = parseHash(hash);
      // Restaure le dernier onglet visité si on atterrit sur la racine nue.
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
   * Navigue vers un écran (pushState dans l'historique navigateur).
   * @param {string} screen
   * @param {object} [params] - Query params optionnels (string→string).
   */
  const navigate = useCallback((screen, params) => {
    const h = buildHash(screen, params);
    if (h) window.location.hash = h;
  }, []);

  /**
   * Met à jour les params du screen courant sans changer d'écran.
   * - Merge partiel : `{ sel: 'X' }` ne touche pas aux autres clés.
   * - Pour supprimer une clé : passer `null`, `undefined` ou `''`.
   * - Utilise replaceState : ne pollue pas l'historique navigateur.
   * @param {object | ((prev: object) => object)} updater
   */
  const setParams = useCallback((updater) => {
    setState((prev) => {
      const merged =
        typeof updater === 'function'
          ? updater(prev.params)
          : { ...prev.params, ...updater };
      const h = buildHash(prev.screen, merged);
      if (h) window.history.replaceState(null, '', h);
      // Normalise (supprime les clés vides) pour la cohérence du state interne.
      const clean = {};
      for (const [k, v] of Object.entries(merged || {})) {
        if (v != null && v !== '') clean[k] = String(v);
      }
      return { ...prev, params: clean };
    });
  }, []);

  /** Retour à l'écran parent (replaceState + reset params). */
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
