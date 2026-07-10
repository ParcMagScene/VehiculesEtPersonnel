// apps/api/services/locations/index.js
//
// Ticket : T-P0-12 (Localisation v2 - API + services).
// Barrel exports.

export { getDepotById, isZoneKnown, listDepots } from './depots.js';
export { LOCATION_FIELDS, updateEquipmentLocation } from './equipment.js';
export {
  LocationsV2ConflictError,
  LocationsV2NotFoundError,
  LocationsV2ValidationError,
} from './errors.js';
