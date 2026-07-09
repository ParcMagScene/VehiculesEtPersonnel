// hooks/v2/usePlanningAffairesV2.js
//
// Ticket : T-P0-05 étendu (backend affaires-status + hooks web).
//
// Hook offset-based sur GET /api/v2/planning/affaires. Volumétrie
// faible (<1000 affaires actives typiquement) : pas de cursor à ce
// stade. Fournit `loadMore` par incrément d'offset.

import { useCallback, useEffect, useRef, useState } from 'react';

import api from '../../utils/api';

const DEFAULT_LIMIT = 200;

export function usePlanningAffairesV2({
  enabled = true,
  filters = {},
  limit = DEFAULT_LIMIT,
  includeHidden = false,
} = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchPage = useCallback(
    async (currentOffset, mode) => {
      if (mode === 'refresh') setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const response = await api.listV2PlanningAffaires({
          ...filtersRef.current,
          include_hidden: includeHidden ? 1 : undefined,
          limit,
          offset: currentOffset,
        });
        if (!response || response.success !== true) {
          throw new Error(response?.error || 'Réponse Planning v2 affaires invalide');
        }
        setFeatureDisabled(false);
        const nextItems = Array.isArray(response.data) ? response.data : [];
        setItems((prev) => (mode === 'refresh' ? nextItems : prev.concat(nextItems)));
        const pagination = response.meta?.pagination;
        setTotal(pagination?.total ?? nextItems.length);
        setHasMore(Boolean(pagination?.has_more));
        setOffset(currentOffset + nextItems.length);
      } catch (err) {
        const status = err?.response?.status;
        const code = err?.response?.data?.code;
        if (status === 404 && code === 'FEATURE_DISABLED') {
          setFeatureDisabled(true);
          setItems([]);
          setTotal(0);
          setHasMore(false);
          setOffset(0);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [includeHidden, limit],
  );

  const refresh = useCallback(async () => {
    await fetchPage(0, 'refresh');
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    await fetchPage(offset, 'more');
  }, [hasMore, offset, fetchPage]);

  useEffect(() => {
    if (!enabled) return;
    fetchPage(0, 'refresh');
  }, [enabled, fetchPage]);

  return {
    items,
    total,
    loading,
    loadingMore,
    error,
    featureDisabled,
    hasMore,
    refresh,
    loadMore,
  };
}
