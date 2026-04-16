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
  const [resetStep, setResetStep] = useState(1);
  const [resetOtp, setResetOtp] = useState('');

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
                setResetStep(1);
                setResetOtp('');
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

      {/* Modal Réinitialisation du mot de passe (2 étapes avec OTP) */}
      <BottomSheet
        open={showResetPassword}
        onClose={() => {
          setShowResetPassword(false);
          setResetError('');
          setResetStep(1);
          setResetOtp('');
        }}
        title="🔑 Réinitialiser le mot de passe"
      >
        <div className="mobile-sheet-form">
          <p className="mobile-sheet-desc">
            {resetStep === 1
              ? 'Entrez votre adresse email et votre nom complet. Un code de vérification vous sera envoyé par email.'
              : 'Un code de vérification a été envoyé à votre adresse email. Saisissez-le ci-dessous avec votre nouveau mot de passe.'}
          </p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              setResetError('');
              try {
                if (resetStep === 1) {
                  await api.selfResetPassword(resetFormEmail, resetFormName);
                  setResetStep(2);
                } else {
                  if (resetFormPassword !== resetFormConfirm) {
                    setResetError('Les mots de passe ne correspondent pas');
                    return;
                  }
                  if (resetFormPassword.length < 10) {
                    setResetError('Le mot de passe doit contenir au moins 10 caractères');
                    return;
                  }
                  await api.setNewPassword(resetFormEmail, resetOtp, resetFormPassword);
                  setShowResetPassword(false);
                  setResetStep(1);
                  setResetOtp('');
                  setError(
                    'Mot de passe réinitialisé — connectez-vous avec votre nouveau mot de passe.',
                  );
                }
              } catch (err) {
                setResetError(err.message);
              } finally {
                setIsLoading(false);
              }
            }}
          >
            {resetStep === 1 ? (
              <>
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
              </>
            ) : (
              <>
                <FormField
                  className="form-group"
                  label="Code de vérification (6 chiffres)"
                  htmlFor="reset-otp"
                >
                  <Input
                    id="reset-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </FormField>

                <FormField
                  className="form-group"
                  label="Nouveau mot de passe"
                  htmlFor="reset-password"
                >
                  <Input
                    id="reset-password"
                    type="password"
                    value={resetFormPassword}
                    onChange={(e) => setResetFormPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={10}
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
                    minLength={10}
                    autoComplete="new-password"
                  />
                </FormField>
              </>
            )}

            {resetError && <InlineAlert>{resetError}</InlineAlert>}

            <div className="mobile-sheet-form-actions">
              <Button
                variant="ghost"
                type="button"
                className="toggle-mode-button"
                onClick={() => {
                  setShowResetPassword(false);
                  setResetError('');
                  setResetStep(1);
                  setResetOtp('');
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
                  (resetStep === 1 && (!resetFormEmail || !resetFormName)) ||
                  (resetStep === 2 &&
                    (resetOtp.length !== 6 || !resetFormPassword || !resetFormConfirm))
                }
              >
                {isLoading
                  ? resetStep === 1
                    ? 'Envoi...'
                    : 'Réinitialisation...'
                  : resetStep === 1
                    ? 'Envoyer le code'
                    : 'Réinitialiser'}
              </Button>
            </div>
          </form>
        </div>
      </BottomSheet>
    </div>
  );
}

export default MobileLogin;
