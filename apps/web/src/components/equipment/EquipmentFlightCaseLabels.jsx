import './EquipmentFlightCaseLabels.css';

import { AlertTriangle, CheckCircle2, Download, RotateCw } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/design-system';

import { APP_BASE_URL } from './equipmentConstants';
import { analyzeQrBaseUrl } from './qrSafety';
import TEMPLATE_SVG from './templates/PlaquesIDVierges.svg?raw';

// ═══════════════════════════════════════════════════════════════════════════
// Plaques ID alu (flight-cases) — Génération SVG pour LightBurn
//
// Approche : on PART du gabarit officiel MAG SCENE
// (apps/web/src/components/equipment/templates/PlaquesIDVierges.svg, version
// sans le bitmap logo embarqué). On garde la FORME EXACTE (cadre 210×150 mm,
// oreilles décoratives grises, marques bleues d'alignement, pied de page
// « MAG SCENE … contact@mag-scene.com … ») et on remplace UNIQUEMENT les
// deux libellés gravés « Client » et « DEsignation » par notre contenu
// éditable, plus l'ajout d'un QR (par référence) et d'une case « Testé ».
//
// Modes LightBurn (convention couleur) :
//   • CUT  (ligne)       : stroke #000000 → 4 champs Marque/Réf/Désig/Quantité
//   • FILL (remplissage) : fill #FF0000   → libellé Client + label Testé
//   • IMAGE (raster)     : QR PNG + logo MAG SCENE
//
// Une plaque = une RÉFÉRENCE (collée sur le flight-case). Au scan, le mobile
// affiche la liste des unités de cette référence et l'utilisateur choisit.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Ancres EXACTES du gabarit (NE PAS BOUGER) ─────────────────────────────
// Position des deux libellés gravés « Client » et « DEsignation » dans le
// gabarit officiel. Source : matrices `transform` des paths 0 et 1.
const ANCHOR_CLIENT = { x: 172.735138, y: -178.038361 };
const ANCHOR_DESIGNATION = { x: 142.735275, y: -178.992889 };

// ─── Matrice texte EXACTEMENT identique au gabarit ─────────────────────────
// Le gabarit utilise matrix(-0.000168, 0.961539, 0.961539, 0.000168, X, Y)
// (rotation 90° + flip horizontal, det ≈ -0.92). Les paths du gabarit sont
// pré-tracés en MIROIR pour que la matrice les remette à l'endroit. Pour
// obtenir EXACTEMENT la même position visuelle qu'un placeholder du gabarit
// avec un <text> SVG natif, on conserve la matrice du gabarit telle quelle
// et on enveloppe le texte dans un wrapper qui flippe les glyphes
// VERTICALEMENT (scale(1,-1)) :
//   • det(M * scale(1,-1)) = +0.92  → glyphes lisibles (non miroités)
//   • la combinaison équivaut à une rotation 90° CW pure, donc le texte
//     est lisible quand la plaque est tenue en paysage et il pointe dans
//     le sens normal de lecture (180° par rapport à la version précédente).
const TPL = { a: -0.000168, b: 0.961539, c: 0.961539, d: 0.000168 };
const tplMatrix = (x, y) =>
  `matrix(${TPL.a},${TPL.b},${TPL.c},${TPL.d},${x.toFixed(4)},${y.toFixed(4)})`;

// Police par défaut des champs CUT (Marque/Référence/Désignation/Quantité).
const FONT_FAMILY = "'Liberation Sans','DejaVu Sans',Arial,Helvetica,sans-serif";
// Police imposée pour les libellés Client & Désignation (fallback inclus).
const FONT_FAMILY_ASTRO = "'Astronomus','Liberation Sans',Arial,Helvetica,sans-serif";
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * Crée un <g> + <text> positionné à (x,y) avec la matrice EXACTE du
 * gabarit officiel (= même point d'ancrage et même orientation 90° que
 * les placeholders Client/DEsignation) et un scale(1,-1) interne qui :
 *   • neutralise le mirror de la matrice (det final positif, glyphes lisibles)
 *   • oriente le texte dans le sens de lecture normal en paysage
 *     (= rotation 180° par rapport à un simple scale(-1,1)).
 */
