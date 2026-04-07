import React, { useState, useRef } from 'react';
import { X, Camera, User, Save, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { Button, Input, Avatar, InlineAlert } from '@/design-system';
import './ProfileEditModal.css';

// targetUser: si fourni (mode admin), on édite cet utilisateur via les endpoints admin
// sinon on édite currentUser via /users/me
const ProfileEditModal = ({ currentUser, targetUser, onClose, onUserUpdate }) => {
  const editedUser = targetUser || currentUser;
  const isAdminMode = !!targetUser;

  const [name, setName] = useState(editedUser?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

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
        body: JSON.stringify({ name: name.trim() })
      });
      onUserUpdate(result.user);
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
      setError('L\'image ne doit pas dépasser 5 Mo');
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
      setError(err.message || 'Erreur lors de l\'upload');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
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
  };

  return (
    <div className="profile-edit-overlay">
      <div className="profile-edit-modal">
        {/* Header */}
        <div className="theme-modal-header">
          <h3 className="profile-edit-header-title">
            <User size={20} /> {isAdminMode ? `Modifier ${editedUser.name}` : 'Mon profil'}
          </h3>
          <Button variant="ghost" onClick={onClose} className="theme-close-btn">
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="profile-edit-content">
          {/* Avatar section */}
          <div className="profile-edit-avatar-section">
            <div className="profile-edit-avatar-wrapper">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="profile-edit-avatar-preview" />
              ) : (
                <Avatar name={editedUser.name} avatar={editedUser.avatar} size={100} />
              )}
              
              <Button variant="ghost"                 onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="profile-edit-avatar-btn"
              >
                <Camera size={14} />
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              style={{ display: 'none' }}
            />

            {uploading && (
              <div className="profile-edit-upload-status">Upload en cours...</div>
            )}

            {editedUser.avatar && !uploading && (
              <Button variant="ghost" onClick={handleDeleteAvatar} className="profile-edit-delete-avatar">
                <Trash2 size={14} /> Supprimer la photo
              </Button>
            )}
          </div>

          {/* Name field */}
          <div className="profile-edit-field">
            <label className="profile-edit-label">
              Nom
            </label>
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
            <label className="profile-edit-label">
              Email
            </label>
            <div className="profile-edit-readonly">
              {editedUser.email}
            </div>
          </div>

          {error && (
            <InlineAlert style={{ marginBottom: '16px' }}>{error}</InlineAlert>
          )}
        </div>

        {/* Footer */}
        <div className="profile-edit-footer">
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Fermer
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveName}
            disabled={saving || name.trim() === editedUser.name || !name.trim()}
          >
            <Save size={16} />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;
