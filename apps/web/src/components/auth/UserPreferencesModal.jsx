import './UserPreferencesModal.css';

import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Layout,
  Monitor,
  Moon,
  Palette,
  Settings,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Toggle,
} from '@/design-system';

import { useDirtyForm } from '../../hooks/useDirtyForm';
import { PALETTES } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { DESKTOP_MODULES } from '../../router/routes.config';
import api from '../../utils/api';
import {
  NOTIFICATION_SOUND_VARIANTS,
  playNotificationSound,
  playNotificationVariant,
  playSound,
  requestNotificationPermission,
  setVolume,
  showBrowserNotification,
  SOUND_TYPES,
} from '../../utils/notificationSound';

// Source de vérité : routes.config.js (DESKTOP_MODULES). Le premier module
// (vehicles) est verrouillé : il sert d'onglet par défaut et ne peut pas être
// masqué ni déplacé.
const ALL_MODULES = DESKTOP_MODULES.map((m, i) => (i === 0 ? { ...m, locked: true } : m));

const VALID_MODULE_IDS = new Set(ALL_MODULES.map((m) => m.id));

const DEFAULT_TAB_ORDER = ALL_MODULES.map((m) => m.id);
const DEFAULT_HIDDEN_TABS = [];

const DEFAULT_PREFS = {
  defaultModule: 'vehicles',
  defaultView: 'week',
  compactMode: false,
  notificationsEnabled: true,
  soundEnabled: true,
  soundVolume: 70,
  notificationSoundVariant: 'notification',
  colorTheme: 'default',
  tabOrder: DEFAULT_TAB_ORDER,
  hiddenTabs: DEFAULT_HIDDEN_TABS,
};

