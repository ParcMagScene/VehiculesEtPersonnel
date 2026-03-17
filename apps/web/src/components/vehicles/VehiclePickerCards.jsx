import React from 'react';
import { Check } from 'lucide-react';
import { getVehicleAvatar } from '../../utils/vehicleAvatars';
import './VehiclePickerCards.css';

/**
 * Composant réutilisable de sélection de véhicule avec photos.
 * Utilisable en mode mobile (liste verticale) ou desktop (grille).
 * 
 * @param {Object[]} vehicles - Liste des véhicules à afficher
 * @param {number|string} selectedId - ID du véhicule sélectionné (mode unique)
 * @param {number[]|string[]} selectedIds - IDs des véhicules sélectionnés (mode multiple)
 * @param {function} onSelect - Callback appelé avec l'ID du véhicule sélectionné
 * @param {boolean} multiple - Permet la sélection multiple
 * @param {boolean} disabled - Désactive toute interaction
 * @param {string} variant - 'mobile' (liste verticale) ou 'desktop' (grille)
 * @param {string} emptyMessage - Message quand la liste est vide
 */
function VehiclePickerCards({
  vehicles = [],
  selectedId = null,
  selectedIds = [],
  onSelect,
  multiple = false,
  disabled = false,
  variant = 'mobile',
  emptyMessage = 'Aucun véhicule disponible'
}) {
  const isDesktop = variant === 'desktop';
  const containerClass = isDesktop ? 'vehicle-picker-grid' : 'vehicle-picker-list';

  const isSelected = (vehicleId) => {
    if (multiple) {
      return selectedIds.includes(vehicleId);
    }
    return selectedId === vehicleId || selectedId === String(vehicleId);
  };

  const handleClick = (vehicleId) => {
    if (disabled || !onSelect) return;
    onSelect(vehicleId);
  };

  if (vehicles.length === 0) {
    return (
      <div className={containerClass}>
        <div className="vehicle-picker-empty">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {vehicles.map((vehicle) => (
        <div
          key={vehicle.id}
          className={`vehicle-picker-card${isDesktop ? '-desktop' : ''}${isSelected(vehicle.id) ? ' selected' : ''}${disabled ? ' readonly' : ''}`}
          onClick={() => handleClick(vehicle.id)}
        >
          <div className={`vehicle-picker-photo${isDesktop ? '-desktop' : ''}`}>
            {vehicle.photo ? (
              <img
                src={`/Photos/${vehicle.photo}`}
                alt={vehicle.name}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
            ) : (
              <img src={getVehicleAvatar(vehicle.type)} alt={vehicle.name} className="vehicle-avatar" />
            )}
          </div>

          <div className={`vehicle-picker-info${isDesktop ? '-desktop' : ''}`}>
            <div className={`vehicle-picker-name${isDesktop ? '-desktop' : ''}`}>
              {vehicle.name}
            </div>
            <div className={`vehicle-picker-meta${isDesktop ? '-desktop' : ''}`}>
              {vehicle.brand && (
                <span className={`vehicle-picker-brand${isDesktop ? '-desktop' : ''}`}>
                  {vehicle.brand}
                </span>
              )}
              <span className={`vehicle-picker-type${isDesktop ? '-desktop' : ''}`}>
                {vehicle.type}
              </span>
            </div>
            <div className={`vehicle-picker-reg${isDesktop ? '-desktop' : ''}`}>
              {vehicle.registration || vehicle.immatriculation || ''}
            </div>
          </div>

          {isDesktop && (
            <div
              className="vehicle-color-indicator"
              style={{ backgroundColor: vehicle.displayColor || vehicle.color }}
            />
          )}

          {isSelected(vehicle.id) && (
            <div className={`vehicle-picker-check${isDesktop ? '-desktop' : ''}`}>
              <Check size={isDesktop ? 16 : 20} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default VehiclePickerCards;
