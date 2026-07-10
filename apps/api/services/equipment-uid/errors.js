// apps/api/services/equipment-uid/errors.js
//
// Classes d'erreur typees pour /api/v2/equipment-uid/* (T-P1-06).

export class EquipmentUidV2ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'EquipmentUidV2ValidationError';
    if (details) this.details = details;
  }
}

export class EquipmentUidV2NotFoundError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'EquipmentUidV2NotFoundError';
    if (details) this.details = details;
  }
}

export class EquipmentUidV2ConflictError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'EquipmentUidV2ConflictError';
    if (details) this.details = details;
  }
}
