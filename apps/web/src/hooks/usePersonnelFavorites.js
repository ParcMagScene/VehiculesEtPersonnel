import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'personnel_favorites';
const FAVORITE_PREFIX = '★ ';

function readFavoriteIds() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => Number(id))
      .filter((id, idx, arr) => Number.isFinite(id) && arr.indexOf(id) === idx);
  } catch {
    return [];
  }
}

export default function usePersonnelFavorites() {
  const [favoriteIds, setFavoriteIds] = useState(() => readFavoriteIds());

  const persist = useCallback((next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }, []);

  const toggleFavorite = useCallback(
    (personId) => {
      const numericId = Number(personId);
      if (!Number.isFinite(numericId)) return;
      setFavoriteIds((prev) => {
        const next = prev.includes(numericId)
          ? prev.filter((id) => id !== numericId)
          : [...prev, numericId];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      setFavoriteIds(readFavoriteIds());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const getPersonName = useCallback((person) => {
    const firstName = person?.firstName || person?.first_name || '';
    const lastName = person?.lastName || person?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Sans nom';
  }, []);

  const isFavorite = useCallback((personId) => favoriteSet.has(Number(personId)), [favoriteSet]);

  const sortPersonsByFavorites = useCallback(
    (persons = []) =>
      [...persons].sort((a, b) => {
        const aFav = favoriteSet.has(Number(a?.id)) ? 0 : 1;
        const bFav = favoriteSet.has(Number(b?.id)) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        return getPersonName(a).toLowerCase().localeCompare(getPersonName(b).toLowerCase());
      }),
    [favoriteSet, getPersonName],
  );

  const getFavoriteDisplayName = useCallback(
    (person) =>
      `${favoriteSet.has(Number(person?.id)) ? FAVORITE_PREFIX : ''}${getPersonName(person)}`,
    [favoriteSet, getPersonName],
  );

  return {
    favoriteIds,
    favoriteSet,
    isFavorite,
    toggleFavorite,
    getPersonName,
    getFavoriteDisplayName,
    sortPersonsByFavorites,
  };
}
