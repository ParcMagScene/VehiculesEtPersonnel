import { useCallback, useMemo, useRef } from 'react';

/**
 * Hook pour accéder au système de toast + feedback
 * Usage :
 *   const { toastRef, toast } = useFeedback();
 *   <ToastContainer ref={toastRef} />
 *   toast.success('Sauvegardé !');
 */
export function useFeedback() {
  const toastRef = useRef(null);

  const show = useCallback((type, message, opts = {}) => {
    toastRef.current?.show({ type, message, ...opts });
  }, []);

  const toast = useMemo(
    () => ({
      success: (msg, opts) => show('success', msg, opts),
      error: (msg, opts) => show('error', msg, opts),
      warning: (msg, opts) => show('warning', msg, opts),
      info: (msg, opts) => show('info', msg, opts),
    }),
    [show],
  );

  return { toastRef, toast };
}
