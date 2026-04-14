import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, User, KeyRound, UserPlus, LogIn } from 'lucide-react';
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
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  // État de vérification email
  const [emailStatus, setEmailStatus] = useState(null); // null | 'checking' | 'authorized' | 'unknown' | 'already-registered'
  const [_emailCheckName, setEmailCheckName] = useState('');
  const userSelectorRef = useRef(null);

  // Vérifier l'email pour savoir si autorisé / déjà inscrit
  const checkEmail = useCallback(async (emailToCheck) => {
    if (!emailToCheck || !emailToCheck.includes('@')) {
      setEmailStatus(null);
      return;
    }
    setEmailStatus('checking');
    try {
      const data = await api.checkEmailAccessRequest(emailToCheck);
      if (data.authorized) {
        setEmailStatus('authorized');
        if (data.name) setEmailCheckName(data.name);
      } else if (data.reason === 'already_registered') {
        setEmailStatus('already-registered');
      } else {
        setEmailStatus('unknown');
      }
    } catch (_err) {
      setEmailStatus(null);
    }
  }, []);

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

  // Debounce check email (800ms après arrêt de saisie)
  useEffect(() => {
    if (!email || !email.includes('@')) {
      setEmailStatus(null);
      return;
    }
    const timer = setTimeout(() => checkEmail(email), 800);
    return () => clearTimeout(timer);
  }, [email, checkEmail]);

  // Fermer le dropdown utilisateur au clic extérieur
  useEffect(() => {
    if (!showUserList) return;
    const handleClickOutside = (e) => {
      if (userSelectorRef.current && !userSelectorRef.current.contains(e.target)) {
        setShowUserList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserList]);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setEmail(user.email || '');
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
        setNewPassword('');
        setNewPasswordConfirm('');
        setShowResetPassword(true);
        setResetError('Votre compte nécessite une réinitialisation du mot de passe.');
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
      const _data = await api.forceLogin(conflictUser.email, conflictUser.password);
      
      // Fermer le modal et se connecter proprement via le callback parent
      setShowSessionConflict(false);
      await onLogin(conflictUser.email, conflictUser.password)
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleSelfResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');

    if (newPassword !== newPasswordConfirm) {
      setResetError('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 10) {
      setResetError('Le mot de passe doit contenir au moins 10 caractères');
      return;
    }

    setLoading(true);
    try {
      await api.selfResetPasswordWithNewPassword(resetFormEmail, resetFormName, newPassword);
      setShowResetPassword(false);
      setResetError('');
      setError('Mot de passe réinitialisé — connectez-vous avec votre nouveau mot de passe.');
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
          <p>Connexion à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {users.length > 0 && (
            <FormField className="form-group" label="Sélectionner un utilisateur">
              <div 
                ref={userSelectorRef}
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

          <FormField className="form-group" label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              required
              placeholder="email@exemple.com"
              autoComplete="username"
            />
          </FormField>

          {/* Indicateur d'état de l'email */}
          {emailStatus === 'authorized' && (
            <div className="login-email-status login-email-authorized">
              <KeyRound size={16} />
              <div>
                <strong>Email autorisé !</strong>
                <span>Vous pouvez créer votre mot de passe pour activer votre compte.</span>
              </div>
              <Button
                variant="primary"
                type="button"
                className="login-setup-password-btn"
                onClick={() => {
                  setSetupEmail(email);
                  setShowAccessRequest(true);
                }}
              >
                <KeyRound size={14} />
                Définir mon mot de passe
              </Button>
            </div>
          )}

          {emailStatus === 'unknown' && (
            <div className="login-email-status login-email-unknown">
              <UserPlus size={16} />
              <div>
                <span>Cet email n'est pas encore enregistré.</span>
              </div>
              <Button
                variant="secondary"
                type="button"
                className="login-request-access-inline-btn"
                onClick={() => setShowAccessRequest(true)}
              >
                <UserPlus size={14} />
                Demander un accès
              </Button>
            </div>
          )}

          {emailStatus !== 'authorized' && (
            <>
              <FormField className="form-group" label="Mot de passe">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </FormField>

              {error && <InlineAlert>{error}</InlineAlert>}

              <Button variant="primary" type="submit" className="login-button" disabled={loading}>
                <LogIn size={18} />
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>

              <Button variant="ghost" type="button"
                className="forgot-password-link"
                onClick={() => {
                  setShowResetPassword(true);
                  setResetFormEmail(email || '');
                  setResetFormName('');
                  setNewPassword('');
                  setNewPasswordConfirm('');
                  setResetError('');
                }}
              >
                Mot de passe oublié ?
              </Button>
            </>
          )}

          <div className="login-separator">
            <span>Pas encore de compte ?</span>
          </div>

          <Button
            variant="secondary"
            type="button"
            className="access-request-button"
            onClick={() => setShowAccessRequest(true)}
          >
            <UserPlus size={18} />
            Demander un accès
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
                  Entrez votre adresse email, votre nom complet, puis choisissez un nouveau mot de passe.
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
                      autoComplete="new-password"
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
                      autoComplete="new-password"
                    />
                  </FormField>

                  {resetError && (
                    <InlineAlert className="login-modal-alert">{resetError}</InlineAlert>
                  )}
                  
                  <div className="modal-actions login-modal-actions">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowResetPassword(false);
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
                        newPassword.length < 10 ||
                        newPasswordConfirm !== newPassword
                      }
                    >
                      {loading ? 'Réinitialisation...' : 'Réinitialiser'}
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
