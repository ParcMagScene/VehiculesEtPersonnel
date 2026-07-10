// API Client — Assemblage de tous les modules domaine
import { registerAdminMethods } from './admin.js';
import { registerAffairesMethods } from './affaires.js';
import { registerAnnuaireMethods } from './annuaire.js';
import { ApiClient, getApiUrl } from './base.js';
import { registerControlesMethods } from './controles.js';
import { registerDisplayMethods } from './display.js';
import { registerEquipmentMethods } from './equipment.js';
import { registerInventoryMethods } from './inventory.js';
import { registerLabelsMethods } from './labels.js';
import { registerLeavesMethods } from './leaves.js';
import { registerLocmatImportMethods } from './locmatImport.js';
import { registerMailingMethods } from './mailing.js';
import { registerMessagingMethods } from './messaging.js';
import { registerOrdersMethods } from './orders.js';
import { registerPersonalActionsMethods } from './personalActions.js';
import { registerPersonnelMethods } from './personnel.js';
import { registerPlanningMethods } from './planning.js';
import { registerPvImportsMethods } from './pvImports.js';
import { registerSonosMethods } from './sonos.js';
import { registerStockMethods } from './stock.js';
import { registerSuiviMethods } from './suivi.js';
import { registerPlanningV2Methods } from './v2/planning.js';
import { registerV2AffairesMethods } from './v2/affaires.js';
import { registerV2ConflictsMethods } from './v2/conflicts.js';
import { registerV2EquipmentUidMethods } from './v2/equipmentUid.js';
import { registerV2LeavesMethods } from './v2/leaves.js';
import { registerV2LocationsMethods } from './v2/locations.js';
import { registerV2MetaMethods } from './v2/meta.js';
import { registerV2SavMethods } from './v2/sav.js';
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
registerControlesMethods(ApiClient);
registerPvImportsMethods(ApiClient);
registerPersonalActionsMethods(ApiClient);

// eM@g 3.0 — namespace API v2 (T-P0-03+). Endpoints inertes tant que
// FEATURE_V2_<DOMAINE> n'est pas activé côté serveur.
registerPlanningV2Methods(ApiClient);
registerV2LocationsMethods(ApiClient);
registerV2AffairesMethods(ApiClient);
registerV2LeavesMethods(ApiClient);
registerV2ConflictsMethods(ApiClient);
registerV2EquipmentUidMethods(ApiClient);
registerV2SavMethods(ApiClient);
registerV2MetaMethods(ApiClient);

// Singleton
export const api = new ApiClient();
export default api;
export { getApiUrl };
