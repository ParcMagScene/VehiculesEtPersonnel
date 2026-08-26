/* ═══════════════════════════════════════════════════════════════
   usePersonalActionGuard — Auth éphémère « actions personnelles »
   ═══════════════════════════════════════════════════════════════

   Permet à un composant métier de déclencher une action sensible
   (création d'assignment, demande de congé, indisponibilité) qui :
     - depuis un compte personnel : s'exécute directement (callback `direct`)
     - depuis le compte Equipe partagé (commun@magsav.com) : ouvre une
       modal d'auth éphémère, vérifie PIN/mot de passe, puis exécute
       via POST /api/personal-actions/perform.

   Usage type :
     const guard = usePersonalActionGuard();

     // Dans le handler save :
     guard.run({
       actionType: 'create_assignment',
       payload: { date, person_id, ... },
       defaultPersonId: assignment?.person_id,
       direct: () => api.createAssignment(payload),
       onSuccess: (res) => { closeModal(); refresh(); },
       onError: (err) => toast(err.message),
     });

   Le composant racine doit afficher `<PersonalActionDialog … {...guard.dialogProps} />`. */

import { useCallback, useState } from 'react';

import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../utils/api';

const initialDialogState = {
  isOpen: false,
  actionType: null,
  payload: null,
  defaultPersonId: null,
  actionLabel: 'Valider en mon nom',
  description: undefined,
  // Callbacks transmis par le composant appelant
  onSuccess: null,
  onError: null,
  onCancel: null,
};

export default function usePersonalActionGuard() {
  const { isTeamAccount } = useAuth();
  const [state, setState] = useState(initialDialogState);

  const closeDialog = useCallback(() => {
    setState(initialDialogState);
  }, []);

  /**
   * Annule explicitement (l'utilisateur ferme la modal sans valider).
   * Appelle onCancel s'il a été fourni puis ferme.
   */
  const handleCancel = useCallback(() => {
    state.onCancel?.();
    setState(initialDialogState);
  }, [state]);

  /**
   * Déclenche une action personnelle.
   * - Si compte Equipe : ouvre le dialog (l'utilisateur tape PIN/mdp).
   * - Sinon : appelle `direct()` immédiatement.
   */
  const run = useCallback(
    async ({
      actionType,
      payload,
      defaultPersonId = null,
      actionLabel = 'Valider en mon nom',
      description,
      direct,
      onSuccess,
      onError,
      onCancel,
    }) => {
      if (!isTeamAccount) {
        // Compte perso normal → exécution directe
        if (typeof direct !== 'function') {
          const err = new Error('Aucun handler direct fourni pour ce contexte');
          onError?.(err);
          throw err;
        }
        try {
          const result = await direct();
          onSuccess?.(result);
          return result;
        } catch (err) {
          onError?.(err);
          throw err;
        }
      }

      // Compte Equipe → ouvre la modal
      setState({
        isOpen: true,
        actionType,
        payload,
        defaultPersonId,
        actionLabel,
        description,
        onSuccess: onSuccess || null,
        onError: onError || null,
        onCancel: onCancel || null,
      });
    },
    [isTeamAccount],
  );

  /**
   * Handler interne — appelé par PersonalActionDialog quand l'utilisateur
   * valide. Lance la requête backend et notifie l'appelant.
   * Throw en cas d'échec pour que la modal affiche l'erreur.
   */
  const handleConfirm = useCallback(
    async ({ personId, pin, password }) => {
      const { actionType, payload, onSuccess } = state;
      const result = await api.performPersonalAction({
        personId,
        pin,
        password,
        actionType,
        payload,
      });
      if (!result || result.success === false) {
        const message = result?.error || 'Action refusée';
        throw new Error(message);
      }
      onSuccess?.(result);
      closeDialog();
      return result;
    },
    [state, closeDialog],
  );

  return {
    run,
    /**
     * Props à étaler sur `<PersonalActionDialog>`.
     * `personnel` doit être ajouté par l'appelant (liste contextuelle).
     */
    dialogProps: {
      isOpen: state.isOpen,
      onClose: handleCancel,
      defaultPersonId: state.defaultPersonId,
      actionLabel: state.actionLabel,
      description: state.description,
      onConfirm: handleConfirm,
    },
    /** Indique si le compte courant est le compte partagé Equipe. */
    isTeamAccount,
  };
}