function createPlateText(
  doc,
  {
    x,
    y,
    content,
    fontSize,
    fontFamily,
    fill,
    stroke,
    strokeWidth,
    fontWeight,
    textAnchor,
    topAlign,
  },
) {
  const g = doc.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', tplMatrix(x, y));
  const t = doc.createElementNS(SVG_NS, 'text');
  // scale(1,-1) : flip vertical local. Combiné avec la matrice gabarit
  // (rot 90° + flip horizontal), ça donne une rotation 90° CW pure →
  // texte LISIBLE en orientation paysage normale.
  t.setAttribute('transform', 'scale(1,-1)');
  t.setAttribute('x', '0');
  // Par défaut le texte est ancré sur sa BASELINE (text-y = 0).
  // Avec `topAlign: true`, on décale la baseline de `+0.8 * fontSize` en
  // local. Après scale(1,-1) puis matrice gabarit, le HAUT des capitales
  // (ascender) atterrit EXACTEMENT sur l'ancre passée en (x, y). C'est ce
  // qu'on veut pour les libellés CLIENT/DESIGNATION : le haut du texte
  // doit être collé au bord HAUT de la zone (= l'ancre du gabarit), pas
  // sa baseline.
  const yLocal = topAlign ? fontSize * 0.8 : 0;
  t.setAttribute('y', String(yLocal));
  t.setAttribute('font-family', fontFamily || FONT_FAMILY);
  t.setAttribute('font-size', String(fontSize));
  if (fontWeight) t.setAttribute('font-weight', String(fontWeight));
  t.setAttribute('fill', fill || 'none');
  if (stroke) {
    t.setAttribute('stroke', stroke);
    t.setAttribute('stroke-width', String(strokeWidth ?? 0.08));
  } else {
    t.setAttribute('stroke', 'none');
  }
  if (textAnchor) t.setAttribute('text-anchor', textAnchor);
  t.textContent = content;
  g.appendChild(t);
  return g;
}

// Repère les <path> du gabarit qui rendent les textes « Client » et
// « DEsignation » (gravés en placeholders) : leur matrice translation
// correspond aux ancres connues. On les supprime avant d'injecter notre
// contenu éditable.
function isPlaceholderPath(transform) {
  if (!transform) return false;
  const m = transform.replace(/\s+/g, '').match(/matrix\(([^)]+)\)/);
  if (!m) return false;
  const parts = m[1].split(',').map(parseFloat);
  if (parts.length !== 6 || parts.some((n) => Number.isNaN(n))) return false;
  const [, , , , tx, ty] = parts;
  const near = (x1, y1, x2, y2) => Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5;
  return (
    near(tx, ty, ANCHOR_CLIENT.x, ANCHOR_CLIENT.y) ||
    near(tx, ty, ANCHOR_DESIGNATION.x, ANCHOR_DESIGNATION.y)
  );
}

const buildPlateUrl = (reference) =>
  `${APP_BASE_URL}/#/mobile/equipment-ref/${encodeURIComponent(reference || '')}`;

const cleanText = (s) => String(s == null ? '' : s).trim();

// Largeur moyenne approximative d'un caractère en sans-serif gras, en mm
// quand fontSize = 1mm. Calibré sur des références typiques.
const CHAR_WIDTH_FACTOR = 0.58;

const measureWidth = (text, fontSize) => text.length * fontSize * CHAR_WIDTH_FACTOR;

/**
 * Coupe un texte en 2 lignes équilibrées (séparateur préféré : espace,
 * tiret ou underscore). Retourne [text] si pas de séparateur acceptable.
 */
const splitTwoLines = (text) => {
  if (!text) return [text];
  const ideal = text.length / 2;
  const seps = [' ', '-', '_', '/', '.'];
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 1; i < text.length - 1; i += 1) {
    if (seps.includes(text[i])) {
      const dist = Math.abs(i - ideal);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }
  if (bestIdx === -1) {
    // Pas de séparateur : coupe arbitraire au milieu
    bestIdx = Math.floor(text.length / 2);
    return [text.slice(0, bestIdx).trim(), text.slice(bestIdx).trim()];
  }
  // On garde le séparateur sur la ligne du haut s'il s'agit d'un tiret/_/etc,
  // mais on enlève les espaces autour
  const left = text.slice(0, bestIdx).trim();
  const right = text.slice(bestIdx + 1).trim();
  return [left, right];
};

/**
 * Détermine la taille de police et le découpage d'un texte de référence
 * pour tenir sur 1 à 2 lignes max dans une largeur donnée.
 *
 * @param {string} text
 * @param {number} maxWidth   - largeur disponible en mm
 * @param {number} maxFontSize - taille de police idéale (utilisée si tient sur 1 ligne)
 * @param {number} minFontSize - plancher si tout déborde
 * @returns {{ lines: string[], fontSize: number }}
 */
