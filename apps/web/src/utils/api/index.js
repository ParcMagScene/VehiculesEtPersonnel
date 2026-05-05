// API Client — Assemblage de tous les modules domaine
import { registerAdminMethods } from './admin.js';
import { registerAffairesMethods } from './affaires.js';
import { registerAnnuaireMethods } from './annuaire.js';
import { ApiClient, getApiUrl } from './base.js';
import { registerDisplayMethods } from './display.js';
import { registerEquipmentMethods } from './equipment.js';
import { registerInventoryMethods } from './inventory.js';
import { registerLocmatImportMethods } from './locmatImport.js';
import { registerLabelsMethods } from './labels.js';
import { registerLeavesMethods } from './leaves.js';
import { registerMailingMethods } from './mailing.js';
import { registerMessagingMethods } from './messaging.js';
import { registerOrdersMethods } from './orders.js';
import { registerPersonnelMethods } from './personnel.js';
import { registerPlanningMethods } from './planning.js';
import { registerSonosMethods } from './sonos.js';
import { registerStockMethods } from './stock.js';
import { registerSuiviMethods } from './suivi.js';
import { registerVehicleMethods } from './vehicles.js';
import { registerVideoMethods } from './video.js';

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
registerSonosMethods(ApiClient);
registerInventoryMethods(ApiClient);
registerLocmatImportMethods(ApiClient);
registerLabelsMethods(ApiClient);
registerVideoMethods(ApiClient);
registerSuiviMethods(ApiClient);

// Singleton
export const api = new ApiClient();
export default api;
export { getApiUrl };
