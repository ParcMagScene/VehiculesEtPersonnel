import React, { useState, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';
import api, { getApiUrl } from '../utils/api';
import AccessRequestModal from './AccessRequestModal';
import UserAvatar from './UserAvatar';
import './LoginForm.css';

const LoginForm = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [users, setUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSessionConflict, setShowSessionConflict] = useState(false);
  const [conflictUser, setConflictUser] = useState(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

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
    
    if (!isRegister) {
      loadUsers();
    }
  }, [isRegister]);

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
      if (isRegister) {
        await api.register(email, name, password);
        setIsRegister(false);
        setError('');
        alert('Compte créé ! Vous pouvez maintenant vous connecter.');
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      // Vérifier si c'est une erreur de session déjà active
      if (err.response?.status === 409 && err.response?.data?.error === 'SESSION_ALREADY_ACTIVE') {
        setConflictUser({ email, password });
        setShowSessionConflict(true);
        setError('');
      } 
      // Vérifier si c'est une demande de réinitialisation de mot de passe
      else if (err.response?.status === 403 && err.response?.data?.error === 'PASSWORD_RESET_REQUIRED') {
        setResetEmail(email);
        setShowPasswordReset(true);
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
      
      // Sauvegarder le token
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      
      // Fermer le modal et informer le parent
      setShowSessionConflict(false);
      window.location.reload(); // Recharger l'application
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${getApiUrl()}/auth/set-new-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: resetEmail, 
          newPassword: newPassword 
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la définition du mot de passe');
      }

      const data = await response.json();
      
      // Sauvegarder le token (auto-login)
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      
      // Fermer le modal et recharger
      setShowPasswordReset(false);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-overlay">
      <div className="login-container">
        <div className="login-header">
          <img src="/Logos/LogoMagSav.svg" alt="Mag Scène" style={{ maxWidth: '200px', height: 'auto', margin: '0 auto 1rem' }} />
          <p>{isRegister ? 'Créer un compte' : 'Connexion'}</p>
          {isRegister && (
            <small style={{ color: '#6b7280', fontSize: '13px', display: 'block', marginTop: '8px' }}>
              ⚠️ Seuls les emails autorisés par un administrateur peuvent créer un compte
            </small>
          )}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {!isRegister && users.length > 0 && (
            <div className="form-group">
              <label>Sélectionner un utilisateur</label>
              <div 
                className="user-selector"
                onClick={() => setShowUserList(!showUserList)}
                style={{
                  position: 'relative',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '12px',
                  cursor: 'pointer',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                {selectedUser ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <UserAvatar name={selectedUser.name} avatar={selectedUser.avatar} size={40} gradient={false} />
                    <div>
                      <div style={{ fontWeight: '500', color: '#111827' }}>{selectedUser.name}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{selectedUser.email}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#9ca3af' }}>
                    <User size={24} />
                    <span>Choisir un utilisateur</span>
                  </div>
                )}
                <ChevronDown size={20} style={{ color: '#6b7280' }} />

                {showUserList && (
                  <div 
                    className="user-list"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #d1d5db',
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
                          borderBottom: '1px solid #f3f4f6'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                      >
                        <UserAvatar name={user.name} avatar={user.avatar} size={40} gradient={false} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#111827' }}>{user.name}</div>
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>{user.email}</div>
                        </div>
                        {user.isAdmin && (
                          <span style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            ADMIN
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {isRegister && (
            <div className="form-group">
              <label>Nom complet</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jean Dupont"
              />
            </div>
          )}

          {(isRegister || !users.length) && (
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
            {loading ? 'Chargement...' : (isRegister ? 'Créer le compte' : 'Se connecter')}
          </button>

          <button
            type="button"
            className="toggle-button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
          >
            {isRegister ? 'Déjà un compte ? Se connecter' : 'Créer un compte'}
          </button>

          <button
            type="button"
            className="access-request-button"
            onClick={() => setShowAccessRequest(true)}
          >
            Pas encore d'accès ? Faire une demande
          </button>
        </form>

        {showAccessRequest && (
          <AccessRequestModal
            onClose={() => setShowAccessRequest(false)}
            onSuccess={() => {
              alert('✅ Demande envoyée avec succès !\n\nVous recevrez un email dès qu\'un administrateur aura validé votre demande.');
            }}
          />
        )}

        {showSessionConflict && (
          <div className="modal-overlay" onClick={() => setShowSessionConflict(false)}>
            <div className="modal-content session-conflict-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>⚠️ Session déjà active</h3>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '16px', color: '#374151' }}>
                  Une session est déjà ouverte avec ces identifiants sur un autre appareil ou navigateur.
                </p>
                <p style={{ marginBottom: '24px', color: '#6b7280', fontSize: '14px' }}>
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

        {showPasswordReset && (
          <div className="modal-overlay" onClick={() => setShowPasswordReset(false)}>
            <div className="modal-content session-conflict-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🔐 Compte réinitialisé</h3>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '16px', color: '#374151' }}>
                  Votre administrateur a réinitialisé votre compte.
                </p>
                <p style={{ marginBottom: '24px', color: '#6b7280', fontSize: '14px' }}>
                  Veuillez définir un nouveau mot de passe pour continuer.<br/>
                  Le mot de passe doit contenir au moins 6 caractères.
                </p>
                
                <form onSubmit={handleSetNewPassword}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
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
                      autoFocus
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    />
                  </div>

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
                        setShowPasswordReset(false);
                        setNewPassword('');
                      }}
                      disabled={loading}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading || newPassword.length < 6}
                    >
                      {loading ? 'Définition...' : 'Définir mon mot de passe'}
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
