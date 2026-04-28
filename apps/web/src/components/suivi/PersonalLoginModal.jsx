/* ═══════════════════════════════════════════════════════════════
   PersonalLoginModal — Modal d'authentification personnelle
   Permet à un utilisateur du compte Equipe de s'authentifier
   comme personnel pour accéder à ses données
   ═══════════════════════════════════════════════════════════════ */

import './PersonalLoginModal.css';

import { Eye, EyeOff, Lock, LogIn } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button, Input, Dialog } from '@/design-system';

import { usePersonalAuth } from '../../contexts/PersonalAuthContext.jsx';
import usePersonnelFavorites from '../../hooks/usePersonnelFavorites';

function PersonalLoginModal({ personnel = [], isOpen, onClose }) {
  const { authenticatePersonal, authError, authLoading, clearError } = usePersonalAuth();
  const { getFavoriteDisplayName, getPersonName, sortPersonsByFavorites } = usePersonnelFavorites();

  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('pin'); // 'pin' | 'password'
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setPassword('');
      setSelectedPersonId('');
      setAuthMode('pin');
      setShowPassword(false);
      clearError();
    }
  }, [isOpen, clearError]);

  const handleAuthModeChange = (mode) => {
    setAuthMode(mode);
    setPin('');
    setPassword('');
    clearError();
  };

  const handleLogin = async () => {
    if (!selectedPersonId) {
      return;
    }

    const result = await authenticatePersonal(Number(selectedPersonId), {
      pin: authMode === 'pin' ? pin : '',
      password: authMode === 'password' ? password : '',
    });

    if (result && result.success) {
      onClose();
    }
  };

  const isFormValid =
    selectedPersonId &&
    ((authMode === 'pin' && pin.length === 4) || (authMode === 'password' && password.length > 0));

  const sortedPersonnel = useMemo(
    () => sortPersonsByFavorites(personnel || []),
    [personnel, sortPersonsByFavorites],
  );

  const selectedPersonName = useMemo(() => {
    const person = personnel.find((p) => p.id === Number(selectedPersonId));
    return person ? getPersonName(person) : '';
  }, [personnel, selectedPersonId, getPersonName]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Accès Personnel — Planning et Suivi"
      description="Entrez votre PIN (4 chiffres) ou mot de passe pour accéder à vos données."
      showClose={true}
    >
      <div className="personal-login-modal">
        {/* Sélection du personnel */}
        <div className="form-field">
          <label htmlFor="personnel-select" className="form-label">
            Personnel
          </label>
          <select
            id="personnel-select"
            value={selectedPersonId}
            onChange={(e) => {
              setSelectedPersonId(e.target.value);
              clearError();
            }}
            disabled={authLoading}
            className="personnel-select"
          >
            <option value="">— Sélectionnez un personnel —</option>
            {sortedPersonnel.map((p) => (
              <option key={p.id} value={p.id}>
                {getFavoriteDisplayName(p)}
              </option>
            ))}
          </select>
        </div>

        {selectedPersonName && (
          <div className="selected-person-info">
            <strong>{selectedPersonName}</strong>
          </div>
        )}

        {/* Onglets PIN/Mot de passe */}
        <div className="auth-mode-tabs">
          <button
            type="button"
            className={`auth-tab ${authMode === 'pin' ? 'active' : ''}`}
            onClick={() => handleAuthModeChange('pin')}
            disabled={authLoading}
          >
            Code PIN
          </button>
          <button
            type="button"
            className={`auth-tab ${authMode === 'password' ? 'active' : ''}`}
            onClick={() => handleAuthModeChange('password')}
            disabled={authLoading}
          >
            Mot de passe
          </button>
        </div>

        {/* Champ PIN */}
        {authMode === 'pin' && (
          <div className="form-field">
            <label htmlFor="pin-input" className="form-label">
              Code PIN (4 chiffres)
            </label>
            <Input
              id="pin-input"
              type="text"
              inputMode="numeric"
              placeholder="0000"
              maxLength="4"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d]/g, '');
                setPin(val);
                if (authError) clearError();
              }}
              disabled={authLoading}
              className="pin-input"
            />
          </div>
        )}

        {/* Champ Mot de passe */}
        {authMode === 'password' && (
          <div className="form-field">
            <label htmlFor="password-input" className="form-label">
              Mot de passe
            </label>
            <div className="password-input-wrapper">
              <Input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Entrez votre mot de passe"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) clearError();
                }}
                disabled={authLoading}
                className="password-input"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={authLoading}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* Message d'erreur */}
        {authError && <div className="error-message">{authError}</div>}

        {/* Boutons d'action */}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose} disabled={authLoading}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleLogin}
            disabled={!isFormValid || authLoading}
            isLoading={authLoading}
          >
            <LogIn size={16} />
            Accéder
          </Button>
        </div>

        {/* Info d'aide */}
        <div className="modal-info">
          <Lock size={14} />
          <span>Vos données personnelles sont protégées et filtrées.</span>
        </div>
      </div>
    </Dialog>
  );
}

export default PersonalLoginModal;
