// ═══════════════════════════════════════════════════════════════
// BPAnnotationViewer — Visualiseur PDF avec annotations famille
// Surlignage automatique par famille métier (Sono, Lumière, etc.)
// ═══════════════════════════════════════════════════════════════
import './BPAnnotationViewer.css';

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Layers,
  Maximize2,
  Printer,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Modal, ModalBody, ModalFooter, ModalHeader, Tooltip } from '@/design-system';

import { AVATAR_COLORS } from '../../constants/colors';
import { FAMILY_COLORS } from '../../utils/bpAnnotationEngine';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

const SCALE_MIN = 0.5;
const SCALE_MAX = 3.0;
const SCALE_STEP = 0.25;

// ─── Regrouper les items texte en lignes par proximité Y ───
function groupTextIntoLines(textItems, viewport) {
  // Identifier la police principale (la plus fréquente = régulière)
  // Toute autre police est considérée comme italique/variante
  const fontCounts = {};
  for (const item of textItems) {
    const fn = item.fontName || '';
    fontCounts[fn] = (fontCounts[fn] || 0) + 1;
  }
  const mainFont = Object.entries(fontCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const positioned = textItems
    .map((item) => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const isMainFont = (item.fontName || '') === mainFont;
      const rawT = item.transform;
      const hasShear = Math.abs(rawT[1]) > 0.01 || Math.abs(rawT[2]) > 0.01;
      return {
        text: item.str.trim(),
        x: tx[4],
        y: tx[5],
        width: item.width * viewport.scale,
        height: Math.abs(tx[3] - tx[1]) || item.height * viewport.scale || 12,
        italic: !isMainFont || hasShear,
      };
    })
    .filter((p) => p.text.length > 0);

  const tolerance = 4;
  const lines = [];
  const sorted = [...positioned].sort((a, b) => a.y - b.y);

  for (const item of sorted) {
    const existing = lines.find((l) => Math.abs(l.y - item.y) < tolerance);
    if (existing) {
      existing.items.push(item);
      existing.text += ' ' + item.text;
      existing.minX = Math.min(existing.minX, item.x);
      existing.maxX = Math.max(existing.maxX, item.x + item.width);
      existing.height = Math.max(existing.height, item.height);
      // Pondérer l'italic par la longueur du texte (ignore les colonnes numériques "1", "0")
      existing.italicChars = (existing.italicChars || 0) + (item.italic ? item.text.length : 0);
      existing.totalChars = (existing.totalChars || 0) + item.text.length;
    } else {
      lines.push({
        y: item.y,
        height: item.height,
        minX: item.x,
        maxX: item.x + item.width,
        text: item.text,
        items: [item],
        italicChars: item.italic ? item.text.length : 0,
        totalChars: item.text.length,
      });
    }
  }

  // Marquer les lignes comme italic si la majorité du TEXTE (en caractères) est en police italique
  for (const line of lines) {
    line.italic = (line.italicChars || 0) > (line.totalChars || 1) / 2;
  }

  return lines;
}

