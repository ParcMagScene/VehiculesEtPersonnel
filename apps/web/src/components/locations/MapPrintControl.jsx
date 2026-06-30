// ═══════════════════════════════════════════════════════════════
// MapPrintControl.jsx — Bouton d'impression/export de la carte
// ═══════════════════════════════════════════════════════════════

import { Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/design-system';

import { usePrintPreview } from '../ui/PrintPreviewProvider';
import { buildMapPrintHtml, exportMapPNG } from './map-print-utils';

export default function MapPrintControl({ mapContainerRef, title = 'Carte eM@g', onDualPrint }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const printPreview = usePrintPreview();

  // Fermer le menu au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePrint = async (format, orientation) => {
    const container = mapContainerRef?.current?.querySelector('.emag-leaflet-map');
    setOpen(false);
    if (!container) return;
    const result = await buildMapPrintHtml(container, { format, orientation, title });
    if (result) {
      printPreview.showHtml(result.html, {
        title: result.title,
        filename: result.filename,
      });
    }
  };

  const handleExport = () => {
    const container = mapContainerRef?.current?.querySelector('.emag-leaflet-map');
    if (container) {
      exportMapPNG(container, `emag-carte-${Date.now()}.png`);
    }
    setOpen(false);
  };

  return (
    <div className="map-print-control" ref={menuRef}>
      <Button
        type="button"
        className="map-print-btn"
        onClick={() => setOpen(!open)}
        title="Imprimer / Exporter la carte"
        aria-label="Imprimer ou exporter la carte"
        aria-expanded={open}
      >
        <Printer size={18} />
      </Button>

      {open && (
        <div className="map-print-menu" role="menu">
          <div className="map-print-menu-title">Imprimer</div>
          <Button type="button" role="menuitem" onClick={() => handlePrint('A4', 'landscape')}>
            A4 Paysage
          </Button>
          <Button type="button" role="menuitem" onClick={() => handlePrint('A4', 'portrait')}>
            A4 Portrait
          </Button>
          <Button type="button" role="menuitem" onClick={() => handlePrint('A3', 'landscape')}>
            A3 Paysage
          </Button>
          <div className="map-print-menu-divider" />
          <div className="map-print-menu-title">Exporter</div>
          <Button type="button" role="menuitem" onClick={handleExport}>
            PNG haute résolution
          </Button>
          {onDualPrint && (
            <>
              <div className="map-print-menu-divider" />
              <div className="map-print-menu-title">Double carte</div>
              <Button
                type="button"
                role="menuitem"
                onClick={() => {
                  onDualPrint();
                  setOpen(false);
                }}
              >
                Générale + Locale
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
