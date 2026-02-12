import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook pour détecter les modifications non sauvegardées et avertir avant fermeture.
 * 
 * @param {Object} currentData - Les données actuelles du formulaire
 * @param {Object} initialData - Les données initiales (au chargement)
 * @param {Object} options - Options supplémentaires
 * @param {Function} options.onClose - Callback de fermeture (sans sauvegarde)
 * @param {Function} options.onSave - Callback de sauvegarde (optionnel, pour bouton "Enregistrer")
 * @param {boolean} options.isNew - Si true, considère qu'il y a des changements dès qu'un champ est rempli
 * @param {Function} options.customHasChanges - Fonction personnalisée pour détecter les changements
 * 
 * @returns {Object} { hasChanges, handleClose, showConfirm, confirmDialog }
 */
export function useUnsavedChanges(currentData, initialData, options = {}) {
  const { onClose, onSave, isNew = false, customHasChanges } = options;
  const [showConfirm, setShowConfirm] = useState(false);
  const hasTriggeredRef = useRef(false);

  // Détecter les changements
  const hasChanges = useCallback(() => {
    if (customHasChanges) return customHasChanges();
    if (!initialData && !isNew) return false;
    
    if (isNew) {
      // En création, vérifier si au moins un champ a été modifié
      if (!currentData) return false;
      return Object.values(currentData).some(v => 
        v !== '' && v !== null && v !== undefined && v !== false && 
        !(Array.isArray(v) && v.length === 0)
      );
    }
    
    // En édition, comparer les données courantes avec les initiales
    if (!currentData || !initialData) return false;
    
    const keys = new Set([...Object.keys(currentData), ...Object.keys(initialData)]);
    for (const key of keys) {
      const curr = currentData[key];
      const init = initialData[key];
      
      // Ignorer les fonctions
      if (typeof curr === 'function' || typeof init === 'function') continue;
      
      // Comparaison d'arrays
      if (Array.isArray(curr) && Array.isArray(init)) {
        if (JSON.stringify(curr) !== JSON.stringify(init)) return true;
        continue;
      }
      
      // Comparaison simple (traiter null/undefined/'' comme équivalents)
      const normCurr = curr === null || curr === undefined ? '' : curr;
      const normInit = init === null || init === undefined ? '' : init;
      if (String(normCurr) !== String(normInit)) return true;
    }
    
    return false;
  }, [currentData, initialData, isNew, customHasChanges]);

  // Handler de fermeture avec confirmation si changements
  const handleClose = useCallback(() => {
    if (hasChanges()) {
      setShowConfirm(true);
    } else {
      onClose?.();
    }
  }, [hasChanges, onClose]);

  // Confirmer la fermeture (sans sauvegarder)
  const confirmClose = useCallback(() => {
    setShowConfirm(false);
    onClose?.();
  }, [onClose]);

  // Annuler la fermeture (rester sur le formulaire)
  const cancelClose = useCallback(() => {
    setShowConfirm(false);
  }, []);

  // Sauvegarder et fermer
  const saveAndClose = useCallback(() => {
    setShowConfirm(false);
    onSave?.();
  }, [onSave]);

  // Empêcher la fermeture par la touche Escape si modifications
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showConfirm) {
          e.stopPropagation();
          cancelClose();
        } else if (hasChanges()) {
          e.preventDefault();
          e.stopPropagation();
          setShowConfirm(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showConfirm, hasChanges, cancelClose]);

  return {
    hasChanges: hasChanges(),
    handleClose,
    showConfirm,
    confirmClose,
    cancelClose,
    saveAndClose,
    setShowConfirm
  };
}
