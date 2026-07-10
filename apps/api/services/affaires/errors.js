// apps/api/services/affaires/errors.js
//
// Classes d'erreur typees pour le namespace /api/v2/affaires/*
// (T-P0-09). Traduites en reponse HTTP par
// `apps/api/v2/affairesRoutes.js#handleServiceError`.

/**
 * Erreur de validation d'entree (mapping HTTP 400).
 */
export class AffairesV2ValidationError extends Error {
  /**
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(message, details) {
    super(message);
    this.name = 'AffairesV2ValidationError';
    if (details) this.details = details;
  }
}

/**
 * Ressource introuvable (mapping HTTP 404).
 */
export class AffairesV2NotFoundError extends Error {
  /**
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(message, details) {
    super(message);
    this.name = 'AffairesV2NotFoundError';
    if (details) this.details = details;
  }
}

/**
 * Conflit metier (mapping HTTP 409). Utilise notamment pour un
 * `numero_affaire` deja pris (violation UNIQUE) ou un patch no-op
 * en mode strict.
 */
export class AffairesV2ConflictError extends Error {
  /**
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(message, details) {
    super(message);
    this.name = 'AffairesV2ConflictError';
    if (details) this.details = details;
  }
}
