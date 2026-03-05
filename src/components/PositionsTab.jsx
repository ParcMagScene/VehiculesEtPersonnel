import { useState } from 'react';
import { Plus, X, Save, Edit2, Trash2, Briefcase } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import api from '../utils/api';
import { POSITION_CATEGORIES } from './personnelConstants';

const PositionsTab = ({ positions, setPositions, currentUser }) => {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'autre', is_common: false });

  const groupedPositions = POSITION_CATEGORIES.map(cat => ({
    ...cat,
    positions: positions.filter(p => p.category === cat.value),
  })).filter(g => g.positions.length > 0);

  const resetForm = () => {
    setForm({ name: '', category: 'autre', is_common: false });
    setEditingPosition(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPosition) {
        const updated = await api.updatePosition(editingPosition.id, form);
        setPositions(prev => prev.map(p => p.id === editingPosition.id ? updated : p));
      } else {
        const created = await api.createPosition(form);
        setPositions(prev => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce poste ?')) return;
    try {
      await api.deletePosition(id);
      setPositions(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de supprimer'));
    }
  };

  return (
    <div className="personnel-tab-content">
      {currentUser?.isAdmin && (
        <div className="personnel-toolbar">
          <div style={{ flex: 1 }} />
          <button className="personnel-add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={16} /> Ajouter un poste
          </button>
        </div>
      )}

      {showForm && currentUser?.isAdmin && (
        <div className="personnel-form-overlay">
          <form className="personnel-form compact" onSubmit={handleSubmit}>
            <div className="personnel-form-header">
              <h3>{editingPosition ? 'Modifier' : 'Nouveau poste'}</h3>
              <button type="button" className="close-btn" onClick={resetForm}><X size={18} /></button>
            </div>
            <div className="personnel-form-grid">
              <div className="form-field">
                <label>Nom du poste *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Catégorie</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {POSITION_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.is_common}
                  onChange={e => setForm({ ...form, is_common: e.target.checked })}
                />
                Poste couramment occupé (affiché en priorité)
              </label>
            </div>
            <div className="personnel-form-actions">
              <button type="button" className="cancel-btn" onClick={resetForm}>Annuler</button>
              <button type="submit" className="save-btn"><Save size={16} /> Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      <div className="skills-grid">
        {groupedPositions.map(group => (
          <div key={group.value} className="skill-group">
            <h4 className="skill-group-title" style={{ '--group-color': group.color }}>
              <span className="skill-group-dot" style={{ background: group.color }} />
              {group.label} ({group.positions.length})
            </h4>
            <div className="skill-group-items">
              {group.positions.map(pos => (
                <div key={pos.id} className="skill-item" style={{ '--chip-color': group.color }}>
                  <span className="skill-item-name">
                    {pos.name}
                    {pos.isCommon ? ' ⭐' : ''}
                  </span>
                  {currentUser?.isAdmin && (
                    <div className="skill-item-actions">
                      <button className="icon-btn" onClick={() => {
                        setForm({ name: pos.name, category: pos.category, is_common: !!pos.isCommon });
                        setEditingPosition(pos);
                        setShowForm(true);
                      }}>
                        <Edit2 size={12} />
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDelete(pos.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupedPositions.length === 0 && (
          <div className="personnel-empty">
            <Briefcase size={48} />
            <p>Aucun poste enregistré</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionsTab;
