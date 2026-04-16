import { useState } from 'react';
import { LogIn, UserPlus, Mail, Key } from 'lucide-react';
import api from '../../utils/api';
import AccessRequestModal from '../management/AccessRequestModal';
import './MobileLogin.css';
import './MobileSheet.css';
import { useToast } from '../../hooks/useToast';
import { Button, Card, FormField, InlineAlert, Input, BottomSheet } from '@/design-system';

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
      <Card className="login-card">
        <div className="login-header">
          <div className="login-icon">
            {mode === 'register' ? <UserPlus size={32} /> : <LogIn size={32} />}
          </div>
          <h1>Connexion eM@g</h1>
          <p>{mode === 'register' ? 'Créer un compte' : 'Connectez-vous pour continuer'}</p>
          {mode === 'register' && (
            <small className="login-register-warning">⚠️ Email autorisé requis</small>
          )}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'register' && (
            <FormField className="form-group" label="Nom complet" htmlFor="name">
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                required
              />
            </FormField>
          )}

          <FormField className="form-group" label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              autoComplete="email"
            />
          </FormField>

          <FormField className="form-group" label="Mot de passe" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </FormField>

          {error && <InlineAlert>{error}</InlineAlert>}

          <Button variant="ghost" type="submit" className="login-button" disabled={isLoading}>
            {isLoading
              ? mode === 'register'
                ? 'Création...'
                : 'Connexion...'
              : mode === 'register'
                ? 'Créer le compte'
                : 'Se connecter'}
          </Button>

          <Button
            variant="ghost"
            type="button"
            className="toggle-mode-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setPassword('');
            }}
          >
            {mode === 'login' ? 'Créer un compte' : 'Déjà un compte ? Se connecter'}
          </Button>

          <Button
            variant="ghost"
            type="button"
            className="access-request-button"
            onClick={() => setShowAccessRequest(true)}
          >
            <Mail size={16} />
            Pas d'accès ? Faire une demande
          </Button>

          {mode === 'login' && (
            <Button
              variant="ghost"
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
            </Button>
          )}
        </form>

        <div className="login-footer">
          <p>Interface mobile simplifiée</p>
        </div>
      </Card>

      {showAccessRequest && (
        <AccessRequestModal
          onClose={() => setShowAccessRequest(false)}
          onSuccess={() => {
            toast.success(
              "Demande envoyée avec succès ! Vous recevrez un email dès qu'un administrateur aura validé votre demande.",
            );
          }}
        />
      )}

      {/* Modal Réinitialisation directe du mot de passe */}
      <BottomSheet
        open={showResetPassword}
        onClose={() => {
          setShowResetPassword(false);
          setResetError('');
        }}
        title="🔑 Réinitialiser le mot de passe"
      >
        <div className="mobile-sheet-form">
          <p className="mobile-sheet-desc">
            Entrez votre adresse email, votre nom complet et choisissez un nouveau mot de passe.
          </p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (resetFormPassword !== resetFormConfirm) {
                setResetError('Les mots de passe ne correspondent pas');
                return;
              }
              setIsLoading(true);
              setResetError('');
              try {
                const data = await api.selfResetPasswordWithNewPassword(
                  resetFormEmail,
                  resetFormName,
                  resetFormPassword,
                );
                onLogin(data.user);
                setShowResetPassword(false);
              } catch (err) {
                setResetError(err.message);
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <FormField className="form-group" label="Adresse email" htmlFor="reset-email">
              <Input
                id="reset-email"
                type="email"
                value={resetFormEmail}
                onChange={(e) => setResetFormEmail(e.target.value)}
                placeholder="email@exemple.com"
                required
                autoFocus
              />
            </FormField>

            <FormField className="form-group" label="Nom complet" htmlFor="reset-name">
              <Input
                id="reset-name"
                type="text"
                value={resetFormName}
                onChange={(e) => setResetFormName(e.target.value)}
                placeholder="Prénom Nom"
                required
              />
            </FormField>

            <FormField className="form-group" label="Nouveau mot de passe" htmlFor="reset-password">
              <Input
                id="reset-password"
                type="password"
                value={resetFormPassword}
                onChange={(e) => setResetFormPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </FormField>

            <FormField
              className="form-group"
              label="Confirmer le mot de passe"
              htmlFor="reset-confirm"
            >
              <Input
                id="reset-confirm"
                type="password"
                value={resetFormConfirm}
                onChange={(e) => setResetFormConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </FormField>

            {resetError && <InlineAlert>{resetError}</InlineAlert>}

            <div className="mobile-sheet-form-actions">
              <Button
                variant="ghost"
                type="button"
                className="toggle-mode-button"
                onClick={() => {
                  setShowResetPassword(false);
                  setResetError('');
                }}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                variant="ghost"
                type="submit"
                className="login-button"
                disabled={
                  isLoading ||
                  !resetFormEmail ||
                  !resetFormName ||
                  !resetFormPassword ||
                  !resetFormConfirm
                }
              >
                {isLoading ? 'Réinitialisation...' : 'Réinitialiser'}
              </Button>
            </div>
          </form>
        </div>
      </BottomSheet>
    </div>
  );
}

export default MobileLogin;
