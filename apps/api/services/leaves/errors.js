// apps/api/services/leaves/errors.js
//
// Classes d'erreur typees pour le namespace /api/v2/leaves/*
// (T-P1-04). Traduites en reponse HTTP par le handler v2.

/**
 * Erreur de validation d'entree (HTTP 400).
 */
export class LeavesV2ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'LeavesV2ValidationError';
    if (details) this.details = details;
  }
}

/**
 * Ressource introuvable (HTTP 404).
 */
export class LeavesV2NotFoundError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'LeavesV2NotFoundError';
    if (details) this.details = details;
  }
}
