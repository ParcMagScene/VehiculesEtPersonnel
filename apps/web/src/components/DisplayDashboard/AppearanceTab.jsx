// ═══════════════════════════════════════════════════════════════
// AppearanceTab — Configuration de l'apparence du Dashboard TV
// (couleurs, police, météo, défilement automatique, Sonos IP)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, memo } from 'react';
import { Palette, Sun, Music, Eye, Save, RefreshCw } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { Button, Input, Select, Checkbox, SectionHeader } from '@/design-system';

const FONT_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Segoe UI', sans-serif", label: 'Segoe UI' },
];

function AppearanceTab({ currentUser, refreshKey, onPreviewChange }) {
  const toast = useToast();
  const [config, setConfig] = useState({
    primaryColor: '#00e1ff',
    secondaryColor: '#000000',
    eventBgColor: '#000000',
    eventTextColor: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    showWeather: false,
    autoScroll: true,
    weatherApiKey: '',
    weatherCity: 'Saint-Denis,RE,FR',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPath, setLogoPath] = useState(null);
  const [sonosIP, setSonosIP] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const [appearance, logo, sonos] = await Promise.all([
        api.getDisplayAppearance(),
        api.getDisplayLogo(),
        api.getDisplaySonosConfig(),
      ]);
      setConfig(appearance);
      setLogoPath(logo.path);
      setSonosIP(sonos.sonosIP || '');
    } catch {
      toast.error('Erreur chargement config');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadConfig(); }, [loadConfig, refreshKey]);

  const handleChange = (key, value) => {
    setConfig(prev => {
      const next = { ...prev, [key]: value };
      // Notifier le panneau aperçu des modifications en cours
      if (onPreviewChange) {
        onPreviewChange({ config: next });
      }
      return next;
    });
  };

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await Promise.all([
        api.saveDisplayAppearance(config),
        api.saveDisplaySonosConfig(sonosIP),
      ]);
      toast.success('Configuration enregistrée');
    } catch {
      toast.error('Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [config, sonosIP, toast]);

  const handleLogoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const result = await api.uploadDisplayLogo(formData);
      setLogoPath(result.path);
      toast.success('Logo mis à jour');
    } catch {
      toast.error('Erreur upload logo');
    }
  }, [toast]);

  if (loading) return <div className="display-loading">Chargement de la configuration…</div>;

  return (
    <div className="dtv-appearance">
      {/* Couleurs */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" icon={<Palette size={16} />} title="Couleurs" />
        <div className="dtv-form-grid">
          <div className="dtv-form-group">
            <label>Couleur principale</label>
            <div className="dtv-color-input">
              <input type="color" value={config.primaryColor} onChange={e => handleChange('primaryColor', e.target.value)} />
              <span>{config.primaryColor}</span>
            </div>
          </div>
          <div className="dtv-form-group">
            <label>Couleur secondaire</label>
            <div className="dtv-color-input">
              <input type="color" value={config.secondaryColor} onChange={e => handleChange('secondaryColor', e.target.value)} />
              <span>{config.secondaryColor}</span>
            </div>
          </div>
          <div className="dtv-form-group">
            <label>Fond événements</label>
            <div className="dtv-color-input">
              <input type="color" value={config.eventBgColor} onChange={e => handleChange('eventBgColor', e.target.value)} />
              <span>{config.eventBgColor}</span>
            </div>
          </div>
          <div className="dtv-form-group">
            <label>Texte événements</label>
            <div className="dtv-color-input">
              <input type="color" value={config.eventTextColor} onChange={e => handleChange('eventTextColor', e.target.value)} />
              <span>{config.eventTextColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Police */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" icon={<Eye size={16} />} title="Police & Affichage" />
        <div className="dtv-form-grid">
          <div className="dtv-form-group">
            <label>Police</label>
            <Select value={config.fontFamily} onChange={e => handleChange('fontFamily', e.target.value)}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </div>
          <div className="dtv-form-group dtv-toggle-row">
            <label>
              <Checkbox checked={config.autoScroll} onChange={e => handleChange('autoScroll', e.target.checked)} />
              Défilement automatique des événements
            </label>
          </div>
        </div>
      </div>

      {/* Météo */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" icon={<Sun size={16} />} title="Météo" />
        <div className="dtv-form-grid">
          <div className="dtv-form-group dtv-toggle-row">
            <label>
              <Checkbox checked={config.showWeather} onChange={e => handleChange('showWeather', e.target.checked)} />
              Afficher la météo sur l'écran TV
            </label>
          </div>
          <div className="dtv-form-group">
            <label>Clé API OpenWeatherMap</label>
            <Input type="text" value={config.weatherApiKey} onChange={e => handleChange('weatherApiKey', e.target.value)}
              placeholder="Votre clé API..." />
          </div>
          <div className="dtv-form-group">
            <label>Ville</label>
            <Input type="text" value={config.weatherCity} onChange={e => handleChange('weatherCity', e.target.value)}
              placeholder="Saint-Denis,RE,FR" />
          </div>
        </div>
      </div>

      {/* Sonos */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" icon={<Music size={16} />} title="Sonos" />
        <div className="dtv-form-group">
          <label>Adresse IP du Sonos</label>
          <Input type="text" value={sonosIP} onChange={e => setSonosIP(e.target.value)}
            placeholder="192.168.1.xxx" />
        </div>
      </div>

      {/* Logo */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" title="Logo de l'entreprise" />
        <div className="dtv-logo-section">
          {logoPath && (
            <img src={logoPath} alt="Logo actuel" className="dtv-logo-preview" />
          )}
          <div className="dtv-form-group">
            <label>Changer le logo</label>
            <input type="file" accept="image/*" onChange={handleLogoUpload} />
          </div>
        </div>
      </div>

      {/* Bouton sauvegarder */}
      <div className="dtv-actions">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer la configuration'}
        </Button>
      </div>
    </div>
  );
}

export default memo(AppearanceTab);