// ─── Dessiner les annotations sur l'overlay ───
function drawAnnotations(ctx, lines, viewport, annotationData) {
  const { sections = [], annotatedItems = [], _kits = [] } = annotationData;
  if (lines.length === 0) return;

  // Index section -> couleur
  const sectionFamilyMap = {};
  for (const s of sections) {
    if (s.color) sectionFamilyMap[s.name.toUpperCase()] = s.color;
  }

  // Index d'items par référence et description (normalisés)
  const itemsByRef = new Map();
  const itemsByDesc = new Map();
  for (const item of annotatedItems) {
    if (item.reference) {
      const key = item.reference.toUpperCase().trim();
      if (!itemsByRef.has(key)) itemsByRef.set(key, item);
    }
    if (item.description && item.description.length > 5) {
      const key = item.description.toUpperCase().trim();
      if (!itemsByDesc.has(key)) itemsByDesc.set(key, item);
    }
  }

  const margin = 10;

  // Fonction : la ligne est-elle un header de kit ?
  function isKitHeader(text) {
    return /\bCOMPRENANT\s*:/i.test(text) || /\bliaison\s+UHF\b/i.test(text);
  }

  // Fonction : la ligne est-elle un en-tête de section ?
  function isSectionLine(text) {
    const upper = text.toUpperCase().trim();
    for (const secName of Object.keys(sectionFamilyMap)) {
      if (upper.includes(secName) || secName.includes(upper)) {
        return sectionFamilyMap[secName];
      }
    }
    return null;
  }

  // Fonction : trouver la couleur d'un article annoté qui matche une ligne
  function findItemColor(text) {
    const upper = text.toUpperCase().trim();
    // Par référence
    for (const [ref, item] of itemsByRef) {
      if (upper.includes(ref) && item._color) return item._color;
    }
    // Par description
    for (const [desc, item] of itemsByDesc) {
      const words = desc.split(/\s+/).filter((w) => w.length > 2);
      if (words.length === 0) continue;
      const matchCount = words.filter((w) => upper.includes(w)).length;
      if (matchCount / words.length >= 0.6 && item._color) return item._color;
    }
    return null;
  }

  // ─── Pré-passe : assigner la couleur de section courante à chaque ligne ───
  let currentSectionColor = null;
  for (const line of lines) {
    const secColor = isSectionLine(line.text);
    if (secColor) currentSectionColor = secColor;
    line._sectionColor = currentSectionColor;
  }

  // ─── Passe 1 : détecter les blocs kit ───
  // Un kit = ligne précédente + ligne COMPRENANT: + lignes italiques suivantes
  const kitBlocks = [];

  for (let i = 0; i < lines.length; i++) {
    if (!isKitHeader(lines[i].text)) continue;

    // Couleur du kit : d'abord essayer via l'article de la ligne précédente,
    // puis via la section courante, puis fallback divers
    let kitColor = null;
    if (i > 0) kitColor = findItemColor(lines[i - 1].text);
    if (!kitColor) kitColor = lines[i]._sectionColor;
    if (!kitColor) kitColor = FAMILY_COLORS.divers;

    // Inclure la ligne précédente seulement pour COMPRENANT (titre de l'article kit)
    const isComprenant = /\bCOMPRENANT\s*:/i.test(lines[i].text);
    const startIdx = isComprenant && i > 0 ? i - 1 : i;

    // Collecter les lignes italiques qui suivent (= sous-items du kit)
    let endIdx = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].italic) {
        endIdx = j;
      } else {
        break;
      }
    }

    kitBlocks.push({ startIdx, endIdx, color: kitColor });
  }

  // Set des lignes appartenant à un kit pour ne pas les surligner individuellement
  const kitLineIndices = new Set();
  for (const kb of kitBlocks) {
    for (let k = kb.startIdx; k <= kb.endIdx; k++) kitLineIndices.add(k);
  }

  // ─── Passe 2 : surlignage individuel des lignes (hors kits) ───
  for (let i = 0; i < lines.length; i++) {
    if (kitLineIndices.has(i)) continue;

    const line = lines[i];
    let color = null;
    let isSection = false;

    // 1. Matcher en-tête de section
    const secColor = isSectionLine(line.text);
    if (secColor) {
      color = secColor;
      isSection = true;
    }

    // 2. Matcher article — priorité à la couleur de section courante
    if (!color) {
      const itemColor = findItemColor(line.text);
      if (itemColor) {
        // Utiliser la couleur de la section courante si disponible,
        // sinon celle de l'item (par mots-clés)
        color = line._sectionColor || itemColor;
      }
    }

    if (!color) continue;

    // Dessiner le surlignage
    ctx.save();
    ctx.globalAlpha = isSection ? 0.4 : 0.25;
    ctx.fillStyle = color.bg || color;

    const rectH = isSection ? line.height + 8 : line.height + 4;
    const rectY = line.y - rectH + 2 + 6;
    const rectX = margin;
    const rectW = viewport.width - 2 * margin - 20;

    ctx.fillRect(rectX, rectY, rectW, rectH);

    // Bordure gauche colorée pour les sections
    if (isSection) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color.border || color.bg;
      ctx.fillRect(rectX, rectY, 4, rectH);
    }

    ctx.restore();
  }

  // ─── Passe 3 : encadrer les blocs kit ───
  for (const kb of kitBlocks) {
    const firstLine = lines[kb.startIdx];
    const lastLine = lines[kb.endIdx];
    const color = kb.color;

    const rectX = margin;
    const rectW = viewport.width - 2 * margin - 20;
    const topY = firstLine.y - firstLine.height - 2 + 6;
    const bottomY = lastLine.y + 6 + 6;
    const rectH = bottomY - topY;

    // Fond léger
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = color.bg || color;
    ctx.fillRect(rectX, topY, rectW, rectH);

    // Encadrement
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = color.border || color.bg;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(rectX, topY, rectW, rectH);
    ctx.setLineDash([]);

    // Bordure gauche pleine
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color.border || color.bg;
    ctx.fillRect(rectX, topY, 4, rectH);

    ctx.restore();
  }
}

