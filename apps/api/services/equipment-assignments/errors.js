// apps/api/services/equipment-assignments/errors.js
export class EqAssignV2ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'EqAssignV2ValidationError';
    if (details) this.details = details;
  }
}
export class EqAssignV2NotFoundError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'EqAssignV2NotFoundError';
    if (details) this.details = details;
  }
}
export class EqAssignV2ConflictError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'EqAssignV2ConflictError';
    if (details) this.details = details;
  }
}
