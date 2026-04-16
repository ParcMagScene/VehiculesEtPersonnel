import { EVENT_TYPE_COLORS, PLANNING_SECTIONS } from '../../constants/colors';
import { AFFAIRE_TYPE_INFO } from '../../utils/affaireConstants';

// ═══ Sections ═══
export const SECTIONS = {
  ...PLANNING_SECTIONS,
  manual: { ...PLANNING_SECTIONS.manual, color: 'var(--theme-text-secondary)' },
};

export const EVENT_SECTION_KEYS = ['rdv', 'evenements'];
export const OPS_SECTION_KEYS = Object.keys(SECTIONS).filter(
  (k) => !EVENT_SECTION_KEYS.includes(k),
);
export const EVENT_TYPES = EVENT_TYPE_COLORS;

// ═══ Mapping helpers ═══
export const mapEventToSection = (event) => {
  const type = event.type;
  const cat = event.category;
  if (type === 'preparation') {
    if (cat === 'location') return 'prep_locations';
    if (cat === 'prestation') return 'prep_prestations';
    if (cat === 'vente') return 'prep_ventes';
    if (cat === 'installation') return 'prep_installations';
    return 'prep_locations';
  }
  if (type === 'enlevement') return 'courses';
  if (type === 'depart') return 'depart';
  if (type === 'livraison') return 'courses';
  if (type === 'retour') return 'courses';
  if (type === 'recuperation') return 'courses';
  if (type === 'installation') return 'installation';
  if (type === 'montage') return 'montage';
  if (type === 'demontage') return 'demontage';
  return 'evenements';
};

export const mapAffaireToSection = (affaire) => {
  const info = AFFAIRE_TYPE_INFO[affaire.type];
  return info ? info.section : 'manual';
};

// ═══ Date utils ═══
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const getMonday = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getWeekDays = (dateStr) => {
  const monday = getMonday(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

// ═══ Normalisation des sections ═══
export const SECTION_ALIASES = {
  enlevement: 'courses',
  retour: 'courses',
  recuperation: 'courses',
};
export const normalizeSection = (sec) => SECTION_ALIASES[sec] || sec;

// ═══ Extraction numéro d'affaire ═══
export const extractAffaireNum = (text) => {
  if (!text) return null;
  const match = text.match(/\bAF\s*\d{3,}/i);
  return match ? match[0].toUpperCase().replace(/\s+/g, '') : null;
};

export const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
