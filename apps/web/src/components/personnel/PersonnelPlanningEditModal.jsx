import React, { useState } from 'react';
import { Check, Save, User } from 'lucide-react';

import { Button, FormField, Input, ModalLayout, Select, Textarea } from '@/design-system';

import { STATUS } from '../../constants';
import {
  CONTRACT_TYPES,
  getCategoryColor,
  PERSON_TYPES,
  POSITION_CATEGORIES,
  SKILL_LEVELS,
} from './personnelConstants';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import PhoneInput from '../PhoneInput';

export const PersonnelPlanningEditModal = ({
  open,
  onClose,
  person,
  skills,
  positions,
  onSuccess,
  onError,
}) => {
  const [editForm, setEditForm] = useState(
    person
      ? {
          firstName: person.firstName || '',
          lastName: person.lastName || '',
          email: person.email || '',
          phone: person.phone || '',
          type: person.type || 'permanent',
          contractType: person.contractType || '',
          userId: person.userId || null,
          status: person.status || 'active',
          notes: person.notes || '',
          showInPlanning: person.show_in_planning !== 0 && person.showInPlanning !== false,
          skills: (person.skills || []).map((s) => ({
            skillId: s.skillId || s.skill_id,
            level: s.level || 'intermédiaire',
          })),
          defaultPositions: (() => {
            try {
              const raw = person.defaultPositions || person.default_positions;
              return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
            } catch {
              return [];
            }
          })(),
        }
      : {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          type: 'permanent',
          contractType: '',
          userId: null,
          status: STATUS.ACTIVE,
          notes: '',
          skills: [],
          defaultPositions: [],
          showInPlanning: true,
        },
  );

  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    if (!person) {
      setEditForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        type: 'permanent',
        contractType: '',
        userId: null,
        status: STATUS.ACTIVE,
        notes: '',
        skills: [],
        defaultPositions: [],
        showInPlanning: true,
      });
    }
    onClose();
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        first_name: editForm.firstName,
        last_name: editForm.lastName,
        email: editForm.email || null,
        phone: editForm.phone || null,
        type: editForm.type,
        contract_type:
          editForm.type === 'contractuel' ? editForm.contractType || 'intermittent' : null,
        user_id: editForm.userId ? Number(editForm.userId) : null,
        status: editForm.status,
        notes: editForm.notes || null,
        default_positions: JSON.stringify(editForm.defaultPositions || []),
        show_in_planning: editForm.showInPlanning ? 1 : 0,
        skills: editForm.skills.map((s) => ({
          skill_id: s.skillId,
          level: s.level,
        })),
      };

      if (person) {
        await api.updatePerson(person.id, payload);
      } else {
        await api.createPerson(payload);
      }

      refreshBus.publish('persons');
      onSuccess?.();
      resetForm();
    } catch (err) {
      onError?.(err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEditSkill = (skillId) => {
    setEditForm((prev) => {
      const existing = prev.skills.find((s) => s.skillId === skillId);
      if (existing) {
        return { ...prev, skills: prev.skills.filter((s) => s.skillId !== skillId) };
      }
      return { ...prev, skills: [...prev.skills, { skillId, level: 'intermédiaire' }] };
    });
  };

  const updateEditSkillLevel = (skillId, level) => {
    setEditForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.skillId === skillId ? { ...s, level } : s)),
    }));
  };

  return (
    <>
      {open && (
        <ModalLayout
          open
          onClose={resetForm}
          title={
            <>
              <User size={20} /> {person ? 'Modifier la fiche' : 'Nouvelle personne'}
            </>
          }
          size="lg"
          className="personnel-edit-modal"
          footer={
            <>
              <div />
              <div className="right-actions">
                <Button variant="ghost" onClick={resetForm} disabled={submitting}>
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  form="personnel-edit-form"
                  disabled={submitting}
                >
                  <Save size={18} /> {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </>
          }
        >
          <form
            id="personnel-edit-form"
            className="personnel-edit-form-body"
            onSubmit={handleEditSubmit}
          >
            <div className="form-row">
              <FormField className="form-group" label="Prénom" required>
                <Input
                  required
                  maxLength={100}
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  disabled={submitting}
                />
              </FormField>
              <FormField className="form-group" label="Nom" required>
                <Input
                  required
                  maxLength={100}
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  disabled={submitting}
                />
              </FormField>
            </div>
            <div className="form-row">
              <FormField className="form-group" label="Email">
                <Input
                  type="email"
                  maxLength={254}
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  disabled={submitting}
                />
              </FormField>
              <FormField className="form-group" label="Téléphone">
                <PhoneInput
                  value={editForm.phone}
                  onChange={(val) => setEditForm({ ...editForm, phone: val })}
                  disabled={submitting}
                />
              </FormField>
            </div>
            <div className="form-row">
              <FormField className="form-group" label="Catégorie">
                <Select
                  value={editForm.type}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      type: e.target.value,
                      contractType: e.target.value === 'permanent' ? '' : editForm.contractType,
                    })
                  }
                  disabled={submitting}
                >
                  {PERSON_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              {editForm.type === 'contractuel' ? (
                <FormField className="form-group" label="Type de contrat">
                  <Select
                    value={editForm.contractType}
                    onChange={(e) => setEditForm({ ...editForm, contractType: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">-- Choisir --</option>
                    {CONTRACT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <FormField className="form-group" label="Statut">
                  <Select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                  </Select>
                </FormField>
              )}
            </div>
            {editForm.type === 'contractuel' && (
              <FormField className="form-group" label="Statut">
                <Select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  disabled={submitting}
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </Select>
              </FormField>
            )}
            <FormField className="form-group" label="Notes">
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                disabled={submitting}
              />
            </FormField>
            {['permanent', 'apprenti', 'stagiaire'].includes(editForm.type) && (
              <FormField className="form-group" label="Affichage dans planning">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <Input
                    type="checkbox"
                    checked={!!editForm.showInPlanning}
                    onChange={(e) => setEditForm({ ...editForm, showInPlanning: e.target.checked })}
                    disabled={submitting}
                  />
                  Visible dans la liste du planning
                </label>
              </FormField>
            )}
            <FormField className="form-group" label="Compétences">
              <div className="skills-selector">
                {skills.map((skill) => {
                  const selected = editForm.skills.find((s) => s.skillId === skill.id);
                  return (
                    <div
                      key={skill.id}
                      className={`skill-chip-select ${selected ? 'selected' : ''}`}
                    >
                      <Button
                        variant="ghost"
                        type="button"
                        className="skill-toggle"
                        onClick={() => toggleEditSkill(skill.id)}
                        style={{ '--chip-color': getCategoryColor(skill.category) }}
                        disabled={submitting}
                      >
                        {selected && <Check size={12} />} {skill.name}
                      </Button>
                      {selected && (
                        <Select
                          className="skill-level-select"
                          value={selected.level}
                          onChange={(e) => updateEditSkillLevel(skill.id, e.target.value)}
                          disabled={submitting}
                        >
                          {SKILL_LEVELS.map((l) => (
                            <option key={l.value} value={l.value}>
                              {l.label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </FormField>
            <FormField className="form-group" label="Postes habituels">
              <div className="skills-selector">
                {positions.map((pos) => {
                  const selected = editForm.defaultPositions.includes(pos.name);
                  const catColor =
                    POSITION_CATEGORIES.find((c) => c.value === pos.category)?.color ||
                    'var(--theme-text-gray)';
                  return (
                    <div key={pos.id} className={`skill-chip-select ${selected ? 'selected' : ''}`}>
                      <Button
                        variant="ghost"
                        type="button"
                        className="skill-toggle"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            defaultPositions: selected
                              ? prev.defaultPositions.filter((n) => n !== pos.name)
                              : [...prev.defaultPositions, pos.name],
                          }))
                        }
                        style={{ '--chip-color': catColor }}
                        disabled={submitting}
                      >
                        {selected && <Check size={12} />} {pos.name}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </FormField>
          </form>
        </ModalLayout>
      )}
    </>
  );
};

export default PersonnelPlanningEditModal;
