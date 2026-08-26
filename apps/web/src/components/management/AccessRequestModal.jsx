import './AccessRequestModal.css';

import { ArrowLeft, CheckCircle, Clock, KeyRound, Lock, Mail, Send, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, FormField, InlineAlert, Input, ModalLayout } from '@/design-system';

import { STATUS } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import api from '../../utils/api';

// Politique mot de passe (alignée avec le backend) :
// majuscules + minuscules + chiffres, pas de longueur minimale
function validatePasswordClient(pw) {
  if (!pw) return 'Mot de passe requis';
  if (!/[A-Z]/.test(pw)) return 'Le mot de passe doit contenir au moins une majuscule';
  if (!/[a-z]/.test(pw)) return 'Le mot de passe doit contenir au moins une minuscule';
  if (!/[0-9]/.test(pw)) return 'Le mot de passe doit contenir au moins un chiffre';
  return null;
}

function AccessRequestModal({ onClose, onSuccess, prefillEmail }) {
  const [step, setStep] = useState('request'); // 'request' | 'create-password' | 'define-pin' | 'pending'
  const [formData, setFormData] = useState({
    email: prefillEmail || '',
    name: '',
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const { resetDirty, guardClose } = useDirtyForm(
    { name: formData.name, email: formData.email, password, confirmPassword, pin, confirmPin },
    { confirmer: confirm },
  );
  const handleSafeClose = guardClose(onClose);

  // Si email pré-rempli (lien direct), vérifier s'il est autorisé
  useEffect(() => {
    if (prefillEmail) {
      checkEmailAuthorization(prefillEmail);
    }
  }, [prefillEmail]);

  const checkEmailAuthorization = async (email) => {
    try {
      const data = await api.checkEmailAccessRequest(email);
      if (data.authorized) {
        if (data.name) {
          setFormData((prev) => ({ ...prev, name: prev.name || data.name }));
        }
        setStep('create-password');
      }
    } catch (_err) {
      // Silencieux
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await api.createAccessRequest(formData);

      if (data.autoApproved) {
        setStep('create-password');
      } else {
        setStep('pending');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    const pwError = validatePasswordClient(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setLoading(true);
    try {
      await api.register(formData.email, formData.name, password);
      // Login direct pour ouvrir une session authentifiée → étape PIN
      await api.login(formData.email, password);
      setStep('define-pin');
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  const handleDefinePin = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(pin)) {
      setError('Le code PIN doit contenir exactement 4 chiffres');
      return;
    }
    if (pin !== confirmPin) {
      setError('Les codes PIN ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      // Premier setup : la session JWT suffit, pas besoin de currentPassword
      await api.setPin(pin);
      resetDirty();
      onSuccess?.();
      onClose();
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Erreur lors de la définition du code PIN');
    } finally {
      setLoading(false);
    }
  };

  // ===== ÉTAPE 1 : FORMULAIRE DE DEMANDE =====
  if (step === 'request') {
    return (
      <>
        <ModalLayout
          open
          onClose={handleSafeClose}
          title="Demande d'accès"
          icon={<Mail size={20} />}
          size="md"
          className="access-request-modal"
          footer={
            <>
              <Button variant="ghost" onClick={handleSafeClose}>
                Annuler
              </Button>
              <Button variant="primary" type="submit" form="ar-request-form" disabled={loading}>
                <Send size={18} />
                {loading ? 'Vérification...' : 'Continuer'}
              </Button>
            </>
          }
        >
          <div className="access-request-content">
            <p className="access-request-description">
              Renseignez votre nom et adresse email pour accéder à l'application. Si votre email a
              déjà été autorisé, vous pourrez créer votre mot de passe immédiatement.
            </p>

            {error && <InlineAlert>{error}</InlineAlert>}

            <form id="ar-request-form" onSubmit={handleSubmitRequest}>
              <FormField
                className="form-group"
                label={
                  <>
                    <User size={18} /> Nom complet
                  </>
                }
                htmlFor="ar-name"
                required
              >
                <Input
                  type="text"
                  id="ar-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Votre nom et prénom"
                  autoComplete="name"
                  maxLength={100}
                />
              </FormField>

              <FormField
                className="form-group"
                label={
                  <>
                    <Mail size={18} /> Adresse email
                  </>
                }
                htmlFor="ar-email"
                required
              >
                <Input
                  type="email"
                  id="ar-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="votre.email@example.com"
                  autoComplete="email"
                  maxLength={254}
                />
              </FormField>
            </form>
          </div>
        </ModalLayout>
        {ConfirmDialogRenderer}
      </>
    );
  }

  // ===== ÉTAPE 2A : CRÉATION DE MOT DE PASSE (email autorisé) =====
  if (step === 'create-password') {
    return (
      <>
        <ModalLayout
          open
          onClose={handleSafeClose}
          title="Créer votre compte"
          icon={<CheckCircle size={20} />}
          size="md"
          className="access-request-modal"
          footer={
            <>
              <Button variant="ghost" onClick={() => setStep('request')}>
                <ArrowLeft size={18} />
                Retour
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="ar-create-form"
                disabled={
                  loading || !!validatePasswordClient(password) || password !== confirmPassword
                }
              >
                <CheckCircle size={18} />
                {loading ? 'Création...' : 'Créer mon compte'}
              </Button>
            </>
          }
        >
          <div className="access-request-content">
            <div className="success-banner">
              <CheckCircle size={24} />
              <div>
                <strong>Email autorisé !</strong>
                <p>
                  Votre adresse <strong>{formData.email}</strong> est autorisée. Définissez votre
                  mot de passe pour finaliser votre inscription.
                </p>
              </div>
            </div>

            {error && <InlineAlert>{error}</InlineAlert>}

            <form id="ar-create-form" onSubmit={handleCreateAccount}>
              <FormField
                className="form-group"
                label={
                  <>
                    <User size={18} /> Nom complet
                  </>
                }
                htmlFor="ar-create-name"
                required
              >
                <Input
                  type="text"
                  id="ar-create-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Votre nom et prénom"
                  autoComplete="name"
                  maxLength={100}
                />
              </FormField>

              <FormField
                className="form-group"
                label={
                  <>
                    <Mail size={18} /> Email
                  </>
                }
              >
                <Input type="email" value={formData.email} disabled className="input-disabled" />
              </FormField>

              <FormField
                className="form-group"
                label={
                  <>
                    <Lock size={18} /> Mot de passe
                  </>
                }
                htmlFor="ar-password"
                required
              >
                <Input
                  type="password"
                  id="ar-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                  placeholder="Lettres maj. + min. + chiffres"
                  autoFocus
                  autoComplete="new-password"
                />
              </FormField>

              <FormField
                className="form-group"
                label={
                  <>
                    <Lock size={18} /> Confirmer le mot de passe
                  </>
                }
                htmlFor="ar-confirm-password"
                required
              >
                <Input
                  type="password"
                  id="ar-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  required
                  placeholder="Retapez votre mot de passe"
                  autoComplete="new-password"
                />
              </FormField>
            </form>
          </div>
        </ModalLayout>
        {ConfirmDialogRenderer}
      </>
    );
  }

  // ===== ÉTAPE 2B : DEMANDE EN ATTENTE DE VALIDATION =====
  if (step === STATUS.PENDING) {
    return (
      <ModalLayout
        open
        onClose={onClose}
        title="Demande envoyée"
        icon={<Clock size={20} />}
        size="md"
        className="access-request-modal"
        footer={
          <Button variant="primary" onClick={onClose}>
            Compris
          </Button>
        }
        footerAlign="center"
      >
        <div className="access-request-content">
          <div className="pending-banner">
            <Clock size={48} />
            <h3>Votre demande a été transmise</h3>
            <p>
              Votre demande sera examinée par un administrateur. Une fois validée, vous pourrez vous
              connecter avec votre adresse email pour définir votre mot de passe et votre code PIN.
            </p>
          </div>
        </div>
      </ModalLayout>
    );
  }

  // ===== ÉTAPE 3 : DÉFINITION DU CODE PIN =====
  if (step === 'define-pin') {
    return (
      <>
        <ModalLayout
          open
          onClose={handleSafeClose}
          title="Définir votre code PIN"
          icon={<KeyRound size={20} />}
          size="md"
          className="access-request-modal"
          footer={
            <Button
              variant="primary"
              type="submit"
              form="ar-pin-form"
              disabled={loading || !/^\d{4}$/.test(pin) || pin !== confirmPin}
            >
              <CheckCircle size={18} />
              {loading ? 'Enregistrement...' : 'Activer mon compte'}
            </Button>
          }
        >
          <div className="access-request-content">
            <div className="success-banner">
              <CheckCircle size={24} />
              <div>
                <strong>Compte créé !</strong>
                <p>
                  Définissez maintenant un code PIN à 4 chiffres pour la connexion rapide depuis les
                  bornes et l'application mobile.
                </p>
              </div>
            </div>

            {error && <InlineAlert>{error}</InlineAlert>}

            <form id="ar-pin-form" onSubmit={handleDefinePin}>
              <FormField
                className="form-group"
                label={
                  <>
                    <KeyRound size={18} /> Code PIN (4 chiffres)
                  </>
                }
                htmlFor="ar-pin"
                required
              >
                <Input
                  type="text"
                  inputMode="numeric"
                  id="ar-pin"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setError('');
                  }}
                  required
                  placeholder="0000"
                  maxLength={4}
                  autoFocus
                  autoComplete="off"
                />
              </FormField>

              <FormField
                className="form-group"
                label={
                  <>
                    <KeyRound size={18} /> Confirmer le code PIN
                  </>
                }
                htmlFor="ar-confirm-pin"
                required
              >
                <Input
                  type="text"
                  inputMode="numeric"
                  id="ar-confirm-pin"
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setError('');
                  }}
                  required
                  placeholder="0000"
                  maxLength={4}
                  autoComplete="off"
                />
              </FormField>
            </form>
          </div>
        </ModalLayout>
        {ConfirmDialogRenderer}
      </>
    );
  }

  return null;
}

export default AccessRequestModal;
