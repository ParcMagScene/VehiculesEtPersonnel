/**
 * useAffairesList
 * ---------------
 * Hook unifié pour consommer la liste des affaires.
 *
 * - Charge via `fetchAffaires()` (cache IDB + fallback offline inclus).
 * - Se ré-abonne automatiquement au bus refreshBus sur les clés
 *   `'affaires'` ET `'reservations'` (les réservations génèrent des affaires
 *   auto-détectées côté backend).
 * - Expose une map indexée par `numeroAffaire.toUpperCase()` pour les vues
 *   qui font du lookup (ex. DashboardTasksSidebar).
 *
 * Sprint 2 (audit state management) : remplace les 3 implémentations
 * dupliquées dans AffairesPanel, DashboardTasksSidebar et MobileAffaires.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildAffairesMap, fetchAffaires } from '../utils/affairesLoader';
import { refreshBus } from '../utils/refresh-bus';

/**
 * @param {Object} [options]
 * @param {boolean} [options.autoLoad=true]
 *   Charge automatiquement au montage. Mettre à `false` pour un chargement manuel.
 * @returns {{
 *   affaires: Array,
 *   affairesMap: Object,
 *   loading: boolean,
 *   fromCache: boolean,
 *   error: Error | null,
 *   reload: () => Promise<void>,
 * }}
 */
export function useAffairesList({ autoLoad = true } = {}) {
  const [affaires, setAffaires] = useState([]);
  const [loading, setLoading] = useState(autoLoad);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchAffaires();
    setAffaires(result.affaires);
    setFromCache(result.fromCache);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (autoLoad) {
      void reload();
    }
  }, [autoLoad, reload]);

  // Invalidation cross-module : 'affaires' (direct) + 'reservations' (impact indirect).
  useEffect(() => {
    const unsubA = refreshBus.subscribe('affaires', reload);
    const unsubR = refreshBus.subscribe('reservations', reload);
    return () => {
      unsubA();
      unsubR();
    };
  }, [reload]);

  const affairesMap = useMemo(() => buildAffairesMap(affaires), [affaires]);

  return { affaires, affairesMap, loading, fromCache, error, reload };
}

export default useAffairesList;
