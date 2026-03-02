import React, { useState, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';
import api, { getApiUrl } from '../utils/api';
import AccessRequestModal from './AccessRequestModal';
import UserAvatar from './UserAvatar';
import './LoginForm.css';

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
        const response = await fetch(`${getApiUrl()}/auth/users`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        }
      } catch (err) {
        console.error('Erreur chargement utilisateurs:', err);
      }
    };
    loadUsers();
  }, []);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setEmail(user.email);
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
      const response = await fetch(`${getApiUrl()}/auth/force-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: conflictUser.email, 
          password: conflictUser.password 
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la connexion forcée');
      }

      const data = await response.json();
      
      // Sauvegarder le token via api.setAuth (synchronise le singleton)
      api.setAuth(data.token, data.user);
      
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
    if (newPassword !== newPasswordConfirm) {
      setResetError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    setResetError('');
    
    try {
      const response = await fetch(`${getApiUrl()}/auth/self-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: resetFormEmail, 
          name: resetFormName,
          newPassword: newPassword 
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la réinitialisation');
      }

      const data = await response.json();
      
      // Sauvegarder le token via api.setAuth (synchronise le singleton)
      api.setAuth(data.token, data.user);
      
      // Fermer le modal et recharger
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
          <img src="/Logos/LogoEmag.png" alt="eM@g Scene" style={{ maxWidth: '200px', height: 'auto', margin: '0 auto 1rem' }} />
          <p>Connexion</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {users.length > 0 && (
            <div className="form-group">
              <label>Sélectionner un utilisateur</label>
              <div 
                className="user-selector"
                onClick={() => setShowUserList(!showUserList)}
                style={{
                  position: 'relative',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '8px',
                  padding: '12px',
                  cursor: 'pointer',
                  background: 'var(--theme-bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                {selectedUser ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <UserAvatar name={selectedUser.name} avatar={selectedUser.avatar} size={40} gradient={false} />
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--theme-text-heading)' }}>{selectedUser.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--theme-text-gray)' }}>{selectedUser.email}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--theme-text-muted)' }}>
                    <User size={24} />
                    <span>Choisir un utilisateur</span>
                  </div>
                )}
                <ChevronDown size={20} style={{ color: 'var(--theme-text-gray)' }} />

                {showUserList && (
                  <div 
                    className="user-list"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'var(--theme-bg-card)',
                      border: '1px solid var(--theme-border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 10
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {users.map(user => (
                      <div
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'background 0.2s',
                          borderBottom: '1px solid var(--theme-border)'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--theme-bg-secondary)'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                      >
                        <UserAvatar name={user.name} avatar={user.avatar} size={40} gradient={false} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: 'var(--theme-text-heading)' }}>{user.name}</div>
                          <div style={{ fontSize: '13px', color: 'var(--theme-text-gray)' }}>{user.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!users.length && (
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@exemple.com"
              />
            </div>
          )}

          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Chargement...' : 'Se connecter'}
          </button>

          <button
            type="button"
            className="forgot-password-link"
            onClick={() => {
              setShowResetPassword(true);
              setResetFormEmail(email || (selectedUser ? selectedUser.email : ''));
              setResetFormName('');
              setNewPassword('');
              setNewPasswordConfirm('');
              setResetError('');
            }}
          >
            Mot de passe oublié ?
          </button>

          <button
            type="button"
            className="access-request-button"
            onClick={() => setShowAccessRequest(true)}
          >
            Pas encore de compte ? Demander un accès
          </button>
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
                <p style={{ marginBottom: '16px', color: 'var(--theme-text-body)' }}>
                  Une session est déjà ouverte avec ces identifiants sur un autre appareil ou navigateur.
                </p>
                <p style={{ marginBottom: '24px', color: 'var(--theme-text-gray)', fontSize: '14px' }}>
                  Vous pouvez :<br/>
                  • <strong>Fermer les autres sessions</strong> et vous connecter ici (recommandé)<br/>
                  • Annuler et vous déconnecter de l'autre appareil d'abord
                </p>
                
                {error && (
                  <div className="error-message" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}
                
                <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowSessionConflict(false);
                      setConflictUser(null);
                    }}
                    disabled={loading}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleForceLogin}
                    disabled={loading}
                    style={{ background: '#ef4444' }}
                  >
                    {loading ? 'Connexion...' : 'Fermer les autres sessions et se connecter'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showResetPassword && (
          <div className="login-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowResetPassword(false)}>
            <div className="login-modal-content session-conflict-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ background: 'var(--theme-gradient-alt, linear-gradient(135deg, var(--theme-accent), #d97706))' }}>
                <h3>🔑 Réinitialiser le mot de passe</h3>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '16px', color: 'var(--theme-text-body)' }}>
                  Entrez votre adresse email, votre nom complet et choisissez un nouveau mot de passe.
                </p>
                
                <form onSubmit={handleSelfResetPassword}>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label htmlFor="reset-email" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      Adresse email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={resetFormEmail}
                      onChange={(e) => setResetFormEmail(e.target.value)}
                      placeholder="email@exemple.com"
                      required
                      autoFocus
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--theme-border)', borderRadius: '4px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label htmlFor="reset-name" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      Nom complet
                    </label>
                    <input
                      id="reset-name"
                      type="text"
                      value={resetFormName}
                      onChange={(e) => setResetFormName(e.target.value)}
                      placeholder="Prénom Nom"
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--theme-border)', borderRadius: '4px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label htmlFor="new-password" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      Nouveau mot de passe
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Entrez votre nouveau mot de passe"
                      minLength={6}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--theme-border)', borderRadius: '4px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label htmlFor="confirm-password" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      Confirmer le mot de passe
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="Confirmez votre nouveau mot de passe"
                      minLength={6}
                      required
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--theme-border)', borderRadius: '4px' }}
                    />
                  </div>

                  {resetError && (
                    <div className="error-message" style={{ marginBottom: '16px' }}>
                      {resetError}
                    </div>
                  )}
                  
                  <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setShowResetPassword(false);
                        setResetError('');
                      }}
                      disabled={loading}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading || !resetFormEmail || !resetFormName || newPassword.length < 6 || !newPasswordConfirm}
                    >
                      {loading ? 'Réinitialisation...' : 'Réinitialiser'}
                    </button>
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
