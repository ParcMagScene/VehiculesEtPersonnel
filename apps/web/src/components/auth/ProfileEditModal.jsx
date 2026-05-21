import './ProfileEditModal.css';

import { Camera, Hash, RefreshCw, Save, Shield, Trash2, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Avatar, Button, InlineAlert, Input, ModalLayout } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import api from '../../utils/api';

// targetUser: si fourni (mode admin), on édite cet utilisateur via les endpoints admin
// sinon on édite currentUser via /users/me
const ProfileEditModal = ({ currentUser, targetUser, onClose, onUserUpdate }) => {
  const editedUser = targetUser || currentUser;
  const isAdminMode = !!targetUser;
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'pin'
  const [name, setName] = useState(editedUser?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const { resetDirty, guardClose } = useDirtyForm({ name }, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

  // ─── PIN state (uniquement en mode propre, pas admin)
  const [hasPin, setHasPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinCurrentPassword, setPinCurrentPassword] = useState('');
  const [pinCurrentPin, setPinCurrentPin] = useState('');

  useEffect(() => {
    if (!isAdminMode) {
      api
        .getPinStatus()
        .then((d) => setHasPin(!!d.hasPin))
        .catch(() => {});
    }
  }, [isAdminMode]);

  const handleSaveName = async () => {
    if (!name.trim()) {
      setError('Le nom ne peut pas être vide');
      return;
    }
    if (name.trim() === editedUser.name) return;

    setSaving(true);
    setError('');
    try {
      const endpoint = isAdminMode ? `/users/${editedUser.id}/profile` : '/users/me';
      const result = await api.request(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });
      onUserUpdate(result.user);
      resetDirty();
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    // Prévisualisation
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    setError('');
    try {
      const data = await api.uploadAvatar(file, isAdminMode ? editedUser.id : null);
      onUserUpdate(data.user);
      setPreviewUrl(null);
    } catch (err) {
      setError(err.message || "Erreur lors de l'upload");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = () => {
    confirm({
      title: 'Supprimer la photo',
      message: 'Supprimer la photo de profil ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setUploading(true);
        setError('');
        try {
          await api.deleteAvatar(isAdminMode ? editedUser.id : null);
          onUserUpdate({ ...editedUser, avatar: null });
          setPreviewUrl(null);
        } catch (err) {
          setError(err.message);
        } finally {
          setUploading(false);
        }
      },
    });
  };

  const handleSetPin = async (e) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinError('Le PIN doit contenir exactement 4 chiffres');
      return;
    }
    if (newPin !== newPinConfirm) {
      setPinError('Les codes PIN ne correspondent pas');
      return;
    }
    setPinLoading(true);
    try {
      await api.setPin(
        newPin,
        hasPin ? undefined : pinCurrentPassword,
        hasPin ? pinCurrentPin : undefined,
      );
      setHasPin(true);
      setPinSuccess('Code PIN enregistré avec succès');
      setNewPin('');
      setNewPinConfirm('');
      setPinCurrentPassword('');
      setPinCurrentPin('');
    } catch (err) {
      setPinError(err.message || 'Erreur lors de la mise à jour du PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const handleDeletePin = async () => {
    confirm({
      title: 'Supprimer le PIN',
      message: 'Supprimer votre code PIN de connexion rapide ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setPinLoading(true);
        setPinError('');
        try {
          await api.deletePin();
          setHasPin(false);
          setPinSuccess('Code PIN supprimé');
        } catch (err) {
          setPinError(err.message || 'Erreur lors de la suppression');
        } finally {
          setPinLoading(false);
        }
      },
    });
  };

  return (
    <ModalLayout
      open
      onClose={handleSafeClose}
      size="sm"
      title={isAdminMode ? `Modifier ${editedUser.name}` : 'Mon profil'}
      icon={<User size={20} />}
      className="profile-edit-modal"
      footer={
        <>
          <Button variant="ghost" onClick={handleSafeClose}>
            Fermer
          </Button>
          {activeTab === 'profile' && (
            <Button
              variant="primary"
              onClick={handleSaveName}
              disabled={saving || name.trim() === editedUser.name || !name.trim()}
            >
              <Save size={16} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          )}
        </>
      }
    >
      {ConfirmDialogRenderer}

      {/* Onglets (uniquement hors mode admin) */}
      {!isAdminMode && (
        <div className="profile-edit-tabs">
          <button
            className={`profile-edit-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={14} />
            Profil
          </button>
          <button
            className={`profile-edit-tab ${activeTab === 'pin' ? 'active' : ''}`}
            onClick={() => setActiveTab('pin')}
          >
            <Hash size={14} />
            Code PIN
          </button>
        </div>
      )}

      {/* ─── Onglet Profil ─── */}
      {activeTab === 'profile' && (
        <div className="profile-edit-content">
          {/* Avatar section */}
          <div className="profile-edit-avatar-section">
            <div className="profile-edit-avatar-wrapper">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  loading="lazy"
                  className="profile-edit-avatar-preview"
                />
              ) : (
                <Avatar name={editedUser.name} avatar={editedUser.avatar} size={100} />
              )}

              <Button
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="profile-edit-avatar-btn"
              >
                <Camera size={14} />
              </Button>
            </div>

            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              style={{ display: 'none' }}
            />

            {uploading && <div className="profile-edit-upload-status">Upload en cours...</div>}

            {editedUser.avatar && !uploading && (
              <Button
                variant="ghost"
                onClick={handleDeleteAvatar}
                className="profile-edit-delete-avatar"
              >
                <Trash2 size={14} /> Supprimer la photo
              </Button>
            )}
          </div>

          {/* Name field */}
          <div className="profile-edit-field">
            <label className="profile-edit-label">Nom</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
              className="profile-edit-input"
            />
          </div>

          {/* Email (read-only) */}
          <div className="profile-edit-field">
            <label className="profile-edit-label">Email</label>
            <div className="profile-edit-readonly">{editedUser.email}</div>
          </div>

          {error && <InlineAlert style={{ marginBottom: '16px' }}>{error}</InlineAlert>}
        </div>
      )}

      {/* ─── Onglet PIN ─── */}
      {activeTab === 'pin' && (
        <div className="profile-edit-content">
          <div className="profile-edit-pin-header">
            <Shield size={18} />
            <div>
              <strong>Code PIN de connexion rapide</strong>
              <p className="profile-edit-pin-desc">
                Un code à 4 chiffres pour vous connecter sans saisir votre mot de passe.
              </p>
            </div>
          </div>

          {pinError && (
            <InlineAlert dismissible onDismiss={() => setPinError('')} style={{ marginBottom: 12 }}>
              {pinError}
            </InlineAlert>
          )}
          {pinSuccess && (
            <InlineAlert
              variant="success"
              dismissible
              onDismiss={() => setPinSuccess('')}
              style={{ marginBottom: 12 }}
            >
              {pinSuccess}
            </InlineAlert>
          )}

          <form onSubmit={handleSetPin} className="profile-edit-pin-form">
            {!hasPin && (
              <div className="profile-edit-field">
                <label className="profile-edit-label">Mot de passe actuel</label>
                <Input
                  type="password"
                  value={pinCurrentPassword}
                  onChange={(e) => setPinCurrentPassword(e.target.value)}
                  placeholder="Pour confirmer votre identité"
                  required
                  autoComplete="current-password"
                />
              </div>
            )}
            {hasPin && (
              <div className="profile-edit-field">
                <label className="profile-edit-label">PIN actuel</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinCurrentPin}
                  onChange={(e) => setPinCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  required
                  autoComplete="off"
                  className="profile-edit-pin-input"
                />
              </div>
            )}
            <div className="profile-edit-field">
              <label className="profile-edit-label">
                {hasPin ? 'Nouveau PIN' : 'Code PIN (4 chiffres)'}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                required
                autoComplete="off"
                className="profile-edit-pin-input"
              />
            </div>
            <div className="profile-edit-field">
              <label className="profile-edit-label">Confirmer le PIN</label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={newPinConfirm}
                onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                required
                autoComplete="off"
                className="profile-edit-pin-input"
              />
            </div>
            <div className="profile-edit-pin-actions">
              <Button type="submit" variant="primary" disabled={pinLoading}>
                {pinLoading ? (
                  <RefreshCw size={14} className="profile-edit-spin" />
                ) : (
                  <Hash size={14} />
                )}
                {hasPin ? 'Modifier le PIN' : 'Définir le PIN'}
              </Button>
              {hasPin && (
                <Button
                  type="button"
                  variant="ghost"
                  className="profile-edit-pin-delete"
                  onClick={handleDeletePin}
                  disabled={pinLoading}
                >
                  Supprimer le PIN
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </ModalLayout>
  );
};

export default ProfileEditModal;