function fitReferenceLayout(text, maxWidth, maxFontSize = 28, minFontSize = 12) {
  const t = cleanText(text);
  if (!t) return { lines: [t], fontSize: maxFontSize };

  // Étape 1 : essayer 1 ligne, du plus grand au plus petit
  for (let fs = maxFontSize; fs >= minFontSize; fs -= 1) {
    if (measureWidth(t, fs) <= maxWidth) {
      return { lines: [t], fontSize: fs };
    }
  }

  // Étape 2 : 2 lignes, du plus grand au plus petit
  const [a, b] = splitTwoLines(t);
  for (let fs = maxFontSize; fs >= minFontSize; fs -= 1) {
    if (measureWidth(a, fs) <= maxWidth && measureWidth(b, fs) <= maxWidth) {
      return { lines: [a, b], fontSize: fs };
    }
  }

  // Étape 3 : plancher minimum, peut déborder légèrement
  return { lines: [a, b], fontSize: minFontSize };
}

/**
 * Construit le SVG d'UNE plaque à partir du gabarit officiel.
 *  fields = { client, brand, reference, quantity }
 *  qrDataUrl = string (PNG dataURL) ou null
 *  logoDataUrl = string (PNG dataURL) ou null (réinjecte le logo strippé)
 */
function buildPlateSvg({ fields, qrDataUrl, logoDataUrl }) {
  const doc = new DOMParser().parseFromString(TEMPLATE_SVG, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.tagName === 'parsererror' || svg.querySelector('parsererror')) {
    throw new Error('Gabarit SVG invalide');
  }

  // 1) Supprimer les 2 paths-textes placeholders « Client » et « DEsignation ».
  for (const p of Array.from(svg.querySelectorAll('path'))) {
    if (isPlaceholderPath(p.getAttribute('transform'))) {
      p.parentNode.removeChild(p);
    }
  }

  // ─── Géométrie des zones (déduite des ancres EXACTES du gabarit) ──────────
  // Le rect-cadre 210×150 du gabarit a son intérieur en :
  //   world_x ∈ [27.7 ; 177.7]   world_y ∈ [-203.0 ; 7.0]
  // Les 2 placeholders « Client » et « DEsignation » sont posés dans le coin
  // haut-gauche (en paysage) de leur zone respective :
  //   ANCHOR_CLIENT       (172.735, -178.04) → coin haut-gauche zone CLIENT
  //   ANCHOR_DESIGNATION  (142.735, -179.0)  → coin haut-gauche zone DESIGNATION
  // Donc en paysage (le lecteur incline la tête 90° à droite) :
  //   • Zone CLIENT       : bande haute, world_x ∈ [142.7 ; 177.7] (35 mm)
  //   • Zone DESIGNATION  : grande zone, world_x ∈ [ 27.7 ; 142.7] (115 mm)
  //   • Centre zone CLIENT       ≈ (160, -98)
  //   • Centre zone DESIGNATION  ≈ ( 85, -98) — réservé (le contenu de cette
  //     zone est désormais empilé sous le QR, pas centré).
  const ZONE_CLIENT_CENTER = { x: 157.7, y: -98 };

  // 2) Libellé « CLIENT » — posé à partir du coin haut-gauche EXACT du
  //    gabarit (ancre placeholder), puis ajusté :
  //      • « gauche en paysage » = world_y plus négatif → -4 mm sur y
  //      • « relever de 2 mm en paysage » = world_x plus grand → +2 mm sur x
  //    `topAlign` : le HAUT des caps (et non la baseline) est calé sur
  //    l'ancre, pour que le label soit aligné au bord HAUT de la zone.
  svg.appendChild(
    createPlateText(doc, {
      x: ANCHOR_CLIENT.x + 2,
      y: ANCHOR_CLIENT.y - 11,
      content: 'CLIENT',
      fontSize: 6,
      fontWeight: 700,
      fontFamily: FONT_FAMILY_ASTRO,
      fill: '#FF0000',
      topAlign: true,
    }),
  );

  // 3) Valeur du client (nom saisi) AU CENTRE de la zone CLIENT.
  //    Mode CUT (ligne, stroke noir).
  const clientValue = cleanText(fields.client);
  if (clientValue) {
    svg.appendChild(
      createPlateText(doc, {
        x: ZONE_CLIENT_CENTER.x,
        y: ZONE_CLIENT_CENTER.y,
        content: clientValue,
        fontSize: 7,
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        fill: 'none',
        stroke: '#000000',
        strokeWidth: 0.1,
        textAnchor: 'middle',
      }),
    );
  }

  // 4) Libellé « DESIGNATION » — posé à partir du coin haut-gauche EXACT du
  //    gabarit (ancre placeholder), puis ajusté :
  //      • « gauche en paysage » = world_y plus négatif → -20 mm sur y
  //      • « relever de 2 mm en paysage » = world_x plus grand → +2 mm sur x
  //    Sans « : », sans valeur, en MAJUSCULES sans accent. FILL rouge
  //    (le LIBELLÉ reste en remplissage ; c'est la ZONE qui passe en
  //    ligne, modifiée directement dans PlaquesIDVierges.svg). Police
  //    Astronomus. `topAlign` calé sur le bord haut de la zone.
  svg.appendChild(
    createPlateText(doc, {
      x: ANCHOR_DESIGNATION.x + 2,
      y: ANCHOR_DESIGNATION.y - 20,
      content: 'DESIGNATION',
      fontSize: 6,
      fontWeight: 700,
      fontFamily: FONT_FAMILY_ASTRO,
      fill: '#FF0000',
      topAlign: true,
    }),
  );

  // 5) Infos matériel AU CENTRE de la zone DESIGNATION.
  // 5) Infos matériel :
  //      • BRAND + RÉFÉRENCE empilées en haut-paysage de la zone
  //        DESIGNATION, sous le QR à droite paysage (= world_y plus grand).
  //        BRAND  : police 14, sans label.
  //        RÉFÉRENCE : police 28 (encore x2), sans label « Réf : ».
  //      • QUANTITÉ : en BAS-DROITE paysage, juste à GAUCHE de la case
  //        Testé (= world_y inférieur au coin gauche-paysage de Testé).
  //        Police 14, descendue de 5 mm en paysage.
  //    Toutes les lignes en mode REMPLISSAGE (fill noir).
  const brand = cleanText(fields.brand);
  const reference = cleanText(fields.reference);
  const qty = cleanText(fields.quantity);

  // Après déplacement, le QR fait 30×30 mm et son top paysage est à
  // world_x = 133. Marque/référence décalées de 10 mm à droite paysage
  // (= world_y +10) par rapport à leur position précédente à -161.
  const INFO_BASE_Y = -151; // world_y commun pour brand + réf (10 mm à droite)
  const INFO_TOP_X = 133; // top paysage = top du QR
  if (brand) {
    svg.appendChild(
      createPlateText(doc, {
        x: INFO_TOP_X,
        y: INFO_BASE_Y,
        content: brand,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        fill: '#000000',
        textAnchor: 'start',
        topAlign: true,
      }),
    );
  }
  if (reference) {
    // La référence (police 28 par défaut) est placée SOUS la marque en
    // paysage (= world_x plus petit). Descendue de 15 mm de plus (total :
    // ~33 mm sous le top paysage), ce qui la centre verticalement entre
    // la marque (en haut) et la quantité (en bas de zone).
    //
    // La taille de police s'ADAPTE à la longueur du texte pour tenir sur
    // 1 ou 2 lignes maximum dans la largeur disponible (~115 mm en
    // paysage, soit world_y de -151 jusqu'à ~-36).
    //
    // La référence est CENTRÉE horizontalement (en paysage) dans sa zone
    // → text-anchor='middle' au centre de la largeur disponible.
    const REF_X = INFO_TOP_X - 33;
    const REF_MAX_WIDTH_MM = 115; // largeur dispo en paysage (le long de world_y)
    const REF_CENTER_Y = INFO_BASE_Y + REF_MAX_WIDTH_MM / 2; // centre de zone en world_y
    const layout = fitReferenceLayout(reference, REF_MAX_WIDTH_MM, 28, 12);
    layout.lines.forEach((line, idx) => {
      // En paysage, les lignes successives s'empilent vers le BAS = world_x
      // décroissant. Espace entre lignes = 1.1 × fontSize.
      const lineOffset = idx * layout.fontSize * 1.1;
      svg.appendChild(
        createPlateText(doc, {
          x: REF_X - lineOffset,
          y: REF_CENTER_Y,
          content: line,
          fontSize: layout.fontSize,
          fontWeight: 700,
          fontFamily: FONT_FAMILY,
          fill: '#000000',
          textAnchor: 'middle',
          topAlign: true,
        }),
      );
    });
  }

  // ─── Repère paysage (utilisation lecteur) ─────────────────────────────────
  // Le rect-cadre 210×150 du gabarit est centré en world (102.72, -98).
  // Bornes utiles (intérieur du cadre) :
  //   world_x ∈ [27.7 ; 177.7]   (= longueur 150 mm portrait)
  //   world_y ∈ [-203.0 ; 7.0]   (= longueur 210 mm portrait)
  // Quand l'utilisateur incline sa tête 90° à droite (= rotation CCW de la
  // page), on perçoit :
  //   « HAUT » paysage  = world_x élevé (côté Client à 172)
  //   « BAS » paysage   = world_x faible
  //   « GAUCHE » paysage = world_y faible (≈ -200, côté Désignation)
  //   « DROITE » paysage = world_y élevé (≈ 0, côté logo MAG SCENE)

  // 4) QR placé dans la zone DESIGNATION, coin HAUT-GAUCHE paysage.
  //    Taille 30×30 mm. Après ajustements cumulés :
  //      • +3 mm vers la droite paysage = world_y + 3   → left:  -196 + 3  = -193
  //      • +2 mm vers le bas paysage    = world_x - 2   → top:   135  - 2  = 133
  //    Coin haut-gauche paysage = (world_x=133, world_y=-193).
  //    SVG x = 133-30 = 103, SVG y = -193, w=h=30.
  if (qrDataUrl) {
    const QR = 30;
    const qrSvgX = 103;
    const qrSvgY = -193;
    const qrImg = doc.createElementNS(SVG_NS, 'image');
    qrImg.setAttributeNS(XLINK_NS, 'xlink:href', qrDataUrl);
    qrImg.setAttribute('href', qrDataUrl);
    qrImg.setAttribute('x', String(qrSvgX));
    qrImg.setAttribute('y', String(qrSvgY));
    qrImg.setAttribute('width', String(QR));
    qrImg.setAttribute('height', String(QR));
    qrImg.setAttribute('preserveAspectRatio', 'none');
    qrImg.setAttribute('style', 'image-rendering:pixelated');
    svg.appendChild(qrImg);
  }

  // 5) Case « Testé » 20×20 mm « en bas à droite » paysage
  //    → world_x faible (BAS paysage), world_y élevé (DROITE paysage). Marges 6 mm.
  //    ATTENTION : un <rect> placé directement (sans tplMatrix) reçoit ses
  //    attributs SVG x/y dans le repère world du viewBox. SVG `x` = world_x,
  //    SVG `y` = world_y (PAS l'inverse comme la convention « paysage »).
  const TEST = 20;
  const tMargin = 6;
  const X_BOT = 27.7; // bord intérieur gauche du cadre (paysage : bas)
  const Y_RIGHT = 7.0; // bord intérieur bas du cadre   (paysage : droite)
  // Offsets d'ajustement fin (paysage) : +6 mm « vers le haut » (= world_x +6)
  // et -12 mm « vers la gauche » (= world_y -12) par rapport à la marge.
  const testWorldX = X_BOT + tMargin + 6; // coin haut-gauche en SVG = world_x
  const testWorldY = Y_RIGHT - tMargin - TEST - 11; // coin haut-gauche en SVG = world_y
  const testRect = doc.createElementNS(SVG_NS, 'rect');
  testRect.setAttribute('x', String(testWorldX));
  testRect.setAttribute('y', String(testWorldY));
  testRect.setAttribute('width', String(TEST));
  testRect.setAttribute('height', String(TEST));
  // Mode REMPLISSAGE : fill rouge plein (au lieu du contour stroke noir).
  testRect.setAttribute('fill', '#FF0000');
  testRect.setAttribute('stroke', 'none');
  svg.appendChild(testRect);
  // Label « Testé » lisible en paysage — même mécanique matrix gabarit
  // + scale(1,-1) interne (rotation 180° par rapport à scale(-1,1)).
  // tplMatrix attend (world_x, world_y) ; on positionne le label « sous »
  // la case en paysage = world_x plus faible, même centre world_y.
  const labelAnchorX = testWorldX - 5; // 5 mm sous la case en paysage
  const labelAnchorY = testWorldY + TEST / 2; // centré horizontalement (paysage)
  const testLabelG = doc.createElementNS(SVG_NS, 'g');
  testLabelG.setAttribute('transform', tplMatrix(labelAnchorX, labelAnchorY));
  const testLabel = doc.createElementNS(SVG_NS, 'text');
  testLabel.setAttribute('transform', 'scale(1,-1)');
  testLabel.setAttribute('font-family', FONT_FAMILY);
  testLabel.setAttribute('font-size', '5');
  testLabel.setAttribute('font-weight', '700');
  testLabel.setAttribute('fill', '#FF0000');
  testLabel.setAttribute('stroke', 'none');
  testLabel.setAttribute('text-anchor', 'middle');
  testLabel.setAttribute('x', '0');
  testLabel.setAttribute('y', '0');
  testLabel.textContent = 'Testé';
  testLabelG.appendChild(testLabel);
  svg.appendChild(testLabelG);
  // (La case sera cochee physiquement au feutre apres gravure ; pas de
  // croix superposee, pas de champ `tested` dans les fields.)

  // 5bis) Quantité — placée en BAS-DROITE paysage de la zone DESIGNATION,
  //       juste à GAUCHE paysage de la case Testé.
  //       Le LABEL « Quantité : » est rendu en PLUS PETIT (police 8) que la
  //       valeur numérique (police 14) : deux <text> séparés, ancrés à
  //       droite, alignés sur la même BASELINE pour qu'ils ressemblent à
  //       un texte continu « Quantité : N ».
  if (qty) {
    const QTY_VALUE_FONT = 14;
    const QTY_LABEL_FONT = 8;
    const QTY_GAP_MM = 2; // espace entre label et valeur
    const qtyAnchorX = testWorldX + TEST - 5; // world_x (vertical en paysage)
    const qtyAnchorY = testWorldY - 5; // world_y (horizontal en paysage)
    // Avec topAlign:true, l'ancre est sur le HAUT des capitales. Pour que
    // les BASELINES soient alignées (apparence d'un texte sur la même
    // ligne), on remonte l'ancre du petit label de (FS_value - FS_label)
    // × 0.8 vers le bas paysage (= world_x plus petit).
    const labelTopOffset = (QTY_VALUE_FONT - QTY_LABEL_FONT) * 0.8;
    // Valeur numérique (grande) — ancrée à droite paysage
    svg.appendChild(
      createPlateText(doc, {
        x: qtyAnchorX,
        y: qtyAnchorY,
        content: qty,
        fontSize: QTY_VALUE_FONT,
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        fill: '#000000',
        textAnchor: 'end',
        topAlign: true,
      }),
    );
    // Label « Quantité : » (plus petit) — placé juste à GAUCHE paysage de
    // la valeur (= world_y plus petit), baseline alignée avec la valeur.
    const qtyValueWidth = measureWidth(qty, QTY_VALUE_FONT);
    svg.appendChild(
      createPlateText(doc, {
        x: qtyAnchorX - labelTopOffset,
        y: qtyAnchorY - qtyValueWidth - QTY_GAP_MM,
        content: 'Quantité :',
        fontSize: QTY_LABEL_FONT,
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        fill: '#000000',
        textAnchor: 'end',
        topAlign: true,
      }),
    );
  }

  // 6) Logo MAG SCENE — taille et position EXACTES du gabarit.
  //    Bitmap original 803×666 px posé avec scale 0.032661 → 26.24 mm de large.
  //    Le gabarit utilisait matrix(0, +scale, +scale, 0, CX, CY) avec un PNG
  //    pré-flippé. Notre PNG (Logos/Logo_MAGSCENE_Noir_Transp.png) n'est PAS
  //    pré-flippé : on utilise donc matrix(0, +scale, -scale, 0, CX, CY)
  //    (rotation 90° CCW PURE) qui produit le même rendu visuel mais sans
  //    mirroring du PNG.
  if (logoDataUrl) {
    const LOGO_SCALE = 0.043592; // ~35 mm de large (35 / 803.31897)
    const LOGO_CX = 159.520294;
    const LOGO_CY = -14.578194;
    const m = `matrix(0,${LOGO_SCALE},${-LOGO_SCALE},0,${LOGO_CX},${LOGO_CY})`;
    const logoG = doc.createElementNS(SVG_NS, 'g');
    logoG.setAttribute('transform', m);
    const logoImg = doc.createElementNS(SVG_NS, 'image');
    logoImg.setAttributeNS(XLINK_NS, 'xlink:href', logoDataUrl);
    logoImg.setAttribute('href', logoDataUrl);
    logoImg.setAttribute('x', String(-803.31897 / 2));
    logoImg.setAttribute('y', String(-666.497314 / 2));
    logoImg.setAttribute('width', '803.31897');
    logoImg.setAttribute('height', '666.497314');
    logoImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    logoG.appendChild(logoImg);
    svg.appendChild(logoG);
  }

  return new XMLSerializer().serializeToString(doc);
}

