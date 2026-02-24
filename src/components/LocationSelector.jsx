// ============================================================
// LocationSelector.jsx — Sélecteur cascadé Zone → Code → Étage
// Pour le formulaire d'édition/création d'équipement catalogue
// ============================================================

import React, { useMemo } from 'react';
import { MapPin } from 'lucide-react';

export default function LocationSelector({ zones, value, onChange }) {
  // value = { location_zone, location_code, location_floor }
  const zone = value?.location_zone || '';
  const code = value?.location_code || '';
  const floor = value?.location_floor || '';

  // Zone sélectionnée
  const selectedZone = useMemo(() => {
    if (!zones?.zones || !zone) return null;
    return zones.zones.find(z => z.id === zone);
  }, [zones, zone]);

  // Codes disponibles pour la zone sélectionnée
  const availableCodes = useMemo(() => {
    return selectedZone?.codes || [];
  }, [selectedZone]);

  // Étages uniques
  const floors = useMemo(() => {
    return zones?.floors || [];
  }, [zones]);

  // Zones groupées par étage
  const zonesByFloor = useMemo(() => {
    if (!zones?.zones) return {};
    const grouped = {};
    zones.zones.forEach(z => {
      if (!grouped[z.floor]) grouped[z.floor] = [];
      grouped[z.floor].push(z);
    });
    return grouped;
  }, [zones]);

  const handleZoneChange = (newZoneId) => {
    const zoneObj = zones?.zones?.find(z => z.id === newZoneId);
    onChange({
      location_zone: newZoneId || null,
      location_code: null,
      location_floor: zoneObj?.floor || null,
    });
  };

  const handleCodeChange = (newCode) => {
    onChange({
      ...value,
      location_code: newCode || null,
    });
  };

  const handleFloorChange = (newFloor) => {
    // Si on change d'étage, on reset la zone et le code
    onChange({
      location_zone: null,
      location_code: null,
      location_floor: newFloor || null,
    });
  };

  return (
    <div className="location-selector">
      <div className="location-selector-header">
        <MapPin size={14} />
        <span>Localisation dépôt</span>
      </div>
      <div className="location-selector-fields">
        {/* Étage */}
        <div className="catalog-form-group">
          <label>Étage</label>
          <select
            value={floor}
            onChange={(e) => handleFloorChange(e.target.value)}
          >
            <option value="">— Aucun —</option>
            {floors.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Zone */}
        <div className="catalog-form-group">
          <label>Zone</label>
          <select
            value={zone}
            onChange={(e) => handleZoneChange(e.target.value)}
          >
            <option value="">— Aucune —</option>
            {floor && zonesByFloor[floor]?.map(z => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
            {!floor && zones?.zones?.map(z => (
              <option key={z.id} value={z.id}>
                [{z.floor}] {z.label}
              </option>
            ))}
          </select>
        </div>

        {/* Code emplacement */}
        <div className="catalog-form-group">
          <label>Code emplacement</label>
          <select
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            disabled={!zone || availableCodes.length === 0}
          >
            <option value="">— Aucun —</option>
            {availableCodes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview couleur zone */}
      {selectedZone && (
        <div className="location-selector-preview" style={{ borderLeftColor: selectedZone.color }}>
          <span className="location-dot" style={{ backgroundColor: selectedZone.color }} />
          <span>{selectedZone.label}</span>
          {code && <span className="location-code-badge">{code}</span>}
        </div>
      )}
    </div>
  );
}
