import { useState, useEffect } from 'react';
import { X, Settings, Monitor, Layout, Bell, Palette, Check, Volume2 } from 'lucide-react';
import api from '../utils/api';
import { playNotificationSound, requestNotificationPermission, showBrowserNotification } from '../utils/notificationSound';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import './UserPreferencesModal.css';

const DEFAULT_PREFS = {
  defaultModule: 'vehicles',
  defaultView: 'week',
  compactMode: false,
  notificationsEnabled: true,
  soundEnabled: true,
  colorTheme: 'default',
};

const UserPreferencesModal = ({ isOpen, onClose, onPreferencesChange }) => {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPrefs, setOriginalPrefs] = useState(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  const handleSafeClose = () => {
    if (hasChanges) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const fetchPrefs = async () => {
      try {
        const data = await api.getPreferences();
        const merged = { ...DEFAULT_PREFS, ...data };
        setPrefs(merged);
        setOriginalPrefs(merged);
        setHasChanges(false);
        setSaved(false);
      } catch (err) {
        console.error('Erreur chargement préférences:', err);
      }
    };
    fetchPrefs();
  }, [isOpen]);

  const updatePref = (key, value) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setHasChanges(JSON.stringify(newPrefs) !== JSON.stringify(originalPrefs));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.savePreferences(prefs);
      setOriginalPrefs(prefs);
      setHasChanges(false);
      setSaved(true);
      if (onPreferencesChange) onPreferencesChange(prefs);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Erreur sauvegarde préférences:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="prefs-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleSafeClose(); }}>
      <div className="prefs-modal">
        <div className="prefs-header">
          <h3><Settings size={18} /> Préférences</h3>
          <button onClick={handleSafeClose}><X size={18} /></button>
        </div>

        <div className="prefs-body">
          {/* Section Interface */}
          <div className="prefs-section">
            <div className="prefs-section-title">Interface</div>

            <div className="prefs-field">
              <span className="prefs-field-label">
                <Layout size={14} /> Module par défaut
              </span>
              <select
                className="prefs-select"
                value={prefs.defaultModule}
                onChange={(e) => updatePref('defaultModule', e.target.value)}
              >
                <option value="vehicles">Parc</option>
                <option value="personnel">Personnel</option>
                <option value="affaires">Affaires</option>
                <option value="equipment">Matériel</option>
                <option value="orders">Commandes</option>
              </select>
            </div>

            <div className="prefs-field">
              <span className="prefs-field-label">
                <Monitor size={14} /> Vue calendrier
              </span>
              <select
                className="prefs-select"
                value={prefs.defaultView}
                onChange={(e) => updatePref('defaultView', e.target.value)}
              >
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
            </div>

            <div className="prefs-field">
              <span className="prefs-field-label">
                <Layout size={14} /> Mode compact
              </span>
              <label className="prefs-toggle">
                <input
                  type="checkbox"
                  checked={prefs.compactMode}
                  onChange={(e) => updatePref('compactMode', e.target.checked)}
                />
                <span className="prefs-toggle-slider" />
              </label>
            </div>
          </div>

          {/* Section Thème */}
          <div className="prefs-section">
            <div className="prefs-section-title">Apparence</div>

            <div className="prefs-field">
              <span className="prefs-field-label">
                <Palette size={14} /> Couleur d'accent
              </span>
              <select
                className="prefs-select"
                value={prefs.colorTheme}
                onChange={(e) => updatePref('colorTheme', e.target.value)}
              >
                <option value="default">Violet (défaut)</option>
                <option value="blue">Bleu</option>
                <option value="green">Vert</option>
                <option value="orange">Orange</option>
              </select>
            </div>
          </div>

          {/* Section Notifications */}
          <div className="prefs-section">
            <div className="prefs-section-title">Notifications</div>

            <div className="prefs-field">
              <span className="prefs-field-label">
                <Bell size={14} /> Notifications navigateur
              </span>
              <label className="prefs-toggle">
                <input
                  type="checkbox"
                  checked={prefs.notificationsEnabled}
                  onChange={(e) => updatePref('notificationsEnabled', e.target.checked)}
                />
                <span className="prefs-toggle-slider" />
              </label>
            </div>

            <div className="prefs-field">
              <span className="prefs-field-label">
                <Bell size={14} /> Son de notification
              </span>
              <label className="prefs-toggle">
                <input
                  type="checkbox"
                  checked={prefs.soundEnabled}
                  onChange={(e) => updatePref('soundEnabled', e.target.checked)}
                />
                <span className="prefs-toggle-slider" />
              </label>
            </div>

            <div className="prefs-field">
              <button
                className="prefs-test-btn"
                onClick={async () => {
                  // Tester le son
                  playNotificationSound();
                  // Tester la notification navigateur
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    showBrowserNotification('Test de notification', {
                      body: 'Les notifications eM@g fonctionnent \u2705',
                    });
                  } else {
                    alert('Les notifications navigateur sont bloqu\u00e9es.\nAutorisez-les dans les param\u00e8tres de votre navigateur.');
                  }
                }}
              >
                <Volume2 size={14} /> Tester les notifications
              </button>
            </div>
          </div>
        </div>

        <div className="prefs-footer">
          {saved && (
            <span className="prefs-saved-msg">
              <Check size={14} /> Enregistré
            </span>
          )}
          <button className="prefs-btn-cancel" onClick={handleSafeClose}>Fermer</button>
          <button className="prefs-btn-save" onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {showUnsavedWarning && (
        <UnsavedChangesDialog
          onCancel={() => setShowUnsavedWarning(false)}
          onDiscard={onClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default UserPreferencesModal;
