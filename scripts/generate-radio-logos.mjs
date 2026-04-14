#!/usr/bin/env node
/**
 * Génère des logos SVG pour les radios connues dans public/radio-logos/
 * Usage: node scripts/generate-radio-logos.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'radio-logos');
mkdirSync(OUT_DIR, { recursive: true });

// Couleurs distinctives par radio
const RADIOS = [
  { file: 'radiomeuh',       label: 'Radio\nMeuh',     bg: '#4CAF50', fg: '#fff' },
  { file: 'fip',             label: 'FIP',              bg: '#E91E63', fg: '#fff' },
  { file: 'franceinter',     label: 'France\nInter',    bg: '#1565C0', fg: '#fff' },
  { file: 'franceinfo',      label: 'france\ninfo',     bg: '#0D47A1', fg: '#FFB300' },
  { file: 'franceculture',   label: 'France\nCulture',  bg: '#880E4F', fg: '#fff' },
  { file: 'francemusique',   label: 'France\nMusique',  bg: '#AD1457', fg: '#fff' },
  { file: 'nova',            label: 'NOVA',             bg: '#000',    fg: '#FF5722' },
  { file: 'rtl',             label: 'RTL',              bg: '#01579B', fg: '#FFD600' },
  { file: 'nrj',             label: 'NRJ',              bg: '#000',    fg: '#FFD600' },
  { file: 'nostalgie',       label: 'Nostalgie',        bg: '#F57F17', fg: '#fff' },
  { file: 'rfm',             label: 'RFM',              bg: '#D32F2F', fg: '#fff' },
  { file: 'skyrock',         label: 'SKY\nROCK',        bg: '#000',    fg: '#00E5FF' },
  { file: 'cheriefm',        label: 'Chérie\nFM',       bg: '#C62828', fg: '#fff' },
  { file: 'rmc',             label: 'RMC',              bg: '#1A237E', fg: '#fff' },
  { file: 'europe1',         label: 'Europe\n1',        bg: '#0D47A1', fg: '#fff' },
  { file: 'tsfjazz',         label: 'TSF\nJazz',        bg: '#263238', fg: '#FFB74D' },
  { file: 'jazzradio',       label: 'Jazz\nRadio',      bg: '#1B5E20', fg: '#FFD54F' },
  { file: 'mouv',            label: "Mouv'",            bg: '#FF6F00', fg: '#000' },
  { file: 'ouifm',           label: 'OÜI\nFM',         bg: '#B71C1C', fg: '#fff' },
  { file: 'rtl2',            label: 'RTL2',             bg: '#FF8F00', fg: '#fff' },
  { file: 'virgin',          label: 'Virgin\nRadio',    bg: '#D50000', fg: '#fff' },
  { file: 'funradio',        label: 'FUN\nRADIO',       bg: '#F9A825', fg: '#000' },
  { file: 'rireetchansons',  label: 'Rire &\nChansons', bg: '#FF6D00', fg: '#fff' },
  { file: 'sudradio',        label: 'Sud\nRadio',       bg: '#1565C0', fg: '#F44336' },
];

function generateSVG({ label, bg, fg }) {
  const lines = label.split('\n');
  const fontSize = lines.some(l => l.length > 6) ? 22 : 28;
  const lineHeight = fontSize * 1.2;
  const startY = 60 - ((lines.length - 1) * lineHeight) / 2;

  const textElements = lines.map((line, i) =>
    `<text x="60" y="${startY + i * lineHeight}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fg}" text-anchor="middle" dominant-baseline="central">${escapeXml(line)}</text>`
  ).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="16" fill="${bg}"/>
  <circle cx="60" cy="60" r="50" fill="none" stroke="${fg}" stroke-opacity="0.15" stroke-width="2"/>
    ${textElements}
</svg>`;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let count = 0;
for (const radio of RADIOS) {
  const svg = generateSVG(radio);
  const filePath = join(OUT_DIR, `${radio.file}.svg`);
  writeFileSync(filePath, svg, 'utf8');
  count++;
}

console.log(`✅ ${count} logos SVG générés dans public/radio-logos/`);
