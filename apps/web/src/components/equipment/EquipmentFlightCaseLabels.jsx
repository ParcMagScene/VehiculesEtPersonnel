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

// ═══════════════════════════════════════════════════════════════════════════
// Plaques ID alu (flight-cases) — Génération SVG pour LightBurn
//
// • Une plaque = une RÉFÉRENCE (collée sur le flight-case qui contient les
//   unités). Le QR encode la référence : au scan, l'utilisateur voit la
//   liste des unités de cette référence sur mobile et choisit la sienne.
// • Géométrie reproduite du gabarit fourni (PlaquesIDVierges.svg / lbrn2) :
//   - SVG en orientation portrait (152×210mm) avec le contenu paysage
//     (210×150mm) rotaté 90° à droite (rotate(90) translate(0,-150)).
//   - Cadre extérieur arrondi avec 2 oreilles de fixation latérales.
//   - Cadre intérieur 210×150mm.
// • Modes LightBurn (par convention couleur) :
//   - CUT (ligne, stroke #000000) → contour plaque, oreilles, cadre intérieur,
//     champs Marque/Référence/Quantité/Désignation, contour case Testé.
//   - FILL (remplissage, fill #FF0000) → label "Client", ligne pied de page
//     (MAG SCENE…), label "Testé", coche éventuelle.
//   - IMAGE (raster) → QR code par référence + logo MAG SCENE.
// ═══════════════════════════════════════════════════════════════════════════

const escHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const FONT_FAMILY = "'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif";

// Géométrie en mm (coordonnées paysage logiques 240×170 ≈ 210×150 + oreilles)
const GEO = {
  // Cadre intérieur (zone de gravage utile)
  innerW: 210,
  innerH: 150,
  // Plaque hors-tout (avec oreilles latérales pour fixation)
  outerW: 240,
  outerH: 170,
  // Décalage du cadre intérieur dans la plaque
  offsetX: 15,
  offsetY: 10,
  // Oreilles : 2 zones de fixation arrondies à gauche et droite
  earTopH: 20,
  earBotH: 20,
};

// Construit le path "plaque + oreilles" (forme générale de la plaque alu).
function buildOuterPath() {
  const { outerW, outerH, offsetX, offsetY, innerW, innerH } = GEO;
  const r = 4; // rayon des coins arrondis
  // x range global : 0..outerW, y : 0..outerH
  // Oreilles à gauche (x: 0..offsetX) et à droite (x: offsetX+innerW..outerW)
  const leftEarX = 0;
  const earsW = offsetX;
  const innerTop = offsetY;
  const innerBot = offsetY + innerH;
  const innerLeft = offsetX;
  const innerRight = offsetX + innerW;
  const earTop = innerTop + (innerH - GEO.earTopH) / 2;
  const earBot = earTop + GEO.earTopH;
  // Path qui contourne la plaque entière
  void leftEarX;
  void earsW;
  // Forme simplifiée : un rectangle arrondi pour la plaque + 2 oreilles
  // rectangulaires latérales centrées verticalement.
  return [
    `M ${innerLeft} 0`,
    `H ${innerRight}`,
    `Q ${innerRight + r} 0 ${innerRight + r} ${r}`,
    `V ${earTop}`,
    `H ${outerW - r}`,
    `Q ${outerW} ${earTop} ${outerW} ${earTop + r}`,
    `V ${earBot - r}`,
    `Q ${outerW} ${earBot} ${outerW - r} ${earBot}`,
    `H ${innerRight + r}`,
    `V ${innerBot - r}`,
    `Q ${innerRight + r} ${outerH} ${innerRight} ${outerH}`,
    `H ${innerLeft}`,
    `Q ${innerLeft - r} ${outerH} ${innerLeft - r} ${innerBot - r}`,
    `V ${earBot}`,
    `H ${r}`,
    `Q 0 ${earBot} 0 ${earBot - r}`,
    `V ${earTop + r}`,
    `Q 0 ${earTop} ${r} ${earTop}`,
    `H ${innerLeft - r}`,
    `V ${r}`,
    `Q ${innerLeft - r} 0 ${innerLeft} 0`,
    'Z',
  ].join(' ');
}

const buildPlateUrl = (reference) =>
  `${APP_BASE_URL}/#/mobile/equipment-ref/${encodeURIComponent(reference || '')}`;

const cleanText = (s) => String(s == null ? '' : s).trim();

/**
 * Construit le SVG pour UNE plaque flight-case.
 *  fields = { client, brand, reference, designation, quantity, tested }
 *  qrDataUrl = string (PNG dataURL) — peut être null
 *  logoDataUrl = string (PNG dataURL) ou null
 */
