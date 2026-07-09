// hooks/v2/usePlanningEventsV2.js
//
// Ticket : T-P0-05 étendu (backend events + hooks web).
//
// Hook cursor-based sur GET /api/v2/planning/events. Miroir de
// usePlanningTasksV2 : loadMore, refresh, hasMore, featureDisabled,
// error. Aucune mutation à ce stade (routes v2 mutations events
// seront livrées par un ticket ultérieur).

import { useCallback, useEffect, useRef, useState } from 'react';

import api from '../../utils/api';

const DEFAULT_LIMIT = 100;

export function usePlanningEventsV2({ enabled = true, filters = {}, limit = DEFAULT_LIMIT } = {}) {
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
        const response = await api.listV2Events({
          ...filtersRef.current,
          cursor: currentCursor || undefined,
          limit,
        });
        if (!response || response.success !== true) {
          throw new Error(response?.error || 'Réponse Planning v2 events invalide');
        }
        setFeatureDisabled(false);
        const nextItems = Array.isArray(response.data) ? response.data : [];
        setItems((prev) => (mode === 'refresh' ? nextItems : prev.concat(nextItems)));
        const pagination = response.meta?.pagination;
        setCursor(pagination?.next_cursor ?? null);
        setHasMore(Boolean(pagination?.has_more));
      } catch (err) {
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
    fetchPage(null, 'refresh');
  }, [enabled, fetchPage]);

  return { items, loading, loadingMore, error, featureDisabled, hasMore, refresh, loadMore };
}
