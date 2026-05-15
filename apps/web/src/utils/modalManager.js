/**
 * modalManager.js — Gestionnaire global et centralisé des modaux eM@g.
 *
 * Objectifs :
 *  - Pile (stack) FIFO des modaux ouverts pour calculer un z-index cohérent.
 *  - Verrouillage du scroll body uniquement quand au moins un modal est ouvert
 *    (libéré au close du dernier modal → plus de "scroll bloqué" résiduel).
 *  - Portail DOM unique : #emag-modal-root (créé à la volée si absent, utile
 *    notamment côté tests jsdom et SSR-fallback).
 *  - Aucun couplage React : module ESM pur, testable en isolation.
 *
 * Hiérarchie z-index (cf. spec) :
 *   - backdrop (overlay)  : Z_BACKDROP_BASE + index*Z_STEP        → 9000+
 *   - dialog (contenu)    : Z_DIALOG_BASE   + index*Z_STEP        → 10000+
 *
 * Un index = position dans la pile (0 = plus ancien). Les modaux ouverts plus
 * tard se superposent automatiquement au-dessus.
 */

export const MODAL_ROOT_ID = 'emag-modal-root';

export const Z_BACKDROP_BASE = 9000;
export const Z_DIALOG_BASE = 10000;
export const Z_STEP = 10;

// État interne (singleton). NE PAS exporter directement, utiliser les helpers.
const state = {
  /** @type {symbol[]} pile de tokens uniques, un par modal ouvert */
  stack: [],
  /** @type {string|null} valeur d'origine de body.style.overflow (restaurée au pop final) */
  prevBodyOverflow: null,
  /** listeners notifiés à chaque mutation de la pile */
  listeners: new Set(),
};

/**
 * Retourne (en créant si nécessaire) le nœud DOM portail unique.
 * Côté tests/jsdom, le node n'existe pas tant qu'on n'a pas monté index.html
 * → on le crée à la volée pour éviter les `null` sur createPortal.
 *
 * @returns {HTMLElement|null} le node portail, ou null si pas de DOM (SSR).
 */
export function getModalRoot() {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById(MODAL_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = MODAL_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Pousse un modal sur la pile. À appeler lors de l'ouverture (open=true).
 * @returns {symbol} token à passer à `pop()` lors de la fermeture.
 */
export function push() {
  const token = Symbol('emag-modal');
  if (state.stack.length === 0 && typeof document !== 'undefined') {
    state.prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  state.stack.push(token);
  notify();
  return token;
}

/**
 * Retire un modal de la pile. Idempotent si token déjà absent.
 * Le scroll body n'est libéré que lorsque la pile est totalement vide.
 */
export function pop(token) {
  const idx = state.stack.indexOf(token);
  if (idx === -1) return;
  state.stack.splice(idx, 1);
  if (state.stack.length === 0 && typeof document !== 'undefined') {
    document.body.style.overflow = state.prevBodyOverflow ?? '';
    state.prevBodyOverflow = null;
  }
  notify();
}

/**
 * Calcule l'index courant (0-based) d'un modal dans la pile.
 * Renvoie -1 si le token n'est pas (ou plus) présent.
 */
export function indexOf(token) {
  return state.stack.indexOf(token);
}

/** Taille courante de la pile. */
export function size() {
  return state.stack.length;
}

/**
 * Z-index calculés pour un modal donné, à utiliser en style inline.
 * @param {symbol} token
 * @returns {{ overlay: number, dialog: number }}
 */
export function zIndexFor(token) {
  const i = Math.max(indexOf(token), 0);
  return {
    overlay: Z_BACKDROP_BASE + i * Z_STEP,
    dialog: Z_DIALOG_BASE + i * Z_STEP,
  };
}

/**
 * S'abonne aux changements de pile (utile pour re-render React si besoin).
 * @param {() => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

function notify() {
  state.listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listeners ne doivent jamais casser la pile */
    }
  });
}

/**
 * Réinitialise complètement le manager. À RÉSERVER aux tests.
 */
export function __resetForTests() {
  state.stack.length = 0;
  state.listeners.clear();
  if (typeof document !== 'undefined') {
    document.body.style.overflow = state.prevBodyOverflow ?? '';
  }
  state.prevBodyOverflow = null;
}
