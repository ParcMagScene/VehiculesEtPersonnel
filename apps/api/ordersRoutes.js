// [S2-1] Barrel: les routes commandes/devis ont ete eclatees dans apps/api/orders/.
// Conserve l'API publique pour server.js (5 fonctions setupXxxRoutes).
export { setupSuppliersRoutes } from './orders/suppliersRoutes.js';
export { setupOrdersRoutes } from './orders/ordersCoreRoutes.js';
export { setupQuotesRoutes } from './orders/quotesRoutes.js';
export { setupMaterialRequestsRoutes } from './orders/materialRequestsRoutes.js';
export { setupSupplierDocumentsRoutes } from './orders/supplierDocumentsRoutes.js';
