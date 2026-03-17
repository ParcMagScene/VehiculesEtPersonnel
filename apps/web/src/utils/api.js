// API Client — Barrel re-export
// Le code est maintenant découpé dans src/utils/api/ (14 modules domaine)
// Ce fichier assure la rétro-compatibilité pour tous les imports existants

export { api, api as default, getApiUrl } from './api/index.js';
