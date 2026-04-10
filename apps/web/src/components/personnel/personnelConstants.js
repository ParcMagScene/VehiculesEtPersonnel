// ═══════════════════════════════════════
// CONSTANTES PERSONNEL — Extraites de PersonnelPanel.jsx
// Partagées entre PersonnelPanel, PersonFormModal, PlanningTab, etc.
// ═══════════════════════════════════════

import { STATUS_COLORS, ACCENT_COLORS } from '../../constants/colors';

export const PERSON_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'salarié', label: 'Salarié' },
  { value: 'contractuel', label: 'Contractuel' },
  { value: 'stagiaire', label: 'Stagiaire' },
  { value: 'apprenti', label: 'Apprenti' },
];

export const CONTRACT_TYPES = [
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'CDD', label: 'CDD' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'prestataire', label: 'Prestataire' },
  { value: 'auto-entrepreneur', label: 'Auto-entrepreneur' },
  { value: 'entreprise', label: 'Entreprise' },
];

export const SKILL_CATEGORIES = [
  { value: 'son', label: 'Son', color: STATUS_COLORS.info },
  { value: 'lumière', label: 'Lumière', color: ACCENT_COLORS.amber },
  { value: 'vidéo', label: 'Vidéo', color: ACCENT_COLORS.violet },
  { value: 'plateau', label: 'Plateau', color: STATUS_COLORS.danger },
  { value: 'régie', label: 'Régie', color: ACCENT_COLORS.orange },
  { value: 'conduite', label: 'Conduite', color: ACCENT_COLORS.cyan },
  { value: 'logistique', label: 'Logistique', color: STATUS_COLORS.success },
  { value: 'autre', label: 'Autre', color: 'var(--theme-text-gray)' },
];

export const SKILL_LEVELS = [
  { value: 'débutant', label: 'Débutant' },
  { value: 'intermédiaire', label: 'Intermédiaire' },
  { value: 'confirmé', label: 'Confirmé' },
  { value: 'expert', label: 'Expert' },
];

export const POSITION_CATEGORIES = [
  { value: 'administratif', label: 'Administration & Direction', color: '#7c3aed' },
  { value: 'direction', label: 'Direction technique & Régie', color: STATUS_COLORS.dangerDark },
  { value: 'son', label: 'Son (Audio)', color: STATUS_COLORS.info },
  { value: 'lumiere', label: 'Lumière', color: ACCENT_COLORS.amber },
  { value: 'video', label: 'Vidéo & Média', color: ACCENT_COLORS.violet },
  { value: 'plateau', label: 'Plateau, Décors & Machinerie', color: STATUS_COLORS.danger },
  { value: 'backline', label: 'Backline', color: ACCENT_COLORS.orange },
  { value: 'costumes', label: 'Costumes, Maquillage & Habillage', color: ACCENT_COLORS.pink },
  { value: 'electricite', label: 'Électricité & Réseaux', color: ACCENT_COLORS.cyan },
  { value: 'logistique', label: 'Logistique & Transport', color: STATUS_COLORS.success },
  { value: 'captation', label: 'Audiovisuel & Captation', color: ACCENT_COLORS.indigo },
  { value: 'production', label: 'Production & Coordination', color: '#78716c' },
  { value: 'autre', label: 'Autre', color: 'var(--theme-text-gray)' },
];

export const PERMANENT_TYPES = ['permanent', 'stagiaire', 'apprenti'];
export const NON_PERMANENT_TYPES = ['salarié', 'contractuel'];

export const getCategoryColor = (category) => {
  return SKILL_CATEGORIES.find(c => c.value === category)?.color || 'var(--theme-text-gray)';
};

export const getPositionCategoryColor = (category) => {
  return POSITION_CATEGORIES.find(c => c.value === category)?.color || 'var(--theme-text-gray)';
};
