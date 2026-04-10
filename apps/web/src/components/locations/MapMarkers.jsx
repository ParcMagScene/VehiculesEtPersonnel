// ═══════════════════════════════════════════════════════════════
// MapMarkers.jsx — Markers SVG stylisés selon le design system eM@g
// ═══════════════════════════════════════════════════════════════

import L from 'leaflet';
import { getLocationType } from './map-utils';

/**
 * Crée un DivIcon Leaflet stylisé pour un type de lieu donné
 */
export function createLocationIcon(type, { size = 36, selected = false } = {}) {
  const config = getLocationType(type);
  const s = selected ? size + 8 : size;
  const half = s / 2;
  const shadowBlur = selected ? 8 : 4;
  const shadowOpacity = selected ? 0.4 : 0.2;
  const strokeWidth = selected ? 2.5 : 1.5;
  const scale = (s - 12) / 24; // Échelle pour l'icône interne (path basé sur viewBox 24x24)

  const html = `
    <svg width="${s}" height="${s + 8}" viewBox="0 0 ${s} ${s + 8}" xmlns="http://www.w3.org/2000/svg" class="map-marker-svg">
      <defs>
        <filter id="shadow-${type.replace(/\s/g, '')}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="${shadowBlur / 2}" flood-color="${config.color}" flood-opacity="${shadowOpacity}" />
        </filter>
      </defs>
      <!-- Marqueur goutte -->
      <path d="M${half} ${s + 4} C${half} ${s + 4} ${s - 2} ${half + 4} ${s - 2} ${half - 2} A${half - 2} ${half - 2} 0 1 0 2 ${half - 2} C2 ${half + 4} ${half} ${s + 4} ${half} ${s + 4}Z"
        fill="${config.color}" stroke="white" stroke-width="${strokeWidth}"
        filter="url(#shadow-${type.replace(/\s/g, '')})" />
      <!-- Cercle intérieur blanc -->
      <circle cx="${half}" cy="${half - 2}" r="${half * 0.42}" fill="white" opacity="0.9" />
      <!-- Icône SVG interne -->
      <g transform="translate(${half - scale * 12}, ${half - 2 - scale * 12}) scale(${scale})"
         fill="none" stroke="${config.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="${config.iconPath}" />
      </g>
    </svg>
  `;

  return L.divIcon({
    html,
    className: 'emag-map-marker',
    iconSize: [s, s + 8],
    iconAnchor: [half, s + 8],
    popupAnchor: [0, -(s + 4)],
  });
}

/**
 * Icône spéciale pour le siège Mag Scène
 */
export function createHQIcon(size = 44) {
  const half = size / 2;
  const html = `
    <svg width="${size}" height="${size + 10}" viewBox="0 0 ${size} ${size + 10}" xmlns="http://www.w3.org/2000/svg" class="map-marker-svg map-marker-hq">
      <defs>
        <linearGradient id="hq-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#667eea" />
          <stop offset="100%" stop-color="#764ba2" />
        </linearGradient>
        <filter id="shadow-hq" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#667eea" flood-opacity="0.45" />
        </filter>
      </defs>
      <path d="M${half} ${size + 6} C${half} ${size + 6} ${size - 2} ${half + 4} ${size - 2} ${half - 2} A${half - 2} ${half - 2} 0 1 0 2 ${half - 2} C2 ${half + 4} ${half} ${size + 6} ${half} ${size + 6}Z"
        fill="url(#hq-grad)" stroke="white" stroke-width="2.5"
        filter="url(#shadow-hq)" />
      <circle cx="${half}" cy="${half - 2}" r="${half * 0.42}" fill="white" opacity="0.95" />
      <text x="${half}" y="${half + 2}" text-anchor="middle" font-size="${size * 0.32}" font-weight="700" fill="#667eea" font-family="system-ui, sans-serif">⭐</text>
    </svg>
  `;

  return L.divIcon({
    html,
    className: 'emag-map-marker emag-map-marker-hq',
    iconSize: [size, size + 10],
    iconAnchor: [half, size + 10],
    popupAnchor: [0, -(size + 6)],
  });
}
