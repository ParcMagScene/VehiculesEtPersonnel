import React, { useState } from 'react';
import { LogIn, UserPlus, Mail, Key } from 'lucide-react';
import api, { getApiUrl } from '../../utils/api';
import AccessRequestModal from '../AccessRequestModal';
import './MobileLogin.css';
import { useToast } from '../../hooks/useToast';

function MobileLogin({ onLogin }) {
  const toast = useToast();
  const [mode, setMode] = useState('login'); // 'login', 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetFormEmail, setResetFormEmail] = useState('');
  const [resetFormName, setResetFormName] = useState('');
  const [resetFormPassword, setResetFormPassword] = useState('');
  const [resetFormConfirm, setResetFormConfirm] = useState('');
  const [resetError, setResetError] = useState('');

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
        toast.success('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
      } else {
        try {
          const data = await api.login(email, password);
          onLogin(data.user);
        } catch (loginErr) {
          // Vérifier si c'est une réinitialisation de mot de passe requise
          if (loginErr.response?.data?.error === 'PASSWORD_RESET_REQUIRED') {
            setResetFormEmail(loginErr.response.data.email || email);
            setShowResetPassword(true);
            setResetError('Votre compte nécessite une réinitialisation du mot de passe.');
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
            <small style={{ color: 'var(--theme-text-gray)', fontSize: '12px', display: 'block', marginTop: '8px' }}>
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
                setShowResetPassword(true);
                setResetFormEmail(email);
                setResetFormName('');
                setResetFormPassword('');
                setResetFormConfirm('');
                setResetError('');
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
            toast.success('Demande envoyée avec succès ! Vous recevrez un email dès qu\'un administrateur aura validé votre demande.');
          }}
        />
      )}

      {/* Modal Réinitialisation directe du mot de passe */}
      {showResetPassword && (
        <div className="mobile-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowResetPassword(false)}>
          <div className="mobile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-modal-header" style={{ background: 'var(--theme-gradient-alt, linear-gradient(135deg, var(--theme-accent), #d97706))' }}>
              <h3>🔑 Réinitialiser le mot de passe</h3>
            </div>
            <div className="mobile-modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--theme-text-body)', fontSize: '14px' }}>
                Entrez votre adresse email, votre nom complet et choisissez un nouveau mot de passe.
              </p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (resetFormPassword !== resetFormConfirm) {
                  setResetError('Les mots de passe ne correspondent pas');
                  return;
                }
                setIsLoading(true);
                setResetError('');
                try {
                  const response = await fetch(`${getApiUrl()}/auth/self-reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: resetFormEmail, name: resetFormName, newPassword: resetFormPassword })
                  });
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Erreur lors de la réinitialisation');
                  }
                  const data = await response.json();
                  localStorage.setItem('auth_token', data.token);
                  localStorage.setItem('auth_user', JSON.stringify(data.user));
                  setShowResetPassword(false);
                  onLogin(data.user);
                } catch (err) {
                  setResetError(err.message);
                } finally {
                  setIsLoading(false);
                }
              }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label htmlFor="reset-email">Adresse email</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetFormEmail}
                    onChange={(e) => setResetFormEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label htmlFor="reset-name">Nom complet</label>
                  <input
                    id="reset-name"
                    type="text"
                    value={resetFormName}
                    onChange={(e) => setResetFormName(e.target.value)}
                    placeholder="Prénom Nom"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label htmlFor="reset-password">Nouveau mot de passe</label>
                  <input
                    id="reset-password"
                    type="password"
                    value={resetFormPassword}
                    onChange={(e) => setResetFormPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label htmlFor="reset-confirm">Confirmer le mot de passe</label>
                  <input
                    id="reset-confirm"
                    type="password"
                    value={resetFormConfirm}
                    onChange={(e) => setResetFormConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                {resetError && <div className="login-error">{resetError}</div>}
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="toggle-mode-button"
                    onClick={() => {
                      setShowResetPassword(false);
                      setResetError('');
                    }}
                    disabled={isLoading}
                    style={{ flex: 0 }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="login-button"
                    disabled={isLoading || !resetFormEmail || !resetFormName || !resetFormPassword || !resetFormConfirm}
                    style={{ flex: 0 }}
                  >
                    {isLoading ? 'Réinitialisation...' : 'Réinitialiser'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileLogin;
