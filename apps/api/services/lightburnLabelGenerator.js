// ═══════════════════════════════════════════════════════════════
// apps/api/services/lightburnLabelGenerator.js
//
// Générateur SVG strictement compatible LightBurn pour gravure sur
// aluminium anodisé noir.
//
//   • 3 calques nommés (Inkscape labels) :
//       1. QR_IMAGE   → uniquement <image> PNG (QR + logo fusionnés)
//       2. TEXT_FILL  → uniquement <text> noir (UID, S/N, MAG)
//       3. FRAME_LINE → uniquement <rect> stroke noir (cadre)
//   • Aucune transparence, aucun filtre, aucun masque, aucun clipPath.
//   • Couleurs : strictement #000000 et #FFFFFF.
//   • QR + logo : PNG raster (via pngjs) embarqué en base64.
//   • Plaque : 200×200 mm — 4 col × 8 lignes = 32 étiquettes 50×25 mm.
//   • Marges externes : 5 mm. Espacement : 1 mm.
//
// ⚠  Sur anodisé noir : noir = couche conservée, blanc = laser grave.
//    Donc QR noir/blanc = lecture correcte (jamais inversé).
// ═══════════════════════════════════════════════════════════════

import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Constantes LightBurn ───────────────────────────────────────────
export const LB_PLATE_W = 200; // mm
export const LB_PLATE_H = 200; // mm
export const LB_PLATE_MARGIN = 5; // mm
export const LB_COL_GAP = 1; // mm
export const LB_ROW_GAP = 1; // mm
export const LB_COLS = 4;
export const LB_ROWS = 8;
export const LB_LABEL_W = 50; // mm
export const LB_LABEL_H = 25; // mm  (utiliser 33.33 pour spec alternative)
export const LB_QR_SIZE = 25; // mm  (QR carré, prend toute la hauteur étiquette)
export const LB_QR_QUIET_MM = 2.5; // mm — quiet zone à l'intérieur du PNG QR

// Résolution PNG : 600 DPI ⇒ 25mm × 23.622 px/mm ≈ 590 px. On force 600 px
// pour avoir un multiple confortable et un rendu net en pixelated.
const LB_PNG_PX = 600;

// ─── Logo source ────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.resolve(__dirname, '../../../public/Logos/Logo_MAGSCENE_Noir_Crop.png');
let __logoCache = null; // { width, height, data:Uint8Array RGBA }

function loadLogo() {
  if (__logoCache !== null) return __logoCache;
  try {
    const buf = fs.readFileSync(LOGO_PATH);
    const png = PNG.sync.read(buf);
    __logoCache = { width: png.width, height: png.height, data: png.data };
  } catch {
    __logoCache = null; // logo absent → aucun overlay (QR reste valide)
  }
  return __logoCache;
}

// ─── Helpers ────────────────────────────────────────────────────────
function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Compose un PNG carré contenant : QR + logo central avec fond noir.
 *
 * Convention couleurs PNG (correspondance gravure anodisé noir) :
 *   • #000000 (noir)  → couche anodisée conservée
 *   • #FFFFFF (blanc) → laser grave (alu apparent)
 *
 * Le logo est BINARISÉ depuis la source `Logo_MAGSCENE_Noir_Crop.png` puis
 * INVERSÉ : pixels sombres du logo source → blanc (gravé) ; pixels clairs/
 * transparents → noir (non gravé). Résultat : motif clair sur carré noir,
 * parfaitement visible après gravure.
 *
 * @param {string} qrValue       Donnée à encoder
 * @param {object} [opts]
 * @param {number} [opts.sizePx] Côté du PNG (px). Défaut 600.
 * @param {number} [opts.quietRatio] Quiet zone en fraction du PNG. Défaut 0.10.
 * @param {number} [opts.logoRatio]  Côté du carré logo en fraction du PNG. Défaut 0.22.
 * @returns {string} data URI `data:image/png;base64,…`
 */
