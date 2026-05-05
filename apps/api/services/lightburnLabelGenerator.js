// ═══════════════════════════════════════════════════════════════
// apps/api/services/lightburnLabelGenerator.js
//
// Générateur SVG strictement compatible LightBurn pour gravure sur
// aluminium anodisé noir.
//
//   • 3 calques nommés (Inkscape labels) ET 3 COULEURS LightBurn distinctes :
//       1. QR_IMAGE   → <image> PNG  (couleur tag #000000 = C00 → mode IMAGE)
//       2. TEXT_FILL  → <text> rouge (couleur tag #FF0000 = C02 → mode FILL)
//       3. FRAME_LINE → <rect> bleu  (couleur tag #0000FF = C01 → mode LINE)
//   ⚠ LightBurn assigne les modes (Image / Fill / Line) en se basant sur la
//      COULEUR du calque, pas sur l'id ni l'inkscape:label. Trois couleurs
//      différentes ⇒ trois calques séparés dans LightBurn, chacun avec son
//      propre mode et ses propres paramètres laser.
//   • Aucune transparence, aucun filtre, aucun masque, aucun clipPath.
//   • PNG QR+logo : strictement #000000 / #FFFFFF (gravure réelle).
//   • Couleurs SVG vectorielles (#FF0000, #0000FF) = uniquement tags de calque
//      LightBurn, jamais gravées (le laser utilise les paramètres du calque).
//   • QR + logo : PNG raster (via pngjs) embarqué en base64.
//   • Plaque : 200×200 mm — 4 col × 8 lignes = 32 étiquettes 50×25 mm.
//   • Marges externes : 0 mm. Espacement : 0 mm (étiquettes jointives, option B).
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
export const LB_PLATE_MARGIN = 0; // mm — option B : étiquettes jointives, pas de découpe
export const LB_COL_GAP = 0; // mm
export const LB_ROW_GAP = 0; // mm
export const LB_COLS = 4;
export const LB_ROWS = 8;
export const LB_LABEL_W = 50; // mm
export const LB_LABEL_H = 25; // mm  (utiliser 33.33 pour spec alternative)
export const LB_QR_SIZE = 25; // mm  (QR carré, prend toute la hauteur étiquette)
export const LB_QR_QUIET_MM = 1.0; // mm — quiet zone à l'intérieur du PNG QR

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
 * @param {number} [opts.logoRatio]  Côté du carré logo en fraction du PNG. Défaut 0.28.
 * @returns {string} data URI `data:image/png;base64,…`
 */
export function buildQrLogoPng(qrValue, opts = {}) {
  const sizePx = Math.max(64, Math.floor(opts.sizePx ?? LB_PNG_PX));
  const quietRatio = opts.quietRatio ?? LB_QR_QUIET_MM / LB_QR_SIZE; // 2.5/25 = 0.10
  const logoRatio = opts.logoRatio ?? 0.28;

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

  // 5) Overlay logo (carré central blanc plus grand que le logo + motif logo en noir).
  const logo = loadLogo();
  const logoPx = Math.floor(sizePx * logoRatio);
  // Le fond blanc est agrandi de ~25% pour encadrer clairement le logo
  // (sinon le motif sombre se confond avec les modules QR adjacents).
  const bgPx = Math.floor(logoPx * 1.25);
  const bx = Math.floor((sizePx - bgPx) / 2);
  const by = Math.floor((sizePx - bgPx) / 2);

  // 5a) Remplir d'abord le carré central en BLANC (efface les modules QR sous-jacents).
  for (let y = by; y < by + bgPx; y++) {
    const rowOff = y * sizePx * 4;
    for (let x = bx; x < bx + bgPx; x++) {
      const i = rowOff + x * 4;
      buf[i] = 255;
      buf[i + 1] = 255;
      buf[i + 2] = 255;
      buf[i + 3] = 255;
    }
  }

  // 5b) Dessiner le logo binarisé en NOIR sur ce carré blanc.
  if (logo) {
    // Préserve le ratio du logo dans le carré disponible.
    const aspect = logo.width / logo.height;
    let drawW = logoPx;
    let drawH = logoPx;
    if (aspect >= 1) drawH = Math.floor(logoPx / aspect);
    else drawW = Math.floor(logoPx * aspect);
    const dx = Math.floor((sizePx - drawW) / 2);
    const dy = Math.floor((sizePx - drawH) / 2);

    // Nearest-neighbor + binarisation (luminance < 128 = pixel "logo" → noir).
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
        if (a < 128) continue; // pixel transparent → garde fond blanc
        const lum = (r * 299 + g * 587 + b * 114) / 1000;
        if (lum < 128) {
          // pixel sombre du logo source → on l'AFFICHE en noir
          const di = dstRow + (dx + x) * 4;
          buf[di] = 0;
          buf[di + 1] = 0;
          buf[di + 2] = 0;
          buf[di + 3] = 255;
        }
        // sinon (pixel clair du logo) → reste blanc (fond du carré)
      }
    }
  }

  // 6) Encode + base64.
  const out = PNG.sync.write(png);
  return `data:image/png;base64,${out.toString('base64')}`;
}

