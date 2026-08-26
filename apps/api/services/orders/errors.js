// apps/api/services/orders/errors.js
export class OrdersV2ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'OrdersV2ValidationError';
    if (details) this.details = details;
  }
}
export class OrdersV2NotFoundError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'OrdersV2NotFoundError';
    if (details) this.details = details;
  }
}
export class OrdersV2ConflictError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'OrdersV2ConflictError';
    if (details) this.details = details;
  }
}
