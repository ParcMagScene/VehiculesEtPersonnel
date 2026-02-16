import React, { useState } from 'react';
import { LogIn, UserPlus, Mail, Key } from 'lucide-react';
import api, { getApiUrl } from '../../utils/api';
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

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
        try {
          const data = await api.login(email, password);
          onLogin(data.user);
        } catch (loginErr) {
          // Vérifier si c'est une réinitialisation de mot de passe requise
          if (loginErr.response?.data?.error === 'PASSWORD_RESET_REQUIRED') {
            setResetEmail(loginErr.response.data.email);
            setShowPasswordReset(true);
            return;
          }
          throw loginErr;
        }
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
          <h1>Connexion eM@g</h1>
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

          {mode === 'login' && (
            <button
              type="button"
              className="forgot-password-button"
              onClick={() => {
                setShowForgotPassword(true);
                setForgotEmail(email);
                setForgotSuccess(false);
                setError('');
              }}
            >
              <Key size={16} />
              Réinitialiser le mot de passe
            </button>
          )}
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

      {/* Modal Mot de passe oublié */}
      {showForgotPassword && (
        <div className="mobile-modal-overlay" onClick={() => setShowForgotPassword(false)}>
          <div className="mobile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-modal-header" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <h3>🔑 Mot de passe oublié</h3>
            </div>
            <div className="mobile-modal-body">
              {!forgotSuccess ? (
                <>
                  <p style={{ marginBottom: '16px', color: '#374151', fontSize: '14px' }}>
                    Entrez l'adresse email de votre compte pour réinitialiser votre mot de passe.
                  </p>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    setError('');
                    try {
                      const response = await fetch(`${getApiUrl()}/auth/forgot-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: forgotEmail })
                      });
                      if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || 'Erreur lors de la demande');
                      }
                      setForgotSuccess(true);
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label htmlFor="forgot-email">Adresse email</label>
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="email@exemple.com"
                        required
                        autoFocus
                      />
                    </div>

                    {error && <div className="login-error">{error}</div>}
                    
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="toggle-mode-button"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotEmail('');
                          setError('');
                        }}
                        disabled={isLoading}
                        style={{ flex: 0 }}
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="login-button"
                        disabled={isLoading || !forgotEmail}
                        style={{ flex: 0 }}
                      >
                        {isLoading ? 'Envoi...' : 'Réinitialiser'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                  <p style={{ color: '#374151', marginBottom: '8px', fontWeight: '500' }}>
                    Demande envoyée
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
                    Si cette adresse correspond à un compte, il a été préparé pour une réinitialisation.
                    <br /><strong>Reconnectez-vous</strong> pour définir un nouveau mot de passe.
                  </p>
                  <button
                    type="button"
                    className="login-button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotEmail('');
                      setForgotSuccess(false);
                    }}
                  >
                    Retour à la connexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Définir un nouveau mot de passe (après reset admin) */}
      {showPasswordReset && (
        <div className="mobile-modal-overlay">
          <div className="mobile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-modal-header" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <h3>🔒 Nouveau mot de passe</h3>
            </div>
            <div className="mobile-modal-body">
              <p style={{ marginBottom: '16px', color: '#374151', fontSize: '14px' }}>
                Votre compte a été réinitialisé. Veuillez définir un nouveau mot de passe.
              </p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (newPassword !== newPasswordConfirm) {
                  setError('Les mots de passe ne correspondent pas');
                  return;
                }
                setIsLoading(true);
                setError('');
                try {
                  const response = await fetch(`${getApiUrl()}/auth/set-new-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: resetEmail, newPassword })
                  });
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Erreur lors de la définition du mot de passe');
                  }
                  const data = await response.json();
                  localStorage.setItem('auth_token', data.token);
                  localStorage.setItem('auth_user', JSON.stringify(data.user));
                  setShowPasswordReset(false);
                  onLogin(data.user);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setIsLoading(false);
                }
              }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label htmlFor="new-password">Nouveau mot de passe</label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label htmlFor="confirm-password">Confirmer le mot de passe</label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                {error && <div className="login-error">{error}</div>}
                
                <button
                  type="submit"
                  className="login-button"
                  disabled={isLoading || !newPassword || !newPasswordConfirm}
                >
                  {isLoading ? 'Enregistrement...' : 'Définir le mot de passe'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileLogin;