// ─── Bloc infos affaire (coin supérieur droit) ───
function drawInfoBlock(ctx, canvasWidth, lines, affaireData, scale) {
  // On écrit directement dans le cadre vide existant du BP (coin supérieur droit)
  // Coordonnées en points PDF, mises à l'échelle
  const s = scale || 1.5;
  const padding = 8 * s;
  const lineH = 13 * s;
  // Position du cadre dans le BP (approx. top-right)
  const x = canvasWidth - 356 * s;
  const y = 125 * s;

  // Couleurs pour les avatars personnel (rotation)
  const avatarColors = AVATAR_COLORS;
  let avatarIdx = 0;

  let cy = y;
  for (const line of lines) {
    if (line.type === 'header') {
      cy += 5 * s; // espacement avant chaque section
      ctx.font = `bold ${Math.round(9 * s)}px sans-serif`;
      ctx.fillStyle = '#4338ca';
      ctx.fillText(line.text, x + padding, cy);
    } else if (line.type === 'more') {
      ctx.font = `italic ${Math.round(7.5 * s)}px sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(line.text, x + padding, cy);
    } else if (line.type === 'person') {
      // Mini avatar : cercle coloré + initiales
      const r = 5 * s;
      const cx = x + padding + r;
      const color = avatarColors[avatarIdx % avatarColors.length];
      avatarIdx++;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.4, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // Initiales dans le cercle
      ctx.font = `bold ${Math.round(5 * s)}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(line.initials, cx, cy - r * 0.4 + 2 * s);
      ctx.textAlign = 'start';
      // Nom à droite du cercle
      ctx.font = `${Math.round(8 * s)}px sans-serif`;
      ctx.fillStyle = '#334155';
      ctx.fillText(line.text, x + padding + r * 2 + 4 * s, cy);
    } else {
      ctx.font = `${Math.round(8 * s)}px sans-serif`;
      ctx.fillStyle = '#334155';
      ctx.fillText(line.text, x + padding, cy);
    }
    cy += lineH;
  }
}

