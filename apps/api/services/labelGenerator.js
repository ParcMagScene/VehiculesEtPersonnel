// ═══════════════════════════════════════════════════════════════
// apps/api/services/labelGenerator.js
//
// Génération d'étiquettes vectorielles (SVG) pour gravure laser via LightBurn.
//
//   • Étiquette unitaire : 50 mm × 33,33 mm
//   • Plaque complète    : 200 mm × 200 mm — 6 colonnes × 4 lignes (24 étiquettes)
//   • Marges externes    : 5 mm
//   • Espacement inter   : 1 mm
//   • QR Code vectorisé  : généré par `qrcode` (mode SVG path)
//   • Couleur            : noir pur (#000000), aucun fond, aucun dégradé
//   • Police             : sans-serif (Arial, Helvetica, Liberation Sans)
//
// Sortie : string SVG prêt à être servi en download (Content-Type image/svg+xml)
// ou converti en PNG 300 DPI côté client (canvas drawImage).
// ═══════════════════════════════════════════════════════════════

import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Logo Mag Scène intégré au centre du QR ──────────────────────────────
// Lecture paresseuse + cache : le PNG (~550 ko) n'est lu qu'une seule fois.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.resolve(__dirname, '../../../public/Logos/Logo_MAGSCENE_Noir_Crop.png');
let __logoDataUriCache = null;
let __logoAspectCache = 1; // largeur / hauteur (le logo Mag Scène croppe à ~1.21)
function getLogoDataUri() {
  if (__logoDataUriCache !== null) return __logoDataUriCache;
  try {
    const buf = fs.readFileSync(LOGO_PATH);
    __logoDataUriCache = `data:image/png;base64,${buf.toString('base64')}`;
    // Lecture manuelle des dimensions PNG (chunk IHDR à l'offset 16, big-endian).
    if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w > 0 && h > 0) __logoAspectCache = w / h;
    }
  } catch {
    __logoDataUriCache = ''; // logo absent → pas d'overlay (QR reste valide)
  }
  return __logoDataUriCache;
}
// Fraction du côté du QR occupée par le logo (largeur).
// 0.40 = très visible ; on reste lisible grâce à ECC 'H' + padding blanc qui
// "découpe" proprement les pixels masqués (l'algo de scan tolère mieux des
// blancs nets que des modules abîmés). Validé par jsQR sur 4 cas.
// Fraction du côté du QR occupée par le logo (largeur).
// 0.30 = bien visible ; ECC 'H' tolère ~30% de pertes — validé par jsQR.
const LOGO_RATIO = 0.3;

// ─── Constantes plaque (toutes en millimètres) ────────────────────────────
//
// Spec utilisateur : plaque 200 × 200 mm, 4 colonnes × 8 lignes = 32 étiquettes
// de 50 × 25 mm chacune. Avec 4×50 = 200 et 8×25 = 200, on remplit
// la plaque entièrement → marges et gaps à 0 (les étiquettes sont jointives,
// le rognage / découpe se fera sur le bord externe en gravure laser).
const PLATE_W = 200;
const PLATE_H = 200;
const PLATE_MARGIN = 0;
const COL_GAP = 0;
const ROW_GAP = 0;
const COLS = 4;
const ROWS = 8;
const LABEL_W = 50; // 200 / 4
const LABEL_H = 200 / 8; // 25

// ─── Constantes étiquette ──────────────────────────────────
const LABEL_PADDING = 1.2; // marge interne (resserrée)
const QR_QUIET_ZONE = 1; // quiet zone QR — réduite pour QR plus gros
// NB: pas de guillemets imbriqués (l'attribut SVG est déjà entre " ").
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

/**
 * Calcule le layout réel d'une étiquette dans la plaque 200×200 mm.
 * Si les dimensions imposées (50 × 33,33) ne rentrent pas dans la grille
 * 6×4 d'une plaque 200×200, on rétro-calcule la taille effective d'étiquette
 * pour respecter les contraintes externes (la plaque prime).
 */
export function computeLayout({
  plateWidth = PLATE_W,
  plateHeight = PLATE_H,
  margin = PLATE_MARGIN,
  cols = COLS,
  rows = ROWS,
  colGap = COL_GAP,
  rowGap = ROW_GAP,
} = {}) {
  const usableW = plateWidth - 2 * margin - (cols - 1) * colGap;
  const usableH = plateHeight - 2 * margin - (rows - 1) * rowGap;
  const labelW = usableW / cols;
  const labelH = usableH / rows;
  return { plateWidth, plateHeight, margin, cols, rows, colGap, rowGap, labelW, labelH };
}

