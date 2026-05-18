import { useCallback, useEffect, useState } from 'react';

/**
 * useModalDialogClose
 * -------------------
 * Hook compagnon de `useSlidePanelClose`, dédié aux **dialogues modaux centrés
 * avec backdrop** (et non aux slide-panels latéraux).
 *
 * Différences avec `useSlidePanelClose` :
 *  - Pas de transition d'ouverture en double rAF (le dialog apparaît directement).
 *  - Pas d'état `isVisible` / `isOpen` (le composant appelant rend ou non en
 *    fonction de la prop source — ex. `if (!ticket) return null;`).
 *  - Délai de fermeture par défaut plus court (200 ms vs 350 ms).
 *  - Gère automatiquement la fermeture par la touche Escape quand `open` est
 *    truthy.
 *
 * @param {*}        open          Objet/valeur qui détermine si le dialog est
 *                                 actuellement affiché (truthy => écouter Escape).
 * @param {Function} onClose       Callback à appeler une fois l'animation finie.
 * @param {number}   closeDelayMs  Durée (ms) de la transition CSS de fermeture.
 * @returns {{ isClosing: boolean, handleClose: () => void }}
 */
export function useModalDialogClose(open, onClose, closeDelayMs = 200) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose?.();
      setIsClosing(false);
    }, closeDelayMs);
  }, [onClose, closeDelayMs]);

  useEffect(() => {
    if (!open) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClosing(false);
    const handler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  return { isClosing, handleClose };
}

export default useModalDialogClose;