function _roundRect(ctx, x, y, w, h, r) {
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

// ═══════════════════════════════════════════════════════════════
// Sous-composant : rend UNE page PDF + son overlay d'annotations
// (2 canvas empilés). Utilisé dans la pile verticale du visualiseur.
// ═══════════════════════════════════════════════════════════════
function PdfPage({ pageNum, pdfDoc, scale, data, showInfo, affaire, infoLines, onWrapperRef }) {
  const pdfCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Expose le wrapper au parent (IntersectionObserver + scroll programmatique).
  useEffect(() => {
    if (wrapperRef.current && onWrapperRef) {
      onWrapperRef(pageNum, wrapperRef.current);
    }
    return () => {
      if (onWrapperRef) onWrapperRef(pageNum, null);
    };
  }, [pageNum, onWrapperRef]);

  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current || !overlayCanvasRef.current) return undefined;
    let cancelled = false;

    (async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }
        const page = await pdfDoc.getPage(pageNum);
        const rotation = page.rotate || 0;
        const viewport = page.getViewport({ scale, rotation });

        const canvas = pdfCanvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
        if (cancelled) return;

        const overlay = overlayCanvasRef.current;
        overlay.width = viewport.width;
        overlay.height = viewport.height;
        const octx = overlay.getContext('2d');
        octx.clearRect(0, 0, overlay.width, overlay.height);

        const textContent = await page.getTextContent();
        const textItems = textContent.items.filter((i) => i.str.trim());
        const lines = groupTextIntoLines(textItems, viewport);

        drawAnnotations(octx, lines, viewport, data);

        if (pageNum === 1 && showInfo && infoLines.length > 0) {
          drawInfoBlock(octx, viewport.width, infoLines, affaire, scale);
        }
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Erreur rendu page', pageNum, err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNum, scale, data, showInfo, infoLines, affaire]);

  return (
    <div
      ref={wrapperRef}
      className="bp-page-wrapper"
      data-page-num={pageNum}
      aria-label={`Page ${pageNum}`}
    >
      <div className="bp-page-label-overlay">Page {pageNum}</div>
      <div className="bp-canvas-wrapper">
        <canvas ref={pdfCanvasRef} className="bp-canvas-pdf" />
        <canvas ref={overlayCanvasRef} className="bp-canvas-overlay" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Composant principal
// ═══════════════════════════════════════════════════════════════
export default function BPAnnotationViewer({ annotationResult, pdfUrl, onClose }) {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const pageRefsRef = useRef(new Map());

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(null); // null = auto-fit
  const [autoScale, setAutoScale] = useState(1.25);
  const [showLegend, setShowLegend] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = annotationResult || {};
  const { sections = [], stats = {}, infoLines = [], affaire, blImport, _kits = [] } = data;

  // ─── Charger le PDF ───
  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    setLoading(true);
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // ─── Echelle auto-fit : la page doit tenir dans la HAUTEUR du modal ───
  const computeAutoScale = useCallback(async () => {
    if (!pdfDoc || !containerRef.current) return 1.25;
    try {
      const page = await pdfDoc.getPage(1);
      const vp = page.getViewport({ scale: 1, rotation: page.rotate || 0 });
      const container = containerRef.current;
      const legendW = showLegend ? 200 : 0;
      const cw = container.clientWidth - legendW - 40;
      const ch = container.clientHeight - 40;
      // On contraint à la fois par largeur et hauteur ; la hauteur est
      // la contrainte principale demandée par l'utilisateur (la page tient
      // dans le modal), la largeur sert de garde-fou si la légende est large.
      return Math.max(0.8, Math.min(cw / vp.width, ch / vp.height, SCALE_MAX));
    } catch {
      return 1.25;
    }
  }, [pdfDoc, showLegend]);

  // Recalcule autoScale quand pdfDoc / légende / resize change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await computeAutoScale();
      if (!cancelled) setAutoScale(s);
    })();
    const onResize = async () => {
      const s = await computeAutoScale();
      if (!cancelled) setAutoScale(s);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
    };
  }, [computeAutoScale]);

  // Echelle effective utilisée pour le rendu de toutes les pages.
  const effectiveScale = scale ?? autoScale;

  // ─── Suivre la page la plus visible via IntersectionObserver ───
  useEffect(() => {
    if (!scrollRef.current || numPages === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage = null;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            const num = Number(entry.target.dataset.pageNum);
            if (Number.isFinite(num)) bestPage = num;
          }
        }
        if (bestPage) setCurrentPage(bestPage);
      },
      {
        root: scrollRef.current,
        rootMargin: '-30% 0px -50% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );
    for (const el of pageRefsRef.current.values()) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [numPages, pdfDoc]);

  // Enregistre la ref d'un wrapper de page (depuis le sous-composant PdfPage).
  const registerPageRef = useCallback((pageNum, el) => {
    if (el) {
      pageRefsRef.current.set(pageNum, el);
    } else {
      pageRefsRef.current.delete(pageNum);
    }
  }, []);

  // Scrolle vers une page donnée (depuis les boutons précédent/suivant).
  const scrollToPage = useCallback((pageNum) => {
    const el = pageRefsRef.current.get(pageNum);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // ─── Rendre une page donnée avec annotations sur un canvas temporaire ───
  const renderPageToCanvas = useCallback(
    async (pageNum, targetScale) => {
      if (!pdfDoc) return null;
      const page = await pdfDoc.getPage(pageNum);
      const rotation = page.rotate || 0;
      const viewport = page.getViewport({ scale: targetScale, rotation });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      // Rendre le PDF
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Dessiner les annotations
      const textContent = await page.getTextContent();
      const textItems = textContent.items.filter((i) => i.str.trim());
      const lines = groupTextIntoLines(textItems, viewport);
      drawAnnotations(ctx, lines, viewport, data);

      // Bloc info sur la première page
      if (pageNum === 1 && showInfo && infoLines.length > 0) {
        drawInfoBlock(ctx, viewport.width, infoLines, affaire, targetScale);
      }

      return canvas;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [pdfDoc, data, showInfo, infoLines, affaire],
  );

  // ─── Impression multi-pages ───
  const handlePrint = useCallback(async () => {
    if (!pdfDoc) return;
    const printScale = effectiveScale;
    const images = [];

    for (let p = 1; p <= numPages; p++) {
      const canvas = await renderPageToCanvas(p, printScale);
      if (canvas) images.push(canvas.toDataURL('image/png'));
    }

    if (images.length === 0) return;

    const win = window.open('', '_blank');
    if (win) {
      const imgsHtml = images
        .map(
          (src, i) =>
            '<img src="' +
            src +
            '" alt="BP annoté page ' +
            (i + 1) +
            '" style="width:100%;height:auto;display:block;' +
            (i < images.length - 1 ? 'page-break-after:always;' : '') +
            '" />',
        )
        .join('');

      win.document.write(
        '<html><head><title>BP Annoté</title>' +
          '<style>@media print { body { margin: 0; } } body { margin: 0; }</style>' +
          '</head><body>' +
          imgsHtml +
          '<script>window.onload=function(){window.print();window.close();}</scr' +
          'ipt></body></html>',
      );
      win.document.close();
    }
  }, [pdfDoc, numPages, effectiveScale, renderPageToCanvas]);

  // ─── Téléchargement (page courante avec annotations) ───
  const handleDownload = useCallback(async () => {
    if (!pdfDoc) return;
    const dlScale = effectiveScale;
    const canvas = await renderPageToCanvas(currentPage, dlScale);
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BP_Annote_${affaire?.nom || 'export'}_p${currentPage}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [pdfDoc, affaire, currentPage, effectiveScale, renderPageToCanvas]);

  // ─── Zoom ───
  const zoomIn = () => setScale((s) => Math.min(SCALE_MAX, (s ?? autoScale) + SCALE_STEP));
  const zoomOut = () => setScale((s) => Math.max(SCALE_MIN, (s ?? autoScale) - SCALE_STEP));
  const zoomFit = () => setScale(null);

  // ─── Raccourcis clavier ───
  useEffect(() => {
    const handle = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') scrollToPage(Math.max(1, currentPage - 1));
      if (e.key === 'ArrowRight') scrollToPage(Math.min(numPages, currentPage + 1));
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, onClose, currentPage]);

  const displayScale = effectiveScale;

  // ─── Rendu ───
  return (
    <Modal open={true} onClose={onClose} size="full" className="bp-annotation-modal">
      <ModalHeader onClose={onClose}>
        <div className="bp-annotation-title">
          <span>BP Annoté — {affaire?.nom || 'Affaire'}</span>
          {blImport?.filename && <span className="bp-filename">{blImport.filename}</span>}
        </div>
        <div className="bp-annotation-toolbar">
          <Tooltip content="Zoom -">
            <Button variant="ghost" iconOnly size="sm" onClick={zoomOut} aria-label="Zoom arrière">
              <ZoomOut size={16} />
            </Button>
          </Tooltip>
          <span className="bp-zoom-label">{Math.round(displayScale * 100)}%</span>
          <Tooltip content="Zoom +">
            <Button variant="ghost" iconOnly size="sm" onClick={zoomIn} aria-label="Zoom avant">
              <ZoomIn size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Ajuster">
            <Button variant="ghost" iconOnly size="sm" onClick={zoomFit} aria-label="Ajuster">
              <Maximize2 size={16} />
            </Button>
          </Tooltip>
          <div className="bp-toolbar-sep" />
          <Button
            variant="ghost"
            iconOnly
            size="sm"
            onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            aria-label="Page précédente"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="bp-page-label">
            {currentPage} / {numPages}
          </span>
          <Button
            variant="ghost"
            iconOnly
            size="sm"
            onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            aria-label="Page suivante"
          >
            <ChevronRight size={16} />
          </Button>
          <div className="bp-toolbar-sep" />
          <Tooltip content="Légende">
            <Button
              variant="ghost"
              iconOnly
              size="sm"
              className={showLegend ? 'active' : ''}
              onClick={() => setShowLegend((v) => !v)}
              aria-label="Afficher la légende"
            >
              <Layers size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Infos affaire">
            <Button
              variant="ghost"
              iconOnly
              size="sm"
              className={showInfo ? 'active' : ''}
              onClick={() => setShowInfo((v) => !v)}
              aria-label="Afficher les informations"
            >
              <Info size={16} />
            </Button>
          </Tooltip>
          <div className="bp-toolbar-sep" />
          <Tooltip content="Imprimer">
            <Button variant="ghost" iconOnly size="sm" onClick={handlePrint} aria-label="Imprimer">
              <Printer size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Télécharger">
            <Button
              variant="ghost"
              iconOnly
              size="sm"
              onClick={handleDownload}
              aria-label="Télécharger"
            >
              <Download size={16} />
            </Button>
          </Tooltip>
        </div>
      </ModalHeader>

      <ModalBody className="bp-annotation-body">
        <div ref={containerRef} className="bp-annotation-content">
          {/* Légende */}
          {showLegend && (
            <div className="bp-legend">
              <div className="bp-legend-title">Familles</div>
              {sections
                .filter((s) => s.color && s.items.length > 0)
                .map((sec) => (
                  <div key={sec.name} className="bp-legend-item">
                    <span
                      className="bp-legend-swatch"
                      style={{ background: sec.color.bg, borderColor: sec.color.border }}
                    />
                    <span>
                      {sec.color.emoji} {sec.color.label || sec.name}
                    </span>
                    <span className="bp-legend-count">{sec.items.length}</span>
                  </div>
                ))}
              {stats.kitsCount > 0 && (
                <div className="bp-legend-item">
                  <span className="bp-legend-swatch bp-legend-kit" />
                  <span>📦 Kits</span>
                  <span className="bp-legend-count">{stats.kitsCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Liste verticale des pages — scroll vertical natif (molette + scrollbar) */}
          <div ref={scrollRef} className="bp-canvas-scroll">
            {loading && <div className="bp-rendering-indicator">Chargement du PDF...</div>}
            {!loading &&
              pdfDoc &&
              Array.from({ length: numPages }, (_, idx) => idx + 1).map((p) => (
                <PdfPage
                  key={p}
                  pageNum={p}
                  pdfDoc={pdfDoc}
                  scale={effectiveScale}
                  data={data}
                  showInfo={showInfo}
                  affaire={affaire}
                  infoLines={infoLines}
                  onWrapperRef={registerPageRef}
                />
              ))}
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="bp-annotation-footer">
        <span>{stats.total || 0} articles</span>
        <span>{stats.matched || 0} matchés</span>
        <span>{stats.kitsCount || 0} kits</span>
        <span>{Object.keys(stats.byFamily || {}).length} familles</span>
      </ModalFooter>
    </Modal>
  );
}