function buildPlateSvg({ fields, qrDataUrl, logoDataUrl }) {
  const { outerW, outerH, offsetX, offsetY, innerW, innerH } = GEO;
  // SVG en portrait (outerH × outerW) avec rotation 90° du contenu paysage
  // (reproduit le gabarit du user : width=152mm height=210mm).
  const svgW = outerH;
  const svgH = outerW;

  // Position des éléments dans le repère paysage (avant rotation)
  const innerLeft = offsetX;
  const innerTop = offsetY;

  // Logo MAG SCENE en haut à gauche (zone usable)
  const logoW = 38;
  const logoH = 22;
  const logoX = innerLeft + 6;
  const logoY = innerTop + 4;

  // Champs textuels (mode CUT/ligne, stroke noir, no fill)
  const lineX = innerLeft + 8;
  let lineY = innerTop + 38;
  const lineGap = 13;

  // Texte "Client" + valeur (FILL rouge)
  const clientLabelX = innerLeft + 60;
  const clientLabelY = innerTop + 16;

  // Cadre "Testé" + label (FILL rouge), 20×20mm
  const testW = 20;
  const testH = 20;
  const testX = innerLeft + innerW - testW - 10;
  const testY = innerTop + innerH - testH - 28;

  // QR en bas à droite — taille 38mm (laisse de la place pour pied de page)
  const qrSize = 38;
  const qrX = innerLeft + innerW - qrSize - 6;
  const qrY = innerTop + 8;

  // Pied de page (FILL rouge)
  const footerY = innerTop + innerH - 6;

  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${svgW}mm" height="${svgH}mm" viewBox="0 0 ${svgW} ${svgH}">`,
  );
  lines.push(
    `  <!-- Plaque ID flight-case ${innerW}x${innerH}mm — réf "${escHtml(fields.reference)}" -->`,
  );
  // Tout le contenu est dessiné en coordonnées paysage (outerW × outerH)
  // puis tourné 90° à droite pour tenir dans le viewport portrait.
  lines.push(`  <g transform="rotate(90) translate(0,-${outerH})">`);

  // Calque CUT (ligne) : contours plaque + cadre intérieur + champs textes
  lines.push(
    `    <g id="CUT" inkscape:label="CUT" inkscape:groupmode="layer" fill="none" stroke="#000000" stroke-width="0.1">`,
  );
  // Contour plaque + oreilles
  lines.push(`      <path d="${buildOuterPath()}" />`);
  // Cadre intérieur 210×150mm
  lines.push(
    `      <rect x="${innerLeft}" y="${innerTop}" width="${innerW}" height="${innerH}" />`,
  );
  // Champs en mode LIGNE (texte stroke noir, no fill)
  const fieldEntries = [
    ['Marque', fields.brand],
    ['Référence', fields.reference],
    ['Désignation', fields.designation],
    ['Quantité', fields.quantity],
  ];
  fieldEntries.forEach(([label, value]) => {
    const v = cleanText(value);
    lines.push(
      `      <text x="${lineX.toFixed(2)}" y="${lineY.toFixed(2)}" font-family="${FONT_FAMILY}" font-size="6" stroke="#000000" stroke-width="0.08" fill="none">${escHtml(label)} : ${escHtml(v)}</text>`,
    );
    lineY += lineGap;
  });
  // Contour case "Testé"
  lines.push(`      <rect x="${testX}" y="${testY}" width="${testW}" height="${testH}" />`);
  lines.push('    </g>');

  // Calque FILL (remplissage rouge) : label Client, label Testé, pied de page,
  // coche dans la case si tested, contour épais Testé.
  lines.push(
    `    <g id="FILL" inkscape:label="FILL" inkscape:groupmode="layer" fill="#FF0000" stroke="none">`,
  );
  // "Client : <valeur>"
  lines.push(
    `      <text x="${clientLabelX}" y="${clientLabelY}" font-family="${FONT_FAMILY}" font-size="6" font-weight="700">Client : ${escHtml(fields.client)}</text>`,
  );
  // Label "Testé" sous la case
  lines.push(
    `      <text x="${(testX + testW / 2).toFixed(2)}" y="${(testY + testH + 5).toFixed(2)}" font-family="${FONT_FAMILY}" font-size="4.5" font-weight="700" text-anchor="middle">Testé</text>`,
  );
  // Coche si tested
  if (fields.tested) {
    const cx = testX + testW / 2;
    const cy = testY + testH / 2;
    // Croix en remplissage (2 rectangles fins)
    lines.push(
      `      <rect x="${(cx - 7).toFixed(2)}" y="${(cy - 1).toFixed(2)}" width="14" height="2" transform="rotate(45 ${cx} ${cy})" />`,
    );
    lines.push(
      `      <rect x="${(cx - 7).toFixed(2)}" y="${(cy - 1).toFixed(2)}" width="14" height="2" transform="rotate(-45 ${cx} ${cy})" />`,
    );
  }
  // Pied de page
  lines.push(
    `      <text x="${(innerLeft + innerW / 2).toFixed(2)}" y="${footerY.toFixed(2)}" font-family="${FONT_FAMILY}" font-size="3.6" font-weight="500" text-anchor="middle">MAG SCENE - contact@mag-scene.com - 04 77 81 50 25</text>`,
  );
  lines.push('    </g>');

  // Calque IMAGE : QR code + logo MAG SCENE (raster)
  lines.push(
    `    <g id="IMAGE" inkscape:label="IMAGE" inkscape:groupmode="layer" style="image-rendering:pixelated">`,
  );
  if (qrDataUrl) {
    lines.push(
      `      <image href="${qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" preserveAspectRatio="none" />`,
    );
  }
  if (logoDataUrl) {
    lines.push(
      `      <image href="${logoDataUrl}" x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`,
    );
  }
  lines.push('    </g>');

  lines.push('  </g>');
  lines.push('</svg>');
  return lines.join('\n');
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
          Les plaques sont générées en orientation portrait avec une rotation 90° à droite par
          défaut (alignée sur le gabarit MAG SCENE).
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
