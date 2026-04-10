// ═══════════════════════════════════════════════════════════════
// MapPopup.jsx — Popup stylisé DS pour les marqueurs de carte
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { Popup } from 'react-leaflet';
import { getLocationType } from './map-utils';

export default function MapPopup({ location, onEdit }) {
  const config = getLocationType(location.type);

  return (
    <Popup className="emag-map-popup" maxWidth={280} minWidth={200}>
      <div className="map-popup-content">
        <div className="map-popup-header">
          <span
            className="map-popup-type-badge"
            style={{ background: config.color }}
          >
            {config.label}
          </span>
          {location.isCompanyLocation && (
            <span className="map-popup-hq-badge">Siège</span>
          )}
        </div>

        <h3 className="map-popup-title">{location.name}</h3>

        {location.address && (
          <p className="map-popup-address">{location.address}</p>
        )}

        {location.lat != null && location.lng != null && (
          <p className="map-popup-coords">
            {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
          </p>
        )}

        <div className="map-popup-actions">
          {onEdit && !location.isCompanyLocation && (
            <button
              className="map-popup-btn map-popup-btn-edit"
              onClick={() => onEdit(location)}
            >
              Modifier
            </button>
          )}
          {location.lat != null && location.lng != null && (
            <a
              className="map-popup-btn map-popup-btn-gmaps"
              href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Maps ↗
            </a>
          )}
        </div>
      </div>
    </Popup>
  );
}
