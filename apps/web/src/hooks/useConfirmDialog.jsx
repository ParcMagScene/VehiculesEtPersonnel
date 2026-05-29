import { useCallback, useState } from 'react';

import { Dialog } from '@/design-system';

/**
 * Hook pour gérer un dialogue de confirmation réutilisable.
 * Élimine le boilerplate useState + JSX dupliqué dans 15+ composants.
 *
 * @returns {{ confirm: (config: Object) => void, ConfirmDialogRenderer: JSX.Element|null }}
 *
 * @example
 * const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
 *
 * const handleDelete = (item) => {
 *   confirm({
 *     title: 'Supprimer',
 *     message: `Supprimer « ${item.name} » ?`,
 *     variant: 'danger',
 *     confirmLabel: 'Supprimer',
 *     onConfirm: async () => {
 *       await api.deleteItem(item.id);
 *       toast.success('Supprimé');
 *     },
 *   });
 * };
 *
 * return <>{ConfirmDialogRenderer}</>;
 */
export function useConfirmDialog() {
  const [config, setConfig] = useState(null);

  const confirm = useCallback((dialogConfig) => {
    setConfig(dialogConfig);
  }, []);

  const close = useCallback(() => {
    setConfig(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (config?.onConfirm) {
      await config.onConfirm();
    }
    setConfig(null);
  }, [config]);

  const ConfirmDialogRenderer = config ? (
    <Dialog
      open
      onClose={close}
      title={config.title || 'Confirmation'}
      variant={config.variant || 'confirm'}
      onConfirm={handleConfirm}
      confirmLabel={config.confirmLabel || 'Confirmer'}
      cancelLabel={config.cancelLabel || 'Annuler'}
      destructive={!!config.destructive}
    >
      {config.message}
    </Dialog>
  ) : null;

  return { confirm, close, ConfirmDialogRenderer };
}
