// ============================================================
// LocationSelector.jsx — Sélecteur cascadé Dépôt → Étage → Zone → Code
// Pour le formulaire d'édition/création d'équipement
// Supporte un ou plusieurs dépôts
// ============================================================

import React, { useMemo } from 'react';
import { MapPin, Warehouse } from 'lucide-react';
import './LocationSelector.css';

export default function LocationSelector({ zones, depots, value, onChange }) {
  // value = { location_depot, location_zone, location_code, location_floor }
  // zones = données d'un seul dépôt (rétrocompat)
  // depots = { depots: [{ id, name, floors, zones, categories }, ...] }
  const depot = value?.location_depot || '';
  const zone = value?.location_zone || '';
  const code = value?.location_code || '';
  const floor = value?.location_floor || '';

  // Liste des dépôts disponibles
  const depotList = useMemo(() => {
    if (depots?.depots) return depots.depots;
    if (zones) return [{ id: zones.depotId || '1', name: zones.name || 'Dépôt', ...zones }];
    return [];
  }, [depots, zones]);

  // Dépôt actuellement sélectionné
  const selectedDepot = useMemo(() => {
    if (!depot) return null;
    return depotList.find(d => d.id === depot) || null;
  }, [depotList, depot]);

  // Étages du dépôt sélectionné
  const floors = useMemo(() => {
    return selectedDepot?.floors || [];
  }, [selectedDepot]);

  // Zones groupées par étage dans le dépôt sélectionné
  const zonesByFloor = useMemo(() => {
    if (!selectedDepot?.zones) return {};
    const grouped = {};
    selectedDepot.zones.forEach(z => {
      if (!grouped[z.floor]) grouped[z.floor] = [];
      grouped[z.floor].push(z);
    });
    return grouped;
  }, [selectedDepot]);

  // Zone sélectionnée
  const selectedZone = useMemo(() => {
    if (!selectedDepot?.zones || !zone) return null;
    return selectedDepot.zones.find(z => z.id === zone);
  }, [selectedDepot, zone]);

  // Codes disponibles pour la zone sélectionnée
  const availableCodes = useMemo(() => {
    return selectedZone?.codes || [];
  }, [selectedZone]);

  const handleDepotChange = (newDepotId) => {
    onChange({
      location_depot: newDepotId || null,
      location_zone: null,
      location_code: null,
      location_floor: null,
    });
  };

  const handleFloorChange = (newFloor) => {
    onChange({
      location_depot: depot || null,
      location_zone: null,
      location_code: null,
      location_floor: newFloor || null,
    });
  };

  const handleZoneChange = (newZoneId) => {
    const zoneObj = selectedDepot?.zones?.find(z => z.id === newZoneId);
    onChange({
      location_depot: depot || null,
      location_zone: newZoneId || null,
      location_code: null,
      location_floor: zoneObj?.floor || floor || null,
    });
  };

  const handleCodeChange = (newCode) => {
    onChange({
      ...value,
      location_code: newCode || null,
    });
  };

  const hasMultipleDepots = depotList.length > 1;

  return (
    <div className="location-selector">
      <div className="location-selector-header">
        <MapPin size={14} />
        <span>Localisation dépôt</span>
      </div>
      <div className={`location-selector-fields ${hasMultipleDepots ? 'has-depot' : ''}`}>
        {/* Dépôt */}
        {hasMultipleDepots && (
          <div className="location-form-group">
            <label><Warehouse size={12} /> Dépôt</label>
            <select
              value={depot}
              onChange={(e) => handleDepotChange(e.target.value)}
            >
              <option value="">— Aucun —</option>
              {depotList.map(d => (
                <option key={d.id} value={d.id}>{d.name || `Dépôt ${d.id}`}</option>
              ))}
            </select>
          </div>
        )}

        {/* Étage */}
        <div className="location-form-group">
          <label>Étage</label>
          <select
            value={floor}
            onChange={(e) => handleFloorChange(e.target.value)}
            disabled={hasMultipleDepots && !depot}
          >
            <option value="">— Aucun —</option>
            {floors.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Zone */}
        <div className="location-form-group">
          <label>Zone</label>
          <select
            value={zone}
            onChange={(e) => handleZoneChange(e.target.value)}
            disabled={hasMultipleDepots && !depot}
          >
            <option value="">— Aucune —</option>
            {floor && zonesByFloor[floor]?.map(z => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
            {!floor && selectedDepot?.zones?.map(z => (
              <option key={z.id} value={z.id}>
                [{z.floor}] {z.label}
              </option>
            ))}
          </select>
        </div>

        {/* Code emplacement */}
        <div className="location-form-group">
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
          {selectedDepot && <span className="location-depot-badge">D{depot}</span>}
          <span>{selectedZone.label}</span>
          {floor && <span className="location-floor-badge">{floor}</span>}
          {code && <span className="location-code-badge">{code}</span>}
        </div>
      )}
    </div>
  );
}
