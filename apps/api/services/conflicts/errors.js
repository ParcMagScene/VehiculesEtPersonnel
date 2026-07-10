// apps/api/services/conflicts/errors.js
//
// Classes d'erreur typees pour le namespace /api/v2/conflicts/*
// (T-P1-05).

export class ConflictsV2ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ConflictsV2ValidationError';
    if (details) this.details = details;
  }
}
