// ═══════════════════════════════════════════════════════════════
// ColorRulesTab — Règles de couleurs pour les événements
// (mot-clé → couleur d'affichage sur l'écran TV)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, memo } from 'react';
import { Tag, Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function ColorRulesTab({ currentUser, refreshKey, onPreviewChange }) {
  const toast = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplayColorRules();
      setRules(data.rules || []);
    } catch {
      toast.error('Erreur chargement règles');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadRules(); }, [loadRules, refreshKey]);

  const handleAdd = () => {
    setRules(prev => [...prev, { keyword: '', color: '#00e1ff', description: '' }]);
  };

  const handleChange = (index, field, value) => {
    setRules(prev => {
      const next = prev.map((r, i) => i === index ? { ...r, [field]: value } : r);
      if (onPreviewChange) {
        onPreviewChange({ colorRules: next });
      }
      return next;
    });
  };

  const handleRemove = (index) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const validRules = rules.filter(r => r.keyword.trim());
      await api.saveDisplayColorRules(validRules);
      setRules(validRules);
      toast.success('Règles de couleurs enregistrées');
    } catch {
      toast.error('Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [rules, toast]);

  if (loading) return <div className="display-loading">Chargement des règles…</div>;

  return (
    <div className="dtv-color-rules">
      <div className="dtv-section">
        <h3 className="dtv-section-title">
          <Tag size={16} /> Règles de couleurs des événements
        </h3>
        <p className="dtv-hint">
          Définissez la couleur d'affichage des événements selon les mots-clés contenus dans le titre.
        </p>

        <div className="dtv-rules-list">
          {rules.length === 0 && (
            <div className="dtv-empty-hint">Aucune règle définie. Cliquez sur « Ajouter » pour commencer.</div>
          )}
          {rules.map((rule, index) => (
            <div key={index} className="dtv-rule-card">
              <div className="dtv-rule-row">
                <input
                  type="color"
                  value={rule.color}
                  onChange={e => handleChange(index, 'color', e.target.value)}
                  className="dtv-rule-color"
                  title="Couleur"
                />
                <input
                  type="text"
                  value={rule.keyword}
                  onChange={e => handleChange(index, 'keyword', e.target.value)}
                  placeholder="Mot-clé (ex: Livraison, Presta…)"
                  className="dtv-rule-keyword"
                />
                <input
                  type="text"
                  value={rule.description || ''}
                  onChange={e => handleChange(index, 'description', e.target.value)}
                  placeholder="Description (optionnel)"
                  className="dtv-rule-desc"
                />
                <button className="btn-icon-sm danger" onClick={() => handleRemove(index)} title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
              {/* Prévisualisation */}
              <div className="dtv-rule-preview" style={{ borderLeftColor: rule.color }}>
                <span style={{ color: rule.color }}>■</span> {rule.keyword || 'Mot-clé'} → {rule.description || 'Aucune description'}
              </div>
            </div>
          ))}
        </div>

        <div className="dtv-actions">
          <button className="btn-secondary-sm" onClick={handleAdd}>
            <Plus size={14} /> Ajouter une règle
          </button>
          <button className="btn-primary-sm" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ColorRulesTab);