export function buildQrLogoPng(qrValue, opts = {}) {
  const sizePx = Math.max(64, Math.floor(opts.sizePx ?? LB_PNG_PX));
  const quietRatio = opts.quietRatio ?? LB_QR_QUIET_MM / LB_QR_SIZE; // 2.5/25 = 0.10
  const logoRatio = opts.logoRatio ?? 0.22;

  // 1) Génération matrice QR (ECC H pour tolérer le masque logo central).
  const qr = QRCode.create(String(qrValue || ' '), { errorCorrectionLevel: 'H' });
  const modules = qr.modules.size;
  const data = qr.modules.data; // Uint8Array : 1 = dark module

  // 2) Création du canvas PNG (RGBA, fond blanc).
  const png = new PNG({ width: sizePx, height: sizePx });
  const buf = png.data;
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = 255; // R
    buf[i + 1] = 255; // G
    buf[i + 2] = 255; // B
    buf[i + 3] = 255; // A (jamais transparent)
  }

  // 3) Calcul de la zone QR (en pixels) avec quiet zone interne.
  const quietPx = Math.round(sizePx * quietRatio);
  const qrAreaPx = sizePx - 2 * quietPx;
  const cellPx = qrAreaPx / modules; // peut être fractionnel
  const offX = quietPx;
  const offY = quietPx;

  // 4) Peinture des modules noirs.
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (data[row * modules + col] !== 1) continue;
      const x0 = Math.floor(offX + col * cellPx);
      const y0 = Math.floor(offY + row * cellPx);
      const x1 = Math.floor(offX + (col + 1) * cellPx);
      const y1 = Math.floor(offY + (row + 1) * cellPx);
      for (let y = y0; y < y1; y++) {
        const rowOff = y * sizePx * 4;
        for (let x = x0; x < x1; x++) {
          const i = rowOff + x * 4;
          buf[i] = 0;
          buf[i + 1] = 0;
          buf[i + 2] = 0;
          buf[i + 3] = 255;
        }
      }
    }
  }

  // 5) Overlay logo (carré central noir + motif logo en blanc).
  const logo = loadLogo();
  const logoPx = Math.floor(sizePx * logoRatio);
  const lx = Math.floor((sizePx - logoPx) / 2);
  const ly = Math.floor((sizePx - logoPx) / 2);

  // 5a) Remplir d'abord le carré central en NOIR (efface les modules QR sous-jacents).
  for (let y = ly; y < ly + logoPx; y++) {
    const rowOff = y * sizePx * 4;
    for (let x = lx; x < lx + logoPx; x++) {
      const i = rowOff + x * 4;
      buf[i] = 0;
      buf[i + 1] = 0;
      buf[i + 2] = 0;
      buf[i + 3] = 255;
    }
  }

  // 5b) Dessiner le logo binarisé+inversé en BLANC sur ce carré noir.
  if (logo) {
    // Préserve le ratio du logo dans le carré disponible.
    const aspect = logo.width / logo.height;
    let drawW = logoPx;
    let drawH = logoPx;
    if (aspect >= 1) drawH = Math.floor(logoPx / aspect);
    else drawW = Math.floor(logoPx * aspect);
    const dx = Math.floor((sizePx - drawW) / 2);
    const dy = Math.floor((sizePx - drawH) / 2);

    // Nearest-neighbor + binarisation (luminance < 128 = pixel "logo" → blanc gravé).
    for (let y = 0; y < drawH; y++) {
      const sy = Math.min(logo.height - 1, Math.floor((y * logo.height) / drawH));
      const dstRow = (dy + y) * sizePx * 4;
      const srcRow = sy * logo.width * 4;
      for (let x = 0; x < drawW; x++) {
        const sx = Math.min(logo.width - 1, Math.floor((x * logo.width) / drawW));
        const si = srcRow + sx * 4;
        const r = logo.data[si];
        const g = logo.data[si + 1];
        const b = logo.data[si + 2];
        const a = logo.data[si + 3];
        if (a < 128) continue; // pixel transparent → garde fond noir
        const lum = (r * 299 + g * 587 + b * 114) / 1000;
        if (lum < 128) {
          // pixel sombre du logo source → on l'AFFICHE en blanc (= gravé)
          const di = dstRow + (dx + x) * 4;
          buf[di] = 255;
          buf[di + 1] = 255;
          buf[di + 2] = 255;
          buf[di + 3] = 255;
        }
        // sinon (pixel clair du logo) → reste noir (fond du carré)
      }
    }
  }

  // 6) Encode + base64.
  const out = PNG.sync.write(png);
  return `data:image/png;base64,${out.toString('base64')}`;
}

