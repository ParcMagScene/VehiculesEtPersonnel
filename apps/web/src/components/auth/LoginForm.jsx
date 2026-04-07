import React, { useState, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';
import api from '../../utils/api';
import AccessRequestModal from '../management/AccessRequestModal';
import './LoginForm.css';
import { Button, FormField, Input, Avatar, InlineAlert } from '@/design-system';

const LoginForm = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [setupEmail, setSetupEmail] = useState(null); // Email pré-rempli pour lien direct
  const [users, setUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSessionConflict, setShowSessionConflict] = useState(false);
  const [conflictUser, setConflictUser] = useState(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetFormEmail, setResetFormEmail] = useState('');
  const [resetFormName, setResetFormName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetStep, setResetStep] = useState('request'); // 'request' or 'confirm'
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [resetError, setResetError] = useState('');

  // Détecter le paramètre URL ?setup=email pour ouvrir le modal de création directe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupParam = params.get('setup');
    if (setupParam) {
      setSetupEmail(setupParam);
      setShowAccessRequest(true);
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Charger la liste des utilisateurs
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await api.getUsersPublic();
        setUsers(data);
      } catch (err) {
        console.error('Erreur chargement utilisateurs:', err);
      }
    };
    loadUsers();
  }, []);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    // [AUDIT FIX HIGH-1] Email n'est plus exposé dans users-public
    // L'utilisateur doit saisir son email manuellement
    setShowUserList(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      // Vérifier si c'est une erreur de session déjà active
      if (err.response?.status === 409 && err.response?.data?.error === 'SESSION_ALREADY_ACTIVE') {
        setConflictUser({ email, password });
        setShowSessionConflict(true);
        setError('');
      } 
      // Vérifier si c'est une demande de réinitialisation de mot de passe
      else if (err.response?.status === 403 && err.response?.data?.error === 'PASSWORD_RESET_REQUIRED') {
        setResetFormEmail(email);
        setResetStep('request');
        setResetToken('');
        setNewPassword('');
        setNewPasswordConfirm('');
        setShowResetPassword(true);
        setResetError('Votre compte nécessite une réinitialisation du mot de passe. Demandez un code et suivez les instructions.');
        setError('');
      } 
      else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const data = await api.forceLogin(conflictUser.email, conflictUser.password);
      
      // Fermer le modal et informer le parent
      setShowSessionConflict(false);
      window.location.reload(); // Recharger l'application
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleSelfResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');

    // Étape 1 : Demander un code de vérification (OTP) par email
    if (resetStep === 'request') {
      try {
        await api.selfResetPassword(resetFormEmail, resetFormName);
        setResetStep('confirm');
        setResetError('Un code de vérification a été envoyé à votre email.');
      } catch (err) {
        setResetError(err.message);
      }

      return;
    }

    // Étape 2 : Confirmer le code OTP et définir le nouveau mot de passe
    if (newPassword !== newPasswordConfirm) {
      setResetError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!resetToken) {
      setResetError('Veuillez saisir le code de vérification (OTP) reçu par email.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.setNewPassword(resetFormEmail, resetToken, newPassword);
      setShowResetPassword(false);
      window.location.reload();
    } catch (err) {
      setResetError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-overlay">
      <div className="login-container">
        <div className="login-header">
          <img src="/Logos/LogoEmag.png" alt="eM@g Scene" className="login-logo" />
          <p>Connexion</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {users.length > 0 && (
            <FormField className="form-group" label="Sélectionner un utilisateur">
              <div 
                className="user-selector login-user-selector"
                onClick={() => setShowUserList(!showUserList)}
              >
                {selectedUser ? (
                  <div className="login-user-selected">
                    <Avatar name={selectedUser.name} avatar={selectedUser.avatar} size="md" gradient={false} />
                    <div>
                      <div className="login-user-name">{selectedUser.name}</div>
                    </div>
                  </div>
                ) : (
                  <div className="login-user-placeholder">
                    <User size={24} />
                    <span>Choisir un utilisateur</span>
                  </div>
                )}
                <ChevronDown size={20} className="login-chevron" />

                {showUserList && (
                  <div 
                    className="user-list login-user-list"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {users.map(user => (
                      <div
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        className="login-user-item"
                      >
                        <Avatar name={user.name} avatar={user.avatar} size="md" gradient={false} />
                        <div className="login-user-item-info">
                          <div className="login-user-name">{user.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormField>
          )}

          {!users.length && (
            <FormField className="form-group" label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@exemple.com"
              />
            </FormField>
          )}

          <FormField className="form-group" label="Mot de passe">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </FormField>

          {error && <InlineAlert>{error}</InlineAlert>}

          <Button variant="ghost" type="submit" className="login-button" disabled={loading}>
            {loading ? 'Chargement...' : 'Se connecter'}
          </Button>

          <Button variant="ghost"             type="button"
            className="forgot-password-link"
            onClick={() => {
              setShowResetPassword(true);
              setResetStep('request');
              setResetFormEmail(email || '');
              setResetFormName('');
              setResetToken('');
              setNewPassword('');
              setNewPasswordConfirm('');
              setResetError('');
            }}
          >
            Mot de passe oublié ?
          </Button>

          <Button variant="ghost"             type="button"
            className="access-request-button"
            onClick={() => setShowAccessRequest(true)}
          >
            Pas encore de compte ? Demander un accès
          </Button>
        </form>

        {showAccessRequest && (
          <AccessRequestModal
            onClose={() => { setShowAccessRequest(false); setSetupEmail(null); }}
            onSuccess={() => {}}
            prefillEmail={setupEmail}
          />
        )}

        {showSessionConflict && (
          <div className="login-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowSessionConflict(false)}>
            <div className="login-modal-content session-conflict-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>⚠️ Session déjà active</h3>
              </div>
              <div className="modal-body">
                <p className="login-modal-text">
                  Une session est déjà ouverte avec ces identifiants sur un autre appareil ou navigateur.
                </p>
                <p className="login-modal-text-secondary">
                  Vous pouvez :<br/>
                  • <strong>Fermer les autres sessions</strong> et vous connecter ici (recommandé)<br/>
                  • Annuler et vous déconnecter de l'autre appareil d'abord
                </p>
                
                {error && (
                  <InlineAlert className="login-modal-alert">{error}</InlineAlert>
                )}
                
                <div className="modal-actions login-modal-actions">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowSessionConflict(false);
                      setConflictUser(null);
                    }}
                    disabled={loading}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleForceLogin}
                    disabled={loading}
                  >
                    {loading ? 'Connexion...' : 'Fermer les autres sessions et se connecter'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showResetPassword && (
          <div
            className="login-overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowResetPassword(false);
                setResetStep('request');
                setResetToken('');
                setResetError('');
              }
            }}
          >
            <div className="login-modal-content session-conflict-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header login-reset-header">
                <h3>🔑 Réinitialiser le mot de passe</h3>
              </div>
              <div className="modal-body">
                <p className="login-modal-text">
                  {resetStep === 'request'
                    ? 'Entrez votre adresse email et votre nom complet pour recevoir un code de vérification par email.'
                    : 'Entrez le code de vérification reçu par email et choisissez un nouveau mot de passe.'}
                </p>
                
                <form onSubmit={handleSelfResetPassword}>
                  <FormField className="form-group login-form-field-spacing" label="Adresse email" htmlFor="reset-email">
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetFormEmail}
                      onChange={(e) => setResetFormEmail(e.target.value)}
                      placeholder="email@exemple.com"
                      required
                      autoFocus
                      className="login-reset-input"
                    />
                  </FormField>

                  <FormField className="form-group login-form-field-spacing" label="Nom complet" htmlFor="reset-name">
                    <Input
                      id="reset-name"
                      type="text"
                      value={resetFormName}
                      onChange={(e) => setResetFormName(e.target.value)}
                      placeholder="Prénom Nom"
                      required
                      className="login-reset-input"
                    />
                  </FormField>

                  {resetStep === 'confirm' && (
                    <FormField className="form-group login-form-field-spacing" label="Code de vérification (OTP)" htmlFor="reset-token">
                      <Input
                        id="reset-token"
                        type="text"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="Entrez le code reçu par email"
                        required
                        className="login-reset-input"
                      />
                    </FormField>
                  )}

                  <FormField className="form-group login-form-field-spacing" label="Nouveau mot de passe" htmlFor="new-password">
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Entrez votre nouveau mot de passe"
                      minLength={10}
                      required
                      className="login-reset-input"
                    />
                  </FormField>

                  <FormField className="form-group login-form-field-spacing-last" label="Confirmer le mot de passe" htmlFor="confirm-password">
                    <Input
                      id="confirm-password"
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="Confirmez votre nouveau mot de passe"
                      minLength={10}
                      required
                      className="login-reset-input"
                    />
                  </FormField>

                  {resetStep === 'confirm' && (
                    <div className="login-resend-text">
                      <span>Vous n'avez pas reçu le code ? </span>
                      <Button variant="ghost"                         type="button"
                        onClick={() => {
                          setResetStep('request');
                          setResetToken('');
                          setResetError('');
                        }}
                        className="login-resend-link"
                      >
                        Réessayer
                      </Button>
                    </div>
                  )}

                  {resetError && (
                    <InlineAlert className="login-modal-alert">{resetError}</InlineAlert>
                  )}
                  
                  <div className="modal-actions login-modal-actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowResetPassword(false);
                        setResetStep('request');
                        setResetToken('');
                        setResetError('');
                      }}
                      disabled={loading}
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={
                        loading ||
                        !resetFormEmail ||
                        !resetFormName ||
                        (resetStep === 'confirm' && (!resetToken || newPassword.length < 6 || newPasswordConfirm !== newPassword))
                      }
                    >
                      {loading
                        ? 'Réinitialisation...'
                        : resetStep === 'request'
                        ? 'Envoyer le code'
                        : 'Réinitialiser'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