/**
 * Échappe une chaîne pour insertion dans du XML/SVG.
 */
function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Génère un QR code sous forme de matrice de modules (plus fiable pour LightBurn
 * qu'un path stroke généré par qrcode.toString — chaque module devient un <rect>
 * fermé directement gravable).
 *
 * @param {string} value  Donnée à encoder
 * @returns {{ rectsSvg: (size:number)=>string, modules: number }}
 */
function qrModules(value) {
  // ECC 'H' (~30%) : indispensable pour pouvoir masquer un logo central
  // sans perdre la lisibilité du QR.
  const qr = QRCode.create(String(value || ' '), { errorCorrectionLevel: 'H' });
  const modules = qr.modules.size;
  const data = qr.modules.data; // Uint8Array length = modules*modules ; 1=dark
  return {
    modules,
    rectsSvg(size) {
      const cell = size / modules;
      const parts = [];
      for (let row = 0; row < modules; row++) {
        let runStart = -1;
        for (let col = 0; col <= modules; col++) {
          const dark = col < modules && data[row * modules + col] === 1;
          if (dark && runStart === -1) runStart = col;
          if (!dark && runStart !== -1) {
            const x = (runStart * cell).toFixed(4);
            const y = (row * cell).toFixed(4);
            const w = ((col - runStart) * cell).toFixed(4);
            const h = cell.toFixed(4);
            parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);
            runStart = -1;
          }
        }
      }
      return parts.join('');
    },
  };
}

/**
 * Génère le SVG d'une étiquette unitaire (sans wrapper <svg> racine — utilisé
 * comme <g> dans la plaque). Pour usage standalone, voir buildLabelSvg().
 *
 * @param {object} item   { uid, serial, magNumber, qrPayload }
 * @param {number} labelW Largeur en mm
 * @param {number} labelH Hauteur en mm
 * @returns {Promise<string>} contenu SVG (groupes/paths/textes)
 */
