import { useEffect, useCallback, useRef } from 'react';

/**
 * Détection de l'OS pour l'affichage des raccourcis
 */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/**
 * Symboles de touches selon l'OS
 */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';
export const ALT_KEY = isMac ? '⌥' : 'Alt';
export const SHIFT_KEY = isMac ? '⇧' : 'Maj';

/**
 * Raccourcis par défaut de l'application
 * Chaque raccourci a : id, label, keys (pour l'affichage), category
 */
export const SHORTCUTS = [
  { id: 'mod_vehicles', label: 'Module Parc', keys: [MOD_KEY, '1'], category: 'navigation' },
  { id: 'mod_personnel', label: 'Module Personnel', keys: [MOD_KEY, '2'], category: 'navigation' },
  { id: 'mod_affaires', label: 'Module Affaires', keys: [MOD_KEY, '3'], category: 'navigation' },
  { id: 'mod_equipment', label: 'Module Matériel', keys: [MOD_KEY, '4'], category: 'navigation' },
  { id: 'open_messaging', label: 'Messagerie', keys: [MOD_KEY, 'M'], category: 'navigation' },
  { id: 'open_help', label: 'Aide', keys: ['F1'], category: 'general' },
  { id: 'open_preferences', label: 'Préférences', keys: [MOD_KEY, ','], category: 'general' },
  { id: 'new_reservation', label: 'Nouvelle réservation', keys: [MOD_KEY, 'N'], category: 'actions' },
  { id: 'close_modal', label: 'Fermer la fenêtre active', keys: ['Échap'], category: 'general' },
  { id: 'nav_prev', label: 'Période précédente', keys: ['←'], category: 'calendrier' },
  { id: 'nav_next', label: 'Période suivante', keys: ['→'], category: 'calendrier' },
  { id: 'nav_today', label: "Aujourd'hui", keys: [MOD_KEY, 'T'], category: 'calendrier' },
];

export const SHORTCUT_CATEGORIES = {
  navigation: 'Navigation',
  actions: 'Actions',
  calendrier: 'Calendrier',
  general: 'Général',
};

/**
 * Hook de raccourcis clavier
 * @param {Object} handlers - Map id -> callback
 * @param {boolean} enabled - Active/désactive les raccourcis globalement
 */
export function useKeyboardShortcuts(handlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    // Ne pas intercepter si on est dans un champ de saisie
    const tag = e.target.tagName;
    const editable = e.target.isContentEditable;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) {
      // Seul Escape est permis dans les champs
      if (e.key !== 'Escape') return;
    }

    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Mod + chiffre : navigation modules
    if (mod && e.key === '1') { e.preventDefault(); handlersRef.current.mod_vehicles?.(); return; }
    if (mod && e.key === '2') { e.preventDefault(); handlersRef.current.mod_personnel?.(); return; }
    if (mod && e.key === '3') { e.preventDefault(); handlersRef.current.mod_affaires?.(); return; }
    if (mod && e.key === '4') { e.preventDefault(); handlersRef.current.mod_equipment?.(); return; }

    // Mod + M : messagerie
    if (mod && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); handlersRef.current.open_messaging?.(); return; }

    // Mod + N : nouvelle réservation
    if (mod && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); handlersRef.current.new_reservation?.(); return; }

    // Mod + , : préférences
    if (mod && e.key === ',') { e.preventDefault(); handlersRef.current.open_preferences?.(); return; }

    // Mod + T : aujourd'hui
    if (mod && (e.key === 't' || e.key === 'T')) { e.preventDefault(); handlersRef.current.nav_today?.(); return; }

    // F1 : aide
    if (e.key === 'F1') { e.preventDefault(); handlersRef.current.open_help?.(); return; }

    // Escape : fermer
    if (e.key === 'Escape') { handlersRef.current.close_modal?.(); return; }

    // Arrow left/right : navigation calendrier (seulement hors champ de saisie)
    if (e.key === 'ArrowLeft' && !mod && !e.shiftKey && !e.altKey) { handlersRef.current.nav_prev?.(); return; }
    if (e.key === 'ArrowRight' && !mod && !e.shiftKey && !e.altKey) { handlersRef.current.nav_next?.(); return; }
  }, [enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
