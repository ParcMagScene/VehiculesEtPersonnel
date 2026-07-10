// apps/api/services/locations/errors.js
//
// Ticket : T-P0-12 (Localisation v2 - API + services).
//
// Classes d'erreurs typees exposees par les services Locations v2.
// Le namespace v2 (apps/api/v2/locationsRoutes.js) les traduit en
// reponses HTTP 400 / 404 / 409 / 500 via sendV2Error().

/**
 * Erreur de validation d'entree.
 * Traduit en HTTP 400 avec code 'VALIDATION_ERROR'.
 */
export class LocationsV2ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'LocationsV2ValidationError';
    this.details = details;
  }
}

/**
 * Ressource introuvable (depot_id / equipment_id inconnu).
 * Traduit en HTTP 404 avec code 'NOT_FOUND'.
 */
export class LocationsV2NotFoundError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'LocationsV2NotFoundError';
    this.details = details;
  }
}

/**
 * Conflit metier (ex. zone inexistante dans le referentiel SVG du
 * depot cible lors d'un PATCH equipment/:id/location).
 * Traduit en HTTP 409 avec code 'CONFLICT'.
 */
export class LocationsV2ConflictError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'LocationsV2ConflictError';
    this.details = details;
  }
}
