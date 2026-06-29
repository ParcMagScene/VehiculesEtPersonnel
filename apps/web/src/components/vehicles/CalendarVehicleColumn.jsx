import React from 'react';

import { Tooltip } from '@/design-system';
import { Button } from '@/design-system';

import { STATUS } from '../../constants';
import { STATUS_COLORS } from '../../constants/colors';
import { getVehicleAvatar } from '../../utils/vehicleAvatars';
import { getExpiredTechnicalControls, hasExpiredTechnicalControl } from '../../utils/vehicleUtils';

const VehicleCell = ({
  vehicle,
  maintenances,
  onVehicleClick,
  onVehicleDoubleClick,
  onMaintenanceClick,
}) => {
  const activeBreakdowns = maintenances
    .filter(
      (m) =>
        m.vehicleId === vehicle.id &&
        (m.status === 'reported' || m.type === 'breakdown') &&
        m.status !== STATUS.COMPLETED,
    )
    .sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
  const hasBreakdown = activeBreakdowns.length > 0;
  const breakdownMaintenance = activeBreakdowns[0];
  const hasExpiredControl = hasExpiredTechnicalControl(vehicle, maintenances);
  const expiredControls = hasExpiredControl
    ? getExpiredTechnicalControls(vehicle, maintenances)
    : [];

  const handleBreakdownClick = (e) => {
    e.stopPropagation();
    if (onMaintenanceClick && breakdownMaintenance) {
      onMaintenanceClick(vehicle, breakdownMaintenance.id);
    }
  };

  return (
    <div
      className="vehicle-cell"
      onClick={() => onVehicleClick && onVehicleClick(vehicle)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onVehicleDoubleClick && onVehicleDoubleClick(vehicle);
      }}
      style={{ cursor: onVehicleClick ? 'pointer' : 'default' }}
    >
      <div
        className="vehicle-color"
        style={{ backgroundColor: vehicle.displayColor || vehicle.color || STATUS_COLORS.info }}
      />
      <div className="vehicle-photo">
        {vehicle.photo ? (
          <img src={`/Photos/${vehicle.photo}`} alt={vehicle.name} loading="lazy" />
        ) : (
          <img
            src={getVehicleAvatar(vehicle.type)}
            alt={vehicle.name}
            className="vehicle-avatar"
            loading="lazy"
          />
        )}
        {hasBreakdown && (
          <Tooltip content="Panne signalée" position="bottom">
            <span
              className="breakdown-indicator-photo"
              onClick={handleBreakdownClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleBreakdownClick(e);
              }}
              role="button"
              tabIndex={0}
              aria-label="Ouvrir l'intervention signalée"
              style={{ cursor: onMaintenanceClick ? 'pointer' : 'default' }}
            >
              ⚠️
            </span>
          </Tooltip>
        )}
        {hasExpiredControl && (
          <div
            className="expired-control-indicator"
            title={`Contrôle technique expiré: ${expiredControls.map((c) => `${c.type} (${c.daysExpired}j)`).join(', ')}`}
          >
            🚫
          </div>
        )}
      </div>
      <div className="vehicle-info">
        <span className="vehicle-name">{vehicle.name}</span>
        <span className="vehicle-brand">{vehicle.brand || vehicle.marque || ''}</span>
        <span className="vehicle-type">{vehicle.type || ''}</span>
        <span className="vehicle-registration">
          {vehicle.registration || vehicle.immatriculation || ''}
        </span>
      </div>
    </div>
  );
};

const CalendarVehicleColumn = ({
  vehicleGroups,
  collapsedSections,
  setCollapsedSections,
  availabilityCount,
  maintenances,
  onVehicleClick,
  onVehicleDoubleClick,
  onMaintenanceClick,
}) => (
  <div className="vehicle-column">
    {vehicleGroups.companyVehicles.length > 0 && (
      <>
        {!collapsedSections.company &&
          vehicleGroups.companyVehicles.map((vehicle) => (
            <VehicleCell
              key={vehicle.id}
              vehicle={vehicle}
              maintenances={maintenances}
              onVehicleClick={onVehicleClick}
              onVehicleDoubleClick={onVehicleDoubleClick}
              onMaintenanceClick={onMaintenanceClick}
            />
          ))}
      </>
    )}

    {vehicleGroups.locationVehicles.length > 0 && (
      <>
        <div className="vehicle-section-header">
          <span>Véhicules de location</span>
          <Tooltip content="Véhicules de location disponibles aujourd'hui" position="bottom">
            <span className="vehicle-availability-badge location">
              {availabilityCount.location.available}/{availabilityCount.location.total}
            </span>
          </Tooltip>
          <Button
            variant="ghost"
            className="section-toggle-button"
            onClick={() => setCollapsedSections((prev) => ({ ...prev, location: !prev.location }))}
          >
            {collapsedSections.location ? '▼' : '▲'}
          </Button>
        </div>
        {!collapsedSections.location &&
          vehicleGroups.locationVehicles.map((vehicle) => (
            <VehicleCell
              key={vehicle.id}
              vehicle={vehicle}
              maintenances={maintenances}
              onVehicleClick={onVehicleClick}
              onVehicleDoubleClick={onVehicleDoubleClick}
              onMaintenanceClick={onMaintenanceClick}
            />
          ))}
      </>
    )}
  </div>
);

export default React.memo(CalendarVehicleColumn);
