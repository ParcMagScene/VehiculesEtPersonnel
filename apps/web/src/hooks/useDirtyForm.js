import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook pour détecter les modifications non sauvegardées dans un formulaire.
 * Compare l'état actuel avec un snapshot initial via JSON.stringify.
 *
 * @param {Object} formData - L'objet état du formulaire à surveiller
 * @param {Object} [options]
 * @param {(opts: { title?: string, message?: string, confirmLabel?: string, cancelLabel?: string, variant?: string, onConfirm: () => void }) => void} [options.confirmer]
 *        Fonction de confirmation custom (ex. `confirm` de `useConfirmDialog`).
 *        Si fournie, remplace le `window.confirm` natif pour `guardClose`.
 * @returns {{ isDirty: boolean, resetDirty: () => void, guardClose: (onClose: Function) => Function }}
 *
 * @example
 * const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
 * const { guardClose } = useDirtyForm(formData, { confirmer: confirm });
 *
 * return <Modal onClose={guardClose(onClose)}>...{ConfirmDialogRenderer}</Modal>;
 */
export function useDirtyForm(formData, { confirmer } = {}) {
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
      if (typeof confirmer === 'function') {
        confirmer({
          title: 'Modifications non sauvegardées',
          message: 'Quitter sans enregistrer ?',
          confirmLabel: 'Quitter sans enregistrer',
          cancelLabel: 'Continuer l’édition',
          variant: 'danger',
          onConfirm: onClose,
        });
        return;
      }
      if (
        window.confirm('Vous avez des modifications non sauvegardées. Quitter sans enregistrer ?')
      ) {
        onClose();
      }
    },
    [isDirty, confirmer],
  );

  return { isDirty, resetDirty, guardClose };
}
