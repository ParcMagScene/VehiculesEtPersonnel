/* ═══════════════════════════════════════════════════════════════
   PersonalAuthContext — Authentification personnelle
   Permet à un utilisateur du compte Equipe d'accéder aux données
   d'un personnel spécifique via PIN ou mot de passe
   ═══════════════════════════════════════════════════════════════ */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import api from '../utils/api/index.js';

const PersonalAuthContext = createContext();

export function PersonalAuthProvider({ children }) {
  const [authenticatedPerson, setAuthenticatedPerson] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  /**
   * Déconnecter l'utilisateur personnel
   */
  const logoutPersonal = useCallback(() => {
    setAuthenticatedPerson(null);
    setAuthError(null);
  }, []);

  /**
   * Authentifier un utilisateur personnel
   * @param {number} personId - ID de la personne
   * @param {string} pin - Code PIN (4 chiffres) optionnel
   * @param {string} password - Mot de passe optionnel
   */
  const authenticatePersonal = useCallback(
    async (personId, { pin = '', password = '' } = {}) => {
      if (!pin && !password) {
        setAuthError('Code PIN ou mot de passe requis');
        return false;
      }

      setAuthLoading(true);
      setAuthError(null);

      try {
        const response = await api.request('/api/suivi/personal-auth', 'POST', {
          personId,
          pin: pin || undefined,
          password: password || undefined,
        });

        if (response.success) {
          setAuthenticatedPerson(response.person);
          // Auto-déconnexion après 10 minutes d'inactivité
          const timeoutId = setTimeout(
            () => {
              logoutPersonal();
            },
            10 * 60 * 1000,
          );

          return { success: true, timeoutId };
        } else {
          setAuthError(response.error || 'Authentification échouée');
          return false;
        }
      } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || 'Erreur serveur';
        setAuthError(errorMsg);
        return false;
      } finally {
        setAuthLoading(false);
      }
    },
    [logoutPersonal],
  );

  /**
   * Vérifier si un utilisateur personnel est authentifié
   */
  const isPersonalAuthenticated = !!authenticatedPerson;

  /**
   * Obtenir l'ID de la personne authentifiée
   */
  const getAuthenticatedPersonId = useCallback(
    () => authenticatedPerson?.id || null,
    [authenticatedPerson],
  );

  const clearError = useCallback(() => setAuthError(null), []);

  // [PERF Phase 4.G] Mémoïser la value : sans ça, tous les subscribers de
  // usePersonalAuth() re-rendent à chaque render du Provider parent.
  const value = useMemo(
    () => ({
      // État
      authenticatedPerson,
      authError,
      authLoading,
      isPersonalAuthenticated,

      // Actions
      authenticatePersonal,
      logoutPersonal,
      getAuthenticatedPersonId,

      // Utilitaires
      clearError,
    }),
    [
      authenticatedPerson,
      authError,
      authLoading,
      isPersonalAuthenticated,
      authenticatePersonal,
      logoutPersonal,
      getAuthenticatedPersonId,
      clearError,
    ],
  );

  return <PersonalAuthContext.Provider value={value}>{children}</PersonalAuthContext.Provider>;
}

/**
 * Hook pour utiliser le contexte PersonalAuth
 */
export function usePersonalAuth() {
  const context = useContext(PersonalAuthContext);
  if (!context) {
    throw new Error("usePersonalAuth doit être utilisé à l'intérieur de PersonalAuthProvider");
  }
  return context;
}
