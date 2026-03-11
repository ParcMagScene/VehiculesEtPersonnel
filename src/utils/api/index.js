// API Client — Assemblage de tous les modules domaine
import { ApiClient, getApiUrl } from './base.js';
import { registerVehicleMethods } from './vehicles.js';
import { registerAdminMethods } from './admin.js';
import { registerPersonnelMethods } from './personnel.js';
import { registerLeavesMethods } from './leaves.js';
import { registerAffairesMethods } from './affaires.js';
import { registerMessagingMethods } from './messaging.js';
import { registerMailingMethods } from './mailing.js';
import { registerEquipmentMethods } from './equipment.js';
import { registerOrdersMethods } from './orders.js';
import { registerStockMethods } from './stock.js';
import { registerPlanningMethods } from './planning.js';
import { registerAnnuaireMethods } from './annuaire.js';
import { registerDisplayMethods } from './display.js';

// Enregistrer toutes les méthodes domaine sur ApiClient.prototype
registerVehicleMethods(ApiClient);
registerAdminMethods(ApiClient);
registerPersonnelMethods(ApiClient);
registerLeavesMethods(ApiClient);
registerAffairesMethods(ApiClient);
registerMessagingMethods(ApiClient);
registerMailingMethods(ApiClient);
registerEquipmentMethods(ApiClient);
registerOrdersMethods(ApiClient);
registerStockMethods(ApiClient);
registerPlanningMethods(ApiClient);
registerAnnuaireMethods(ApiClient);
registerDisplayMethods(ApiClient);

// Singleton
export const api = new ApiClient();
export default api;
export { getApiUrl };
