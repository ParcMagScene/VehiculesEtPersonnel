// hooks/v2/usePlanningTasksV2.js
//
// Ticket : T-P0-05 (UI TaskPlanningPanel v2 — lecture).
//
// Hook cursor-based pour consommer GET /api/v2/planning/tasks.
// Gère : chargement initial, "load more" via curseur, filtres serveur,
// gestion d'erreurs (dont FEATURE_DISABLED côté serveur).
//
// Le hook est volontairement autonome : il n'utilise ni contexte global
// ni refreshBus, pour rester safe à l'introduction v2 (P0-DECISION-1).

import { useCallback, useEffect, useRef, useState } from 'react';

import api from '../../utils/api';

const DEFAULT_LIMIT = 100;

/**
 * @typedef {object} PlanningV2Filters
 * @property {number} [person_id]
 * @property {string} [section]
 * @property {string} [date_from]  YYYY-MM-DD
 * @property {string} [date_to]    YYYY-MM-DD
 * @property {string} [status]
 * @property {boolean|number|string} [visible]
 * @property {string} [affaire_num]
 */

/**
 * @param {object} params
 * @param {boolean} [params.enabled=true] désactive l'auto-fetch initial.
 * @param {PlanningV2Filters} [params.filters]
 * @param {number} [params.limit=100] 1..200.
 * @returns {{
 *   items: Array,
 *   loading: boolean,
 *   loadingMore: boolean,
 *   error: (Error|null),
 *   featureDisabled: boolean,
 *   hasMore: boolean,
 *   refresh: () => Promise<void>,
 *   loadMore: () => Promise<void>,
 * }}
 */
export function usePlanningTasksV2({ enabled = true, filters = {}, limit = DEFAULT_LIMIT } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchPage = useCallback(
    async (currentCursor, mode) => {
      if (mode === 'refresh') setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const response = await api.listV2Tasks({
          ...filtersRef.current,
          cursor: currentCursor || undefined,
          limit,
        });
        if (!response || response.success !== true) {
          throw new Error(response?.error || 'Réponse Planning v2 invalide');
        }
        setFeatureDisabled(false);
        const nextItems = Array.isArray(response.data) ? response.data : [];
        setItems((prev) => (mode === 'refresh' ? nextItems : prev.concat(nextItems)));
        const pagination = response.meta?.pagination;
        setCursor(pagination?.next_cursor ?? null);
        setHasMore(Boolean(pagination?.has_more));
      } catch (err) {
        // Détection FEATURE_DISABLED (404 gracieux).
        const status = err?.response?.status;
        const code = err?.response?.data?.code;
        if (status === 404 && code === 'FEATURE_DISABLED') {
          setFeatureDisabled(true);
          setItems([]);
          setHasMore(false);
          setCursor(null);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit],
  );

  const refresh = useCallback(async () => {
    await fetchPage(null, 'refresh');
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    await fetchPage(cursor, 'more');
  }, [cursor, fetchPage]);

  useEffect(() => {
    if (!enabled) return;
    // Chargement initial (refresh).
    fetchPage(null, 'refresh');
  }, [enabled, fetchPage]);

  return {
    items,
    loading,
    loadingMore,
    error,
    featureDisabled,
    hasMore,
    refresh,
    loadMore,
  };
}
