import { useState, useEffect, useCallback } from 'react';
import { X, Settings, Monitor, Layout, Bell, Palette, Check, Volume2, VolumeX, Eye, EyeOff, GripVertical, ChevronUp, ChevronDown, Truck, Users, Briefcase, Package, ShoppingCart, BookOpen, Boxes, Sun, Moon, Radio } from 'lucide-react';
import api from '../../utils/api';
import { playNotificationSound, requestNotificationPermission, showBrowserNotification, playSound, setVolume, getVolume, SOUND_TYPES } from '../../utils/notificationSound';
import { PALETTES } from '../../hooks/useTheme';
import UnsavedChangesDialog from '../UnsavedChangesDialog';
import './UserPreferencesModal.css';
import { useToast } from '../../hooks/useToast';

const ALL_MODULES = [
  { id: 'vehicles', label: 'Parc', icon: Truck, locked: true },
  { id: 'personnel', label: 'Personnel', icon: Users },
  { id: 'affaires', label: 'Affaires', icon: Briefcase },
  { id: 'equipment', label: 'Équipements', icon: Package },
  { id: 'orders', label: 'Commandes', icon: ShoppingCart },
  { id: 'catalog', label: 'Catalogue', icon: BookOpen },
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'planning', label: 'Planning', icon: Radio },
];

const VALID_MODULE_IDS = new Set(ALL_MODULES.map(m => m.id));

const DEFAULT_TAB_ORDER = ALL_MODULES.map(m => m.id);
const DEFAULT_HIDDEN_TABS = [];

const DEFAULT_PREFS = {
  defaultModule: 'vehicles',
  defaultView: 'week',
  compactMode: false,
  notificationsEnabled: true,
  soundEnabled: true,
  soundVolume: 70,
  colorTheme: 'default',
  tabOrder: DEFAULT_TAB_ORDER,
  hiddenTabs: DEFAULT_HIDDEN_TABS,
};

