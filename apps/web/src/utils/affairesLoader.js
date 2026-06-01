/**
 * affairesLoader
 * --------------
 * Source unique pour charger la liste des affaires côté frontend.
 *
 * - Récupère via `api.getAffaires()`
 * - Alimente le store IndexedDB `affaires` (offline fallback)
 * - En cas d'échec API, retombe silencieusement sur la dernière version IDB
 *
 * Sprint 2 (audit state management) : ce loader unifie les 3 consommateurs
 * (AffairesPanel, DashboardTasksSidebar, MobileAffaires) qui dupliquaient
 * jusqu'ici la même logique fetch sans cache cohérent.
 */
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
    const data = await api.getAffaires();
    const list = Array.isArray(data) ? data : [];
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
