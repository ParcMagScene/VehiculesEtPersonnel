import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import api from '../../utils/api';
import './MobileLogin.css';

function MobileLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await api.login(email, password);
      onLogin(data.user);
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
            <LogIn size={32} />
          </div>
          <h1>Réservation Véhicules</h1>
          <p>Connectez-vous pour continuer</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
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
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="login-footer">
          <p>Interface mobile simplifiée</p>
        </div>
      </div>
    </div>
  );
}

export default MobileLogin;
