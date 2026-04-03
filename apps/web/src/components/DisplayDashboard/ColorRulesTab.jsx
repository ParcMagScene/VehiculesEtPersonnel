// ═══════════════════════════════════════════════════════════════
// ColorRulesTab — Règles de couleurs par type de tâche
// (type de tâche → couleur d'affichage sur l'écran TV)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, memo } from 'react';
import { Tag, Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { Button, Select, Tooltip, SectionHeader } from '@/design-system';

// Types de tâches (sections) disponibles pour l'association couleur
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
        <SectionHeader className="dtv-section-title" icon={<Tag size={16} />} title="Couleurs par type de tâche" />
        <p className="dtv-hint">
          Attribuez une couleur d'affichage sur l'écran TV à chaque type de tâche.
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
                <Select
                  value={rule.keyword}
                  onChange={e => handleChange(index, 'keyword', e.target.value)}
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
                <Tooltip content="Supprimer">
                  <Button variant="danger" size="sm" iconOnly onClick={() => handleRemove(index)}>
                    <Trash2 size={14} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>

        <div className="dtv-actions">
          <Button variant="secondary" size="sm" onClick={handleAdd}>
            <Plus size={14} /> Ajouter une règle
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(ColorRulesTab);
