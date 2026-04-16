import { useState } from 'react';
import { Plus, X, Save, Edit2, Trash2, Award } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import api from '../../utils/api';
import { SKILL_CATEGORIES } from './personnelConstants';
import { Button, Input, Select, EmptyState } from '@/design-system';

const SkillsTab = ({ skills, setSkills, currentUser }) => {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'autre', description: '' });

  const groupedSkills = SKILL_CATEGORIES.map((cat) => ({
    ...cat,
    skills: skills.filter((s) => s.category === cat.value),
  })).filter((g) => g.skills.length > 0);

  const resetForm = () => {
    setForm({ name: '', category: 'autre', description: '' });
    setEditingSkill(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSkill) {
        const updated = await api.updateSkill(editingSkill.id, form);
        setSkills((prev) => prev.map((s) => (s.id === editingSkill.id ? updated : s)));
      } else {
        const created = await api.createSkill(form);
        setSkills((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      toast.error('Erreur : ' + (err.message || 'Impossible de sauvegarder'));
    }
  };

  const handleDelete = (id) => {
    confirm({
      title: 'Supprimer',
      message: 'Supprimer cette compétence ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteSkill(id);
          setSkills((prev) => prev.filter((s) => s.id !== id));
        } catch (err) {
          toast.error('Erreur : ' + (err.message || 'Impossible de supprimer'));
        }
      },
    });
  };

  return (
    <div className="personnel-tab-content">
      {currentUser?.isAdmin && (
        <div className="personnel-toolbar">
          <div style={{ flex: 1 }} />
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Plus size={16} /> Ajouter une compétence
          </Button>
        </div>
      )}

      {showForm && currentUser?.isAdmin && (
        <div className="personnel-form-overlay">
          <form className="personnel-form compact" onSubmit={handleSubmit}>
            <div className="personnel-form-header">
              <h3>{editingSkill ? 'Modifier' : 'Nouvelle compétence'}</h3>
              <Button
                variant="ghost"
                type="button"
                className="close-btn"
                onClick={resetForm}
                aria-label="Fermer"
              >
                <X size={18} />
              </Button>
            </div>
            <div className="personnel-form-grid">
              <div className="form-field">
                <label>Nom *</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Catégorie</label>
                <Select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {SKILL_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="form-field full-width">
              <label>Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="personnel-form-actions">
              <Button variant="ghost" type="button" onClick={resetForm}>
                Annuler
              </Button>
              <Button variant="primary" type="submit">
                <Save size={16} /> Enregistrer
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="skills-grid">
        {groupedSkills.map((group) => (
          <div key={group.value} className="skill-group">
            <h4 className="skill-group-title" style={{ '--group-color': group.color }}>
              <span className="skill-group-dot" style={{ background: group.color }} />
              {group.label} ({group.skills.length})
            </h4>
            <div className="skill-group-items">
              {group.skills.map((skill) => (
                <div key={skill.id} className="skill-item" style={{ '--chip-color': group.color }}>
                  <span className="skill-item-name">{skill.name}</span>
                  {skill.description && (
                    <span className="skill-item-desc">{skill.description}</span>
                  )}
                  {currentUser?.isAdmin && (
                    <div className="skill-item-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => {
                          setForm({
                            name: skill.name,
                            category: skill.category,
                            description: skill.description || '',
                          });
                          setEditingSkill(skill);
                          setShowForm(true);
                        }}
                        aria-label="Modifier"
                      >
                        <Edit2 size={12} />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        iconOnly
                        onClick={() => handleDelete(skill.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupedSkills.length === 0 && (
          <EmptyState icon={<Award size={48} />} title="Aucune compétence enregistrée" />
        )}
      </div>
      {ConfirmDialogRenderer}
    </div>
  );
};

export default SkillsTab;
