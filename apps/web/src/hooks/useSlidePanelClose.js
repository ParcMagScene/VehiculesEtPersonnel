import { useCallback, useEffect, useState } from 'react';

/**
 * useSlidePanelClose
 * ------------------
 * Hook unifié pour la logique d'ouverture/fermeture animée des slide-panels
 * latéraux d'eM@g (VehicleDetailPanel, PersonnelDetailPanel, EquipmentDetail,
 * EquipmentSAV, StockPanel, AffaireDetailPanel, ...).
 *
 * Comportement :
 *  - Quand `item` devient truthy : monte le panel (`isVisible`), puis bascule
 *    `isOpen=true` après un double requestAnimationFrame pour déclencher la
 *    transition CSS d'entrée.
 *  - Quand `item` devient falsy ou que `handleClose()` est appelé : passe en
 *    mode `isClosing` (transition CSS de sortie), puis appelle `onClose()` et
 *    démonte (`isVisible=false`) après `closeDelayMs` ms.
 *
 * @param {*}        item          Objet courant affiché (truthy => ouvert).
 * @param {Function} onClose       Callback à appeler une fois l'animation finie.
 * @param {number}   closeDelayMs  Durée (ms) de la transition CSS de fermeture.
 * @returns {{
 *   isVisible: boolean,
 *   isOpen: boolean,
 *   isClosing: boolean,
 *   handleClose: () => void,
 * }}
 */
export function useSlidePanelClose(item, onClose, closeDelayMs = 350) {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (item) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      setIsClosing(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setIsOpen(false);
    setIsClosing(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
    }, closeDelayMs);
    return () => clearTimeout(timer);
  }, [item, closeDelayMs]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsClosing(true);
    setTimeout(() => onClose?.(), closeDelayMs);
  }, [onClose, closeDelayMs]);

  return { isVisible, isOpen, isClosing, handleClose };
}

export default useSlidePanelClose;
