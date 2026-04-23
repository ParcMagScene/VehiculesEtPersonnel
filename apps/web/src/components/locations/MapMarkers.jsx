// ═══════════════════════════════════════════════════════════════
// MapMarkers.jsx — Markers SVG stylisés selon le design system eM@g
// ═══════════════════════════════════════════════════════════════

import L from 'leaflet';

import { getLocationType } from './map-utils';

/**
 * Crée un DivIcon Leaflet stylisé pour un type de lieu donné
 */
export function createLocationIcon(type, { size = 6, selected = false } = {}) {
  const config = getLocationType(type);
  const s = selected ? size + 2 : size;
  const canvas = Math.max(10, s + 4);
  const half = canvas / 2;
  const ring = selected ? 1.8 : 1.4;
  const shadowOpacity = selected ? 0.35 : 0.22;

  const html = `
    <svg width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}" xmlns="http://www.w3.org/2000/svg" class="map-marker-svg map-marker-dot">
      <defs>
        <filter id="shadow-${type.replace(/\s/g, '')}" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="0.5" stdDeviation="1.2" flood-color="${config.color}" flood-opacity="${shadowOpacity}" />
        </filter>
      </defs>
      <circle cx="${half}" cy="${half}" r="${s / 2}" fill="${config.color}" stroke="white" stroke-width="${ring}" filter="url(#shadow-${type.replace(/\s/g, '')})" />
    </svg>
  `;

  return L.divIcon({
    html,
    className: 'emag-map-marker',
    iconSize: [canvas, canvas],
    iconAnchor: [half, half],
    popupAnchor: [0, -10],
  });
}

/**
 * Icône spéciale pour le siège Mag Scène
 */
export function createHQIcon(size = 24) {
  const s = Math.max(8, size);
  const canvas = s + 4;
  const half = canvas / 2;
  const html = `
    <svg width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}" xmlns="http://www.w3.org/2000/svg" class="map-marker-svg map-marker-hq map-marker-dot">
      <defs>
        <linearGradient id="hq-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#667eea" />
          <stop offset="100%" stop-color="#764ba2" />
        </linearGradient>
        <filter id="shadow-hq" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="0.5" stdDeviation="1.2" flood-color="#667eea" flood-opacity="0.35" />
        </filter>
      </defs>
      <circle cx="${half}" cy="${half}" r="${s / 2}" fill="url(#hq-grad)" stroke="white" stroke-width="1.8" filter="url(#shadow-hq)" />
    </svg>
  `;

  return L.divIcon({
    html,
    className: 'emag-map-marker emag-map-marker-hq',
    iconSize: [canvas, canvas],
    iconAnchor: [half, half],
    popupAnchor: [0, -10],
  });
}
