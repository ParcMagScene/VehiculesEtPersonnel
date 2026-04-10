// ═══════════════════════════════════════════════════════════════
// COULEURS CENTRALISÉES — eM@g
// Source unique de vérité pour toutes les couleurs sémantiques
// utilisées dans les composants JS/JSX.
//
// Les tokens CSS correspondants sont dans design/tokens.css.
// Ce fichier fournit les valeurs JS quand on ne peut pas utiliser
// var(--token) (inline styles dynamiques, chartes, PDF, etc.)
// ═══════════════════════════════════════════════════════════════

// ─── Couleurs de statut ─────────────────────────────────────
export const STATUS_COLORS = {
  success:     '#10b981',
  successSoft: '#22c55e',
  danger:      '#ef4444',
  dangerDark:  '#dc2626',
  warning:     '#f59e0b',
  warningDark: '#d97706',
  info:        '#3b82f6',
  infoDark:    '#2563eb',
  neutral:     '#64748b',
  neutralSoft: '#6b7280',
  pending:     '#f59e0b',
};

// ─── Couleurs accent ────────────────────────────────────────
export const ACCENT_COLORS = {
  violet:   '#8b5cf6',
  indigo:   '#6366f1',
  cyan:     '#06b6d4',
  cyanDark: '#0891b2',
  pink:     '#ec4899',
  orange:   '#f97316',
  amber:    '#eab308',
};

// ─── Palette avatars (UserAvatar, MobileMessaging, BPAnnotationViewer) ─
export const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#6366f1', '#f97316',
  '#14b8a6', '#a855f7', '#ef4444', '#84cc16',
];

// ─── Sections planning (partagé TaskPlanningPanel, AddTaskModal,
//     TaskPDFExportModal, DashboardTasksSidebar) ──────────────
export const PLANNING_SECTIONS = {
  rdv:                 { label: 'Rendez-vous',               emoji: '📅', color: '#059669' },
  evenements:          { label: 'Événements Google',         emoji: '📌', color: '#64748b' },
  taches_prioritaires: { label: 'Tâches Prioritaires',       emoji: '🔴', color: '#ef4444' },
  courses:             { label: 'Courses',                   emoji: '🚗', color: '#8b5cf6' },
  prep_locations:      { label: 'Préparations Locations',    emoji: '📦', color: '#f59e0b', affaireOnly: true },
  prep_prestations:    { label: 'Préparations Prestations',  emoji: '🎤', color: '#3b82f6', affaireOnly: true },
  prep_ventes:         { label: 'Préparations Ventes',       emoji: '🏷️', color: '#10b981', affaireOnly: true },
  prep_installations:  { label: 'Préparations Installations',emoji: '⚙️', color: '#8b5cf6', affaireOnly: true },
  prep_tournees:       { label: 'Préparations Tournées',     emoji: '🚐', color: '#ec4899', affaireOnly: true },
  chargement:          { label: 'Chargement',                emoji: '📦', color: '#f59e0b', affaireOnly: true },
  depart:              { label: 'Départ',                    emoji: '🚀', color: '#3b82f6', affaireOnly: true },
  installation:        { label: 'Installation',              emoji: '🛠️', color: '#10b981', affaireOnly: true },
  montage:             { label: 'Montage',                   emoji: '🔩', color: '#0891b2', affaireOnly: true },
  demontage:           { label: 'Démontage',                 emoji: '🔧', color: '#dc2626', affaireOnly: true },
  depot:               { label: 'Dépôt',                     emoji: '🏠', color: '#6366f1' },
  taches_secondaires:  { label: 'Tâches Secondaires',        emoji: '🟡', color: '#f59e0b' },
  manual:              { label: 'Autres',                    emoji: '📋', color: '#64748b' },
};

// ─── Types d'événement (planning) ───────────────────────────
export const EVENT_TYPE_COLORS = {
  preparation:  { label: 'Préparation',  emoji: '🔧', color: '#6366f1' },
  enlevement:   { label: 'Enlèvement',   emoji: '📦', color: '#f59e0b' },
  livraison:    { label: 'Livraison',     emoji: '🚚', color: '#10b981' },
  depart:       { label: 'Départ',        emoji: '🚀', color: '#3b82f6' },
  retour:       { label: 'Retour',        emoji: '↩️', color: '#8b5cf6' },
  recuperation: { label: 'Récupération',  emoji: '📥', color: '#ef4444' },
  montage:      { label: 'Montage',       emoji: '🔩', color: '#0891b2' },
  demontage:    { label: 'Démontage',     emoji: '🔧', color: '#dc2626' },
};

// ─── Couleurs confidence BL import ──────────────────────────
export const CONF_COLORS = {
  high:   '#10b981',
  medium: '#f59e0b',
  low:    '#ef4444',
};

// ─── Onglets annuaire ───────────────────────────────────────
export const ANNUAIRE_TAB_COLORS = {
  clients:      '#3b82f6',
  suppliers:    '#10b981',
  prestataires: '#8b5cf6',
  contacts:     '#f59e0b',
  lieux:        '#10b981',
  referentiels: '#64748b',
};

// ─── Helper: couleur de section par clé ─────────────────────
export const getSectionColor = (key) =>
  PLANNING_SECTIONS[key]?.color || STATUS_COLORS.neutral;
