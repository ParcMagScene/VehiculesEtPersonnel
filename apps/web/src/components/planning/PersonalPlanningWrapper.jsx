/* ═══════════════════════════════════════════════════════════════
   PersonalPlanningWrapper — Wrapper pour filtre personnalisé du planning
   Gère l'authentification personnelle et le filtrage des tâches
   ═══════════════════════════════════════════════════════════════ */

import { AlertCircle, LogOut } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button, Dialog } from '@/design-system';

import { usePersonalAuth } from '../../contexts/PersonalAuthContext.jsx';
import { usePersonalAuthWithAutoLogout } from '../../hooks/usePersonalAuthWithAutoLogout.js';
import PersonalLoginModal from '../suivi/PersonalLoginModal';
import TaskPlanningPanel from './TaskPlanningPanel';

/**
 * Wrapper pour TaskPlanningPanel avec gestion de l'authentification personnelle
 * Permet au compte équipe de voir le planning d'un personnel spécifique
 */
function PersonalPlanningWrapper({
  currentUser,
  personnel = [],
  googleEvents = [],
  refreshKey,
  onNavigateToEntity,
}) {
  const { authenticatedPerson, isPersonalAuthenticated, logoutPersonal } = usePersonalAuth();
  const { logoutAfterSave } = usePersonalAuthWithAutoLogout({
    inactivityTimeout: 5 * 60 * 1000, // 5 min
    sessionTimeout: 15 * 60 * 1000, // 15 min
  });

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAutoLogoutWarning, setShowAutoLogoutWarning] = useState(false);

  /**
   * Ouvrir le modal de login personnel
   */
  const handleOpenPersonalLogin = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  /**
   * Fermer le modal de login
   */
  const handleCloseLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  /**
   * Callback quand le personnel sauvegarde des données
   * Déconnecte automatiquement après un délai court
   */
  const handlePersonalDataSaved = useCallback(async () => {
    // Afficher un message de confirmation avant déconnexion
    setShowAutoLogoutWarning(true);

    // Déconnecter après 2 secondes
    await logoutAfterSave(2000);
    setShowAutoLogoutWarning(false);
  }, [logoutAfterSave]);

  /**
   * Déconnexion manuelle
   */
  const handleManualLogout = useCallback(() => {
    logoutPersonal();
    setShowLoginModal(false);
  }, [logoutPersonal]);

  // Si on est en authentification personnelle, afficher le TaskPlanningPanel filtré
  if (isPersonalAuthenticated && authenticatedPerson) {
    return (
      <div style={{ position: 'relative' }}>
        {/* Header de session personnelle */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fef3c7',
            borderLeft: '4px solid #f59e0b',
            marginBottom: '1rem',
            borderRadius: '0.375rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong style={{ color: '#92400e' }}>
              🔒 Planning Personnel — {authenticatedPerson.first_name}{' '}
              {authenticatedPerson.last_name}
            </strong>
            <p style={{ fontSize: '0.875rem', color: '#a16207', marginTop: '0.25rem' }}>
              Vous consultez vos tâches et assignments. Vous serez automatiquement déconnecté après
              modification ou après 15 minutes d'inactivité.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={handleManualLogout}
            title="Déconnecter ce personnel"
            style={{
              color: '#b45309',
              fontSize: '0.875rem',
            }}
          >
            <LogOut size={16} />
            Terminer
          </Button>
        </div>

        {/* Panel planning filtré au personnel authentifié */}
        <TaskPlanningPanel
          currentUser={currentUser}
          personId={authenticatedPerson.id}
          isPersonalMode={true}
          onPersonalDataSaved={handlePersonalDataSaved}
          googleEvents={googleEvents}
        />

        {/* Modal avertissement auto-déconnexion */}
        {showAutoLogoutWarning && (
          <Dialog
            isOpen={showAutoLogoutWarning}
            onClose={() => setShowAutoLogoutWarning(false)}
            size="sm"
            title="Données Sauvegardées"
            showClose={false}
          >
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <AlertCircle size={48} style={{ color: '#10b981', marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Vos modifications ont été sauvegardées. <br />
                Vous allez être déconnecté...
              </p>
            </div>
          </Dialog>
        )}
      </div>
    );
  }

  // Mode équipe normal avec accès personnalisé
  return (
    <div>
      <TaskPlanningPanel
        currentUser={currentUser}
        isPersonalMode={false}
        googleEvents={googleEvents}
        refreshKey={refreshKey}
        onNavigateToEntity={onNavigateToEntity}
      />

      {/* Bouton "Accès Personnel" si compte équipe */}
      {currentUser?.isTeam && (
        <div style={{ marginTop: '2rem' }}>
          <Button
            variant="secondary"
            onClick={handleOpenPersonalLogin}
            style={{
              width: '100%',
              justifyContent: 'center',
            }}
          >
            🔐 Accès Personnel — Planning
          </Button>
        </div>
      )}

      {/* Modal login personnel */}
      <PersonalLoginModal
        personnel={personnel}
        isOpen={showLoginModal}
        onClose={handleCloseLoginModal}
      />
    </div>
  );
}

export default PersonalPlanningWrapper;