const UserPreferencesModal = ({ isOpen, onClose, onPreferencesChange, palette, onPaletteChange, isDark, onToggleTheme }) => {
  const toast = useToast();
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
        // Migration : synchroniser tabOrder avec les modules actuels
        let order = merged.tabOrder || DEFAULT_TAB_ORDER;
        // Retirer les modules supprimés
        order = order.filter(id => VALID_MODULE_IDS.has(id));
        // Ajouter les nouveaux modules absents
        ALL_MODULES.forEach(m => { if (!order.includes(m.id)) order.push(m.id); });
        merged.tabOrder = order;
        // Nettoyer hiddenTabs des modules supprimés
        merged.hiddenTabs = (merged.hiddenTabs || []).filter(id => VALID_MODULE_IDS.has(id));
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

  const moveTab = useCallback((tabId, direction) => {
    setPrefs(prev => {
      const order = [...(prev.tabOrder || DEFAULT_TAB_ORDER)];
      const idx = order.indexOf(tabId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= order.length) return prev;
      [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
      const newPrefs = { ...prev, tabOrder: order };
      setHasChanges(JSON.stringify(newPrefs) !== JSON.stringify(originalPrefs));
      setSaved(false);
      return newPrefs;
    });
  }, [originalPrefs]);

  const toggleTabVisibility = useCallback((tabId) => {
    setPrefs(prev => {
      const hidden = [...(prev.hiddenTabs || [])];
      const idx = hidden.indexOf(tabId);
      if (idx >= 0) {
        hidden.splice(idx, 1);
      } else {
        hidden.push(tabId);
      }
      const newPrefs = { ...prev, hiddenTabs: hidden };
      setHasChanges(JSON.stringify(newPrefs) !== JSON.stringify(originalPrefs));
      setSaved(false);
      return newPrefs;
    });
  }, [originalPrefs]);

  const orderedModules = (prefs.tabOrder || DEFAULT_TAB_ORDER).map(id => ALL_MODULES.find(m => m.id === id)).filter(Boolean);

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
    <div className="prefs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) handleSafeClose(); }}>
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
                <option value="equipment">Équipements</option>
                <option value="orders">Commandes</option>
                <option value="catalog">Catalogue</option>
                <option value="stock">Stock</option>
                <option value="planning">Planning</option>
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

          {/* Section Onglets */}
          <div className="prefs-section">
            <div className="prefs-section-title">Onglets &amp; Ordre</div>
            <div className="prefs-tabs-list">
              {orderedModules.map((mod, idx) => {
                const Icon = mod.icon;
                const isHidden = (prefs.hiddenTabs || []).includes(mod.id);
                return (
                  <div key={mod.id} className={`prefs-tab-row${isHidden ? ' hidden-tab' : ''}${mod.locked ? ' locked' : ''}`}>
                    <div className="prefs-tab-info">
                      <GripVertical size={14} className="prefs-tab-grip" />
                      <Icon size={16} />
                      <span>{mod.label}</span>
                    </div>
                    <div className="prefs-tab-actions">
                      {!mod.locked && (
                        <button
                          className="prefs-tab-vis-btn"
                          onClick={() => toggleTabVisibility(mod.id)}
                          title={isHidden ? 'Afficher' : 'Masquer'}
                        >
                          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                      <button
                        className="prefs-tab-move-btn"
                        onClick={() => moveTab(mod.id, -1)}
                        disabled={idx === 0}
                        title="Monter"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        className="prefs-tab-move-btn"
                        onClick={() => moveTab(mod.id, 1)}
                        disabled={idx === orderedModules.length - 1}
                        title="Descendre"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section Thème */}
          <div className="prefs-section">
            <div className="prefs-section-title">Apparence</div>

            {/* Mode clair / sombre */}
            <div className="prefs-field">
              <span className="prefs-field-label">
                {isDark ? <Moon size={14} /> : <Sun size={14} />} Mode sombre
              </span>
              <label className="prefs-toggle">
                <input
                  type="checkbox"
                  checked={isDark}
                  onChange={() => onToggleTheme && onToggleTheme()}
                />
                <span className="prefs-toggle-slider" />
              </label>
            </div>

            {/* Sélecteur de palette */}
            <div className="prefs-field prefs-palette-section">
              <span className="prefs-field-label">
                <Palette size={14} /> Palette de couleurs
              </span>
              <div className="prefs-palette-grid">
                {PALETTES.map((p) => {
                  const colors = isDark ? p.darkColors : p.colors;
                  const isActive = palette === p.id;
                  return (
                    <button
                      key={p.id}
                      className={`prefs-palette-card${isActive ? ' active' : ''}`}
                      onClick={() => onPaletteChange && onPaletteChange(p.id)}
                      title={p.description}
                    >
                      <div className="prefs-palette-preview" style={{ background: colors.bg }}>
                        <div className="prefs-palette-swatches">
                          <span className="prefs-palette-swatch" style={{ background: colors.primary }} />
                          <span className="prefs-palette-swatch" style={{ background: colors.secondary }} />
                          <span className="prefs-palette-swatch" style={{ background: colors.accent }} />
                        </div>
                        <div className="prefs-palette-mini-card" style={{ background: colors.card, borderColor: colors.primary + '33' }}>
                          <div className="prefs-palette-mini-bar" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }} />
                        </div>
                      </div>
                      <div className="prefs-palette-info">
                        <span className="prefs-palette-name">{p.name}</span>
                        {isActive && <Check size={12} className="prefs-palette-check" />}
                      </div>
                    </button>
                  );
                })}
              </div>
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

            {prefs.soundEnabled && (
              <div className="prefs-field prefs-volume-row">
                <span className="prefs-field-label">
                  {prefs.soundVolume > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />} Volume
                  <span className="prefs-volume-val">{prefs.soundVolume}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={prefs.soundVolume}
                  className="prefs-volume-slider"
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    updatePref('soundVolume', v);
                    setVolume(v / 100);
                  }}
                />
              </div>
            )}

            {prefs.soundEnabled && (
              <div className="prefs-sound-test">
                <span className="prefs-field-label" style={{ marginBottom: 6 }}>Tester les sons :</span>
                <div className="prefs-sound-btns">
                  {SOUND_TYPES.map(st => (
                    <button
                      key={st}
                      className="prefs-sound-btn"
                      onClick={() => { setVolume(prefs.soundVolume / 100); playSound(st); }}
                      title={st}
                    >
                      {st === 'notification' ? '🔔' : st === 'success' ? '✅' : st === 'error' ? '❌' : st === 'warning' ? '⚠️' : st === 'click' ? '👆' : '🗑️'}
                      <span>{st}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="prefs-field">
              <button
                className="prefs-test-btn"
                onClick={async () => {
                  // Tester le son
                  setVolume(prefs.soundVolume / 100);
                  playNotificationSound();
                  // Tester la notification navigateur
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    showBrowserNotification('Test de notification', {
                      body: 'Les notifications eM@g fonctionnent \u2705',
                    });
                  } else {
                    toast.info('Les notifications navigateur sont bloqu\u00e9es. Autorisez-les dans les param\u00e8tres de votre navigateur.');
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
