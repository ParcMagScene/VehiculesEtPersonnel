import './EquipmentFlightCaseLabels.css';

import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  RotateCw,
  Square,
  Tag,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

import { Button, SearchBar } from '@/design-system';

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
// et on enveloppe le texte dans un wrapper qui flippe localement les
// glyphes (scale(-1,1)) — le flip local est ré-inversé par la matrice
// → texte LISIBLE et au mm près à la position du placeholder d'origine.
const TPL = { a: -0.000168, b: 0.961539, c: 0.961539, d: 0.000168 };
const tplMatrix = (x, y) =>
  `matrix(${TPL.a},${TPL.b},${TPL.c},${TPL.d},${x.toFixed(4)},${y.toFixed(4)})`;

// Direction « ligne suivante » dans le repère world : ce sont les coefficients
// (c, d) du gabarit appliqués à un déplacement local +y → ≈ (+0.96, 0)
// = vers world_x croissant (donc en paysage : la pile va vers le HAUT,
// dans le sens de Client).
const LINE_DIR = { dx: TPL.c, dy: TPL.d };

// Gap inter-lignes (mm) appliqué dans la direction LINE_DIR.
const FIELD_LINE_GAP = 8;

// Police par défaut des champs CUT (Marque/Référence/Désignation/Quantité).
const FONT_FAMILY = "'Liberation Sans','DejaVu Sans',Arial,Helvetica,sans-serif";
// Police imposée pour les libellés Client & Désignation (fallback inclus).
const FONT_FAMILY_ASTRO = "'Astronomus','Liberation Sans',Arial,Helvetica,sans-serif";
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * Crée un <g> + <text> positionné à (x,y) avec la matrice du gabarit
 * et un scale(-1,1) interne pour que les glyphes restent lisibles malgré
 * le flip de la matrice. Permet de coller pile-poil sur les placeholders
 * « Client » / « DEsignation » du gabarit officiel.
 */
