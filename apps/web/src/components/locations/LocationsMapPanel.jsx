// ═══════════════════════════════════════════════════════════════
// LocationsMapPanel.jsx — Panneau cartographie des lieux eM@g
// ═══════════════════════════════════════════════════════════════

import 'leaflet/dist/leaflet.css';
import './LocationsMapPanel.css';

import { Building2, Map, Maximize2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Modal, ModalBody, ModalHeader } from '@/design-system';

import { filterGeoLocations, LOCATION_TYPES } from './map-utils';
import { loadMapViewState, normalizeViewForStorage, saveMapViewState } from './map-view-state';
import MapDualPrintModal from './MapDualPrintModal';
import MapGeneral from './MapGeneral';
import MapLocal from './MapLocal';
import MapPrintControl from './MapPrintControl';

export default function LocationsMapPanel({ locations, onClose, onEditLocation }) {
  const [activeView, setActiveView] = useState('general'); // 'general' | 'local'
  const [showDualPrint, setShowDualPrint] = useState(false);
  const [mapViewState, setMapViewState] = useState(() => loadMapViewState());
  const [generalKey, setGeneralKey] = useState(0);
  const [localKey, setLocalKey] = useState(0);
  const mapContainerRef = useRef(null);

  const geoCount = useMemo(() => filterGeoLocations(locations).length, [locations]);
  const totalCount = (locations || []).length;

  useEffect(() => {
    saveMapViewState(mapViewState);
  }, [mapViewState]);

  const updateView = useCallback((key, view) => {
    const normalized = normalizeViewForStorage(view);
    if (!normalized) return;

    setMapViewState((prev) => {
      const prevView = prev[key];
      if (
        prevView &&
        prevView.zoom === normalized.zoom &&
        prevView.center[0] === normalized.center[0] &&
        prevView.center[1] === normalized.center[1]
      ) {
        return prev;
      }

      return {
        ...prev,
        [key]: normalized,
      };
    });
  }, []);

  const handleRecenter = useCallback(() => {
    setMapViewState((prev) => {
      const next = { ...prev };
      if (activeView === 'general') {
        next.generalView = null;
      } else {
        next.localView = null;
      }
      return next;
    });
    if (activeView === 'general') {
      setGeneralKey((k) => k + 1);
    } else {
      setLocalKey((k) => k + 1);
    }
  }, [activeView]);

  const updateLocalZone = useCallback((nextZone) => {
    if (!nextZone) return;

    setMapViewState((prev) => {
      const center = Array.isArray(nextZone.center)
        ? [Number(nextZone.center[0]), Number(nextZone.center[1])]
        : prev.localZone.center;
      const radius = Number(nextZone.radius);

      if (!Number.isFinite(center[0]) || !Number.isFinite(center[1]) || !Number.isFinite(radius)) {
        return prev;
      }

      const safeRadius = Math.max(500, Math.min(100000, Math.round(radius)));
      const normalizedCenter = [Number(center[0].toFixed(6)), Number(center[1].toFixed(6))];
      const prevZone = prev.localZone;

      if (
        prevZone.center[0] === normalizedCenter[0] &&
        prevZone.center[1] === normalizedCenter[1] &&
        prevZone.radius === safeRadius
      ) {
        return prev;
      }

      return {
        ...prev,
        localZone: {
          center: normalizedCenter,
          radius: safeRadius,
        },
      };
    });
  }, []);

  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      className="locations-map-panel"
      data-draggable-enhanced="skip"
    >
      <ModalHeader
        icon={<Map size={20} />}
        onClose={onClose}
        rightContent={
          <>
            <span className="locations-map-count">
              {geoCount}/{totalCount} géolocalisé{geoCount !== 1 ? 's' : ''}
            </span>
            <div className="locations-map-header-actions">
              <Button
                type="button"
                className="locations-map-recenter-btn"
                onClick={handleRecenter}
                title="Recadrer la carte pour afficher tous les lieux"
              >
                <Maximize2 size={14} />
                Recadrer
              </Button>
              <MapPrintControl
                mapContainerRef={mapContainerRef}
                title={activeView === 'general' ? 'Carte générale' : 'Autour du dépôt'}
                onDualPrint={() => setShowDualPrint(true)}
              />
            </div>
          </>
        }
      >
        Cartographie des lieux
      </ModalHeader>

      <ModalBody>
        {/* Onglets */}
        <div className="locations-map-tabs" role="tablist">
          <Button
            type="button"
            role="tab"
            aria-selected={activeView === 'general'}
            className={`locations-map-tab ${activeView === 'general' ? 'active' : ''}`}
            onClick={() => setActiveView('general')}
          >
            <Map size={16} />
            Carte générale
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={activeView === 'local'}
            className={`locations-map-tab ${activeView === 'local' ? 'active' : ''}`}
            onClick={() => setActiveView('local')}
          >
            <Building2 size={16} />
            Autour du dépôt
          </Button>
        </div>

        {/* Contenu carte — no-drag empêche useDraggableModals.onDragStart */}
        <div className="locations-map-body no-drag" ref={mapContainerRef}>
          {activeView === 'general' ? (
            <MapGeneral
              key={`general-${generalKey}`}
              locations={locations}
              onEditLocation={onEditLocation}
              initialView={mapViewState.generalView}
              onViewChange={(view) => updateView('generalView', view)}
            />
          ) : (
            <MapLocal
              key={`local-${localKey}`}
              locations={locations}
              onEditLocation={onEditLocation}
              initialView={mapViewState.localView}
              onViewChange={(view) => updateView('localView', view)}
              zoneCenter={mapViewState.localZone.center}
              zoneRadius={mapViewState.localZone.radius}
              onZoneChange={updateLocalZone}
            />
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
            <span className="locations-map-legend-dot locations-map-legend-dot-siege" />
            Siège
          </span>
        </div>
        {showDualPrint && (
          <MapDualPrintModal
            locations={locations}
            onClose={() => setShowDualPrint(false)}
            initialGeneralView={mapViewState.printGeneralView}
            onGeneralViewChange={(view) => updateView('printGeneralView', view)}
            initialLocalView={mapViewState.printLocalView}
            onLocalViewChange={(view) => updateView('printLocalView', view)}
            zoneCenter={mapViewState.localZone.center}
            zoneRadius={mapViewState.localZone.radius}
            onZoneChange={updateLocalZone}
          />
        )}
      </ModalBody>
    </Modal>
  );
}
