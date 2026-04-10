// ═══════════════════════════════════════════════════════════════
// MapPrintControl.jsx — Bouton d'impression/export de la carte
// ═══════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import { Printer } from 'lucide-react';
import { printMap, exportMapPNG } from './map-print-utils';

export default function MapPrintControl({ mapContainerRef, title = 'Carte eM@g', onDualPrint }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Fermer le menu au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handlePrint = (format, orientation) => {
    const container = mapContainerRef?.current?.querySelector('.emag-leaflet-map');
    if (container) {
      printMap(container, { format, orientation, title });
    }
    setOpen(false);
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
      <button
        className="map-print-btn"
        onClick={() => setOpen(!open)}
        title="Imprimer / Exporter la carte"
        aria-label="Imprimer ou exporter la carte"
        aria-expanded={open}
      >
        <Printer size={18} />
      </button>

      {open && (
        <div className="map-print-menu" role="menu">
          <div className="map-print-menu-title">Imprimer</div>
          <button role="menuitem" onClick={() => handlePrint('A4', 'landscape')}>
            A4 Paysage
          </button>
          <button role="menuitem" onClick={() => handlePrint('A4', 'portrait')}>
            A4 Portrait
          </button>
          <button role="menuitem" onClick={() => handlePrint('A3', 'landscape')}>
            A3 Paysage
          </button>
          <div className="map-print-menu-divider" />
          <div className="map-print-menu-title">Exporter</div>
          <button role="menuitem" onClick={handleExport}>
            PNG haute résolution
          </button>
          {onDualPrint && (
            <>
              <div className="map-print-menu-divider" />
              <div className="map-print-menu-title">Double carte</div>
              <button role="menuitem" onClick={() => { onDualPrint(); setOpen(false); }}>
                Générale + Locale
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
