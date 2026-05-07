// ╔══════════════════════════════════════════════════════════════════════╗
// ║  qrcodeGenerator.js — QR Code SVG avec logo Mag Scène centré          ║
// ╠══════════════════════════════════════════════════════════════════════╣
// ║  Service unifié pour la génération des QR codes stockés en DB         ║
// ║  (colonne `equipment.qrcode`) et utilisés dans les vues mobiles.      ║
// ║                                                                        ║
// ║  • ECC 'H' (~30%) → autorise le masquage central par le logo          ║
// ║  • SVG vectoriel → scalable, léger, embarquable dans <img src=...>    ║
// ║  • Logo Mag Scène (PNG) embarqué en base64 dans le <image href>       ║
// ║  • Sortie : data URL `data:image/svg+xml;base64,...`                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_PATH = path.resolve(__dirname, '../../../public/Logos/Logo_MAGSCENE_Noir_Crop.png');
const LOGO_RATIO = 0.22; // Largeur du logo / largeur du QR
const LOGO_BG_PADDING = 0.1; // Padding blanc autour du logo (fraction de la dim max)
const QUIET_ZONE_MODULES = 2; // Marge silencieuse autour des modules (en modules)

let __logoDataUriCache = null;
let __logoAspectCache = 1; // largeur / hauteur

function getLogoDataUri() {
  if (__logoDataUriCache !== null) return __logoDataUriCache;
  try {
    const buf = fs.readFileSync(LOGO_PATH);
    __logoDataUriCache = `data:image/png;base64,${buf.toString('base64')}`;
    // Lecture des dimensions PNG (signature 8 octets, IHDR à l'offset 16)
    if (buf.length > 24) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w > 0 && h > 0) __logoAspectCache = w / h;
    }
  } catch {
    __logoDataUriCache = ''; // Fallback : pas de logo, QR reste valide
  }
  return __logoDataUriCache;
}

/**
 * Génère un QR code SVG avec logo Mag Scène centré.
 *
 * @param {string} payload   Données à encoder (URL absolue recommandée)
 * @param {object} [opts]
 * @param {boolean} [opts.withLogo=true]  Embarquer le logo central
 * @returns {string} SVG complet (string)
 */
export function generateQrSvg(payload, { withLogo = true } = {}) {
  const qr = QRCode.create(String(payload || ' '), { errorCorrectionLevel: 'H' });
  const modules = qr.modules.size;
  const data = qr.modules.data;
  const total = modules + 2 * QUIET_ZONE_MODULES;

  // Modules sombres regroupés par lignes (rectangles fusionnés horizontalement)
  const rects = [];
  for (let row = 0; row < modules; row++) {
    let runStart = -1;
    for (let col = 0; col <= modules; col++) {
      const dark = col < modules && data[row * modules + col] === 1;
      if (dark && runStart === -1) runStart = col;
      if (!dark && runStart !== -1) {
        rects.push(
          `<rect x="${runStart + QUIET_ZONE_MODULES}" y="${row + QUIET_ZONE_MODULES}" width="${col - runStart}" height="1"/>`,
        );
        runStart = -1;
      }
    }
  }

  // Overlay logo central
  let logoSvg = '';
  if (withLogo) {
    const logoUri = getLogoDataUri();
    if (logoUri) {
      const logoW = total * LOGO_RATIO;
      const logoH = logoW / __logoAspectCache;
      const pad = Math.max(logoW, logoH) * LOGO_BG_PADDING;
      const bgW = logoW + 2 * pad;
      const bgH = logoH + 2 * pad;
      const bgX = (total - bgW) / 2;
      const bgY = (total - bgH) / 2;
      const logoX = (total - logoW) / 2;
      const logoY = (total - logoH) / 2;
      logoSvg =
        `<rect x="${bgX.toFixed(4)}" y="${bgY.toFixed(4)}" width="${bgW.toFixed(4)}" height="${bgH.toFixed(4)}" fill="#FFFFFF"/>` +
        `<image x="${logoX.toFixed(4)}" y="${logoY.toFixed(4)}" width="${logoW.toFixed(4)}" height="${logoH.toFixed(4)}" href="${logoUri}" preserveAspectRatio="xMidYMid meet"/>`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#FFFFFF"/>` +
    `<g fill="#000000">${rects.join('')}</g>` +
    logoSvg +
    `</svg>`
  );
}

/**
 * Génère un QR code et retourne un data URL prêt à stocker en DB
 * ou à utiliser dans `<img src="...">`.
 *
 * @param {string} payload
 * @param {object} [opts]  voir generateQrSvg
 * @returns {string}  `data:image/svg+xml;base64,...`
 */
export function generateQrDataUrl(payload, opts) {
  const svg = generateQrSvg(payload, opts);
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/**
 * Construit le payload canonique d'un équipement (URL absolue vers la fiche mobile).
 *
 * @param {string} uid    Ex: "EMAG-S00882"
 * @param {string} [base] Base URL publique (sans slash final). Défaut : env API_BASE_URL.
 * @returns {string}
 */
export function buildEquipmentQrPayload(uid, base) {
  const root = (base || process.env.API_BASE_URL || 'http://localhost:4173').replace(/\/+$/, '');
  return `${root}/#/mobile/equipment/${uid}`;
}
