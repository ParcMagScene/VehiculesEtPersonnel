import React, { createContext, useContext, useRef } from 'react';

/**
 * Context pour partager le système de toast à tous les composants enfants.
 * Évite le prop drilling de toast.success/error/warning/info.
 * 
 * Usage dans un composant enfant :
 *   import { useToast } from '../hooks/useToast';
 *   const toast = useToast();
 *   toast.success('Sauvegardé !');
 *   toast.error('Erreur : ' + err.message);
 */

const ToastContext = createContext(null);

/**
 * Provider à placer dans App.jsx, en passant l'objet toast de useFeedback().
 * 
 * Example:
 *   const { toastRef, toast } = useFeedback();
 *   <ToastProvider toast={toast}>
 *     <App />
 *   </ToastProvider>
 */
export function ToastProvider({ toast, children }) {
  return (
    <ToastContext.Provider value={toast}>
      {children}
    </ToastContext.Provider>
  );
}

/**
 * Hook pour accéder au toast depuis n'importe quel composant enfant.
 * Retourne un objet { success, error, warning, info } ou un fallback silencieux.
 */
export function useToast() {
  const toast = useContext(ToastContext);
  // Fallback silencieux si utilisé hors du provider (ne crashe pas)
  if (!toast) {
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return toast;
}

export default ToastContext;