/**
 * Génère les fragments des 3 calques pour UNE étiquette, sans wrappers
 * `<g id="…" inkscape:label="…">`. Utile pour consolider toutes les étiquettes
 * d'une plaque dans 3 calques globaux uniques.
 *
 * @param {object} item   { uid, serial, magNumber, qrPayload }
 * @param {number} labelW mm
 * @param {number} labelH mm
 * @returns {{ qrImage:string, textFill:string, frameLine:string }}
 *          Chaque champ est un fragment SVG sans wrapper de calque ; pour la
 *          plaque on les enveloppera dans un `<g transform="translate(x,y)">`.
 */
export function buildLightburnLabelLayerFragments(item, labelW = LB_LABEL_W, labelH = LB_LABEL_H) {
  const qrSize = Math.min(LB_QR_SIZE, labelH);
  const qrX = 0;
  const qrY = (labelH - qrSize) / 2;

  const textX = qrSize + 1;
  const textW = labelW - textX - 1;

  const uid = String(item.uid || '').trim();
  const serial = String(item.serial || '').trim();
  const mag = String(item.magNumber || '').trim();
  const ref = String(item.reference || '').trim();

  const FONT = "'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif";
  const FS_REF_BASE = 3.2;
  const FS_MAG_BASE = 6.5;
  const FS_UID_BASE = 2.8;
  const FS_SN_BASE = 2.5;
  const FS_MIN = 1.4;
  const CHAR_RATIO = 0.6;

  // x="left" + anchor "start" par défaut. Pour MAG, on passe anchor="middle"
  // et x = labelW/2 pour centrer horizontalement sur toute la largeur.
  const renderText = (str, y, fsBase, weight = 400, opts = {}) => {
    if (!str) return { svg: '', fs: 0 };
    const maxW = opts.maxW ?? textW;
    const x = opts.x ?? textX;
    const anchor = opts.anchor ?? 'start';
    const estW = str.length * CHAR_RATIO * fsBase;
    let fs = fsBase;
    if (estW > maxW) fs = Math.max(FS_MIN, maxW / (str.length * CHAR_RATIO));
    const targetW = Math.min(str.length * CHAR_RATIO * fs, maxW);
    const svg = `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-family="${FONT}" font-size="${fs.toFixed(2)}" font-weight="${weight}" fill="#000000" text-anchor="${anchor}" textLength="${targetW.toFixed(3)}" lengthAdjust="spacingAndGlyphs">${xmlEscape(str)}</text>`;
    return { svg, fs };
  };

  // Layout : REF en haut, SN en bas, UID juste au-dessus de SN, MAG centré
  // horizontalement sur toute la largeur, verticalement entre REF et UID.
  const LH = 1.3;
  const PAD_V = LB_QR_QUIET_MM; // 2.5 mm — comme la quiet zone du QR

  // SN en bas
  const snStr = serial ? `SN: ${serial}` : '';
  const snBaselineY = labelH - PAD_V - FS_SN_BASE * 0.2;
  const snR = renderText(snStr, snBaselineY, FS_SN_BASE, 400);

  // UID juste au-dessus de SN
  const uidBaselineY = snBaselineY - (snR.fs || FS_SN_BASE) - LH * 0.3;
  const uidR = renderText(uid, uidBaselineY, FS_UID_BASE, 600);

  // REF en haut
  const refBaselineY = PAD_V + FS_REF_BASE * 0.8;
  const refR = renderText(ref, refBaselineY, FS_REF_BASE, 700);

  // MAG centré horizontalement dans la zone texte (entre QR et bord droit),
  // verticalement entre REF et UID.
  const magBaselineY = (refBaselineY + uidBaselineY) / 2 + FS_MAG_BASE * 0.35;
  const magR = renderText(mag, magBaselineY, FS_MAG_BASE, 700, {
    x: textX + textW / 2,
    anchor: 'middle',
    maxW: textW,
  });

  // Texte en ROUGE (#FF0000 = C02 LightBurn → mode FILL)
  const textFill = [refR.svg, magR.svg, uidR.svg, snR.svg]
    .filter(Boolean)
    .join('\n      ')
    .replace(/fill="#000000"/g, 'fill="#FF0000"');

  const pngDataUri = buildQrLogoPng(item.qrPayload || item.uid || item.serial || '');
  const qrImage = `<image href="data:image/png;base64,${pngDataUri.split(',')[1]}" x="${qrX.toFixed(3)}" y="${qrY.toFixed(3)}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="none"/>`;

  const STROKE = 0.1;
  const inset = STROKE / 2;
  const frameW = labelW - STROKE;
  const frameH = labelH - STROKE;
  const frameLine = `<rect x="${inset.toFixed(3)}" y="${inset.toFixed(3)}" width="${frameW.toFixed(3)}" height="${frameH.toFixed(3)}"/>`;

  return { qrImage, textFill, frameLine };
}