const loadImageAsDataUrl = (src) =>
  new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth || im.width;
        c.height = im.naturalHeight || im.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(im, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    im.onerror = () => resolve(null);
    im.src = src;
  });

const EquipmentFlightCaseLabels = ({ equipment = [] }) => {
  const [selectedRef, setSelectedRef] = useState(null);
  const [refSearch, setRefSearch] = useState('');
  // overrides[ref] = { client, brand, reference, quantity }
  const [overrides, setOverrides] = useState({});
  const [previewSvg, setPreviewSvg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState(null);

  const qrSafety = useMemo(() => analyzeQrBaseUrl(APP_BASE_URL), []);

  // Grouper par référence (1 plaque = 1 référence)
  const groupedByRef = useMemo(() => {
    const groups = {};
    equipment.forEach((eq) => {
      const ref = eq.reference || '(Sans référence)';
      if (!groups[ref]) groups[ref] = [];
      groups[ref].push(eq);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [equipment]);

  // Sélection par défaut : première référence dispo
  useEffect(() => {
    if (!selectedRef && groupedByRef.length > 0) {
      const firstRef = groupedByRef[0][0];
      setSelectedRef(firstRef);
      setRefSearch(firstRef);
    } else if (selectedRef && !groupedByRef.some(([ref]) => ref === selectedRef)) {
      const fallback = groupedByRef[0]?.[0] || null;
      setSelectedRef(fallback);
      setRefSearch(fallback || '');
    }
  }, [groupedByRef, selectedRef]);

  // Suggestions filtrées (limitées) selon ce que l'utilisateur tape
  const refSuggestions = useMemo(() => {
    const q = refSearch.trim().toLowerCase();
    if (!q) return groupedByRef.slice(0, 50);
    return groupedByRef
      .filter(([ref, items]) => {
        if (ref.toLowerCase().includes(q)) return true;
        return items.some(
          (eq) =>
            (eq.name || '').toLowerCase().includes(q) || (eq.brand || '').toLowerCase().includes(q),
        );
      })
      .slice(0, 50);
  }, [groupedByRef, refSearch]);

  const handleRefSearchChange = (value) => {
    setRefSearch(value);
    // Si la valeur correspond exactement à une référence connue, on la sélectionne
    const exact = groupedByRef.find(([ref]) => ref === value);
    if (exact) {
      setSelectedRef(exact[0]);
    }
  };

  // Charge le logo MAG SCENE une seule fois
  useEffect(() => {
    let alive = true;
    (async () => {
      const candidates = [
        '/Logos/Logo_MAGSCENE_Noir_Transp.png',
        '/Logos/Logo_MAGSCENE_Noir_Crop.png',
        '/Logos/LogoEmagTransp.png',
      ];
      for (const src of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const data = await loadImageAsDataUrl(src);
        if (data) {
          if (alive) setLogoDataUrl(data);
          return;
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Valeurs par défaut pour une référence donnée (déduites du premier item)
  const defaultsFor = (ref, items) => {
    const first = items?.[0] || {};
    return {
      client: '',
      brand: cleanText(first.brand || ''),
      reference: ref === '(Sans référence)' ? cleanText(first.name || '') : ref,
      quantity: '1',
    };
  };

  const currentItems = useMemo(() => {
    if (!selectedRef) return [];
    const found = groupedByRef.find(([ref]) => ref === selectedRef);
    return found ? found[1] : [];
  }, [groupedByRef, selectedRef]);

  const fields = useMemo(() => {
    if (!selectedRef) return null;
    const o = overrides[selectedRef] || {};
    return { ...defaultsFor(selectedRef, currentItems), ...o };
  }, [selectedRef, currentItems, overrides]);

  const setField = (key, value) => {
    if (!selectedRef) return;
    setOverrides((prev) => ({
      ...prev,
      [selectedRef]: { ...(prev[selectedRef] || {}), [key]: value },
    }));
  };

  // Génère le QR PNG pour une référence donnée
  const buildQrDataUrl = async (reference) => {
    const url = buildPlateUrl(reference);
    return QRCode.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: 'H' });
  };

  // Aperçu auto : régénère le SVG dès que la sélection ou les champs changent
  useEffect(() => {
    if (!selectedRef || !fields || !qrSafety.safe) {
      setPreviewSvg(null);
      return undefined;
    }
    let alive = true;
    setBusy(true);
    (async () => {
      try {
        // Le QR pointe TOUJOURS vers la référence canonique de la DB
        // (selectedRef), JAMAIS vers le texte affiché modifiable
        // (fields.reference) — sinon le QR scanné mènerait à une URL
        // inexistante en cas d'override visuel.
        const qrDataUrl = await buildQrDataUrl(selectedRef);
        const svg = buildPlateSvg({ fields, qrDataUrl, logoDataUrl });
        if (alive) setPreviewSvg(svg);
      } catch (err) {
        console.error('[FlightCase] Preview build failed:', err);
        if (alive) setPreviewSvg(null);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedRef, fields, logoDataUrl, qrSafety.safe]);

  const handleExport = async () => {
    if (!qrSafety.safe) {
      // eslint-disable-next-line no-alert
      window.alert(
        `⛔ Génération bloquée — URL non publique : ${APP_BASE_URL}\n\n${qrSafety.reason}\n\nOuvrez l'application via https://magsav.duckdns.org avant de générer les plaques.`,
      );
      return;
    }
    if (!selectedRef || !fields) return;
    setBusy(true);
    try {
      // Le QR utilise TOUJOURS selectedRef (DB), pas le texte affiché override.
      const qrDataUrl = await buildQrDataUrl(selectedRef);
      const svg = buildPlateSvg({ fields, qrDataUrl, logoDataUrl });
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      // Nom de fichier basé sur la référence DB (cohérence avec le QR).
      const safeRef = selectedRef.replace(/[^A-Za-z0-9_.-]/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `plaque-flightcase-${safeRef}-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 150));
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="efc-container">
      {/* Bandeau sécurité QR */}
      <div className={`efc-qr-safety ${qrSafety.safe ? 'ok' : 'danger'}`}>
        {qrSafety.safe ? (
          <>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>
              Les QR pointeront vers&nbsp;:{' '}
              <code>{APP_BASE_URL}/#/mobile/equipment-ref/&lt;référence&gt;</code>
            </span>
          </>
        ) : (
          <>
            <AlertTriangle size={18} aria-hidden="true" />
            <div className="efc-qr-safety-text">
              <strong>⛔ Gravé LASER bloqué — URL non publique</strong>
              <div>
                Les QR encoderaient&nbsp;: <code>{APP_BASE_URL}</code>
              </div>
              <div>{qrSafety.reason}</div>
              <div>
                Ouvrez l'application via <code>https://magsav.duckdns.org</code> avant de générer
                les plaques.
              </div>
            </div>
          </>
        )}
      </div>

      <div className="efc-rotate-hint">
        <RotateCw size={14} />
        <span>
          Plaque générée à partir du gabarit MAG SCENE — forme et mise en page exactes
          (210×150&nbsp;mm, marques bleues, pied de page conservés). Seuls les libellés Client et
          les 4 champs sont injectés, plus le QR et la case Testé.
        </span>
      </div>

      {/* Sélection + champs éditables */}
      {groupedByRef.length === 0 ? (
        <div className="efc-empty">Aucun équipement disponible.</div>
      ) : (
        <div className="efc-form-card">
          <label className="efc-field efc-field-ref">
            <span>Référence à graver — tapez pour rechercher</span>
            <input
              type="text"
              list="efc-ref-suggestions"
              value={refSearch}
              onChange={(e) => handleRefSearchChange(e.target.value)}
              placeholder="Tapez une référence, marque ou nom…"
              autoComplete="off"
              spellCheck={false}
            />
            <datalist id="efc-ref-suggestions">
              {refSuggestions.map(([ref, items]) => (
                <option key={ref} value={ref}>
                  {items.length} unité{items.length > 1 ? 's' : ''}
                  {items[0]?.brand ? ` — ${items[0].brand}` : ''}
                  {items[0]?.name ? ` — ${items[0].name}` : ''}
                </option>
              ))}
            </datalist>
            {refSearch.trim() && refSearch !== selectedRef && (
              <small className="efc-field-hint efc-field-hint-warn">
                {refSuggestions.length === 0
                  ? 'Aucune référence trouvée.'
                  : 'Choisissez une suggestion pour valider la sélection.'}
              </small>
            )}
          </label>

          {fields && (
            <div className="efc-fields">
              <label className="efc-field">
                <span>Marque</span>
                <input
                  type="text"
                  value={fields.brand}
                  onChange={(e) => setField('brand', e.target.value)}
                />
              </label>
              <label className="efc-field">
                <span>Référence</span>
                <input
                  type="text"
                  value={fields.reference}
                  onChange={(e) => setField('reference', e.target.value)}
                />
                <small className="efc-field-hint">
                  Affichage uniquement — le QR pointe toujours vers la référence d'origine&nbsp;:{' '}
                  <code>{selectedRef}</code>
                </small>
              </label>
              <label className="efc-field efc-field-qty">
                <span>Quantité</span>
                <input
                  type="text"
                  value={fields.quantity}
                  onChange={(e) => setField('quantity', e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="efc-form-actions">
            <Button
              variant="primary"
              className="efc-btn-export"
              onClick={handleExport}
              disabled={!selectedRef || !qrSafety.safe || busy}
              title={qrSafety.safe ? undefined : qrSafety.reason}
            >
              <Download size={16} />
              Exporter SVG
            </Button>
          </div>
        </div>
      )}

      {/* Aperçu inline (paysage) */}
      {previewSvg && (
        <div className="efc-inline-preview" aria-label="Aperçu plaque flight-case">
          <div className="efc-preview-rot-wrap">
            <div
              className="efc-preview-rot-inner"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentFlightCaseLabels;
