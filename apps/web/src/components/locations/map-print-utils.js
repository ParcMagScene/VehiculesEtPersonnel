// ═══════════════════════════════════════════════════════════════
// map-print-utils.js — Impression et export des cartes
// ═══════════════════════════════════════════════════════════════

/**
 * Capture le contenu d'un élément DOM en canvas via html2canvas-like technique
 * et déclenche l'impression du navigateur avec un style A4/A3.
 *
 * @param {HTMLElement} mapContainer - Le conteneur de la carte à capturer
 * @param {'A4'|'A3'} format - Format papier
 * @param {'portrait'|'landscape'} orientation - Orientation
 * @param {string} title - Titre affiché sur l'impression
 */
export async function printMap(mapContainer, { format = 'A4', orientation = 'landscape', title = 'Carte eM@g' } = {}) {
  if (!mapContainer) return;

  // Dimensions en mm selon format
  const sizes = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 },
  };

  const size = sizes[format] || sizes.A4;
  const [w, h] = orientation === 'landscape' ? [size.height, size.width] : [size.width, size.height];

  // Trouver le canvas Leaflet dans le conteneur
  const canvas = mapContainer.querySelector('canvas');
  let imageUrl;

  if (canvas) {
    imageUrl = canvas.toDataURL('image/png');
  } else {
    // Fallback : capturer les tiles via un canvas intermédiaire
    imageUrl = await captureLeafletTiles(mapContainer);
  }

  // Ouvrir une fenêtre d'impression
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const now = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: ${w}mm ${h}mm;
      margin: 10mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1e293b;
    }
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 2px solid #667eea;
      margin-bottom: 8px;
    }
    .print-header h1 {
      font-size: 16px;
      font-weight: 600;
      color: #667eea;
    }
    .print-header .date {
      font-size: 11px;
      color: #64748b;
    }
    .print-map {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .print-footer {
      margin-top: 8px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="print-header">
    <h1>eM@g — ${title}</h1>
    <span class="date">${now}</span>
  </div>
  ${imageUrl ? `<img class="print-map" src="${imageUrl}" alt="Carte" />` : '<p>Carte non disponible pour l\'impression</p>'}
  <div class="print-footer">
    eM@g — Cartographie des lieux &bull; &copy; OpenStreetMap contributors
  </div>
</body>
</html>`);

  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

/**
 * Capture les tiles Leaflet rendues (non-canvas) en convertissant en image
 */
async function captureLeafletTiles(container) {
  try {
    const { default: html2canvas } = await import('html2canvas');

    // Attendre que les tiles soient chargées
    const images = container.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) =>
        img.complete ? Promise.resolve() : new Promise((res) => {
          img.onload = res;
          img.onerror = res;
        })
      )
    );
    await new Promise((r) => setTimeout(r, 300));

    // Masquer les éléments inutiles avant capture
    const hideSelectors = [
      '.leaflet-control-zoom',
      '.leaflet-control-attribution',
      '.map-search-control',
      '.map-route-toggle',
      '.map-route-panel',
      '.map-radius-control',
      '.map-print-control',
    ];
    const hidden = [];
    for (const sel of hideSelectors) {
      container.querySelectorAll(sel).forEach((el) => {
        hidden.push({ el, prev: el.style.display });
        el.style.display = 'none';
      });
    }

    const canvas = await html2canvas(container, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#f8fafc',
      scale: 2,
      logging: false,
      removeContainer: true,
      imageTimeout: 15000,
      foreignObjectRendering: false,
    });

    // Restaurer les éléments masqués
    for (const { el, prev } of hidden) {
      el.style.display = prev;
    }

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('[MapPrint] Capture failed:', err);
    return null;
  }
}

/**
 * Exporter la carte en PNG (téléchargement direct)
 */
export async function exportMapPNG(mapContainer, filename = 'carte-emag.png') {
  if (!mapContainer) return;

  const canvas = mapContainer.querySelector('canvas');
  let dataUrl;

  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else {
    dataUrl = await captureLeafletTiles(mapContainer);
  }

  if (!dataUrl) return;

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
