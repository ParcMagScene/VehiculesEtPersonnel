// apps/api/services/orders/index.js
// Barrel exports T-P1-09 + T-P1-10.

export { convertQuoteToOrder } from './conversion.js';
export { OrdersV2ConflictError, OrdersV2NotFoundError, OrdersV2ValidationError } from './errors.js';
export { recordItemReception, summarizeOrderReceptions } from './receptions.js';
export {
  assertTransition,
  getAllowedNext,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  QUOTE_STATUSES,
  QUOTE_TRANSITIONS,
} from './stateMachine.js';
export { transitionOrder, transitionQuote } from './transitions.js';