/**
 * Génère le contenu interne (3 calques) d'une étiquette LightBurn.
 * À insérer dans un <g transform="translate(x,y)"> dans la plaque,
 * ou comme racine de buildLightburnLabelSvg().
 *
 * Layout : QR 25×25 mm à gauche, texte à droite, cadre 0.1 mm autour.
 *
 * @param {object} item   { uid, serial, magNumber, qrPayload }
 * @param {number} labelW mm
 * @param {number} labelH mm
 * @returns {string} SVG fragment (3 groupes nommés)
 */
export function buildLightburnLabelInner(item, labelW = LB_LABEL_W, labelH = LB_LABEL_H) {
  const qrSize = Math.min(LB_QR_SIZE, labelH); // QR carré, hauteur max = labelH
  const qrX = 0;
  const qrY = (labelH - qrSize) / 2;

  // Texte à droite du QR.
  const textX = qrSize + 2; // 2 mm de marge entre QR et texte
  const textW = labelW - textX - 1;

  const uid = String(item.uid || '').trim();
  const serial = String(item.serial || '').trim();
  const mag = String(item.magNumber || '').trim();

  // Police sans-serif uniquement (DejaVu Sans = Liberation Sans clone, dispo
  // par défaut sur Linux/Inkscape/LightBurn). Pour LightBurn, on garde du
  // texte (pas de paths) — la conversion en paths se fera via "Convert to
  // Path" dans LightBurn si l'opérateur le souhaite.
  const FONT = "'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif";
  const FS_UID_BASE = 2.8;
  const FS_SN_BASE = 2.5;
  const FS_MAG_BASE = 4.5;
  const FS_MIN = 1.6;
  const CHAR_RATIO = 0.6; // un peu généreux pour bold + fallback DejaVu Sans

  // Auto-shrink : on réduit la taille de police pour tenir dans textW
  // sans dépendre de textLength (que rsvg / LightBurn peuvent ignorer).
  // Renvoie un fragment <text> avec textLength en backup.
  const renderText = (str, y, fsBase, weight = 400) => {
    if (!str) return { svg: '', fs: 0 };
    const estW = str.length * CHAR_RATIO * fsBase;
    let fs = fsBase;
    if (estW > textW) fs = Math.max(FS_MIN, textW / (str.length * CHAR_RATIO));
    const targetW = Math.min(str.length * CHAR_RATIO * fs, textW);
    const svg = `<text x="${textX.toFixed(3)}" y="${y.toFixed(3)}" font-family="${FONT}" font-size="${fs.toFixed(2)}" font-weight="${weight}" fill="#000000" textLength="${targetW.toFixed(3)}" lengthAdjust="spacingAndGlyphs">${xmlEscape(str)}</text>`;
    return { svg, fs };
  };

  // Pré-calcul des tailles effectives pour positionner les baselines.
  const uidStr = uid ? `UID: ${uid}` : '';
  const snStr = serial ? `SN: ${serial}` : '';
  const magStr = mag ? `MAG: ${mag}` : '';

  // Disposition verticale (baselines en mm depuis le haut) :
  //   bloc haut  : UID puis SN (collés en haut)
  //   bloc bas   : MAG (gros, collé en bas)
  const TOP_PAD = 3.5;
  const LH = 1.4;
  const uidR = renderText(uidStr, TOP_PAD, FS_UID_BASE, 600);
  const snBaselineY = TOP_PAD + (uidR.fs || FS_UID_BASE) + LH * 0.5;
  const snR = renderText(snStr, snBaselineY, FS_SN_BASE, 400);
  const magBaselineY = labelH - 2;
  const magR = renderText(magStr, magBaselineY, FS_MAG_BASE, 700);

  const textParts = [uidR.svg, snR.svg, magR.svg].filter(Boolean).join('\n      ');

  // PNG QR + logo (data URI).
  const pngDataUri = buildQrLogoPng(item.qrPayload || item.uid || item.serial || '');

  // Cadre : 0.1 mm stroke, fill none. Inset = stroke/2 pour rester à l'intérieur.
  const STROKE = 0.1;
  const inset = STROKE / 2;
  const frameW = labelW - STROKE;
  const frameH = labelH - STROKE;

  return `
    <!-- CALQUE 1 : QR + logo (image raster, mode IMAGE LightBurn) -->
    <g id="QR_IMAGE" inkscape:label="QR_IMAGE" inkscape:groupmode="layer" style="image-rendering:pixelated">
      <image href="data:image/png;base64,${pngDataUri.split(',')[1]}" x="${qrX.toFixed(3)}" y="${qrY.toFixed(3)}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="none"/>
    </g>
    <!-- CALQUE 2 : Texte (mode FILL LightBurn) -->
    <g id="TEXT_FILL" inkscape:label="TEXT_FILL" inkscape:groupmode="layer" fill="#000000" stroke="none">
      ${textParts}
    </g>
    <!-- CALQUE 3 : Cadre (mode LINE LightBurn) -->
    <g id="FRAME_LINE" inkscape:label="FRAME_LINE" inkscape:groupmode="layer" fill="none" stroke="#000000" stroke-width="${STROKE}">
      <rect x="${inset.toFixed(3)}" y="${inset.toFixed(3)}" width="${frameW.toFixed(3)}" height="${frameH.toFixed(3)}"/>
    </g>`;
}

