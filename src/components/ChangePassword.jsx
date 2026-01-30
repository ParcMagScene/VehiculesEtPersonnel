import React, { useState } from 'react';
import { Lock, Save } from 'lucide-react';
import api from '../utils/api';
import './ChangePassword.css';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword.length < 4) {
      alert('Le nouveau mot de passe doit contenir au moins 4 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setIsSaving(true);
      await api.changePassword(currentPassword, newPassword);
      alert('Mot de passe modifié avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="change-password">
      <div className="change-password-header">
        <h3><Lock size={20} /> Changer mon mot de passe</h3>
      </div>

      <form onSubmit={handleSubmit} className="change-password-form">
        <div className="form-group">
          <label htmlFor="currentPassword">
            Mot de passe actuel
            <span className="required">*</span>
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="newPassword">
            Nouveau mot de passe
            <span className="required">*</span>
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={4}
            autoComplete="new-password"
          />
          <p className="field-hint">Minimum 4 caractères</p>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">
            Confirmer le nouveau mot de passe
            <span className="required">*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={4}
            autoComplete="new-password"
          />
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn-save"
            disabled={isSaving}
          >
            <Save size={18} />
            {isSaving ? 'Enregistrement...' : 'Modifier le mot de passe'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePassword;
