// ═══════════════════════════════════════════════════════════════
// LocationIconsTab — Gestion des icônes GIF de lieux
// Galerie d'icônes + Règles d'association lieu → icône
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, memo } from 'react';
import { Film, Upload, Plus, Trash2, Save, X, Check } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api, { getApiUrl } from '../../utils/api';

function LocationIconsTab({ currentUser, refreshKey, onPreviewChange }) {
  const toast = useToast();
  const [gifs, setGifs] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMosaic, setShowMosaic] = useState(null); // index de la règle en cours

  const API_URL = getApiUrl();

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

  const handleDeleteGif = useCallback(async (filename) => {
    if (!confirm(`Supprimer l'icône « ${filename} » ?`)) return;
    try {
      await api.deleteDisplayLocationGif(filename);
      toast.success('Icône supprimée');
      setGifs(prev => prev.filter(g => g !== filename));
    } catch {
      toast.error('Erreur suppression');
    }
  }, [toast]);

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
        <h3 className="dtv-section-title">
          <Upload size={16} /> Importer des icônes
        </h3>
        <p className="dtv-hint">Uploadez des icônes GIF animés ou PNG avec transparence.</p>
        <div className="dtv-form-group">
          <input type="file" accept="image/gif,image/png" onChange={handleUploadGif} />
        </div>
      </div>

      {/* Galerie GIF */}
      <div className="dtv-section">
        <h3 className="dtv-section-title">
          <Film size={16} /> Galerie des icônes ({gifs.length})
        </h3>
        {gifs.length === 0 ? (
          <div className="dtv-empty-hint">Aucune icône disponible. Importez des fichiers GIF.</div>
        ) : (
          <div className="dtv-gifs-gallery">
            {gifs.map(gif => (
              <div key={gif} className="dtv-gif-item">
                <img src={gifUrl(gif)} alt={gif} />
                <span className="dtv-gif-name">{gif.replace(/\.(gif|png)$/i, '')}</span>
                <button className="dtv-gif-delete" onClick={() => handleDeleteGif(gif)} title="Supprimer">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Règles d'association lieu → icône */}
      <div className="dtv-section">
        <h3 className="dtv-section-title">
          <Film size={16} /> Associer des icônes aux lieux
        </h3>
        <p className="dtv-hint">Définissez quelle icône afficher à côté d'un événement selon son lieu.</p>

        <div className="dtv-rules-list">
          {rules.length === 0 && (
            <div className="dtv-empty-hint">Aucune règle définie.</div>
          )}
          {rules.map((rule, index) => (
            <div key={index} className="dtv-icon-rule">
              <div className="dtv-icon-selector" onClick={() => setShowMosaic(index)}>
                {rule.gifFilename ? (
                  <img src={gifUrl(rule.gifFilename)} alt={rule.gifFilename} />
                ) : (
                  <span className="dtv-icon-empty">➕</span>
                )}
              </div>
              <input
                type="text"
                value={rule.keyword}
                onChange={e => handleRuleChange(index, 'keyword', e.target.value)}
                placeholder="Mot-clé du lieu (ex: Salle A, Bureau…)"
                className="dtv-rule-keyword"
              />
              <button className="btn-icon-sm danger" onClick={() => handleRemoveRule(index)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="dtv-actions">
          <button className="btn-secondary-sm" onClick={handleAddRule}>
            <Plus size={14} /> Ajouter une règle
          </button>
          <button className="btn-primary-sm" onClick={handleSaveRules} disabled={saving}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
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
                  <div key={gif} className="dtv-mosaic-item" onClick={() => handleSelectIcon(gif)}>
                    <img src={gifUrl(gif)} alt={gif} />
                  </div>
                ))}
              </div>
            )}
            <button className="btn-secondary-sm" onClick={() => setShowMosaic(null)} style={{ marginTop: 12, width: '100%' }}>
              <X size={14} /> Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(LocationIconsTab);
