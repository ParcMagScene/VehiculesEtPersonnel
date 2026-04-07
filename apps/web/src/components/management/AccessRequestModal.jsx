import React, { useState, useEffect } from 'react';
import { Mail, User, Send, Lock, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { Button, ModalLayout, Input, InlineAlert, FormField } from '@/design-system';
import api from '../../utils/api';
import './AccessRequestModal.css';

function AccessRequestModal({ onClose, onSuccess, prefillEmail }) {
  const [step, setStep] = useState('request'); // 'request' | 'create-password' | 'pending'
  const [formData, setFormData] = useState({
    email: prefillEmail || '',
    name: ''
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          setFormData(prev => ({ ...prev, name: prev.name || data.name }));
        }
        setStep('create-password');
      }
    } catch (_err) {
      // Silencieux
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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

    if (password.length < 10) {
      setError('Le mot de passe doit contenir au moins 10 caractères (1 majuscule, 1 chiffre, 1 spécial)');
      return;
    }

    setLoading(true);
    try {
      await api.register(formData.email, formData.name, password);
      await api.login(formData.email, password);
      onSuccess?.();
      onClose();
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  // ===== ÉTAPE 1 : FORMULAIRE DE DEMANDE =====
  if (step === 'request') {
    return (
      <ModalLayout
        open
        onClose={onClose}
        title="Demande d'accès"
        icon={<Mail size={20} />}
        size="md"
        className="access-request-modal"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
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
              Renseignez votre nom et adresse email pour accéder à l'application.
              Si votre email a déjà été autorisé, vous pourrez créer votre mot de passe immédiatement.
            </p>

            {error && <InlineAlert>{error}</InlineAlert>}

            <form id="ar-request-form" onSubmit={handleSubmitRequest}>
              <FormField className="form-group" label={<><User size={18} /> Nom complet</>} htmlFor="ar-name" required>
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

              <FormField className="form-group" label={<><Mail size={18} /> Adresse email</>} htmlFor="ar-email" required>
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
    );
  }

  // ===== ÉTAPE 2A : CRÉATION DE MOT DE PASSE (email autorisé) =====
  if (step === 'create-password') {
    return (
      <ModalLayout
        open
        onClose={onClose}
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
            <Button variant="primary" type="submit" form="ar-create-form" disabled={loading || password.length < 10}>
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
                <p>Votre adresse <strong>{formData.email}</strong> est autorisée. Définissez votre mot de passe pour finaliser votre inscription.</p>
              </div>
            </div>

            {error && <InlineAlert>{error}</InlineAlert>}

            <form id="ar-create-form" onSubmit={handleCreateAccount}>
              <FormField className="form-group" label={<><User size={18} /> Nom complet</>} htmlFor="ar-create-name" required>
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

              <FormField className="form-group" label={<><Mail size={18} /> Email</>}>
                <Input
                  type="email"
                  value={formData.email}
                  disabled
                  className="input-disabled"
                />
              </FormField>

              <FormField className="form-group" label={<><Lock size={18} /> Mot de passe</>} htmlFor="ar-password" required>
                <Input
                  type="password"
                  id="ar-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  required
                  placeholder="Min. 10 caractères, 1 majuscule, 1 chiffre, 1 spécial"
                  minLength={10}
                  autoFocus
                  autoComplete="new-password"
                />
              </FormField>

              <FormField className="form-group" label={<><Lock size={18} /> Confirmer le mot de passe</>} htmlFor="ar-confirm-password" required>
                <Input
                  type="password"
                  id="ar-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  required
                  placeholder="Retapez votre mot de passe"
                  minLength={10}
                  autoComplete="new-password"
                />
              </FormField>

              </form>
          </div>
      </ModalLayout>
    );
  }

  // ===== ÉTAPE 2B : DEMANDE EN ATTENTE DE VALIDATION =====
  if (step === 'pending') {
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
                Un email d'activation vous sera envoyé après validation par un administrateur.
                Vous recevrez un lien pour créer votre mot de passe.
              </p>
              <div className="pending-email-info">
                <Mail size={16} />
                <span>{formData.email}</span>
              </div>
            </div>
          </div>
      </ModalLayout>
    );
  }

  return null;
}

export default AccessRequestModal;
