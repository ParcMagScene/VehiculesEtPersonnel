// ═══════════════════════════════════════
// CONSTANTES PERSONNEL — Extraites de PersonnelPanel.jsx
// Partagées entre PersonnelPanel, PersonFormModal, PlanningTab, etc.
// ═══════════════════════════════════════

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
  { value: 'son', label: 'Son', color: '#3b82f6' },
  { value: 'lumière', label: 'Lumière', color: '#eab308' },
  { value: 'vidéo', label: 'Vidéo', color: '#8b5cf6' },
  { value: 'plateau', label: 'Plateau', color: '#ef4444' },
  { value: 'régie', label: 'Régie', color: '#f97316' },
  { value: 'conduite', label: 'Conduite', color: '#06b6d4' },
  { value: 'logistique', label: 'Logistique', color: '#10b981' },
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
  { value: 'direction', label: 'Direction technique & Régie', color: '#dc2626' },
  { value: 'son', label: 'Son (Audio)', color: '#3b82f6' },
  { value: 'lumiere', label: 'Lumière', color: '#eab308' },
  { value: 'video', label: 'Vidéo & Média', color: '#8b5cf6' },
  { value: 'plateau', label: 'Plateau, Décors & Machinerie', color: '#ef4444' },
  { value: 'backline', label: 'Backline', color: '#f97316' },
  { value: 'costumes', label: 'Costumes, Maquillage & Habillage', color: '#ec4899' },
  { value: 'electricite', label: 'Électricité & Réseaux', color: '#06b6d4' },
  { value: 'logistique', label: 'Logistique & Transport', color: '#10b981' },
  { value: 'captation', label: 'Audiovisuel & Captation', color: '#6366f1' },
  { value: 'production', label: 'Production & Coordination', color: '#78716c' },
  { value: 'autre', label: 'Autre', color: 'var(--theme-text-gray)' },
];

export const PERMANENT_TYPES = ['permanent'];
export const NON_PERMANENT_TYPES = ['salarié', 'contractuel', 'stagiaire', 'apprenti'];

export const getCategoryColor = (category) => {
  return SKILL_CATEGORIES.find(c => c.value === category)?.color || 'var(--theme-text-gray)';
};

export const getPositionCategoryColor = (category) => {
  return POSITION_CATEGORIES.find(c => c.value === category)?.color || 'var(--theme-text-gray)';
};
