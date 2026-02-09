import React, { useState, useEffect } from 'react';
import { X, Mail, User, Send, Lock, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { getApiUrl } from '../utils/api';
import api from '../utils/api';
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
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/access-requests/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.authorized) {
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
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la demande');
      }

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

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
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
      <div className="modal-overlay" onClick={onClose}>
        <div className="access-request-modal" onClick={(e) => e.stopPropagation()}>
          <div className="access-request-header">
            <h2>Demande d'accès</h2>
            <button className="close-button" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          <div className="access-request-content">
            <p className="access-request-description">
              Renseignez votre nom et adresse email pour accéder à l'application.
              Si votre email a déjà été autorisé, vous pourrez créer votre mot de passe immédiatement.
            </p>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmitRequest}>
              <div className="form-group">
                <label htmlFor="ar-name">
                  <User size={18} />
                  Nom complet *
                </label>
                <input
                  type="text"
                  id="ar-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Votre nom et prénom"
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="ar-email">
                  <Mail size={18} />
                  Adresse email *
                </label>
                <input
                  type="email"
                  id="ar-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="votre.email@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <Send size={18} />
                  {loading ? 'Vérification...' : 'Continuer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ===== ÉTAPE 2A : CRÉATION DE MOT DE PASSE (email autorisé) =====
  if (step === 'create-password') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="access-request-modal" onClick={(e) => e.stopPropagation()}>
          <div className="access-request-header access-request-header-success">
            <h2>Créer votre compte</h2>
            <button className="close-button" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          <div className="access-request-content">
            <div className="success-banner">
              <CheckCircle size={24} />
              <div>
                <strong>Email autorisé !</strong>
                <p>Votre adresse <strong>{formData.email}</strong> est autorisée. Définissez votre mot de passe pour finaliser votre inscription.</p>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleCreateAccount}>
              <div className="form-group">
                <label>
                  <User size={18} />
                  Nom
                </label>
                <input
                  type="text"
                  value={formData.name}
                  disabled
                  className="input-disabled"
                />
              </div>

              <div className="form-group">
                <label>
                  <Mail size={18} />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="input-disabled"
                />
              </div>

              <div className="form-group">
                <label htmlFor="ar-password">
                  <Lock size={18} />
                  Mot de passe *
                </label>
                <input
                  type="password"
                  id="ar-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  required
                  placeholder="Minimum 6 caractères"
                  minLength={6}
                  autoFocus
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="ar-confirm-password">
                  <Lock size={18} />
                  Confirmer le mot de passe *
                </label>
                <input
                  type="password"
                  id="ar-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  required
                  placeholder="Retapez votre mot de passe"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setStep('request')}>
                  <ArrowLeft size={18} />
                  Retour
                </button>
                <button type="submit" className="btn-primary" disabled={loading || password.length < 6}>
                  <CheckCircle size={18} />
                  {loading ? 'Création...' : 'Créer mon compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ===== ÉTAPE 2B : DEMANDE EN ATTENTE DE VALIDATION =====
  if (step === 'pending') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="access-request-modal" onClick={(e) => e.stopPropagation()}>
          <div className="access-request-header access-request-header-pending">
            <h2>Demande envoyée</h2>
            <button className="close-button" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

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

            <div className="form-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn-primary" onClick={onClose}>
                Compris
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default AccessRequestModal;