const UserPreferencesModal = ({
  isOpen,
  onClose,
  onPreferencesChange,
  palette,
  onPaletteChange,
  isDark,
  onToggleTheme,
}) => {
  const toast = useToast();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const { isDirty, resetDirty } = useDirtyForm(prefs);
  // [Sprint D] Prévient F5 / fermeture onglet pendant édition
  useUnsavedChangesGuard(isDirty);
  const needsResetRef = useRef(false);

  const handleSafeClose = () => {
    if (isDirty) {
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
        order = order.filter((id) => VALID_MODULE_IDS.has(id));
        // Ajouter les nouveaux modules absents
        ALL_MODULES.forEach((m) => {
          if (!order.includes(m.id)) order.push(m.id);
        });
        merged.tabOrder = order;
        // Nettoyer hiddenTabs des modules supprimés
        merged.hiddenTabs = (merged.hiddenTabs || []).filter((id) => VALID_MODULE_IDS.has(id));
        setPrefs(merged);
        needsResetRef.current = true;
        setSaved(false);
      } catch (err) {
        console.error('Erreur chargement préférences:', err);
      }
    };
    fetchPrefs();
  }, [isOpen]);

  // Reset dirty tracking after initial fetch
  useEffect(() => {
    if (needsResetRef.current) {
      needsResetRef.current = false;
      resetDirty();
    }
  }, [prefs, resetDirty]);

  const updatePref = (key, value) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setSaved(false);
  };

  const moveTab = useCallback((tabId, direction) => {
    setPrefs((prev) => {
      const order = [...(prev.tabOrder || DEFAULT_TAB_ORDER)];
      const idx = order.indexOf(tabId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= order.length) return prev;
      [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
      const newPrefs = { ...prev, tabOrder: order };
      setSaved(false);
      return newPrefs;
    });
  }, []);

  const toggleTabVisibility = useCallback((tabId) => {
    setPrefs((prev) => {
      const hidden = [...(prev.hiddenTabs || [])];
      const idx = hidden.indexOf(tabId);
      if (idx >= 0) {
        hidden.splice(idx, 1);
      } else {
        hidden.push(tabId);
      }
      const newPrefs = { ...prev, hiddenTabs: hidden };
      setSaved(false);
      return newPrefs;
    });
  }, []);

  const orderedModules = (prefs.tabOrder || DEFAULT_TAB_ORDER)
    .map((id) => ALL_MODULES.find((m) => m.id === id))
    .filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.savePreferences(prefs);
      resetDirty();
      setSaved(true);
      if (onPreferencesChange) onPreferencesChange(prefs);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Erreur sauvegarde préférences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleSafeClose} size="lg" className="prefs-modal">
      <ModalHeader icon={<Settings size={18} />} onClose={handleSafeClose}>
        Préférences
      </ModalHeader>

      <ModalBody className="prefs-body">
        {/* Section Interface */}
        <div className="prefs-section">
          <div className="prefs-section-title">Interface</div>

          <div className="prefs-field">
            <span className="prefs-field-label">
              <Layout size={14} /> Module par défaut
            </span>
            <Select
              className="prefs-select"
              value={prefs.defaultModule}
              onChange={(e) => updatePref('defaultModule', e.target.value)}
            >
              <option value="vehicles">Parc</option>
              <option value="personnel">Personnel</option>
              <option value="affaires">Affaires</option>
              <option value="equipment">Équipements</option>
              <option value="orders">Commandes</option>
              <option value="stock">Stock</option>
              <option value="planning">Planning</option>
            </Select>
          </div>

          <div className="prefs-field">
            <span className="prefs-field-label">
              <Monitor size={14} /> Vue calendrier
            </span>
            <Select
              className="prefs-select"
              value={prefs.defaultView}
              onChange={(e) => updatePref('defaultView', e.target.value)}
            >
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </Select>
          </div>

          <div className="prefs-field">
            <span className="prefs-field-label">
              <Layout size={14} /> Mode compact
            </span>
            <Toggle
              checked={prefs.compactMode}
              onChange={(e) => updatePref('compactMode', e.target.checked)}
            />
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
                <div
                  key={mod.id}
                  className={`prefs-tab-row${isHidden ? ' hidden-tab' : ''}${mod.locked ? ' locked' : ''}`}
                >
                  <div className="prefs-tab-info">
                    <GripVertical size={14} className="prefs-tab-grip" />
                    <Icon size={16} />
                    <span>{mod.label}</span>
                  </div>
                  <div className="prefs-tab-actions">
                    {!mod.locked && (
                      <Button
                        variant="ghost"
                        className="prefs-tab-vis-btn"
                        onClick={() => toggleTabVisibility(mod.id)}
                        title={isHidden ? 'Afficher' : 'Masquer'}
                      >
                        {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="prefs-tab-move-btn"
                      onClick={() => moveTab(mod.id, -1)}
                      disabled={idx === 0}
                      title="Monter"
                    >
                      <ChevronUp size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      className="prefs-tab-move-btn"
                      onClick={() => moveTab(mod.id, 1)}
                      disabled={idx === orderedModules.length - 1}
                      title="Descendre"
                    >
                      <ChevronDown size={14} />
                    </Button>
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
            <Toggle checked={isDark} onChange={() => onToggleTheme && onToggleTheme()} />
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
                  <Button
                    variant="ghost"
                    key={p.id}
                    className={`prefs-palette-card${isActive ? ' active' : ''}`}
                    onClick={() => onPaletteChange && onPaletteChange(p.id)}
                    title={p.description}
                  >
                    <div className="prefs-palette-preview" style={{ background: colors.bg }}>
                      <div className="prefs-palette-swatches">
                        <span
                          className="prefs-palette-swatch"
                          style={{ background: colors.primary }}
                        />
                        <span
                          className="prefs-palette-swatch"
                          style={{ background: colors.secondary }}
                        />
                        <span
                          className="prefs-palette-swatch"
                          style={{ background: colors.accent }}
                        />
                      </div>
                      <div
                        className="prefs-palette-mini-card"
                        style={{ background: colors.card, borderColor: colors.primary + '33' }}
                      >
                        <div
                          className="prefs-palette-mini-bar"
                          style={{
                            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="prefs-palette-info">
                      <span className="prefs-palette-name">{p.name}</span>
                      {isActive && <Check size={12} className="prefs-palette-check" />}
                    </div>
                  </Button>
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
            <Toggle
              checked={prefs.notificationsEnabled}
              onChange={async (e) => {
                const checked = e.target.checked;
                if (checked && 'Notification' in window && Notification.permission === 'default') {
                  // Demande explicite de la permission au moment du toggle
                  // (Chrome/Safari refusent toute demande sans interaction).
                  const ok = await requestNotificationPermission();
                  if (!ok) {
                    toast.warning(
                      'Permission navigateur refusee — notifications visuelles desactivees',
                    );
                  }
                }
                updatePref('notificationsEnabled', checked);
              }}
            />
          </div>

          <div className="prefs-field">
            <span className="prefs-field-label">
              <Bell size={14} /> Son de notification
            </span>
            <Toggle
              checked={prefs.soundEnabled}
              onChange={(e) => updatePref('soundEnabled', e.target.checked)}
            />
          </div>

          {prefs.soundEnabled && (
            <div className="prefs-field">
              <span className="prefs-field-label">
                <Bell size={14} /> Son d'arrivée de message
              </span>
              <Select
                className="prefs-select"
                value={prefs.notificationSoundVariant || 'notification'}
                onChange={(e) => {
                  const variant = e.target.value;
                  updatePref('notificationSoundVariant', variant);
                  // Preview immédiat avec le volume courant
                  setVolume(prefs.soundVolume / 100);
                  playNotificationVariant(variant);
                }}
              >
                {NOTIFICATION_SOUND_VARIANTS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.emoji} {v.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {prefs.soundEnabled && (
            <div className="prefs-field prefs-volume-row">
              <span className="prefs-field-label">
                {prefs.soundVolume > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />} Volume
                <span className="prefs-volume-val">{prefs.soundVolume}%</span>
              </span>
              <Input
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
              <span className="prefs-field-label" style={{ marginBottom: 6 }}>
                Tester les sons :
              </span>
              <div className="prefs-sound-btns">
                {SOUND_TYPES.map((st) => (
                  <Button
                    variant="ghost"
                    key={st}
                    className="prefs-sound-btn"
                    onClick={() => {
                      setVolume(prefs.soundVolume / 100);
                      playSound(st);
                    }}
                    title={st}
                  >
                    {st === 'notification'
                      ? '🔔'
                      : st === 'success'
                        ? '✅'
                        : st === 'error'
                          ? '❌'
                          : st === 'warning'
                            ? '⚠️'
                            : st === 'click'
                              ? '👆'
                              : '🗑️'}
                    <span>{st}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="prefs-field">
            <Button
              variant="ghost"
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
                  toast.info(
                    'Les notifications navigateur sont bloqu\u00e9es. Autorisez-les dans les param\u00e8tres de votre navigateur.',
                  );
                }
              }}
            >
              <Volume2 size={14} /> Tester les notifications
            </Button>
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="prefs-footer">
        {saved && (
          <span className="prefs-saved-msg">
            <Check size={14} /> Enregistré
          </span>
        )}
        <Button variant="ghost" onClick={handleSafeClose}>
          Fermer
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </ModalFooter>

      <Dialog
        open={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={() => {
          setShowUnsavedWarning(false);
          onClose();
        }}
        title="Modifications non enregistrées"
        variant="warning"
        confirmLabel="Ne pas enregistrer"
        cancelLabel="Continuer l'édition"
        confirmVariant="danger"
        extraAction={{ label: 'Enregistrer', onClick: handleSave, variant: 'primary' }}
      >
        Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?
      </Dialog>
    </Modal>
  );
};

export default UserPreferencesModal;