function createPlateText(
  doc,
  { x, y, content, fontSize, fontFamily, fill, stroke, strokeWidth, fontWeight },
) {
  const g = doc.createElementNS(SVG_NS, 'g');
  g.setAttribute('transform', tplMatrix(x, y));
  const t = doc.createElementNS(SVG_NS, 'text');
  // scale(-1,1) annule le mirror horizontal de la matrice du gabarit.
  t.setAttribute('transform', 'scale(-1,1)');
  t.setAttribute('x', '0');
  t.setAttribute('y', '0');
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
  // Avec scale(-1,1) le texte démarre en local_x=0 et s'étend vers -x ; la
  // matrice du gabarit le ramène à world_y croissant depuis l'ancre, ce qui
  // reproduit EXACTEMENT la disposition d'un placeholder gabarit.
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

/**
 * Construit le SVG d'UNE plaque à partir du gabarit officiel.
 *  fields = { client, brand, reference, designation, quantity, tested }
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

  // 2) Libellé « Client : … » à l'ancre EXACTE du placeholder, FILL rouge,
  //    police Astronomus (imposée par le client).
  svg.appendChild(
    createPlateText(doc, {
      x: ANCHOR_CLIENT.x,
      y: ANCHOR_CLIENT.y,
      content: `Client : ${cleanText(fields.client)}`,
      fontSize: 6,
      fontWeight: 700,
      fontFamily: FONT_FAMILY_ASTRO,
      fill: '#FF0000',
    }),
  );

  // 3) 4 lignes (Marque / Référence / Désignation / Quantité) empilées depuis
  //    l'ancre EXACTE de « DEsignation » (142.735, -178.99). La ligne
  //    « Désignation » utilise la police Astronomus et le FILL rouge (comme
  //    dans le gabarit) ; les 3 autres sont en mode CUT (stroke noir, fill
  //    none) avec la police standard.
  const fieldRows = [
    {
      content: `Marque : ${cleanText(fields.brand)}`,
      mode: 'cut',
    },
    {
      content: `Référence : ${cleanText(fields.reference)}`,
      mode: 'cut',
    },
    {
      content: `Désignation : ${cleanText(fields.designation)}`,
      mode: 'fill-astro',
    },
    {
      content: `Quantité : ${cleanText(fields.quantity)}`,
      mode: 'cut',
    },
  ];
  for (let i = 0; i < fieldRows.length; i++) {
    const row = fieldRows[i];
    const wx = ANCHOR_DESIGNATION.x + i * FIELD_LINE_GAP * LINE_DIR.dx;
    const wy = ANCHOR_DESIGNATION.y + i * FIELD_LINE_GAP * LINE_DIR.dy;
    const isDesignation = row.mode === 'fill-astro';
    svg.appendChild(
      createPlateText(doc, {
        x: wx,
        y: wy,
        content: row.content,
        fontSize: isDesignation ? 6 : 5,
        fontWeight: isDesignation ? 700 : 500,
        fontFamily: isDesignation ? FONT_FAMILY_ASTRO : FONT_FAMILY,
        fill: isDesignation ? '#FF0000' : 'none',
        stroke: isDesignation ? null : '#000000',
        strokeWidth: isDesignation ? null : 0.08,
      }),
    );
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

  // 4) QR « en haut à gauche » paysage  → world_x élevé, world_y faible.
  //    Marges : 4 mm depuis le bord intérieur du cadre, taille 40 mm.
  if (qrDataUrl) {
    const QR = 40;
    const margin = 4;
    const X_TOP = 177.7; // bord intérieur droit du cadre en world
    const Y_LEFT = -203.0; // bord intérieur haut du cadre en world (paysage : gauche)
    // Coin haut-gauche paysage = (X_TOP - margin, Y_LEFT + margin) ; le QR
    // est posé avec son ANGLE haut-droit (en world) sur ce point.
    const qrX = Y_LEFT + margin; // coin gauche world_y
    const qrY = X_TOP - margin - QR; // coin haut world_x (on descend de QR)
    const qrImg = doc.createElementNS(SVG_NS, 'image');
    qrImg.setAttributeNS(XLINK_NS, 'xlink:href', qrDataUrl);
    qrImg.setAttribute('href', qrDataUrl);
    qrImg.setAttribute('x', String(qrX));
    qrImg.setAttribute('y', String(qrY));
    qrImg.setAttribute('width', String(QR));
    qrImg.setAttribute('height', String(QR));
    qrImg.setAttribute('preserveAspectRatio', 'none');
    qrImg.setAttribute('style', 'image-rendering:pixelated');
    svg.appendChild(qrImg);
  }

  // 5) Case « Testé » 20×20 mm « en bas à droite » paysage
  //    → world_x faible, world_y élevé. Marges 6 mm.
  const TEST = 20;
  const tMargin = 6;
  const X_BOT = 27.7; // bord intérieur gauche du cadre (paysage : bas)
  const Y_RIGHT = 7.0; // bord intérieur bas du cadre   (paysage : droite)
  const testX = Y_RIGHT - tMargin - TEST; // coin gauche world_y
  const testY = X_BOT + tMargin; // coin haut world_x
  const testRect = doc.createElementNS(SVG_NS, 'rect');
  testRect.setAttribute('x', String(testX));
  testRect.setAttribute('y', String(testY));
  testRect.setAttribute('width', String(TEST));
  testRect.setAttribute('height', String(TEST));
  testRect.setAttribute('fill', 'none');
  testRect.setAttribute('stroke', '#000000');
  testRect.setAttribute('stroke-width', '0.1');
  svg.appendChild(testRect);
  // Label « Testé » lisible en paysage → on utilise la matrice gabarit (avec
  // wrapper scale(-1,1) interne) ancrée au centre-bas de la case en paysage.
  const labelAnchorX = testY + TEST + 5; // 5 mm sous la case en paysage
  const labelAnchorY = testX + TEST / 2; // centré horizontalement (paysage)
  // Pour text-anchor:middle on doit construire à la main (createPlateText
  // n'expose pas cet attribut) — on garde la même mécanique matrix+scale.
  const testLabelG = doc.createElementNS(SVG_NS, 'g');
  testLabelG.setAttribute('transform', tplMatrix(labelAnchorX, labelAnchorY));
  const testLabel = doc.createElementNS(SVG_NS, 'text');
  testLabel.setAttribute('transform', 'scale(-1,1)');
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
  if (fields.tested) {
    const cx = testX + TEST / 2;
    const cy = testY + TEST / 2;
    const halfA = (TEST - 6) / 2;
    const cross = doc.createElementNS(SVG_NS, 'path');
    cross.setAttribute(
      'd',
      `M ${cx - halfA} ${cy - halfA} L ${cx + halfA} ${cy + halfA} M ${cx + halfA} ${cy - halfA} L ${cx - halfA} ${cy + halfA}`,
    );
    cross.setAttribute('stroke', '#FF0000');
    cross.setAttribute('stroke-width', '2.5');
    cross.setAttribute('stroke-linecap', 'round');
    cross.setAttribute('fill', 'none');
    svg.appendChild(cross);
  }

  // 6) Logo MAG SCENE — réinjection AGRANDIE et non-miroitée.
  //    Le bitmap original (803×666 px) était posé avec matrice det=0 (flip).
  //    On le remet à l'emplacement d'origine (~ centre du « côté droit »
  //    paysage = world (159, -14)) mais avec rotation 90° CCW PURE et un
  //    scale plus grand pour que le logo soit lisible.
  if (logoDataUrl) {
    const LOGO_W = 70; // mm, largeur visible en paysage
    const ratio = 666.497314 / 803.31897; // ≈ 0.829
    const LOGO_H = LOGO_W * ratio; // ≈ 58 mm
    // Position du centre du logo en world (haut-droite paysage,
    // au-dessus du pied de page) — calé sur l'ancre originale du gabarit.
    const LOGO_CX = 159.520294;
    const LOGO_CY = -14.578194;
    const scale = LOGO_W / 803.31897;
    // matrix(0, scale, -scale, 0, CX, CY)  → rotation CCW pure + scale
    const m = `matrix(0,${scale},${-scale},0,${LOGO_CX},${LOGO_CY})`;
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
    // marquer LOGO_H comme utilisé (réservé à un calcul futur de marge)
    void LOGO_H;
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
  const [selectedRefs, setSelectedRefs] = useState(new Set());
  const [search, setSearch] = useState('');
  const [collapsedRefs, setCollapsedRefs] = useState(new Set());
  // overrides[ref] = { client, brand, reference, designation, quantity, tested }
  const [overrides, setOverrides] = useState({});
  const [previewSvg, setPreviewSvg] = useState(null);
  const [busy, setBusy] = useState(false);

  const qrSafety = useMemo(() => analyzeQrBaseUrl(APP_BASE_URL), []);

  // Grouper par référence
  const groupedByRef = useMemo(() => {
    const groups = {};
    equipment.forEach((eq) => {
      const ref = eq.reference || '(Sans référence)';
      if (!groups[ref]) groups[ref] = [];
      groups[ref].push(eq);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [equipment]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedByRef;
    const q = search.toLowerCase();
    return groupedByRef.filter(([ref, items]) => {
      if (ref.toLowerCase().includes(q)) return true;
      return items.some(
        (eq) =>
          (eq.name || '').toLowerCase().includes(q) || (eq.brand || '').toLowerCase().includes(q),
      );
    });
  }, [groupedByRef, search]);

  // Valeurs par défaut pour une référence donnée (déduites du premier item)
  const defaultsFor = (ref, items) => {
    const first = items?.[0] || {};
    return {
      client: '',
      brand: cleanText(first.brand || ''),
      reference: ref === '(Sans référence)' ? '' : ref,
      // user a demandé : Désignation = Référence par défaut
      designation: ref === '(Sans référence)' ? cleanText(first.name || '') : ref,
      quantity: '1',
      tested: false,
    };
  };

  const getFields = (ref, items) => {
    const o = overrides[ref] || {};
    return { ...defaultsFor(ref, items), ...o };
  };

  const setField = (ref, key, value) => {
    setOverrides((prev) => ({ ...prev, [ref]: { ...(prev[ref] || {}), [key]: value } }));
  };

  const toggleRef = (ref) => {
    setSelectedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRefs.size === filteredGroups.length) {
      setSelectedRefs(new Set());
    } else {
      setSelectedRefs(new Set(filteredGroups.map(([ref]) => ref)));
    }
  };

  const toggleCollapse = (ref) => {
    setCollapsedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  // Génère le QR PNG pour une référence donnée
  const buildQrDataUrl = async (reference) => {
    const url = buildPlateUrl(reference);
    return QRCode.toDataURL(url, { width: 600, margin: 1, errorCorrectionLevel: 'H' });
  };

  // Charge le logo MAG SCENE une seule fois
  const [logoDataUrl, setLogoDataUrl] = useState(null);
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

  const handlePreview = async (ref, items) => {
    if (!qrSafety.safe) return;
    setBusy(true);
    try {
      const fields = getFields(ref, items);
      const qrDataUrl = await buildQrDataUrl(fields.reference || ref);
      const svg = buildPlateSvg({ fields, qrDataUrl, logoDataUrl });
      setPreviewSvg({ ref, svg });
    } finally {
      setBusy(false);
    }
  };

  const handleExportSelected = async () => {
    if (!qrSafety.safe) {
      // eslint-disable-next-line no-alert
      window.alert(
        `⛔ Génération bloquée — URL non publique : ${APP_BASE_URL}\n\n${qrSafety.reason}\n\nOuvrez l'application via https://magsav.duckdns.org avant de générer les plaques.`,
      );
      return;
    }
    const selected = filteredGroups.filter(([ref]) => selectedRefs.has(ref));
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const ts = Date.now();
      for (const [ref, items] of selected) {
        const fields = getFields(ref, items);
        // eslint-disable-next-line no-await-in-loop
        const qrDataUrl = await buildQrDataUrl(fields.reference || ref);
        const svg = buildPlateSvg({ fields, qrDataUrl, logoDataUrl });
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const safeRef = (fields.reference || ref).replace(/[^A-Za-z0-9_.-]/g, '_');
        const a = document.createElement('a');
        a.href = url;
        a.download = `plaque-flightcase-${safeRef}-${ts}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 150));
        URL.revokeObjectURL(url);
      }
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

      <div className="efc-toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par référence, marque, nom..."
          size="sm"
        />
        <Button variant="ghost" className="efc-select-all" onClick={selectAll}>
          {selectedRefs.size === filteredGroups.length && filteredGroups.length > 0 ? (
            <CheckSquare size={14} />
          ) : (
            <Square size={14} />
          )}
          {selectedRefs.size === filteredGroups.length && filteredGroups.length > 0
            ? 'Tout désélectionner'
            : 'Tout sélectionner'}
        </Button>
        <div className="efc-toolbar-actions">
          <Button
            variant="ghost"
            className="efc-btn-export"
            onClick={handleExportSelected}
            disabled={selectedRefs.size === 0 || !qrSafety.safe || busy}
            title={qrSafety.safe ? undefined : qrSafety.reason}
          >
            <Download size={16} />
            Exporter SVG{' '}
            {selectedRefs.size > 0
              ? `— ${selectedRefs.size} plaque${selectedRefs.size > 1 ? 's' : ''}`
              : ''}
          </Button>
        </div>
      </div>

      <div className="efc-rotate-hint">
        <RotateCw size={14} />
        <span>
          Plaque générée à partir du gabarit MAG SCENE — forme et mise en page exactes
          (210×150&nbsp;mm, marques bleues, pied de page conservés). Seuls les libellés Client et
          les 4 champs sont injectés, plus le QR et la case Testé.
        </span>
      </div>

      <div className="efc-selection-info">
        <Tag size={14} />
        <span>
          {selectedRefs.size} référence{selectedRefs.size > 1 ? 's' : ''} sélectionnée
          {selectedRefs.size > 1 ? 's' : ''}
        </span>
      </div>

      <div className="efc-list">
        {filteredGroups.map(([ref, items]) => {
          const checked = selectedRefs.has(ref);
          const collapsed = collapsedRefs.has(ref);
          const fields = getFields(ref, items);
          return (
            <div key={ref} className="efc-group">
              <div
                className="efc-group-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleCollapse(ref)}
              >
                <Button variant="ghost" className="efc-collapse-btn">
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </Button>
                <Button
                  variant="ghost"
                  className={`efc-checkbox ${checked ? 'checked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRef(ref);
                  }}
                >
                  {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                </Button>
                <div className="efc-group-title">
                  <strong>{ref}</strong>
                  <span className="efc-group-count">
                    {items.length} unité{items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  className="efc-preview-btn"
                  disabled={busy || !qrSafety.safe}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(ref, items);
                  }}
                >
                  Aperçu
                </Button>
              </div>

              {!collapsed && (
                <div className="efc-group-body">
                  <div className="efc-fields">
                    <label className="efc-field">
                      <span>Client</span>
                      <input
                        type="text"
                        value={fields.client}
                        onChange={(e) => setField(ref, 'client', e.target.value)}
                        placeholder="(vide)"
                      />
                    </label>
                    <label className="efc-field">
                      <span>Marque</span>
                      <input
                        type="text"
                        value={fields.brand}
                        onChange={(e) => setField(ref, 'brand', e.target.value)}
                      />
                    </label>
                    <label className="efc-field">
                      <span>Référence</span>
                      <input
                        type="text"
                        value={fields.reference}
                        onChange={(e) => setField(ref, 'reference', e.target.value)}
                      />
                    </label>
                    <label className="efc-field">
                      <span>Désignation</span>
                      <input
                        type="text"
                        value={fields.designation}
                        onChange={(e) => setField(ref, 'designation', e.target.value)}
                      />
                    </label>
                    <label className="efc-field efc-field-qty">
                      <span>Quantité</span>
                      <input
                        type="text"
                        value={fields.quantity}
                        onChange={(e) => setField(ref, 'quantity', e.target.value)}
                      />
                    </label>
                    <label className="efc-field efc-field-tested">
                      <input
                        type="checkbox"
                        checked={!!fields.tested}
                        onChange={(e) => setField(ref, 'tested', e.target.checked)}
                      />
                      <span>Cocher « Testé »</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {previewSvg && (
        <div
          className="efc-preview-overlay"
          role="dialog"
          aria-label="Aperçu plaque flight-case"
          onClick={() => setPreviewSvg(null)}
        >
          <div className="efc-preview-card" onClick={(e) => e.stopPropagation()} role="document">
            <div className="efc-preview-header">
              <strong>Aperçu — {previewSvg.ref}</strong>
              <Button variant="ghost" onClick={() => setPreviewSvg(null)}>
                Fermer
              </Button>
            </div>
            <div
              className="efc-preview-svg"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: previewSvg.svg }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentFlightCaseLabels;
