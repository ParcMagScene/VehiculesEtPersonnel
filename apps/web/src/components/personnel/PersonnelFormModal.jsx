import { Check, Link2 } from 'lucide-react';
import { useState } from 'react';

import { Button, FormField, Input, ModalLayout, Select, Textarea } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useToast } from '../../hooks/useToast';
import PhoneInput from '../PhoneInput';
import {
  CONTRACT_TYPES,
  getCategoryColor,
  PERSON_TYPES,
  POSITION_CATEGORIES,
  SKILL_LEVELS,
} from './personnelConstants';

// ═══════════════════════════════════════
// Modal formulaire personnel
// ═══════════════════════════════════════

export const PersonnelFormModal = ({
  person,
  skills,
  positions,
  users,
  currentUser,
  onSave,
  onClose,
}) => {
  const isAdmin = !!currentUser?.isAdmin;
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [showAnnuaire, setShowAnnuaire] = useState(false);
  const [form, setForm] = useState(() => {
    let defaultPos = [];
    if (person) {
      try {
        const raw = person.defaultPositions || person.default_positions;
        defaultPos = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      } catch {
        /* ignore */
      }
    }
    return {
      firstName: person?.firstName || '',
      lastName: person?.lastName || '',
      email: person?.email || '',
      phone: person?.phone || '',
      type: person?.type || 'permanent',
      contractType: person?.contractType || '',
      userId: person?.userId || null,
      status: person?.status || 'active',
      notes: person?.notes || '',
      skills: (person?.skills || []).map((s) => ({
        skillId: s.skillId || s.skill_id,
        level: s.level || 'intermédiaire',
      })),
      defaultPositions: defaultPos,
      // ── Annuaire étendu ──
      address: person?.address || '',
      postalCode: person?.postalCode || person?.postal_code || '',
      city: person?.city || '',
      country: person?.country || 'France',
      phonePersonal: person?.phonePersonal || person?.phone_personal || '',
      personalEmail: person?.personalEmail || person?.personal_email || '',
      birthDate: person?.birthDate || person?.birth_date || '',
      emergencyContactName: person?.emergencyContactName || person?.emergency_contact_name || '',
      emergencyContactPhone: person?.emergencyContactPhone || person?.emergency_contact_phone || '',
      emergencyContactRelation:
        person?.emergencyContactRelation || person?.emergency_contact_relation || '',
      linkedinUrl: person?.linkedinUrl || person?.linkedin_url || '',
      // Sensibles — admin only.
      socialSecurityNumber: person?.socialSecurityNumber || person?.social_security_number || '',
      iban: person?.iban || '',
      hrNotes: person?.hrNotes || person?.hr_notes || '',
    };
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim())
      return toast.warning('Prénom et nom requis');
    const payload = {
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email || null,
      phone: form.phone || null,
      type: form.type,
      contract_type: form.type === 'contractuel' ? form.contractType || 'intermittent' : null,
      user_id: form.userId ? Number(form.userId) : null,
      status: form.status,
      notes: form.notes || null,
      default_positions: JSON.stringify(form.defaultPositions || []),
      skills: form.skills.map((s) => ({ skill_id: s.skillId, level: s.level })),
      // Annuaire
      address: form.address || null,
      postal_code: form.postalCode || null,
      city: form.city || null,
      country: form.country || null,
      phone_personal: form.phonePersonal || null,
      personal_email: form.personalEmail || null,
      birth_date: form.birthDate || null,
      emergency_contact_name: form.emergencyContactName || null,
      emergency_contact_phone: form.emergencyContactPhone || null,
      emergency_contact_relation: form.emergencyContactRelation || null,
      linkedin_url: form.linkedinUrl || null,
    };
    if (isAdmin) {
      payload.social_security_number = form.socialSecurityNumber || null;
      payload.iban = form.iban || null;
      payload.hr_notes = form.hrNotes || null;
    }
    resetDirty();
    onSave(payload);
  };

  const toggleSkill = (skillId) => {
    setForm((prev) => {
      const existing = prev.skills.find((s) => s.skillId === skillId);
      if (existing) return { ...prev, skills: prev.skills.filter((s) => s.skillId !== skillId) };
      return { ...prev, skills: [...prev.skills, { skillId, level: 'intermédiaire' }] };
    });
  };

  const updateSkillLevel = (skillId, level) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.skillId === skillId ? { ...s, level } : s)),
    }));
  };

  const { resetDirty, guardClose } = useDirtyForm(form, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

  return (
    <>
      <ModalLayout
        open
        onClose={handleSafeClose}
        title={person ? '✏️ Modifier la fiche' : '➕ Nouvelle personne'}
        size="lg"
        className="eq-modal pp-form-modal"
        footer={
          <>
            <Button variant="ghost" onClick={handleSafeClose}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" form="person-form">
              {person ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <form id="person-form" onSubmit={handleSubmit} className="eq-modal-body">
          <div className="eq-form-grid">
            <FormField className="eq-form-field" label="Prénom" required>
              <Input
                type="text"
                required
                maxLength={100}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                autoFocus
              />
            </FormField>
            <FormField className="eq-form-field" label="Nom" required>
              <Input
                type="text"
                required
                maxLength={100}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </FormField>
            <FormField className="eq-form-field" label="Email">
              <Input
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>
            <FormField className="eq-form-field" label="Téléphone">
              <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
            </FormField>
            <FormField className="eq-form-field" label="Catégorie">
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                    contractType: e.target.value !== 'contractuel' ? '' : form.contractType,
                  })
                }
              >
                {PERSON_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </FormField>
            {form.type === 'contractuel' && (
              <FormField className="eq-form-field" label="Type de contrat">
                <Select
                  value={form.contractType}
                  onChange={(e) => setForm({ ...form, contractType: e.target.value })}
                >
                  <option value="">— Choisir —</option>
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField className="eq-form-field" label="Statut">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </Select>
            </FormField>
            <FormField
              className="eq-form-field"
              label={
                <>
                  <Link2 size={14} /> Compte utilisateur
                </>
              }
            >
              <Select
                value={form.userId || ''}
                onChange={(e) => setForm({ ...form, userId: e.target.value || null })}
              >
                <option value="">Aucun (non lié)</option>
                {(users || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email || `Utilisateur #${u.id}`}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField className="eq-form-field eq-form-full" label="Notes">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>

            {/* Annuaire — coordonnées étendues + contact d'urgence (+ RH si admin) */}
            <div className="eq-form-field eq-form-full">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowAnnuaire((v) => !v)}
                aria-expanded={showAnnuaire}
              >
                {showAnnuaire ? '▾' : '▸'} Annuaire — coordonnées & contact d'urgence
                {isAdmin ? ' (+ RH)' : ''}
              </Button>
            </div>
            {showAnnuaire && (
              <>
                <FormField className="eq-form-field eq-form-full" label="Adresse">
                  <Input
                    type="text"
                    maxLength={500}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Code postal">
                  <Input
                    type="text"
                    maxLength={10}
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Ville">
                  <Input
                    type="text"
                    maxLength={100}
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Pays">
                  <Input
                    type="text"
                    maxLength={100}
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Date de naissance">
                  <Input
                    type="date"
                    value={form.birthDate || ''}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Téléphone personnel">
                  <PhoneInput
                    value={form.phonePersonal}
                    onChange={(val) => setForm({ ...form, phonePersonal: val })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Email personnel">
                  <Input
                    type="email"
                    maxLength={254}
                    value={form.personalEmail}
                    onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="LinkedIn">
                  <Input
                    type="url"
                    maxLength={500}
                    placeholder="https://linkedin.com/in/…"
                    value={form.linkedinUrl}
                    onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Contact d'urgence — Nom">
                  <Input
                    type="text"
                    maxLength={255}
                    value={form.emergencyContactName}
                    onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Contact d'urgence — Téléphone">
                  <PhoneInput
                    value={form.emergencyContactPhone}
                    onChange={(val) => setForm({ ...form, emergencyContactPhone: val })}
                  />
                </FormField>
                <FormField className="eq-form-field" label="Contact d'urgence — Lien">
                  <Input
                    type="text"
                    maxLength={100}
                    placeholder="Conjoint, parent, ami…"
                    value={form.emergencyContactRelation}
                    onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                  />
                </FormField>
                {isAdmin && (
                  <>
                    <FormField
                      className="eq-form-field eq-form-full"
                      label="🔒 N° Sécurité sociale (admin)"
                    >
                      <Input
                        type="text"
                        maxLength={30}
                        autoComplete="off"
                        value={form.socialSecurityNumber}
                        onChange={(e) => setForm({ ...form, socialSecurityNumber: e.target.value })}
                      />
                    </FormField>
                    <FormField className="eq-form-field eq-form-full" label="🔒 IBAN (admin)">
                      <Input
                        type="text"
                        maxLength={40}
                        autoComplete="off"
                        value={form.iban}
                        onChange={(e) => setForm({ ...form, iban: e.target.value })}
                      />
                    </FormField>
                    <FormField className="eq-form-field eq-form-full" label="🔒 Notes RH (admin)">
                      <Textarea
                        rows={3}
                        value={form.hrNotes}
                        onChange={(e) => setForm({ ...form, hrNotes: e.target.value })}
                      />
                    </FormField>
                  </>
                )}
              </>
            )}

            {/* Compétences */}
            <div className="eq-form-field eq-form-full">
              <div className="ui-form-label">Compétences</div>
              <div className="skills-selector">
                {skills.map((skill) => {
                  const selected = form.skills.find((s) => s.skillId === skill.id);
                  return (
                    <div
                      key={skill.id}
                      className={`skill-chip-select ${selected ? 'selected' : ''}`}
                    >
                      <Button
                        variant="ghost"
                        type="button"
                        className="skill-toggle"
                        onClick={() => toggleSkill(skill.id)}
                        style={{ '--chip-color': getCategoryColor(skill.category) }}
                      >
                        {selected && <Check size={12} />} {skill.name}
                      </Button>
                      {selected && (
                        <Select
                          className="skill-level-select"
                          value={selected.level}
                          onChange={(e) => updateSkillLevel(skill.id, e.target.value)}
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
            </div>

            {/* Postes habituels */}
            <div className="eq-form-field eq-form-full">
              <div className="ui-form-label">Postes habituels</div>
              <div className="skills-selector">
                {positions.map((pos) => {
                  const selected = form.defaultPositions.includes(pos.name);
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
                          setForm((prev) => ({
                            ...prev,
                            defaultPositions: selected
                              ? prev.defaultPositions.filter((n) => n !== pos.name)
                              : [...prev.defaultPositions, pos.name],
                          }))
                        }
                        style={{ '--chip-color': catColor }}
                      >
                        {selected && <Check size={12} />} {pos.name}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </form>
      </ModalLayout>
      {ConfirmDialogRenderer}
    </>
  );
};

export default PersonnelFormModal;
