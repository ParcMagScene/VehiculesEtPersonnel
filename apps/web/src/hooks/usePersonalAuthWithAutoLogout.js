/* ═══════════════════════════════════════════════════════════════
   usePersonalAuthWithAutoLogout — Hook pour gestion auth personnelle
   Gère l'authentification personnelle et la déconnexion automatique
   après modification de données
   ═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from 'react';

import { usePersonalAuth } from '../contexts/PersonalAuthContext.jsx';

/**
 * Hook pour gérer l'authentification personnelle avec déconnexion automatique
 * @param {Object} options - Configuration
 * @param {number} options.inactivityTimeout - Timeout d'inactivité en ms (défaut: 5 min)
 * @param {number} options.sessionTimeout - Durée max de session en ms (défaut: 15 min)
 * @returns {Object} État et actions
 */
export function usePersonalAuthWithAutoLogout({
  inactivityTimeout = 5 * 60 * 1000, // 5 minutes
  sessionTimeout = 15 * 60 * 1000, // 15 minutes
} = {}) {
  const { isPersonalAuthenticated, logoutPersonal } = usePersonalAuth();
  const inactivityTimeoutRef = useRef(null);
  const sessionTimeoutRef = useRef(null);
  const sessionStartRef = useRef(null);

  /**
   * Réinitialiser le timer d'inactivité
   */
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    if (isPersonalAuthenticated) {
      inactivityTimeoutRef.current = setTimeout(() => {
        logoutPersonal();
      }, inactivityTimeout);
    }
  }, [isPersonalAuthenticated, inactivityTimeout, logoutPersonal]);

  /**
   * Notifier une activité utilisateur
   * Réinitialise le timer d'inactivité
   */
  const notifyActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  /**
   * Déconnecter après avoir sauvegardé des données
   * Utilisé après modification de planning ou fiche de suivi
   */
  const logoutAfterSave = useCallback(
    async (delayMs = 1000) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          logoutPersonal();
          resolve();
        }, delayMs);
      });
    },
    [logoutPersonal],
  );

  // Initialiser les timers quand l'authentification commence
  useEffect(() => {
    if (isPersonalAuthenticated && !sessionStartRef.current) {
      sessionStartRef.current = Date.now();
      resetInactivityTimer();

      // Timer de session maximale
      sessionTimeoutRef.current = setTimeout(() => {
        logoutPersonal();
      }, sessionTimeout);
    }

    // Cleanup
    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [isPersonalAuthenticated, resetInactivityTimer, sessionTimeout, logoutPersonal]);

  // Listener sur les événements d'activité utilisateur
  useEffect(() => {
    if (!isPersonalAuthenticated) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      notifyActivity();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isPersonalAuthenticated, notifyActivity]);

  return {
    isPersonalAuthenticated,
    resetInactivityTimer,
    notifyActivity,
    logoutAfterSave,
    logoutPersonal,
  };
}
