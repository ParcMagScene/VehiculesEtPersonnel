import './EquipmentBatchLabels.css';

import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  Square,
  Tag,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState } from 'react';

import { Button, SearchBar } from '@/design-system';

const cleanName = (s) => (s || '').replace(/^"+|"+$/g, '').replace(/"{2,}/g, '"');

const PAGE_SIZE_MM = 200; // 200×200 mm
const LABEL_GAP_MM = 2;

const APP_BASE_URL = window.location.origin;

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const EquipmentBatchLabels = ({ equipment = [], _onPrintSingle }) => {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [showLogo, setShowLogo] = useState(true);
  const [collapsedRefs, setCollapsedRefs] = useState(new Set());

  // Grouper par référence
  const groupedByRef = useMemo(() => {
    const groups = {};
    equipment.forEach((eq) => {
      const ref = eq.reference || '(Sans référence)';
      if (!groups[ref]) groups[ref] = [];
      groups[ref].push(eq);
    });
    // Trier par référence
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [equipment]);

  // Filtrer
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedByRef;
    const q = search.toLowerCase();
    return groupedByRef
      .map(([ref, items]) => {
        if (ref.toLowerCase().includes(q)) return [ref, items];
        const filtered = items.filter(
          (eq) =>
            (eq.name || '').toLowerCase().includes(q) ||
            (eq.uid || '').toLowerCase().includes(q) ||
            (eq.serialNumber || eq.serial_number || '').toLowerCase().includes(q),
        );
        if (filtered.length > 0) return [ref, filtered];
        return null;
      })
      .filter(Boolean);
  }, [groupedByRef, search]);

  const totalSelected = selectedIds.size;
  const totalEquipment = equipment.length;

  const toggleRef = (ref, items) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = items.every((eq) => next.has(eq.id));
      items.forEach((eq) => {
        if (allSelected) next.delete(eq.id);
        else next.add(eq.id);
      });
      return next;
    });
  };

  const toggleSingle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === totalEquipment) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(equipment.map((e) => e.id)));
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

  // Calculer la disposition optimale pour 200×200mm
  const calcLayout = () => {
    // Chaque étiquette : 8 cm × 2 cm
    const labelW = 80; // mm
    const labelH = 20; // mm
    const cols = Math.floor((PAGE_SIZE_MM + LABEL_GAP_MM) / (labelW + LABEL_GAP_MM));
    const rows = Math.floor((PAGE_SIZE_MM + LABEL_GAP_MM) / (labelH + LABEL_GAP_MM));
    return { labelW, labelH, cols, rows, perPage: cols * rows };
  };

  const handlePrintBatch = async () => {
    const selected = equipment.filter((eq) => selectedIds.has(eq.id));
    if (selected.length === 0) return;

    // Pré-générer les QR codes localement (pas d'appel externe)
    const qrDataUrlMap = new Map(
      await Promise.all(
        selected.map(async (eq) => [
          eq.id,
          eq.uid
            ? await QRCode.toDataURL(`${APP_BASE_URL}/#/mobile/equipment/${eq.uid}`, {
                width: 200,
                margin: 1,
              })
            : null,
        ]),
      ),
    );

    const layout = calcLayout();
    const pages = [];
    const qrSize = Math.round(layout.labelH - 4);

    for (let i = 0; i < selected.length; i += layout.perPage) {
      const pageItems = selected.slice(i, i + layout.perPage);
      const labels = pageItems
        .map((eq) => {
          const qrUrl = eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : null;
          const qrDataUrl = qrDataUrlMap.get(eq.id);
          return (
            '<div class="batch-label" style="width:' +
            layout.labelW +
            'mm; height:' +
            layout.labelH +
            'mm;">' +
            '<div class="batch-label-inner">' +
            (showLogo
              ? '<div class="batch-logo"><img src="/Logos/logo_Noir_Transp.png" alt="Logo eM@g" /></div>'
              : '') +
            '<div class="batch-info">' +
            '<div class="batch-ref">' +
            escHtml(eq.reference || '') +
            '</div>' +
            (eq.uid ? '<div class="batch-uid"><b>UID: ' + escHtml(eq.uid) + '</b></div>' : '') +
            (eq.serialNumber || eq.serial_number
              ? '<div class="batch-sn"><b>S/N: ' +
                escHtml(eq.serialNumber || eq.serial_number) +
                '</b></div>'
              : '') +
            '</div>' +
            (qrUrl ? '<div class="batch-qr"><img src="' + qrDataUrl + '" alt="QR" /></div>' : '') +
            '</div>' +
            '</div>'
          );
        })
        .join('');

      pages.push(
        '<div class="batch-page">' + '<div class="batch-grid">' + labels + '</div>' + '</div>',
      );
    }

    const htmlContent =
      '<!DOCTYPE html><html><head><title>Étiquettes lot - ' +
      selected.length +
      ' matériels</title>' +
      '<style>' +
      '@page { size: A4; margin: 5mm; }' +
      '* { margin: 0; padding: 0; box-sizing: border-box; }' +
      'body { font-family: -apple-system, BlinkMacSystemFont, monospace; }' +
      '.batch-page { width: 210mm; min-height: 297mm; padding: 5mm; page-break-after: always; }' +
      '.batch-page:last-child { page-break-after: auto; }' +
      '.batch-grid { display: flex; flex-wrap: wrap; gap: ' +
      LABEL_GAP_MM +
      'mm; align-content: flex-start; }' +
      '.batch-label { border: 0.3px dashed #999; border-radius: 1px; overflow: hidden; }' +
      '.batch-label-inner { display: flex; flex-direction: row; align-items: center; width: 100%; height: 100%; padding: 1.5mm; gap: 2mm; }' +
      '.batch-logo { flex-shrink: 0; display: flex; align-items: center; }' +
      '.batch-logo img { height: ' +
      qrSize +
      'mm; width: auto; }' +
      '.batch-qr { flex-shrink: 0; }' +
      '.batch-qr img { width: ' +
      qrSize +
      'mm; height: ' +
      qrSize +
      'mm; }' +
      '.batch-info { flex: 0 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; }' +
      '.batch-ref { font-weight: 800; font-size: 10pt; line-height: 1.1; white-space: nowrap; }' +
      '.batch-uid, .batch-sn { font-size: 7.5pt; font-weight: 700; line-height: 1.1; white-space: nowrap; font-family: monospace; }' +
      '</style></head><body>' +
      pages.join('') +
      '</body></html>';

    // Utiliser un iframe caché pour éviter le bloqueur de popups
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    };
  };

  // ═══════════════════════════════════════════════════════════════════════
  // Export SVG — plaque LightBurn 200×200 mm, 4 colonnes × 8 lignes = 32
  // étiquettes 50×25 mm, sans gap. Format strict aligné sur la plaque de
  // référence (public/plaque-etiquettes-*.svg) :
  //   • Calque "QR_IMAGE" (image-rendering:pixelated) → tous les QR PNG 25×25
  //   • Calque "TEXT_FILL" (fill #FF0000) → réf, N°MAG, UID, SN avec
  //     lengthAdjust="spacingAndGlyphs" pour tenir dans la zone droite.
  //   • Multi-pages : génère N fichiers "plaque-etiquettes-<ts>-X-sur-N.svg"
  // ═══════════════════════════════════════════════════════════════════════
  const handleExportBatchSVG = async () => {
    const selected = equipment.filter((eq) => selectedIds.has(eq.id));
    if (selected.length === 0) return;

    // Géométrie plaque (mm)
    const PLATE = 200;
    const LBL_W = 50;
    const LBL_H = 25;
    const COLS = 4;
    const ROWS = 8;
    const PER_PAGE = COLS * ROWS; // 32
    const QR_SIZE = 25; // image carrée 25×25 dans la zone gauche
    const FONT_FAMILY = "'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif";

    // Charger logo PNG (HTMLImageElement) si demandé — incrusté au CENTRE du QR.
    // Essaie plusieurs noms (Mag Scène puis fallback eM@g) pour rester robuste.
    let logoImg = null;
    if (showLogo) {
      const candidates = [
        '/Logos/Logo_MAGSCENE_Noir_Transp.png',
        '/Logos/Logo_MAGSCENE_Noir_Crop.png',
        '/Logos/LogoEmagTransp.png',
        '/Logos/LogoEmag.png',
      ];
      for (const src of candidates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          logoImg = await new Promise((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = rej;
            im.src = src;
          });
          if (logoImg) break;
        } catch {
          logoImg = null;
        }
      }
    }

    // Pré-générer les QR codes PNG (mode IMAGE LightBurn) avec logo composité au
    // centre. ECC H pour rester scannable malgré l'occlusion du logo (~22 %).
    const composeQrWithLogo = async (url) => {
      const QR_PX = 600;
      const qrUrl = await QRCode.toDataURL(url, {
        width: QR_PX,
        margin: 1,
        errorCorrectionLevel: 'H',
      });
      if (!logoImg) return qrUrl;
      // Compose via canvas
      const qrImg = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = qrUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = QR_PX;
      canvas.height = QR_PX;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImg, 0, 0, QR_PX, QR_PX);
      // Carré blanc derrière logo (lisibilité)
      const boxRatio = 0.32; // 32% du QR
      const box = Math.round(QR_PX * boxRatio);
      const bx = Math.round((QR_PX - box) / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx, bx, box, box);
      // Logo proportionnel
      const ratio = logoImg.width / logoImg.height || 1;
      let lw, lh;
      if (ratio >= 1) {
        lw = box * 0.96;
        lh = lw / ratio;
      } else {
        lh = box * 0.96;
        lw = lh * ratio;
      }
      ctx.drawImage(
        logoImg,
        Math.round((QR_PX - lw) / 2),
        Math.round((QR_PX - lh) / 2),
        Math.round(lw),
        Math.round(lh),
      );
      return canvas.toDataURL('image/png');
    };

    const qrDataUrlMap = new Map(
      await Promise.all(
        selected.map(async (eq) => [
          eq.id,
          eq.uid ? await composeQrWithLogo(`${APP_BASE_URL}/#/mobile/equipment/${eq.uid}`) : null,
        ]),
      ),
    );

    // Largeurs textLength dérivées de la plaque de référence (en mm)
    const REF_CHAR_W = 1.92; // ref text font 3.20
    const MAG_CHAR_W = 3.9; // mag text font 6.50
    const UID_CHAR_W = 1.68; // uid text font 2.80
    const SN_CHAR_W = 1.353; // sn text font 2.25
    const REF_MAX = 17.28; // ≈ 9 caractères max
    const UID_MAX = 16.8;
    const SN_MAX = 23.0;
    const MAG_MAX = 11.7;
    const fitLen = (s, perChar, max) => {
      const n = (s || '').length;
      if (!n) return 0;
      const ideal = n * perChar;
      return Math.min(ideal, max);
    };

    const totalPages = Math.ceil(selected.length / PER_PAGE);
    const ts = Date.now();

    for (let p = 0; p < totalPages; p++) {
      const pageItems = selected.slice(p * PER_PAGE, (p + 1) * PER_PAGE);

      // Calque 1 : QR + logo (raster)
      const qrLayer = pageItems
        .map((eq, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const tx = (col * LBL_W).toFixed(3);
          const ty = (row * LBL_H).toFixed(3);
          const qr = qrDataUrlMap.get(eq.id);
          const parts = [];
          parts.push(`<g transform="translate(${tx},${ty})" data-label-index="${i}">`);
          if (qr) {
            parts.push(
              `<image href="${qr}" x="0.000" y="0.000" width="${QR_SIZE}" height="${QR_SIZE}" preserveAspectRatio="none" />`,
            );
          }
          parts.push('</g>');
          return parts.join('');
        })
        .join('\n    ');

      // Calque 2 : textes (mode FILL LightBurn, rouge)
      const textLayer = pageItems
        .map((eq, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const tx = (col * LBL_W).toFixed(3);
          const ty = (row * LBL_H).toFixed(3);
          const ref = cleanName(eq.reference || '');
          const mag = String(eq.numeroMag || eq.numero_mag || '').trim();
          const uid = eq.uid || '';
          const sn = eq.serialNumber || eq.serial_number || '';
          const lines = [];
          lines.push(`<g transform="translate(${tx},${ty})" data-label-index="${i}">`);
          if (ref) {
            const len = fitLen(ref, REF_CHAR_W, REF_MAX).toFixed(3);
            lines.push(
              `<text x="26.000" y="3.560" font-family="${FONT_FAMILY}" font-size="3.20" font-weight="700" fill="#FF0000" text-anchor="start" textLength="${len}" lengthAdjust="spacingAndGlyphs">${escHtml(ref)}</text>`,
            );
          }
          if (mag) {
            // Pas de textLength pour le N°MAG : il est court (2-3 chars) et le
            // forçage de largeur écrase visuellement les glyphes. text-anchor
            // middle suffit pour le centrer.
            lines.push(
              `<text x="37.500" y="15.500" font-family="${FONT_FAMILY}" font-size="7.50" font-weight="700" fill="#FF0000" text-anchor="middle">${escHtml(mag)}</text>`,
            );
          }
          if (uid) {
            const len = fitLen(uid, UID_CHAR_W, UID_MAX).toFixed(3);
            lines.push(
              `<text x="26.000" y="20.855" font-family="${FONT_FAMILY}" font-size="2.80" font-weight="600" fill="#FF0000" text-anchor="start" textLength="${len}" lengthAdjust="spacingAndGlyphs">${escHtml(uid)}</text>`,
            );
          }
          if (sn) {
            const snTxt = `SN: ${sn}`;
            const len = fitLen(snTxt, SN_CHAR_W, SN_MAX).toFixed(3);
            lines.push(
              `<text x="26.000" y="23.500" font-family="${FONT_FAMILY}" font-size="2.25" font-weight="400" fill="#FF0000" text-anchor="start" textLength="${len}" lengthAdjust="spacingAndGlyphs">${escHtml(snTxt)}</text>`,
            );
          }
          lines.push('</g>');
          return lines.join('\n      ');
        })
        .join('\n    ');

      // Calque 3 : quadrillage fin entre étiquettes (mode SCAN/CUT LightBurn).
      // Trait noir 0.05 mm, dessine UNIQUEMENT les lignes intérieures + le
      // contour de la plaque (pas de doublons sur les bords intérieurs).
      const gridLines = [];
      // Contour plaque
      gridLines.push(`<rect x="0" y="0" width="${PLATE}" height="${PLATE}" fill="none" />`);
      // Lignes verticales intérieures
      for (let c = 1; c < COLS; c++) {
        const x = (c * LBL_W).toFixed(3);
        gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${PLATE}" />`);
      }
      // Lignes horizontales intérieures
      for (let r = 1; r < ROWS; r++) {
        const y = (r * LBL_H).toFixed(3);
        gridLines.push(`<line x1="0" y1="${y}" x2="${PLATE}" y2="${y}" />`);
      }
      const gridLayer = gridLines.join('\n    ');

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     version="1.1"
     width="${PLATE}mm" height="${PLATE}mm"
     viewBox="0 0 ${PLATE} ${PLATE}">
  <!-- LightBurn plate ${PLATE}x${PLATE} mm — ${COLS}x${ROWS} = ${PER_PAGE} labels (${LBL_W}x${LBL_H} mm) -->
  <!-- Page ${p + 1}/${totalPages} — ${pageItems.length} étiquettes -->
  <!-- CALQUE 1 GLOBAL : tous les QR + logos (mode IMAGE LightBurn) -->
  <g id="QR_IMAGE" inkscape:label="QR_IMAGE" inkscape:groupmode="layer" style="image-rendering:pixelated">
    ${qrLayer}
  </g>
  <!-- CALQUE 2 GLOBAL : tous les textes (LightBurn C02 #FF0000 → mode FILL) -->
  <g id="TEXT_FILL" inkscape:label="TEXT_FILL" inkscape:groupmode="layer" fill="#FF0000" stroke="none">
    ${textLayer}
  </g>
  <!-- CALQUE 3 GLOBAL : quadrillage fin (LightBurn C01 #000000 → mode LINE) -->
  <g id="GRID" inkscape:label="GRID" inkscape:groupmode="layer" fill="none" stroke="#000000" stroke-width="0.05">
    ${gridLayer}
  </g>
</svg>`;

      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plaque-etiquettes-${ts}-${p + 1}-sur-${totalPages}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Laisse le temps au navigateur d'enchaîner les téléchargements
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 120));
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="ebl-container">
      {/* Barre de sélection */}
      <div className="ebl-toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par référence, nom, UID..."
          size="sm"
        />

        <Button variant="ghost" className="ebl-select-all" onClick={selectAll}>
          {selectedIds.size === totalEquipment ? <CheckSquare size={14} /> : <Square size={14} />}
          {selectedIds.size === totalEquipment ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Button>

        <div className="ebl-logo-toggle">
          <span>Logo entreprise :</span>
          <Button
            variant="ghost"
            className={`ebl-toggle-btn ${showLogo ? 'active' : ''}`}
            onClick={() => setShowLogo(true)}
          >
            Avec
          </Button>
          <Button
            variant="ghost"
            className={`ebl-toggle-btn ${!showLogo ? 'active' : ''}`}
            onClick={() => setShowLogo(false)}
          >
            Sans
          </Button>
        </div>

        <div className="ebl-toolbar-actions">
          <Button
            variant="ghost"
            className="ebl-btn-export"
            onClick={handleExportBatchSVG}
            disabled={totalSelected === 0}
          >
            <Download size={16} />
            Exporter (200 × 200 mm) {totalSelected > 0 ? `— ${totalSelected}` : ''}
          </Button>
          <Button
            variant="ghost"
            className="ebl-btn-print"
            onClick={handlePrintBatch}
            disabled={totalSelected === 0}
          >
            <Printer size={16} />
            Imprimer (A4){' '}
            {totalSelected > 0 ? `— ${totalSelected} étiquette${totalSelected > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>

      {/* Info sélection */}
      <div className="ebl-selection-info">
        <Tag size={14} />
        <span>
          {totalSelected} matériel{totalSelected > 1 ? 's' : ''} sélectionné
          {totalSelected > 1 ? 's' : ''}
        </span>
        <span className="ebl-page-info">
          ({Math.ceil(totalSelected / calcLayout().perPage) || 0} page
          {Math.ceil(totalSelected / calcLayout().perPage) > 1 ? 's' : ''} A4)
        </span>
      </div>

      {/* Split : liste à gauche, récap sélection à droite */}
      <div className="ebl-content">
        {/* Liste par référence */}
        <div className="ebl-list">
          {filteredGroups.map(([ref, items]) => {
            const allChecked = items.every((eq) => selectedIds.has(eq.id));
            const someChecked = items.some((eq) => selectedIds.has(eq.id));
            const collapsed = collapsedRefs.has(ref);

            return (
              <div key={ref} className="ebl-group">
                <div
                  className="ebl-group-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleCollapse(ref)}
                >
                  <Button variant="ghost" className="ebl-collapse-btn">
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </Button>
                  <Button
                    variant="ghost"
                    className={`ebl-checkbox ${allChecked ? 'checked' : someChecked ? 'partial' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRef(ref, items);
                    }}
                  >
                    {allChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                  </Button>
                  <span className="ebl-group-ref">{ref}</span>
                  <span className="ebl-group-count">
                    {items.length} unité{items.length > 1 ? 's' : ''}
                  </span>
                </div>
                {!collapsed && (
                  <div className="ebl-group-items">
                    {items.map((eq) => (
                      <div
                        key={eq.id}
                        className={`ebl-item ${selectedIds.has(eq.id) ? 'selected' : ''}`}
                      >
                        <Button
                          variant="ghost"
                          className={`ebl-checkbox ${selectedIds.has(eq.id) ? 'checked' : ''}`}
                          onClick={() => toggleSingle(eq.id)}
                        >
                          {selectedIds.has(eq.id) ? (
                            <CheckSquare size={14} />
                          ) : (
                            <Square size={14} />
                          )}
                        </Button>
                        <div className="ebl-item-info">
                          {eq.uid && <span className="ebl-uid">UID: {eq.uid}</span>}
                          {(eq.serialNumber || eq.serial_number) && (
                            <span className="ebl-sn">
                              S/N: {eq.serialNumber || eq.serial_number}
                            </span>
                          )}
                          {eq.name && <span className="ebl-name">{cleanName(eq.name)}</span>}
                        </div>
                        {/* Mini-aperçu */}
                        <div className="ebl-mini-preview">
                          <div className="ebl-mini-label">
                            {showLogo && (
                              <img
                                src="/Logos/logo_Noir_Transp.png"
                                alt="Logo eM@g"
                                className="ebl-mini-logo"
                              />
                            )}
                            <div>
                              <div className="ebl-mini-ref">{eq.reference}</div>
                              {eq.uid && (
                                <div className="ebl-mini-uid">
                                  <b>{eq.uid}</b>
                                </div>
                              )}
                            </div>
                            <QRCodeSVG
                              value={eq.uid ? `${APP_BASE_URL}/#/mobile/equipment/${eq.uid}` : '#'}
                              size={24}
                              level="L"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Panneau récap sélection (droite) */}
        <aside className="ebl-selection-panel" aria-label="Récapitulatif de la sélection">
          <div className="ebl-selection-panel-header">
            <Tag size={14} />
            <span className="ebl-selection-panel-title">Sélection ({totalSelected})</span>
            {totalSelected > 0 && (
              <Button
                variant="ghost"
                className="ebl-selection-clear"
                onClick={() => setSelectedIds(new Set())}
                title="Tout désélectionner"
              >
                <X size={12} /> Vider
              </Button>
            )}
          </div>
          {totalSelected === 0 ? (
            <div className="ebl-selection-empty">
              Aucun équipement sélectionné.
              <br />
              Cochez des matériels à gauche pour visualiser l'export.
            </div>
          ) : (
            <table className="ebl-selection-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>N° série</th>
                  <th>UID</th>
                  <th>N° MAG</th>
                  <th aria-label="Retirer" />
                </tr>
              </thead>
              <tbody>
                {equipment
                  .filter((eq) => selectedIds.has(eq.id))
                  .map((eq) => (
                    <tr key={eq.id}>
                      <td className="ebl-sel-ref" title={cleanName(eq.name)}>
                        {eq.reference || '—'}
                      </td>
                      <td className="ebl-sel-sn">{eq.serialNumber || eq.serial_number || '—'}</td>
                      <td className="ebl-sel-uid">{eq.uid || '—'}</td>
                      <td className="ebl-sel-mag">{eq.numeroMag || eq.numero_mag || '—'}</td>
                      <td>
                        <Button
                          variant="ghost"
                          className="ebl-sel-remove"
                          onClick={() => toggleSingle(eq.id)}
                          title="Retirer de la sélection"
                          aria-label="Retirer"
                        >
                          <X size={12} />
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </aside>
      </div>
    </div>
  );
};

export default EquipmentBatchLabels;
