// apps/api/services/sav/errors.js
// Ticket : T-P1-07 (SAV enrichi).

export class SavV2ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'SavV2ValidationError';
    if (details) this.details = details;
  }
}

export class SavV2NotFoundError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'SavV2NotFoundError';
    if (details) this.details = details;
  }
}

export class SavV2ConflictError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'SavV2ConflictError';
    if (details) this.details = details;
  }
}
