// apps/api/services/display/errors.js
//
// Ticket : T-P0-15 (Display v2 DisplayService interne).
//
// Classes d'erreurs typees exposees par les services Display v2.
// Le namespace v2 (apps/api/v2/displayRoutes.js) les traduit en
// reponses HTTP 400 / 404 / 501 via sendV2Error().

/**
 * Erreur de validation d'entree (parametre manquant, mauvais type).
 * L'endpoint v2 traduit en HTTP 400 avec code 'VALIDATION_ERROR'.
 */
export class DisplayV2ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'DisplayV2ValidationError';
    this.details = details;
  }
}

/**
 * Ressource introuvable (screen_id / playlist_id inconnu).
 * L'endpoint v2 traduit en HTTP 404 avec code 'NOT_FOUND'.
 */
export class DisplayV2NotFoundError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'DisplayV2NotFoundError';
    this.details = details;
  }
}
