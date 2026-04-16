import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook pour détecter les modifications non sauvegardées dans un formulaire.
 * Compare l'état actuel avec un snapshot initial via JSON.stringify.
 *
 * @param {Object} formData - L'objet état du formulaire à surveiller
 * @returns {{ isDirty: boolean, resetDirty: () => void, guardClose: (onClose: Function) => Function }}
 *
 * @example
 * const { isDirty, resetDirty, guardClose } = useDirtyForm(formData);
 *
 * const handleSave = async () => {
 *   await api.save(formData);
 *   resetDirty();
 *   onClose();
 * };
 *
 * return <Modal onClose={guardClose(onClose)}>...</Modal>;
 */
export function useDirtyForm(formData) {
  const initialRef = useRef(null);
  const [isDirty, setIsDirty] = useState(false);

  // Capture le snapshot initial au premier rendu
  useEffect(() => {
    if (initialRef.current === null) {
      initialRef.current = JSON.stringify(formData);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Détecte les changements
  useEffect(() => {
    if (initialRef.current !== null) {
      setIsDirty(JSON.stringify(formData) !== initialRef.current);
    }
  }, [formData]);

  const resetDirty = useCallback(() => {
    initialRef.current = JSON.stringify(formData);
    setIsDirty(false);
  }, [formData]);

  // Wrapper pour protéger la fermeture
  const guardClose = useCallback(
    (onClose) => () => {
      if (!isDirty) {
        onClose();
        return;
      }
      if (
        window.confirm('Vous avez des modifications non sauvegardées. Quitter sans enregistrer ?')
      ) {
        onClose();
      }
    },
    [isDirty],
  );

  return { isDirty, resetDirty, guardClose };
}
