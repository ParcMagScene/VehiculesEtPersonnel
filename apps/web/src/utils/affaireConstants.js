/**
 * ═══ Constantes centralisées pour les Affaires ═══
 * Source unique de vérité pour types, couleurs, emojis et sections planning.
 */

import { STATUS_COLORS, ACCENT_COLORS } from '../constants/colors';

// ═══ Types d'affaire avec métadonnées ═══
export const AFFAIRE_TYPES = [
  { value: 'Prestation',   label: 'Prestation',   color: STATUS_COLORS.info, icon: '🎭' },
  { value: 'Location',     label: 'Location',     color: STATUS_COLORS.warning, icon: '🏗️' },
  { value: 'Installation', label: 'Installation', color: STATUS_COLORS.success, icon: '⚙️' },
  { value: 'Vente',        label: 'Vente',        color: ACCENT_COLORS.violet, icon: '💰' },
  { value: 'Tournée',      label: 'Tournée',      color: ACCENT_COLORS.pink, icon: '🚐' },
];

// ═══ Lookup rapide par valeur ═══
export const AFFAIRE_TYPE_MAP = Object.fromEntries(
  AFFAIRE_TYPES.map(t => [t.value, t])
);

/** Retourne les infos du type, ou Prestation par défaut */
export const getTypeInfo = (type) =>
  AFFAIRE_TYPE_MAP[type] || AFFAIRE_TYPES[0];

// ═══ Mapping type → section planning ═══
export const AFFAIRE_TYPE_SECTIONS = {
  'Location':     'prep_locations',
  'Prestation':   'prep_prestations',
  'Vente':        'prep_ventes',
  'Installation': 'prep_installations',
  'Tournée':      'prep_tournees',
};

// ═══ Info complète pour le planning (avec emoji + section) ═══
export const AFFAIRE_TYPE_INFO = Object.fromEntries(
  AFFAIRE_TYPES.map(t => [t.value, {
    label: t.label,
    emoji: t.icon,
    color: t.color,
    section: AFFAIRE_TYPE_SECTIONS[t.value] || 'manual',
  }])
);

/** Deviner le type d'affaire à partir d'un titre d'événement */
export function guessAffaireType(summary) {
  const s = (summary || '').toLowerCase();
  if (/tourn[eé]e/i.test(s)) return 'Tournée';
  if (/location/i.test(s) || /\bloc\b/.test(s)) return 'Location';
  if (/prestation|spectacle|concert|festival/i.test(s)) return 'Prestation';
  if (/vente|achat/i.test(s)) return 'Vente';
  if (/install/i.test(s)) return 'Installation';
  return '';
}

/** Extraire le numéro d'affaire d'un titre */
export function extractAffaireNumber(title) {
  if (!title) return null;
  const match = title.match(/\baf\s*(\d+)\b/i);
  return match ? `AF${match[1]}` : null;
}
