// ═══════════════════════════════════════════════════════════════
// LocationsMapPanel.jsx — Panneau cartographie des lieux eM@g
// ═══════════════════════════════════════════════════════════════

import 'leaflet/dist/leaflet.css';
import './LocationsMapPanel.css';

import { Building2, Map, Moon, Sun } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Modal, ModalBody, ModalHeader } from '@/design-system';

import { filterGeoLocations, LOCATION_TYPES } from './map-utils';
import MapDualPrintModal from './MapDualPrintModal';
import MapGeneral from './MapGeneral';
import MapLocal from './MapLocal';
import MapPrintControl from './MapPrintControl';

export default function LocationsMapPanel({ locations, onClose, onEditLocation }) {
  const [activeView, setActiveView] = useState('general'); // 'general' | 'local'
  const [darkMode, setDarkMode] = useState(false);
  const [showDualPrint, setShowDualPrint] = useState(false);
  const mapContainerRef = useRef(null);

  const geoCount = useMemo(() => filterGeoLocations(locations).length, [locations]);
  const totalCount = (locations || []).length;

  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      className="locations-map-panel"
      data-draggable-enhanced="skip"
    >
      <ModalHeader icon={<Map size={20} />} onClose={onClose}>
        Cartographie des lieux
        <span className="locations-map-count">
          {geoCount}/{totalCount} géolocalisé{geoCount !== 1 ? 's' : ''}
        </span>
        <div className="locations-map-header-actions">
          <MapPrintControl
            mapContainerRef={mapContainerRef}
            title={activeView === 'general' ? 'Carte générale' : 'Autour du dépôt'}
            onDualPrint={() => setShowDualPrint(true)}
          />
          <button
            type="button"
            className="map-theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Mode clair' : 'Mode sombre'}
            aria-label={darkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Onglets */}
        <div className="locations-map-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'general'}
            className={`locations-map-tab ${activeView === 'general' ? 'active' : ''}`}
            onClick={() => setActiveView('general')}
          >
            <Map size={16} />
            Carte générale
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'local'}
            className={`locations-map-tab ${activeView === 'local' ? 'active' : ''}`}
            onClick={() => setActiveView('local')}
          >
            <Building2 size={16} />
            Autour du dépôt
          </button>
        </div>

        {/* Contenu carte — no-drag empêche useDraggableModals.onDragStart */}
        <div className="locations-map-body no-drag" ref={mapContainerRef}>
          {activeView === 'general' ? (
            <MapGeneral locations={locations} darkMode={darkMode} onEditLocation={onEditLocation} />
          ) : (
            <MapLocal locations={locations} darkMode={darkMode} onEditLocation={onEditLocation} />
          )}
        </div>

        {/* Légende */}
        <div className="locations-map-legend">
          <span className="locations-map-legend-title">Légende :</span>
          {Object.entries(LOCATION_TYPES).map(([type, config]) => (
            <span key={type} className="locations-map-legend-item">
              <span className="locations-map-legend-dot" style={{ background: config.color }} />
              {config.label}
            </span>
          ))}
          <span className="locations-map-legend-item">
            <span
              className="locations-map-legend-dot"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            />
            Siège
          </span>
        </div>
        {showDualPrint && (
          <MapDualPrintModal locations={locations} onClose={() => setShowDualPrint(false)} />
        )}
      </ModalBody>
    </Modal>
  );
}