/**
 * Génère le contenu interne (3 calques) d'une étiquette LightBurn — variante
 * "preview unitaire" qui produit les 3 wrappers de calque pour visualisation
 * isolée d'une seule étiquette.
 *
 * Pour la plaque, utiliser `buildLightburnLabelLayerFragments` afin de
 * consolider 1 seul `QR_IMAGE` / `TEXT_FILL` / `FRAME_LINE` global.
 */
export function buildLightburnLabelInner(item, labelW = LB_LABEL_W, labelH = LB_LABEL_H) {
  const STROKE = 0.1;
  const { qrImage, textFill, frameLine } = buildLightburnLabelLayerFragments(item, labelW, labelH);

  return `
    <!-- CALQUE 1 : QR + logo (image raster, mode IMAGE LightBurn) -->
    <g id="QR_IMAGE" inkscape:label="QR_IMAGE" inkscape:groupmode="layer" style="image-rendering:pixelated">
      ${qrImage}
    </g>
    <!-- CALQUE 2 : Texte (LightBurn C02 #FF0000 → mode FILL) -->
    <g id="TEXT_FILL" inkscape:label="TEXT_FILL" inkscape:groupmode="layer" fill="#FF0000" stroke="none">
      ${textFill}
    </g>
    <!-- CALQUE 3 : Cadre (LightBurn C01 #0000FF → mode LINE) -->
    <g id="FRAME_LINE" inkscape:label="FRAME_LINE" inkscape:groupmode="layer" fill="none" stroke="#0000FF" stroke-width="${STROKE}">
      ${frameLine}
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
 *
 * STRUCTURE PLAQUE : exactement 3 calques globaux (pas 32×3 = 96).
 * Tous les QR de toutes les étiquettes vivent dans UN SEUL `<g id="QR_IMAGE">`,
 * tous les textes dans UN SEUL `<g id="TEXT_FILL">`, tous les cadres dans UN
 * SEUL `<g id="FRAME_LINE">`. Chaque élément est positionné via son propre
 * `transform="translate(x,y)"`. LightBurn voit donc 3 couches gravure.
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

  const qrParts = [];
  const textParts = [];
  const frameParts = [];

  for (let i = 0; i < slots.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (labelW + colGap);
    const y = margin + row * (labelH + rowGap);
    const t = `translate(${x.toFixed(3)},${y.toFixed(3)})`;
    const { qrImage, textFill, frameLine } = buildLightburnLabelLayerFragments(
      slots[i],
      labelW,
      labelH,
    );
    qrParts.push(`<g transform="${t}" data-label-index="${i}">${qrImage}</g>`);
    textParts.push(`<g transform="${t}" data-label-index="${i}">${textFill}</g>`);
    frameParts.push(`<g transform="${t}" data-label-index="${i}">${frameLine}</g>`);
  }

  const STROKE = 0.1;
  const plateW = opts.plateW ?? LB_PLATE_W;
  const plateH = opts.plateH ?? LB_PLATE_H;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     version="1.1"
     width="${plateW}mm" height="${plateH}mm"
     viewBox="0 0 ${plateW} ${plateH}">
  <!-- LightBurn plate ${plateW}x${plateH} mm — ${cols}x${rows} = ${cols * rows} labels (${labelW}x${labelH} mm) -->
  <!-- CALQUE 1 GLOBAL : tous les QR + logos (mode IMAGE LightBurn) -->
  <g id="QR_IMAGE" inkscape:label="QR_IMAGE" inkscape:groupmode="layer" style="image-rendering:pixelated">
    ${qrParts.join('\n    ')}
  </g>
  <!-- CALQUE 2 GLOBAL : tous les textes (LightBurn C02 #FF0000 → mode FILL) -->
  <g id="TEXT_FILL" inkscape:label="TEXT_FILL" inkscape:groupmode="layer" fill="#FF0000" stroke="none">
    ${textParts.join('\n    ')}
  </g>
  <!-- CALQUE 3 GLOBAL : tous les cadres (LightBurn C01 #0000FF → mode LINE) -->
  <g id="FRAME_LINE" inkscape:label="FRAME_LINE" inkscape:groupmode="layer" fill="none" stroke="#0000FF" stroke-width="${STROKE}">
    ${frameParts.join('\n    ')}
  </g>
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
