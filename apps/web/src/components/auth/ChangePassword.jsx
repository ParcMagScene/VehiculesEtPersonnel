import React, { useState } from 'react';
import { Lock, Save, Eye, EyeOff, Shield, KeyRound } from 'lucide-react';
import api from '../../utils/api';
import { Button, FormField, Input } from '@/design-system';
import './ChangePassword.css';
import { useToast } from '../../hooks/useToast';

const ChangePassword = ({ currentUser }) => {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Section admin : définir un nouveau mot de passe sans l'ancien
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);

  const isAdmin = currentUser?.isAdmin;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword.length < 10) {
      toast.info('Le nouveau mot de passe doit contenir au moins 10 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.info('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setIsSaving(true);
      await api.changePassword(currentPassword, newPassword);
      toast.success('Mot de passe modifié avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminSetPassword = async () => {
    if (adminNewPassword.length < 10) {
      toast.info('Le mot de passe doit contenir au moins 10 caractères');
      return;
    }
    try {
      setIsSavingAdmin(true);
      await api.request('/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id, newPassword: adminNewPassword }),
      });
      toast.success('Mot de passe défini avec succès');
      setAdminNewPassword('');
      setShowAdminPassword(false);
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsSavingAdmin(false);
    }
  };

  return (
    <div className="change-password">
      {/* Section Admin : Définir rapidement un mot de passe */}
      {isAdmin && (
        <div className="admin-password-section">
          <div className="admin-password-header">
            <h3><Shield size={20} /> Mon mot de passe administrateur</h3>
            <p className="admin-password-hint">Définissez directement un nouveau mot de passe sans saisir l’ancien</p>
          </div>
          <div className="admin-password-form">
            <FormField className="form-group" label="Nouveau mot de passe" htmlFor="adminNewPassword">
              <div className="password-input-wrapper">
                <input
                  id="adminNewPassword"
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Saisir le nouveau mot de passe"
                  autoComplete="new-password"
                />
                <Button variant="ghost"                   type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  title={showAdminPassword ? 'Masquer' : 'Afficher'}
                >
                  {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
              <p className="field-hint">Min. 10 caractères, 1 majuscule, 1 chiffre, 1 spécial</p>
            </FormField>
            <div className="form-actions">
              <Button
                variant="primary"
                onClick={handleAdminSetPassword}
                disabled={isSavingAdmin || adminNewPassword.length < 10}
              >
                <KeyRound size={16} />
                {isSavingAdmin ? 'Application...' : 'Appliquer le mot de passe'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="change-password-header">
        <h3><Lock size={20} /> Changer mon mot de passe</h3>
      </div>

      <form onSubmit={handleSubmit} className="change-password-form">
        <FormField className="form-group" label="Mot de passe actuel" htmlFor="currentPassword" required>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </FormField>

        <FormField className="form-group" label="Nouveau mot de passe" htmlFor="newPassword" required>
          <div className="password-input-wrapper">
          <input
            id="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
          <Button variant="ghost"             type="button"
            className="password-toggle-btn"
            onClick={() => setShowNewPassword(!showNewPassword)}
            title={showNewPassword ? 'Masquer' : 'Afficher'}
          >
            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </Button>
          </div>
          <p className="field-hint">Min. 10 caractères, 1 majuscule, 1 chiffre, 1 spécial</p>
        </FormField>

        <FormField className="form-group" label="Confirmer le nouveau mot de passe" htmlFor="confirmPassword" required>
          <div className="password-input-wrapper">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
          <Button variant="ghost"             type="button"
            className="password-toggle-btn"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            title={showConfirmPassword ? 'Masquer' : 'Afficher'}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </Button>
          </div>
        </FormField>

        <div className="form-actions">
          <Button 
            variant="primary"
            type="submit"
            disabled={isSaving}
          >
            <Save size={18} />
            {isSaving ? 'Enregistrement...' : 'Modifier le mot de passe'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChangePassword;
