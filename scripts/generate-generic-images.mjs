#!/usr/bin/env node
/**
 * Génère des images SVG placeholder pour le système d'images génériques.
 * Chaque image est un SVG propre avec couleur de fond, icône et label.
 * Usage: node scripts/generate-generic-images.mjs
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const BASE = join(dirname(new URL(import.meta.url).pathname), '..', 'public', 'Photos', 'Generic');

/** Définition de toutes les images à générer  */
const IMAGES = {
  structure: {
    color: '#ef4444', icon: '🏗️',
    items: [
      ['structure_carre_30', 'Carré Alu 30'],
      ['structure_carre_40', 'Carré Alu 40'],
      ['structure_carre_50', 'Carré Alu 50'],
      ['structure_triangle', 'Triangle'],
      ['structure_embase', 'Embase'],
      ['structure_manchon', 'Manchon'],
      ['structure_elingue_acier', 'Élingue Acier'],
      ['structure_elingue_ronde', 'Élingue Ronde'],
      ['structure_manille', 'Manille'],
      ['structure_chaine', 'Chaîne'],
    ],
  },
  levage: {
    color: '#f97316', icon: '⚙️',
    items: [
      ['moteur_250kg', 'Moteur 250kg'],
      ['moteur_500kg', 'Moteur 500kg'],
      ['moteur_1t', 'Moteur 1T'],
      ['palan_chaine', 'Palan à Chaîne'],
      ['poutre_levage', 'Poutre de Levage'],
      ['cable_moteur', 'Câble Moteur'],
    ],
  },
  son: {
    color: '#3b82f6', icon: '🔊',
    items: [
      ['enceinte_generique', 'Enceinte'],
      ['sub_generique', 'Subwoofer'],
      ['line_array_generique', 'Line Array'],
      ['console_generique', 'Console Son'],
      ['micro_hf', 'Micro HF'],
      ['micro_filaire', 'Micro Filaire'],
      ['di_box', 'DI Box'],
      ['cable_xlr', 'Câble XLR'],
      ['cable_speakon', 'Câble Speakon'],
      ['multipaire', 'Multipaire'],
    ],
  },
  lumiere: {
    color: '#f59e0b', icon: '💡',
    items: [
      ['par_led', 'PAR LED'],
      ['projecteur_led', 'Projecteur LED'],
      ['lyre_spot', 'Lyre Spot'],
      ['lyre_wash', 'Lyre Wash'],
      ['barre_led', 'Barre LED'],
      ['gradateur', 'Gradateur'],
      ['cable_dmx', 'Câble DMX'],
      ['cable_powercon', 'Câble PowerCon'],
    ],
  },
  video: {
    color: '#8b5cf6', icon: '🎥',
    items: [
      ['videoprojecteur', 'Vidéoprojecteur'],
      ['module_led', 'Module LED'],
      ['convertisseur_video', 'Convertisseur Vidéo'],
      ['cable_hdmi', 'Câble HDMI'],
      ['cable_sdi', 'Câble SDI'],
      ['cable_rj45', 'Câble RJ45'],
    ],
  },
  praticables: {
    color: '#ec4899', icon: '🎭',
    items: [
      ['praticable_1x1', 'Praticable 1×1'],
      ['praticable_2x1', 'Praticable 2×1'],
      ['praticable_2x2', 'Praticable 2×2'],
      ['pied_reglable', 'Pied Réglable'],
      ['garde_corps', 'Garde-Corps'],
      ['escalier_scene', 'Escalier Scène'],
    ],
  },
  accessoires: {
    color: '#6b7280', icon: '📦',
    items: [
      ['flightcase_generique', 'Flightcase'],
      ['flightcase_double', 'Flightcase Double'],
      ['flightcase_console', 'Flightcase Console'],
      ['outillage', 'Outillage'],
      ['securite', 'Sécurité / EPI'],
      ['coffret_electrique', 'Coffret Électrique'],
      ['rallonge_enrouleur', 'Rallonge / Enrouleur'],
    ],
  },
};

function generateSVG(label, icon, bgColor) {
  // Couleur de fond légèrement transparente + icône centrée + label en bas
  const darkBg = bgColor + '18'; // très léger
  const accentBg = bgColor + '30';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${darkBg}"/>
      <stop offset="100%" stop-color="${accentBg}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="16" fill="url(#bg)"/>
  <rect x="1" y="1" width="398" height="398" rx="15" fill="none" stroke="${bgColor}" stroke-width="2" stroke-opacity="0.3"/>
  <text x="200" y="180" text-anchor="middle" font-size="80" dominant-baseline="central">${icon}</text>
  <text x="200" y="280" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" fill="${bgColor}">${escapeXml(label)}</text>
  <text x="200" y="310" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#9ca3af">Image générique</text>
</svg>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let created = 0;
let skipped = 0;

for (const [folder, def] of Object.entries(IMAGES)) {
  const dir = join(BASE, folder);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  for (const [filename, label] of def.items) {
    const svgPath = join(dir, `${filename}.svg`);
    // Ne pas écraser les fichiers existants
    if (existsSync(svgPath)) {
      console.log(`  ⏭ Existe déjà : ${folder}/${filename}.svg`);
      skipped++;
      continue;
    }
    // Vérifier aussi si un .png existe déjà (pour ne pas doublonner)
    const pngPath = join(dir, `${filename}.png`);
    if (existsSync(pngPath)) {
      console.log(`  ⏭ PNG existe : ${folder}/${filename}.png`);
      skipped++;
      continue;
    }
    writeFileSync(svgPath, generateSVG(label, def.icon, def.color));
    console.log(`  ✅ ${folder}/${filename}.svg`);
    created++;
  }
}

console.log(`\n🎉 Terminé — ${created} images créées, ${skipped} ignorées (existantes)`);
