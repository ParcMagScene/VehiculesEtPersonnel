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

// Ancres extraites du gabarit (matrice de translation des 2 textes gravés).
const ANCHOR_CLIENT = { x: 172.735138, y: -178.038361 };
const ANCHOR_DESIGNATION = { x: 142.735275, y: -178.992889 };

// Matrice de rotation utilisée par les textes gravés du gabarit :
// matrix(-0.000168, 0.961539, 0.961539, 0.000168, X, Y). On la conserve
// telle quelle pour nos nouveaux textes afin de coller à la mise en page.
const TPL_ROT = { a: -0.000168, b: 0.961539, c: 0.961539, d: 0.000168 };
const matrixAt = (x, y) =>
  `matrix(${TPL_ROT.a},${TPL_ROT.b},${TPL_ROT.c},${TPL_ROT.d},${x.toFixed(4)},${y.toFixed(4)})`;

// Décalage entre 2 lignes empilées sous DEsignation (en mm dans le repère
// LOCAL des glyphes, avant matrice — direction +y locale = world +x).
const FIELD_LINE_GAP = 8;

const FONT_FAMILY = "'Liberation Sans','DejaVu Sans',Arial,Helvetica,sans-serif";
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

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

  // 2) Libellé « Client : … » à l'ancre du placeholder, FILL rouge (gravé plein).
  const clientText = doc.createElementNS(SVG_NS, 'text');
  clientText.setAttribute('transform', matrixAt(ANCHOR_CLIENT.x, ANCHOR_CLIENT.y));
  clientText.setAttribute('font-family', FONT_FAMILY);
  clientText.setAttribute('font-size', '6');
  clientText.setAttribute('font-weight', '700');
  clientText.setAttribute('fill', '#FF0000');
  clientText.setAttribute('stroke', 'none');
  clientText.setAttribute('x', '0');
  clientText.setAttribute('y', '0');
  clientText.textContent = `Client : ${cleanText(fields.client)}`;
  svg.appendChild(clientText);

  // 3) 4 lignes (Marque / Référence / Désignation / Quantité) au point
  //    d'ancrage de DEsignation, empilées dans la direction LOCAL +y = world +x.
  //    Mode CUT : stroke noir, fill none.
  const labels = [
    `Marque : ${cleanText(fields.brand)}`,
    `Référence : ${cleanText(fields.reference)}`,
    `Désignation : ${cleanText(fields.designation)}`,
    `Quantité : ${cleanText(fields.quantity)}`,
  ];
  for (let i = 0; i < labels.length; i++) {
    const wx = ANCHOR_DESIGNATION.x + i * FIELD_LINE_GAP * TPL_ROT.c;
    const wy = ANCHOR_DESIGNATION.y + i * FIELD_LINE_GAP * TPL_ROT.d;
    const t = doc.createElementNS(SVG_NS, 'text');
    t.setAttribute('transform', matrixAt(wx, wy));
    t.setAttribute('font-family', FONT_FAMILY);
    t.setAttribute('font-size', '5');
    t.setAttribute('font-weight', '500');
    t.setAttribute('fill', 'none');
    t.setAttribute('stroke', '#000000');
    t.setAttribute('stroke-width', '0.08');
    t.setAttribute('x', '0');
    t.setAttribute('y', '0');
    t.textContent = labels[i];
    svg.appendChild(t);
  }

  // 4) QR code par référence — 35 mm, centré dans la zone libre côté gauche
  //    en paysage (loin du logo MAG SCENE qui est côté bas-droit du gabarit).
  if (qrDataUrl) {
    const QR = 35;
    const cx = 80;
    const cy = -85;
    const qrG = doc.createElementNS(SVG_NS, 'g');
    qrG.setAttribute('transform', matrixAt(cx, cy));
    qrG.setAttribute('style', 'image-rendering:pixelated');
    const qrImg = doc.createElementNS(SVG_NS, 'image');
    qrImg.setAttributeNS(XLINK_NS, 'xlink:href', qrDataUrl);
    qrImg.setAttribute('href', qrDataUrl);
    qrImg.setAttribute('x', String(-QR / 2));
    qrImg.setAttribute('y', String(-QR / 2));
    qrImg.setAttribute('width', String(QR));
    qrImg.setAttribute('height', String(QR));
    qrImg.setAttribute('preserveAspectRatio', 'none');
    qrG.appendChild(qrImg);
    svg.appendChild(qrG);
  }

  // 5) Case « Testé » 20×20 mm — contour CUT (noir), label FILL rouge,
  //    coche FILL rouge si cochée.
  const TEST = 20;
  const testG = doc.createElementNS(SVG_NS, 'g');
  testG.setAttribute('transform', matrixAt(80, -45));
  const testRect = doc.createElementNS(SVG_NS, 'rect');
  testRect.setAttribute('x', String(-TEST / 2));
  testRect.setAttribute('y', String(-TEST / 2));
  testRect.setAttribute('width', String(TEST));
  testRect.setAttribute('height', String(TEST));
  testRect.setAttribute('fill', 'none');
  testRect.setAttribute('stroke', '#000000');
  testRect.setAttribute('stroke-width', '0.1');
  testG.appendChild(testRect);
  const testLabel = doc.createElementNS(SVG_NS, 'text');
  testLabel.setAttribute('x', '0');
  testLabel.setAttribute('y', String(TEST / 2 + 5));
  testLabel.setAttribute('font-family', FONT_FAMILY);
  testLabel.setAttribute('font-size', '5');
  testLabel.setAttribute('font-weight', '700');
  testLabel.setAttribute('fill', '#FF0000');
  testLabel.setAttribute('stroke', 'none');
  testLabel.setAttribute('text-anchor', 'middle');
  testLabel.textContent = 'Testé';
  testG.appendChild(testLabel);
  if (fields.tested) {
    const halfA = (TEST - 6) / 2;
    const cross = doc.createElementNS(SVG_NS, 'path');
    cross.setAttribute(
      'd',
      `M ${-halfA} ${-halfA} L ${halfA} ${halfA} M ${halfA} ${-halfA} L ${-halfA} ${halfA}`,
    );
    cross.setAttribute('stroke', '#FF0000');
    cross.setAttribute('stroke-width', '2.5');
    cross.setAttribute('stroke-linecap', 'round');
    cross.setAttribute('fill', 'none');
    testG.appendChild(cross);
  }
  svg.appendChild(testG);

  // 6) Logo MAG SCENE — réinjection à la position d'origine (le bitmap base64
  //    a été strippé du gabarit pour réduire le bundle).
  if (logoDataUrl) {
    const logoG = doc.createElementNS(SVG_NS, 'g');
    logoG.setAttribute('transform', 'matrix(0,0.032661,0.032661,0,159.520294,-14.578194)');
    const logoImg = doc.createElementNS(SVG_NS, 'image');
    logoImg.setAttributeNS(XLINK_NS, 'xlink:href', logoDataUrl);
    logoImg.setAttribute('href', logoDataUrl);
    logoImg.setAttribute('x', '-401.659485');
    logoImg.setAttribute('y', '-333.248657');
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