async function buildLabelInner(item, labelW, labelH) {
  // Bord visible (gravure de contour découpe). 0.15 mm = trait fin lisible
  // sans gêner la lecture du QR ni du texte.
  const BORDER_W = 0.15;
  const BORDER_INSET = BORDER_W / 2; // pour que le tracé reste à l'intérieur

  // QR : on prend toute la hauteur dispo (après padding), QR carré.
  const qrSize = labelH - 2 * LABEL_PADDING;
  const qrX = LABEL_PADDING;
  const qrY = (labelH - qrSize) / 2;

  // Quiet zone : on réduit la zone de modules pour laisser un padding visuel.
  const qrInnerSize = qrSize - 2 * QR_QUIET_ZONE;
  const qr = qrModules(item.qrPayload || item.uid || item.serial || '');
  const qrRects = qr.rectsSvg(qrInnerSize);

  // Overlay logo au centre du QR (bg blanc rectangulaire au ratio du logo + image).
  const logoUri = getLogoDataUri();
  let logoSvg = '';
  if (logoUri) {
    const logoW = qrInnerSize * LOGO_RATIO;
    const logoH = logoW / __logoAspectCache;
    const logoX = (qrInnerSize - logoW) / 2;
    const logoY = (qrInnerSize - logoH) / 2;
    // Padding blanc autour du logo (10% de la dimension max) pour bien le détacher
    // des modules QR — améliore la reconnaissance visuelle sans gêner le scan.
    const pad = Math.max(logoW, logoH) * 0.1;
    const bgW = logoW + 2 * pad;
    const bgH = logoH + 2 * pad;
    const bgX = (qrInnerSize - bgW) / 2;
    const bgY = (qrInnerSize - bgH) / 2;
    logoSvg =
      `<rect x="${bgX.toFixed(4)}" y="${bgY.toFixed(4)}" width="${bgW.toFixed(4)}" height="${bgH.toFixed(4)}" fill="#FFFFFF"/>` +
      `<image x="${logoX.toFixed(4)}" y="${logoY.toFixed(4)}" width="${logoW.toFixed(4)}" height="${logoH.toFixed(4)}" href="${logoUri}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // Zone texte à droite du QR.
  const textX = qrX + qrSize + LABEL_PADDING;
  const textW = labelW - textX - LABEL_PADDING; // largeur utile pour le texte

  // Polices et tailles
  const REF_FONT_FAMILY = "Georgia, 'Times New Roman', serif";
  const REF_BASE = 3.2; // mm — référence (en haut)
  const REF_MIN = 1.8;
  const VAL_BASE = 2.6; // mm — UID / S/N (en bas)
  const VAL_MIN = 1.5;
  const CHAR_RATIO_SANS = 0.55; // Arial
  const CHAR_RATIO_SERIF = 0.62; // Georgia bold est plus large
  const LH_RATIO = 1.1; // interligne

  /** Découpe une chaîne en lignes pour tenir dans `maxW` à `fontSize` donné.
   *  Tente d'abord d'auto-shrink jusqu'à `minFs`, puis wrap sur 2 lignes max
   *  (priorité à la coupe sur espace, sinon coupe dure). Renvoie { lines, fs }. */
  function fitText(text, maxW, baseFs, minFs, charRatio, maxLines = 2) {
    const t = String(text || '');
    if (!t) return { lines: [], fs: baseFs };
    const widthAt = (s, fs) => s.length * charRatio * fs;
    // 1) tient sur 1 ligne à la taille de base ?
    if (widthAt(t, baseFs) <= maxW) return { lines: [t], fs: baseFs };
    // 2) shrink jusqu'à minFs sur 1 ligne ?
    const shrunk = Math.max(minFs, maxW / (t.length * charRatio));
    if (shrunk >= minFs && widthAt(t, shrunk) <= maxW + 0.01) {
      // OK si shrunk reste >= minFs ET pas trop bas (lisibilité)
      if (shrunk >= baseFs * 0.7) return { lines: [t], fs: shrunk };
    }
    // 3) wrap sur N lignes à baseFs (puis shrink global si besoin)
    function wrap(str, fs) {
      const maxChars = Math.max(3, Math.floor(maxW / (charRatio * fs)));
      const words = str.split(/\s+/).filter(Boolean);
      const out = [];
      let cur = '';
      for (const w of words) {
        if (!cur) {
          if (w.length <= maxChars) cur = w;
          else {
            // mot trop long : coupe dure
            for (let i = 0; i < w.length; i += maxChars) {
              const chunk = w.slice(i, i + maxChars);
              if (!cur) cur = chunk;
              else {
                out.push(cur);
                cur = chunk;
              }
            }
          }
          continue;
        }
        if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
        else {
          out.push(cur);
          if (w.length <= maxChars) cur = w;
          else {
            for (let i = 0; i < w.length; i += maxChars) {
              const chunk = w.slice(i, i + maxChars);
              if (i === 0 && !cur) cur = chunk;
              else if (i === 0) {
                out.push(cur);
                cur = chunk;
              } else {
                out.push(cur);
                cur = chunk;
              }
            }
          }
        }
      }
      if (cur) out.push(cur);
      return out;
    }
    let fs = baseFs;
    let lines = wrap(t, fs);
    while (lines.length > maxLines && fs > minFs) {
      fs = Math.max(minFs, fs - 0.1);
      lines = wrap(t, fs);
    }
    // Garantit qu'aucune ligne ne dépasse maxW à la taille `fs` retenue
    // (ex. mot non-séparé par espace plus large que prévu après wrap).
    const maxLineW = () => Math.max(...lines.map((l) => widthAt(l, fs)));
    while (maxLineW() > maxW + 0.01 && fs > minFs) {
      fs = Math.max(minFs, fs - 0.1);
      lines = wrap(t, fs);
    }
    if (lines.length > maxLines) {
      // tronque proprement avec ellipsis sur la dernière ligne autorisée
      lines = lines.slice(0, maxLines);
      const last = lines[maxLines - 1];
      const maxChars = Math.max(3, Math.floor(maxW / (charRatio * fs)));
      lines[maxLines - 1] =
        last.length > maxChars - 1 ? last.slice(0, maxChars - 1) + '…' : last + '…';
    }
    // Filet de sécurité final : à fs minimum, si une ligne déborde encore,
    // on la tronque avec ellipsis.
    if (maxLineW() > maxW + 0.01) {
      const maxChars = Math.max(3, Math.floor(maxW / (charRatio * fs)));
      lines = lines.map((l) =>
        widthAt(l, fs) > maxW + 0.01 ? l.slice(0, Math.max(1, maxChars - 1)) + '…' : l,
      );
    }
    return { lines, fs };
  }

  // ─── Composition verticale ─────────────────────────────────────────
  // Haut    : Référence (1 à 2 lignes, serif gras)
  // Milieu  : N° MAG (très gros, centré H + V entre ref et bas) — optionnel
  // Bas     : UID puis S/N préfixé "SN: " (sans-serif)
  const ref = String(item.reference || '').trim();
  const uid = String(item.uid || '').trim();
  const serial = String(item.serial || '').trim();
  const mag = String(item.magNumber || '').trim();

  const refFit = ref
    ? fitText(ref, textW, REF_BASE, REF_MIN, CHAR_RATIO_SERIF, 2)
    : { lines: [], fs: REF_BASE };
  const uidFit = uid
    ? fitText(uid, textW, VAL_BASE, VAL_MIN, CHAR_RATIO_SANS, 1)
    : { lines: [], fs: VAL_BASE };
  // S/N : préfixe "SN: " sur la 1re ligne (le préfixe ne se réinjecte pas
  // sur les lignes wrappées). MAG n'est plus suffixé ici (bloc dédié au milieu).
  const snText = serial ? `SN: ${serial}` : '';
  const snFit = serial
    ? fitText(snText, textW, VAL_BASE, VAL_MIN, CHAR_RATIO_SANS, 2)
    : { lines: [], fs: VAL_BASE };
  // MAG : police nettement plus grosse, 1 ligne max, centré horizontalement
  // dans la zone texte. Échelle calibrée pour rester lisible même sur 3 chars.
  const MAG_BASE = 6.5; // mm
  const MAG_MIN = 3.5;
  const magFit = mag
    ? fitText(mag, textW, MAG_BASE, MAG_MIN, CHAR_RATIO_SANS, 1)
    : { lines: [], fs: MAG_BASE };

  // Calcul positions
  const TOP_PAD = LABEL_PADDING + 0.4;
  const BOT_PAD = LABEL_PADDING + 0.2;

  // Bloc haut (référence) — baseline sur la 1re ligne
  const refLH = refFit.fs * LH_RATIO;
  const refLines = refFit.lines.map((line, i) => {
    const y = TOP_PAD + refFit.fs * 0.85 + i * refLH;
    return { line, y, fs: refFit.fs };
  });
  const refBlockBottom =
    refLines.length > 0 ? refLines[refLines.length - 1].y + refFit.fs * 0.15 : TOP_PAD;

  // Bloc bas (S/N puis UID au-dessus, collés en bas)
  const valLH = VAL_BASE * LH_RATIO;
  const snLH = snFit.fs * LH_RATIO;
  const uidLH = uidFit.fs * LH_RATIO;
  // Hauteur totale du bloc bas
  const bottomH = uidFit.lines.length * uidLH + snFit.lines.length * snLH;
  // y baseline de la 1re ligne du bloc bas
  let curY = labelH - BOT_PAD - bottomH + uidFit.fs * 0.85;
  const bottomBlockTop = curY - uidFit.fs * 0.85;
  const uidLines = uidFit.lines.map((line) => {
    const y = curY;
    curY += uidLH;
    return { line, y, fs: uidFit.fs };
  });
  // ré-aligne pour S/N (passage de uidFit à snFit)
  if (uidFit.lines.length > 0) {
    curY = curY - uidFit.fs * 0.85 + snFit.fs * 0.85;
  } else {
    curY = labelH - BOT_PAD - snFit.lines.length * snLH + snFit.fs * 0.85;
  }
  const snLines = snFit.lines.map((line) => {
    const y = curY;
    curY += snLH;
    return { line, y, fs: snFit.fs };
  });

  // Bloc milieu (MAG) — centré V entre refBlockBottom et bottomBlockTop
  const magLines = [];
  if (magFit.lines.length > 0) {
    const slot = bottomBlockTop - refBlockBottom;
    // baseline = milieu vertical du slot (approximation : centré sur cap-height)
    const cy = refBlockBottom + slot / 2 + magFit.fs * 0.35;
    magLines.push({ line: magFit.lines[0], y: cy, fs: magFit.fs });
  }

  // Filet de sécurité : on contraint systématiquement la largeur réelle de
  // chaque ligne à `min(estW, textW)`. Si la police installée s'avère plus
  // large que `charRatio` le prévoit (ex. fallback DejaVu Serif vs Georgia),
  // le moteur SVG comprime les glyphes/espaces pour tenir → aucun débord.
  const renderLine = ({ line, y, fs }, family, weight, charRatio, anchor = 'start', cx = null) => {
    const safe = xmlEscape(line);
    if (!line) return '';
    const estW = line.length * charRatio * fs;
    const targetW = Math.min(estW, textW);
    const xPos = anchor === 'middle' ? (cx ?? textX + textW / 2) : textX;
    const anchorAttr = anchor === 'middle' ? ` text-anchor="middle"` : '';
    return `<text x="${xPos.toFixed(3)}" y="${y.toFixed(3)}" font-family="${family}" font-size="${fs.toFixed(2)}" font-weight="${weight}" fill="#000000"${anchorAttr} textLength="${targetW.toFixed(3)}" lengthAdjust="spacingAndGlyphs">${safe}</text>`;
  };

  const textSvg = [
    ...refLines.map((l) => renderLine(l, REF_FONT_FAMILY, 700, CHAR_RATIO_SERIF)),
    ...magLines.map((l) => renderLine(l, FONT_FAMILY, 800, CHAR_RATIO_SANS, 'middle')),
    ...uidLines.map((l) => renderLine(l, FONT_FAMILY, 600, CHAR_RATIO_SANS)),
    ...snLines.map((l) => renderLine(l, FONT_FAMILY, 500, CHAR_RATIO_SANS)),
  ].join('');

  // (suppression de l'ancien bloc unique sized/textY)
  // eslint-disable-next-line no-unused-vars
  const _unused = { lineHeight: valLH };

  // QR : translate vers (qrX+quiet, qrY+quiet)
  const qrTx = qrX + QR_QUIET_ZONE;
  const qrTy = qrY + QR_QUIET_ZONE;

  // ClipPath de sécurité : empêche tout débord visuel hors de l'étiquette.
  const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;

  return `
    <defs>
      <clipPath id="${clipId}">
        <rect x="0" y="0" width="${labelW}" height="${labelH}"/>
      </clipPath>
    </defs>
    <g clip-path="url(#${clipId})">
      <!-- Contour de découpe / repère gravure -->
      <rect x="${BORDER_INSET}" y="${BORDER_INSET}" width="${(labelW - BORDER_W).toFixed(3)}" height="${(labelH - BORDER_W).toFixed(3)}" fill="none" stroke="#000000" stroke-width="${BORDER_W}"/>
      <g transform="translate(${qrTx.toFixed(3)},${qrTy.toFixed(3)})" fill="#000000">
        ${qrRects}
        ${logoSvg}
      </g>
      <g>${textSvg}</g>
    </g>
  `;
}

/**
 * Construit un SVG d'étiquette unitaire complet (utilisé pour la prévisualisation
 * d'une seule étiquette si besoin).
 */
export async function buildLabelSvg(item, opts = {}) {
  const labelW = opts.labelW ?? LABEL_W;
  const labelH = opts.labelH ?? LABEL_H;
  const inner = await buildLabelInner(item, labelW, labelH);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1"
     width="${labelW}mm" height="${labelH}mm"
     viewBox="0 0 ${labelW} ${labelH}">
${inner}
</svg>`;
}

/**
 * Construit la plaque SVG 200×200 mm contenant jusqu'à 24 étiquettes (6×4).
 * Les emplacements vides sont laissés vides (aucun rendu).
 *
 * @param {Array<{uid?, serial?, magNumber?, qrPayload?}>} items  Max = 24
 * @param {object} [opts]
 * @returns {Promise<string>} SVG complet (sérialisé)
 */
export async function buildPlateSvg(items, opts = {}) {
  const layout = computeLayout(opts);
  const max = layout.cols * layout.rows;
  const slots = items.slice(0, max);

  const groups = [];
  for (let i = 0; i < slots.length; i++) {
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const x = layout.margin + col * (layout.labelW + layout.colGap);
    const y = layout.margin + row * (layout.labelH + layout.rowGap);
    // eslint-disable-next-line no-await-in-loop
    const inner = await buildLabelInner(slots[i], layout.labelW, layout.labelH);
    groups.push(
      `<g transform="translate(${x.toFixed(3)},${y.toFixed(3)})" data-label-index="${i}">${inner}</g>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1"
     width="${layout.plateWidth}mm" height="${layout.plateHeight}mm"
     viewBox="0 0 ${layout.plateWidth} ${layout.plateHeight}">
  <!-- Plaque ${layout.plateWidth}×${layout.plateHeight} mm — ${layout.cols}×${layout.rows} étiquettes (${layout.labelW.toFixed(2)}×${layout.labelH.toFixed(2)} mm) -->
  ${groups.join('\n  ')}
</svg>`;
}

export const LAYOUT_CONSTANTS = {
  PLATE_W,
  PLATE_H,
  PLATE_MARGIN,
  COL_GAP,
  ROW_GAP,
  COLS,
  ROWS,
  LABEL_W_NOMINAL: LABEL_W,
  LABEL_H_NOMINAL: LABEL_H,
};
