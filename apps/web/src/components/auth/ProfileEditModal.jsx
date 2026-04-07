import React, { useState, useRef } from 'react';
import { X, Camera, User, Save, Trash2 } from 'lucide-react';
import api, { getApiUrl } from '../../utils/api';
import { Button, Input, Avatar, InlineAlert } from '@/design-system';

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
      const baseUrl = getApiUrl();
      const formData = new FormData();
      formData.append('avatar', file);

      const avatarUrl = isAdminMode
        ? `${baseUrl}/users/${editedUser.id}/avatar`
        : `${baseUrl}/users/me/avatar`;

      const response = await fetch(avatarUrl, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur upload');
      }

      const data = await response.json();
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
      const baseUrl = getApiUrl();
      const avatarUrl = isAdminMode
        ? `${baseUrl}/users/${editedUser.id}/avatar`
        : `${baseUrl}/users/me/avatar`;

      const response = await fetch(avatarUrl, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Erreur suppression');

      onUserUpdate({ ...editedUser, avatar: null });
      setPreviewUrl(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--theme-overlay)', backdropFilter: 'blur(4px)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 10000
    }}>
      <div style={{
        background: 'var(--theme-bg-card)', borderRadius: '16px', width: '400px', maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div className="theme-modal-header" style={{ borderRadius: '16px 16px 0 0' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--theme-text-inverse)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={20} /> {isAdminMode ? `Modifier ${editedUser.name}` : 'Mon profil'}
          </h3>
          <button onClick={onClose} className="theme-close-btn">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Avatar section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" style={{
                  width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover',
                  border: '3px solid var(--theme-primary)'
                }} />
              ) : (
                <Avatar name={editedUser.name} avatar={editedUser.avatar} size={100} />
              )}
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  position: 'absolute', bottom: '0', right: '0',
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: 'var(--theme-primary)', color: 'var(--theme-text-inverse)', border: '3px solid var(--theme-bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: uploading ? 'wait' : 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                }}
              >
                <Camera size={14} />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              style={{ display: 'none' }}
            />

            {uploading && (
              <div style={{ fontSize: '13px', color: 'var(--theme-primary)' }}>Upload en cours...</div>
            )}

            {editedUser.avatar && !uploading && (
              <button
                onClick={handleDeleteAvatar}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#ef4444', fontSize: '13px', display: 'flex',
                  alignItems: 'center', gap: '4px', marginTop: '4px'
                }}
              >
                <Trash2 size={14} /> Supprimer la photo
              </button>
            )}
          </div>

          {/* Name field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block', fontSize: '14px', fontWeight: 600,
              color: 'var(--theme-text-body)', marginBottom: '6px'
            }}>
              Nom
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid var(--theme-border)',
                borderRadius: '8px', fontSize: '15px', outline: 'none',
                transition: 'border-color 0.2s', boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--theme-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--theme-border-medium)'}
            />
          </div>

          {/* Email (read-only) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block', fontSize: '14px', fontWeight: 600,
              color: 'var(--theme-text-body)', marginBottom: '6px'
            }}>
              Email
            </label>
            <div style={{
              padding: '10px 14px', background: 'var(--theme-bg-tertiary)', borderRadius: '8px',
              fontSize: '15px', color: 'var(--theme-text-gray)'
            }}>
              {editedUser.email}
            </div>
          </div>

          {error && (
            <InlineAlert style={{ marginBottom: '16px' }}>{error}</InlineAlert>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--theme-border)',
          display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--theme-bg-page)'
        }}>
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
