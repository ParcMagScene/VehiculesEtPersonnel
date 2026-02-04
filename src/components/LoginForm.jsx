import React, { useState, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';
import api from '../utils/api';
import AccessRequestModal from './AccessRequestModal';
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

  // Charger la liste des utilisateurs
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/auth/users');
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

  // Fonction pour générer les initiales
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Fonction pour générer une couleur basée sur le nom
  const getAvatarColor = (name) => {
    const colors = [
      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
      '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-container">
        <div className="login-header">
          <h1>Planning Véhicules MagScene</h1>
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
                    <div 
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: getAvatarColor(selectedUser.name),
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      {getInitials(selectedUser.name)}
                    </div>
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
                        <div 
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: getAvatarColor(user.name),
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: '600',
                            flexShrink: 0
                          }}
                        >
                          {getInitials(user.name)}
                        </div>
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
      </div>
    </div>
  );
};

export default LoginForm;
