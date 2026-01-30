import React, { useState } from 'react';
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
