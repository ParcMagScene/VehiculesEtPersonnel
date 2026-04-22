// ═══════════════════════════════════════════════════════════════
// map-utils.js — Constantes et helpers pour le module cartographie
// ═══════════════════════════════════════════════════════════════

import { STATUS_COLORS } from '../../constants/colors';

/** Centre de Mag Scène */
export const MAG_SCENE = [45.4303156, 4.3728596];

/** Rayon par défaut autour du dépôt (en mètres) */
export const LOCAL_RADIUS = 2000;

/** Zoom par défaut pour la carte locale */
export const LOCAL_ZOOM = 14;

/** Zoom par défaut pour la carte générale (fallback) */
export const DEFAULT_ZOOM = 6;

/** Padding pour fitBounds (en pixels) */
export const BOUNDS_PADDING = [40, 40];

/** Tiles OpenStreetMap — mode clair */
export const TILE_LIGHT = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

/** Tiles mode sombre (CartoDB dark matter) */
export const TILE_DARK = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
};

/**
 * Configuration des types de lieux — couleurs et icônes
 * Les couleurs utilisent les tokens DS quand possible.
 */
export const LOCATION_TYPES = {
  Dépôt: {
    color: STATUS_COLORS.successSoft,
    label: 'Dépôt',
    iconPath: 'M3 21V8l9-5 9 5v13H3z M9 21v-6h6v6',
  },
  'Salle de spectacle': {
    color: STATUS_COLORS.info,
    label: 'Salle de spectacle',
    iconPath: 'M2 16s0-6 4-6 4 6 4 6 4 0 4-6 4-6 4 6h0 M12 4v4 M10 2h4',
  },
  Prestataire: {
    color: STATUS_COLORS.warning,
    label: 'Prestataire',
    iconPath:
      'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M22 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  },
  Garage: {
    color: STATUS_COLORS.danger,
    label: 'Garage',
    iconPath:
      'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  },
  Autre: {
    color: '#94a3b8',
    label: 'Autre',
    iconPath: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z',
  },
};

/**
 * Retourne la config du type de lieu, avec fallback sur "Autre"
 */
export function getLocationType(type) {
  return LOCATION_TYPES[type] || LOCATION_TYPES['Autre'];
}

/**
 * Calcul de distance Haversine entre deux points (en mètres)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // rayon Terre en mètres
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filtre les lieux ayant des coordonnées valides
 */
function parseCoordinate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function filterGeoLocations(locations) {
  return (locations || []).reduce((acc, loc) => {
    const lat = parseCoordinate(loc.lat);
    const lng = parseCoordinate(loc.lng);
    if (lat == null || lng == null) return acc;
    acc.push({ ...loc, lat, lng });
    return acc;
  }, []);
}

/**
 * Filtre les lieux dans un rayon donné autour d'un centre
 */
export function filterNearby(locations, center, radiusMeters) {
  return filterGeoLocations(locations).filter(
    (loc) => haversineDistance(center[0], center[1], loc.lat, loc.lng) <= radiusMeters,
  );
}
