// ═══════════════════════════════════════════════════════════════
// BPAnnotationViewer — Visualiseur PDF annoté (canvas overlay)
// Surlignage familles, encadrement kits, bloc infos affaire
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  X, Download, Printer, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, Palette, Info, Layers,
} from 'lucide-react';
import { FAMILY_COLORS } from '../../utils/bpAnnotationEngine';
import './BPAnnotationViewer.css';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

const SCALE_DEFAULT = 1.5;
const SCALE_MIN = 0.5;
const SCALE_MAX = 3.0;
const SCALE_STEP = 0.25;

export default function BPAnnotationViewer({ annotationResult, pdfUrl, onClose }) {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(SCALE_DEFAULT);
  const [showLegend, setShowLegend] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [rendering, setRendering] = useState(false);

  const { annotatedItems = [], kits = [], sections = [], stats = {}, infoLines = [], affaire, blImport } = annotationResult || {};

  // ─── Charger le PDF ───
  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(pdfUrl);
        const buf = await resp.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('Erreur chargement PDF:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // ─── Rendre la page + annotations ───
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !overlayCanvasRef.current) return;
    setRendering(true);
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      // Canvas PDF
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Canvas overlay (annotations)
      const overlay = overlayCanvasRef.current;
      overlay.width = viewport.width;
      overlay.height = viewport.height;
      const octx = overlay.getContext('2d');
      octx.clearRect(0, 0, overlay.width, overlay.height);

      // Extraire les items texte pour matcher les positions
      const textContent = await page.getTextContent();
      const textItems = textContent.items.filter(i => i.str.trim());

      // Annoter les lignes détectées
      drawAnnotations(octx, textItems, viewport);

      // Bloc info affaire (coin sup. droit)
      if (showInfo && infoLines.length > 0) {
        drawInfoBlock(octx, viewport.width, infoLines);
      }
    } catch (err) {
      console.error('Erreur rendu page:', err);
    }
    setRendering(false);
  }, [pdfDoc, currentPage, scale, showInfo, annotatedItems, kits, sections, infoLines]);

  useEffect(() => { renderPage(); }, [renderPage]);

  // ─── Dessiner les annotations sur le canvas overlay ───
  function drawAnnotations(ctx, textItems, viewport) {
    // Construire un index de correspondance: description/référence → famille
    const itemMap = new Map();
    for (const item of annotatedItems) {
      if (item.description) itemMap.set(item.description.trim().toLowerCase(), item);
      if (item.reference) itemMap.set(item.reference.trim().toLowerCase(), item);
    }

    // Construire un index de sections
    const sectionMap = new Map();
    for (const sec of sections) {
      sectionMap.set(sec.name.toUpperCase(), sec);
    }

    // Parcourir les items texte du PDF
    for (const ti of textItems) {
      const text = ti.str.trim();
      if (!text) continue;

      const tx = pdfjsLib.Util.transform(viewport.transform, ti.transform);
      const x = tx[4];
      const y = tx[5] - ti.height;
      const w = ti.width;
      const h = ti.height + 4;

      // Match par titre de section (surlignage fort)
      const upText = text.toUpperCase();
      if (sectionMap.has(upText)) {
        const sec = sectionMap.get(upText);
        if (sec.color) {
          ctx.fillStyle = sec.color.bg.replace(/[\d.]+\)$/, '0.45)');
          ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
          ctx.strokeStyle = sec.color.border;
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        }
        continue;
      }

      // Match par description/référence d'article
      const lower = text.toLowerCase();
      const matched = itemMap.get(lower);
      if (matched?._color) {
        ctx.fillStyle = matched._color.bg;
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      }
    }

    // Encadrement des kits
    drawKitFrames(ctx, textItems, viewport);
  }

  // ─── Encadrer les kits ───
  function drawKitFrames(ctx, textItems, viewport) {
    for (const kit of kits) {
      if (!kit.color || kit.items.length < 2) continue;

      // Trouver les bornes Y du kit dans le PDF
      const kitTexts = new Set();
      for (const item of kit.items) {
        if (item.description) kitTexts.add(item.description.trim().toLowerCase());
        if (item.reference) kitTexts.add(item.reference.trim().toLowerCase());
      }

      let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
      let found = 0;
      for (const ti of textItems) {
        if (kitTexts.has(ti.str.trim().toLowerCase())) {
          const tx = pdfjsLib.Util.transform(viewport.transform, ti.transform);
          const x = tx[4];
          const y = tx[5] - ti.height;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + ti.width);
          maxY = Math.max(maxY, y + ti.height);
          found++;
        }
      }

      if (found >= 2) {
        const pad = 6;
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = kit.color.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2);
        ctx.setLineDash([]);

        // Label du kit
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = kit.color.border;
        ctx.fillText(`📦 ${kit.title}`, minX - pad, minY - pad - 4);
      }
    }
  }

  // ─── Bloc infos affaire (coin supérieur droit) ───
  function drawInfoBlock(ctx, canvasWidth, lines) {
    const blockW = 260;
    const padding = 12;
    const lineH = 16;
    const x = canvasWidth - blockW - 20;
    const y = 20;
    const totalH = padding * 2 + lines.length * lineH + 8;

    // Fond
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, blockW, totalH, 8);
    ctx.fill();
    ctx.stroke();

    // Titre
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`📋 ${affaire?.nom || 'Affaire'}`, x + padding, y + padding + 10);

    // Lignes
    let cy = y + padding + 28;
    for (const line of lines) {
      if (line.type === 'header') {
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#4338ca';
      } else if (line.type === 'more') {
        ctx.font = 'italic 9px sans-serif';
        ctx.fillStyle = '#94a3b8';
      } else {
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#334155';
      }
      ctx.fillText(line.text, x + padding + 4, cy);
      cy += lineH;
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ─── Actions ───
  const handlePrint = () => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas || !overlay) return;

    // Fusionner les deux canvas
    const merged = document.createElement('canvas');
    merged.width = canvas.width;
    merged.height = canvas.height;
    const mctx = merged.getContext('2d');
    mctx.drawImage(canvas, 0, 0);
    mctx.drawImage(overlay, 0, 0);

    const dataUrl = merged.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html><head><title>BP Annoté — ${affaire?.nom || ''}</title>
        <style>@media print { body { margin: 0; } img { width: 100%; height: auto; } }</style>
        </head><body><img src="${dataUrl}" onload="window.print();window.close()"/></body></html>
      `);
      win.document.close();
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas || !overlay) return;

    const merged = document.createElement('canvas');
    merged.width = canvas.width;
    merged.height = canvas.height;
    const mctx = merged.getContext('2d');
    mctx.drawImage(canvas, 0, 0);
    mctx.drawImage(overlay, 0, 0);

    merged.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BP_Annote_${affaire?.nom || 'export'}_p${currentPage}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  // ─── Rendu ───
  return (
    <div className="bp-annotation-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="bp-annotation-modal">
        {/* Header */}
        <div className="bp-annotation-header">
          <div className="bp-annotation-title">
            <Palette size={18} />
            <span>BP Annoté — {affaire?.nom || 'Affaire'}</span>
            {blImport?.filename && <span className="bp-filename">{blImport.filename}</span>}
          </div>
          <div className="bp-annotation-toolbar">
            <button onClick={() => setScale(s => Math.max(SCALE_MIN, s - SCALE_STEP))} title="Zoom -"><ZoomOut size={16} /></button>
            <span className="bp-zoom-label">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(SCALE_MAX, s + SCALE_STEP))} title="Zoom +"><ZoomIn size={16} /></button>
            <div className="bp-toolbar-sep" />
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}><ChevronLeft size={16} /></button>
            <span className="bp-page-label">{currentPage} / {numPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}><ChevronRight size={16} /></button>
            <div className="bp-toolbar-sep" />
            <button className={showLegend ? 'active' : ''} onClick={() => setShowLegend(v => !v)} title="Légende"><Layers size={16} /></button>
            <button className={showInfo ? 'active' : ''} onClick={() => setShowInfo(v => !v)} title="Infos affaire"><Info size={16} /></button>
            <div className="bp-toolbar-sep" />
            <button onClick={handlePrint} title="Imprimer"><Printer size={16} /></button>
            <button onClick={handleDownload} title="Télécharger"><Download size={16} /></button>
          </div>
          <button className="bp-annotation-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="bp-annotation-body" ref={containerRef}>
          {/* Légende */}
          {showLegend && (
            <div className="bp-legend">
              <div className="bp-legend-title">Familles</div>
              {sections.filter(s => s.color).map(sec => (
                <div key={sec.name} className="bp-legend-item">
                  <span className="bp-legend-swatch" style={{ background: sec.color.bg, borderColor: sec.color.border }} />
                  <span>{sec.color.label || sec.name}</span>
                  <span className="bp-legend-count">{sec.items.length}</span>
                </div>
              ))}
              {stats.kitsCount > 0 && (
                <div className="bp-legend-item">
                  <span className="bp-legend-swatch bp-legend-kit" />
                  <span>Kits détectés</span>
                  <span className="bp-legend-count">{stats.kitsCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Canvas layers */}
          <div className="bp-canvas-container">
            {rendering && <div className="bp-rendering-indicator">Rendu en cours…</div>}
            <canvas ref={canvasRef} className="bp-canvas-pdf" />
            <canvas ref={overlayCanvasRef} className="bp-canvas-overlay" />
          </div>
        </div>

        {/* Footer stats */}
        <div className="bp-annotation-footer">
          <span>{stats.total || 0} articles</span>
          <span>{stats.matched || 0} matchés</span>
          <span>{stats.kitsCount || 0} kits</span>
          <span>{Object.keys(stats.byFamily || {}).length} familles</span>
        </div>
      </div>
    </div>
  );
}
