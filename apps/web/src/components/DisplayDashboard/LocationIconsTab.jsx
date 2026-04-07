// ═══════════════════════════════════════════════════════════════
// LocationIconsTab — Gestion des icônes GIF par type de tâche
// Galerie d'icônes + Règles d'association type de tâche → icône
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, memo } from 'react';
import { Film, Upload, Plus, Trash2, Save, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import api, { getApiUrl } from '../../utils/api';
import { Button, Select, Tooltip, SectionHeader } from '@/design-system';

// Types de tâches (sections) disponibles pour l'association icône
const TASK_SECTIONS = [
  { key: 'rdv', label: '📅 RDV' },
  { key: 'evenements', label: '🎉 Événement' },
  { key: 'taches_prioritaires', label: '⚡ Prioritaire' },
  { key: 'courses', label: '🛒 Courses' },
  { key: 'prep_locations', label: '📦 Prépa Location' },
  { key: 'prep_prestations', label: '🎤 Prépa Prestation' },
  { key: 'prep_ventes', label: '💰 Prépa Vente' },
  { key: 'prep_installations', label: '🔧 Prépa Installation' },
  { key: 'prep_tournees', label: '🚛 Prépa Tournée' },
  { key: 'chargement', label: '📦 Chargement' },
  { key: 'depart', label: '🚀 Départ' },
  { key: 'enlevement', label: '📤 Enlèvement' },
  { key: 'retour', label: '🔙 Retour' },
  { key: 'recuperation', label: '♻️ Récupération' },
  { key: 'installation', label: '🔧 Installation' },
  { key: 'montage', label: '🔩 Montage' },
  { key: 'demontage', label: '🔧 Démontage' },
  { key: 'taches_secondaires', label: '📋 Secondaire' },
  { key: 'manual', label: '✏️ Divers' },
];

function LocationIconsTab({ _currentUser, refreshKey, onPreviewChange }) {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [gifs, setGifs] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMosaic, setShowMosaic] = useState(null); // index de la règle en cours

  const _API_URL = getApiUrl();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [gifsData, rulesData] = await Promise.all([
        api.getDisplayLocationGifs(),
        api.getDisplayLocationIconRules(),
      ]);
      setGifs(gifsData.gifs || []);
      setRules(rulesData.rules || []);
    } catch {
      toast.error('Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  // ── Gestion GIFs ──
  const handleUploadGif = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('gif', file);
      await api.uploadDisplayLocationGif(formData);
      toast.success('Icône importée');
      e.target.value = '';
      const data = await api.getDisplayLocationGifs();
      setGifs(data.gifs || []);
    } catch {
      toast.error("Erreur import");
    }
  }, [toast]);

  const handleDeleteGif = useCallback((filename) => {
    confirm({
      title: 'Supprimer',
      message: `Supprimer l'ic\xF4ne \xAB ${filename} \xBB ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteDisplayLocationGif(filename);
          toast.success('Ic\xF4ne supprim\xE9e');
          setGifs(prev => prev.filter(g => g !== filename));
        } catch {
          toast.error('Erreur suppression');
        }
      },
    });
  }, [confirm, toast]);

  // ── Gestion règles d'icônes ──
  const handleAddRule = () => {
    setRules(prev => [...prev, { keyword: '', gifFilename: '' }]);
  };

  const handleRuleChange = (index, field, value) => {
    setRules(prev => {
      const next = prev.map((r, i) => i === index ? { ...r, [field]: value } : r);
      if (onPreviewChange) {
        onPreviewChange({ iconRules: next.map(r => ({ keyword: r.keyword, gif_filename: r.gifFilename })) });
      }
      return next;
    });
  };

  const handleRemoveRule = (index) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectIcon = (gifFilename) => {
    if (showMosaic !== null) {
      handleRuleChange(showMosaic, 'gifFilename', gifFilename);
      setShowMosaic(null);
    }
  };

  const handleSaveRules = useCallback(async () => {
    try {
      setSaving(true);
      const validRules = rules.filter(r => r.keyword && r.gifFilename);
      await api.saveDisplayLocationIconRules(validRules);
      setRules(validRules);
      toast.success("Règles d'icônes enregistrées");
    } catch {
      toast.error('Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [rules, toast]);

  const gifUrl = (filename) => `/display-gifs/${filename}`;

  if (loading) return <div className="display-loading">Chargement des icônes…</div>;

  return (
    <div className="dtv-location-icons">
      {/* Section Import */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" icon={<Upload size={16} />} title="Importer des icônes" />
        <p className="dtv-hint">Uploadez des icônes GIF animés ou PNG avec transparence.</p>
        <div className="dtv-form-group">
          <input type="file" accept="image/gif,image/png" onChange={handleUploadGif} />
        </div>
      </div>

      {/* Galerie GIF */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" icon={<Film size={16} />} title={`Galerie des icônes (${gifs.length})`} />
        {gifs.length === 0 ? (
          <div className="dtv-empty-hint">Aucune icône disponible. Importez des fichiers GIF.</div>
        ) : (
          <div className="dtv-gifs-gallery">
            {gifs.map(gif => (
              <div key={gif} className="dtv-gif-item">
                <img src={gifUrl(gif)} alt={gif} />
                <span className="dtv-gif-name">{gif.replace(/\.(gif|png)$/i, '')}</span>
                <Tooltip content="Supprimer"><Button variant="ghost" className="dtv-gif-delete" onClick={() => handleDeleteGif(gif)}>
                  <Trash2 size={12} />
                </Button></Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Règles d'association type de tâche → icône */}
      <div className="dtv-section">
        <SectionHeader className="dtv-section-title" icon={<Film size={16} />} title="Associer des icônes aux types de tâches" />
        <p className="dtv-hint">Définissez quelle icône afficher sur l'écran TV selon le type de tâche.</p>

        <div className="dtv-rules-list">
          {rules.length === 0 && (
            <div className="dtv-empty-hint">Aucune règle définie.</div>
          )}
          {rules.map((rule, index) => (
            <div key={index} className="dtv-icon-rule">
              <div className="dtv-icon-selector" role="button" tabIndex={0} onClick={() => setShowMosaic(index)}>
                {rule.gifFilename ? (
                  <img src={gifUrl(rule.gifFilename)} alt={rule.gifFilename} />
                ) : (
                  <span className="dtv-icon-empty">➕</span>
                )}
              </div>
              <Select
                value={rule.keyword}
                onChange={e => handleRuleChange(index, 'keyword', e.target.value)}
                className="dtv-rule-keyword"
              >
                <option value="">— Choisir un type de tâche —</option>
                {TASK_SECTIONS
                  .filter(s => s.key === rule.keyword || !rules.some((r, ri) => ri !== index && r.keyword === s.key))
                  .map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))
                }
              </Select>
              <Button variant="danger" size="sm" iconOnly onClick={() => handleRemoveRule(index)}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>

        <div className="dtv-actions">
          <Button variant="secondary" size="sm" onClick={handleAddRule}>
            <Plus size={14} /> Ajouter une règle
          </Button>
          <Button variant="primary" size="sm" onClick={handleSaveRules} disabled={saving}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Overlay mosaïque de sélection d'icône */}
      {showMosaic !== null && (
        <div className="dtv-mosaic-overlay" onClick={() => setShowMosaic(null)}>
          <div className="dtv-mosaic-container" onClick={e => e.stopPropagation()}>
            <h3>Choisir une icône</h3>
            {gifs.length === 0 ? (
              <p className="dtv-hint">Aucune icône disponible. Importez des fichiers GIF d'abord.</p>
            ) : (
              <div className="dtv-mosaic-grid">
                {gifs.map(gif => (
                  <div key={gif} className="dtv-mosaic-item" role="button" tabIndex={0} onClick={() => handleSelectIcon(gif)}>
                    <img src={gifUrl(gif)} alt={gif} />
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={() => setShowMosaic(null)} style={{ marginTop: 12, width: '100%' }}>
              <X size={14} /> Annuler
            </Button>
          </div>
        </div>
      )}
      {ConfirmDialogRenderer}
    </div>
  );
}

export default memo(LocationIconsTab);
