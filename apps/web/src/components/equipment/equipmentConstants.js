import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';

export const EQUIPMENT_STATUS = {
  available: { label: 'Disponible', color: STATUS_COLORS.success, icon: '✅' },
  in_use: { label: 'En service', color: STATUS_COLORS.info, icon: '🔄' },
  maintenance: { label: 'En maintenance', color: STATUS_COLORS.warning, icon: '🔧' },
  retired: { label: 'Réformé', color: 'var(--theme-text-gray)', icon: '⛔' },
};

export const SAV_STATUS = {
  open: { label: 'Ouvert', color: STATUS_COLORS.danger },
  in_progress: { label: 'En cours', color: STATUS_COLORS.warning },
  waiting_parts: { label: 'Attente pièces', color: ACCENT_COLORS.violet },
  resolved: { label: 'Résolu', color: STATUS_COLORS.success },
  sortie_sav: { label: 'Sortie SAV', color: STATUS_COLORS.info },
  closed: { label: 'Clôturé', color: 'var(--theme-text-gray)' },
};

export const SAV_PRIORITY = {
  low: { label: 'Basse', color: 'var(--theme-text-gray)' },
  medium: { label: 'Moyenne', color: STATUS_COLORS.warning },
  high: { label: 'Haute', color: STATUS_COLORS.danger },
  urgent: { label: 'Urgente', color: STATUS_COLORS.dangerDark },
};

export const SAV_TYPES = {
  panne: 'Panne',
  entretien: 'Entretien',
  reparation: 'Réparation',
  calibrage: 'Calibrage',
};

export const cleanName = (s) => (s || '').replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"');

// URL publique de l'application pour les payloads QR (mobile).
// Priorité: VITE_PUBLIC_URL (build) > domaine prod par défaut.
// On n'utilise PAS window.location.origin afin que les QR générés en dev/LAN
// pointent quand même vers l'URL publique (Caddy + Let's Encrypt).
export const APP_BASE_URL = import.meta.env.VITE_PUBLIC_URL || 'https://magsav.duckdns.org';
