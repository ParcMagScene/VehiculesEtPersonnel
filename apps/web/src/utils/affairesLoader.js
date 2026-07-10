/**
 * affairesLoader
 * --------------
 * Source unique pour charger la liste des affaires côté frontend.
 *
 * - Récupère via `api.getAffaires()` (v1) ou `api.v2ListAffaires()` (v2)
 *   selon `VITE_FEATURE_V2_AFFAIRES` — cf T-P0-09b dogfooding UI.
 * - Alimente le store IndexedDB `affaires` (offline fallback)
 * - En cas d'échec API, retombe silencieusement sur la dernière version IDB
 *
 * Sprint 2 (audit state management) : ce loader unifie les 3 consommateurs
 * (AffairesPanel, DashboardTasksSidebar, MobileAffaires) qui dupliquaient
 * jusqu'ici la même logique fetch sans cache cohérent.
 *
 * T-P0-09b (dogfooding v2) : si `VITE_FEATURE_V2_AFFAIRES=1`, on iterе
 * toutes les pages du namespace v2 et on adapte le shape en amont
 * pour rester drop-in avec le reste du frontend. Fallback silencieux
 * sur v1 si le namespace v2 est off cote serveur (404 FEATURE_DISABLED)
 * ou si l'appel v2 leve une erreur reseau. Zero regression fonctionnelle.
 * Note : le v2 ne renvoie que les affaires materialisees en base
 * (cf T-P0-08). Les affaires auto-detectees a la volee depuis Google
 * Calendar (source='auto', id=null) n'apparaissent PAS dans le
 * chemin v2 : c'est un dogfooding attendu — apres materialisation
 * complete, il ne doit rester aucune auto-detectee.
 */
import { fetchAffairesListV2, isFeatureDisabled } from './affaires/fetchAffairesV2.js';
import { readAffairesV2ClientFlag } from './affaires/v2Adapters.js';
import api from './api';
import { loadFromIndexedDB, saveToIndexedDB, STORES } from './indexedDB';
import logger from './logger';

/**
 * Charge la liste des affaires depuis l'API, avec cache IDB et fallback offline.
 *
 * @returns {Promise<{ affaires: Array, fromCache: boolean, error: Error | null }>}
 *   - `affaires` : liste (toujours un tableau, jamais null).
 *   - `fromCache` : `true` si la liste vient d'IndexedDB (API indisponible).
 *   - `error` : l'erreur API si fallback IDB déclenché, sinon `null`.
 */
export async function fetchAffaires() {
  try {
    let list = null;

    if (readAffairesV2ClientFlag() && typeof api.v2ListAffaires === 'function') {
      try {
        list = await fetchAffairesListV2(api);
      } catch (v2Err) {
        if (!isFeatureDisabled(v2Err)) {
          logger.warn('[affaires v2] fetchAffaires: fallback v1', v2Err);
        }
        list = null; // fallback v1 ci-dessous
      }
    }

    if (list === null) {
      const data = await api.getAffaires();
      list = Array.isArray(data) ? data : [];
    }
    // Best-effort : on n'attend pas la sauvegarde IDB et on n'échoue pas si elle plante.
    // Note: l'API renvoie aussi des affaires "auto-détectées" depuis les réservations
    // avec id=null (source: 'auto'). Elles ne peuvent pas être stockées en IDB
    // (keyPath = 'id') et n'ont de sens qu'en mode online (recalculées côté backend).
    // On les filtre du cache pour éviter le spam de warnings, mais on les conserve
    // dans la liste retournée à l'UI.
    const cacheable = list.filter((a) => a && a.id != null);
    saveToIndexedDB(STORES.affaires, cacheable).catch((err) => {
      logger.warn('saveToIndexedDB(affaires) a échoué:', err);
    });
    return { affaires: list, fromCache: false, error: null };
  } catch (apiError) {
    try {
      const cached = await loadFromIndexedDB(STORES.affaires);
      if (Array.isArray(cached) && cached.length > 0) {
        return { affaires: cached, fromCache: true, error: apiError };
      }
    } catch (idbError) {
      logger.warn('Fallback IDB affaires indisponible:', idbError);
    }
    return { affaires: [], fromCache: false, error: apiError };
  }
}

/**
 * Construit la map indexée `numeroAffaire.toUpperCase()` → affaire.
 * Utilisé par les vues qui font du lookup (ex. DashboardTasksSidebar).
 */
export function buildAffairesMap(affaires) {
  const map = {};
  (Array.isArray(affaires) ? affaires : []).forEach((a) => {
    if (a?.numeroAffaire) map[String(a.numeroAffaire).toUpperCase()] = a;
  });
  return map;
}
