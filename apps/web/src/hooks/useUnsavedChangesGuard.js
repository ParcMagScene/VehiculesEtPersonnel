import { useEffect } from 'react';

/**
 * Bloque la fermeture/refresh du navigateur si `isDirty` est vrai.
 *
 * Pose un listener `beforeunload` standard : le navigateur affichera son dialogue
 * natif de confirmation. Le texte est ignoré par les navigateurs modernes (Chrome,
 * Firefox, Safari) qui imposent leur propre message — c'est volontaire (anti-phishing).
 *
 * À utiliser dans tout formulaire/modale d'édition longue. Pour le cas
 * "fermeture modale via X / Esc / clic onglet", utiliser plutôt le pattern
 * `showUnsavedWarning` interne des composants — ce hook ne gère QUE le navigateur.
 *
 * @param {boolean} isDirty - état modifié non sauvegardé
 */
export function useUnsavedChangesGuard(isDirty) {
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      // Requis pour Chrome historique ; navigateurs modernes ignorent la valeur.
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
