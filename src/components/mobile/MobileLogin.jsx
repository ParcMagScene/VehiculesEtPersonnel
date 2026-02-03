import React, { useState } from 'react';
import { LogIn, UserPlus, Mail } from 'lucide-react';
import api from '../../utils/api';
import AccessRequestModal from '../AccessRequestModal';
import './MobileLogin.css';

function MobileLogin({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login', 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        await api.register(email, name, password);
        setMode('login');
        setPassword('');
        setError('');
        alert('✅ Compte créé avec succès !\n\nVous pouvez maintenant vous connecter.');
      } else {
        const data = await api.login(email, password);
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mobile-login">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            {mode === 'register' ? <UserPlus size={32} /> : <LogIn size={32} />}
          </div>
          <h1>Réservation Véhicules</h1>
          <p>{mode === 'register' ? 'Créer un compte' : 'Connectez-vous pour continuer'}</p>
          {mode === 'register' && (
            <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '8px' }}>
              ⚠️ Email autorisé requis
            </small>
          )}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="name">Nom complet</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (mode === 'register' ? 'Création...' : 'Connexion...') : (mode === 'register' ? 'Créer le compte' : 'Se connecter')}
          </button>

          <button 
            type="button" 
            className="toggle-mode-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setPassword('');
            }}
          >
            {mode === 'login' ? 'Créer un compte' : 'Déjà un compte ? Se connecter'}
          </button>

          <button 
            type="button" 
            className="access-request-button"
            onClick={() => setShowAccessRequest(true)}
          >
            <Mail size={16} />
            Pas d'accès ? Faire une demande
          </button>
        </form>

        <div className="login-footer">
          <p>Interface mobile simplifiée</p>
        </div>
      </div>

      {showAccessRequest && (
        <AccessRequestModal
          onClose={() => setShowAccessRequest(false)}
          onSuccess={() => {
            alert('✅ Demande envoyée avec succès !\n\nVous recevrez un email dès qu\'un administrateur aura validé votre demande.');
          }}
        />
      )}
    </div>
  );
}

export default MobileLogin;