/**
 * SVG complet d'UNE étiquette (preview).
 */
export function buildLightburnLabelSvg(item, opts = {}) {
  const labelW = opts.labelW ?? LB_LABEL_W;
  const labelH = opts.labelH ?? LB_LABEL_H;
  const inner = buildLightburnLabelInner(item, labelW, labelH);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     version="1.1"
     width="${labelW}mm" height="${labelH}mm"
     viewBox="0 0 ${labelW} ${labelH}">
  ${inner}
</svg>`;
}

/**
 * SVG plaque 200×200 mm — jusqu'à 32 étiquettes (4×8).
 * Chaque étiquette est un <g> indépendant contenant les 3 calques internes
 * (QR_IMAGE / TEXT_FILL / FRAME_LINE) suffixés par son index pour rester
 * sélectionnable individuellement dans LightBurn.
 *
 * @param {Array<{uid?, serial?, magNumber?, qrPayload?}>} items max 32
 * @param {object} [opts]
 * @param {number} [opts.labelH] hauteur étiquette (défaut 25 mm, alt 33.33)
 * @returns {string}
 */
export function buildLightburnPlateSvg(items, opts = {}) {
  const labelW = opts.labelW ?? LB_LABEL_W;
  const labelH = opts.labelH ?? LB_LABEL_H;
  const cols = opts.cols ?? LB_COLS;
  const rows = opts.rows ?? LB_ROWS;
  const margin = opts.margin ?? LB_PLATE_MARGIN;
  const colGap = opts.colGap ?? LB_COL_GAP;
  const rowGap = opts.rowGap ?? LB_ROW_GAP;
  const max = cols * rows;
  const slots = items.slice(0, max);

  const groups = [];
  for (let i = 0; i < slots.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (labelW + colGap);
    const y = margin + row * (labelH + rowGap);
    // On suffixe les ids de calques internes par l'index pour unicité,
    // mais on garde un id de groupe parent global identifiable.
    const inner = buildLightburnLabelInner(slots[i], labelW, labelH).replace(
      /id="(QR_IMAGE|TEXT_FILL|FRAME_LINE)"/g,
      `id="$1_${i}"`,
    );
    groups.push(
      `<g transform="translate(${x.toFixed(3)},${y.toFixed(3)})" data-label-index="${i}">${inner}</g>`,
    );
  }

  const plateW = opts.plateW ?? LB_PLATE_W;
  const plateH = opts.plateH ?? LB_PLATE_H;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     version="1.1"
     width="${plateW}mm" height="${plateH}mm"
     viewBox="0 0 ${plateW} ${plateH}">
  <!-- LightBurn plate ${plateW}x${plateH} mm — ${cols}x${rows} = ${cols * rows} labels (${labelW}x${labelH} mm) -->
  ${groups.join('\n  ')}
</svg>`;
}

export const LIGHTBURN_LAYOUT = {
  PLATE_W: LB_PLATE_W,
  PLATE_H: LB_PLATE_H,
  PLATE_MARGIN: LB_PLATE_MARGIN,
  COL_GAP: LB_COL_GAP,
  ROW_GAP: LB_ROW_GAP,
  COLS: LB_COLS,
  ROWS: LB_ROWS,
  LABEL_W: LB_LABEL_W,
  LABEL_H: LB_LABEL_H,
  QR_SIZE: LB_QR_SIZE,
};
