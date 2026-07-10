// apps/api/services/affaires/index.js
//
// Barrel exports du domaine services Affaires v2 (T-P0-09).

export {
  AFFAIRE_PATCH_FIELDS,
  AFFAIRE_READ_FIELDS,
  getAffaireById,
  getAffaireByNumero,
  listAffaires,
  patchAffaire,
} from './affaires.js';
export {
  AffairesV2ConflictError,
  AffairesV2NotFoundError,
  AffairesV2ValidationError,
} from './errors.js';
export { appendHistoryEntry, getAffaireHistory } from './history.js';
