import { useCallback, useMemo, useState } from 'react';

/**
 * useSortableData — tri générique d'une liste avec colonne + direction.
 *
 * Usage :
 *   const { sorted, sortCol, sortDir, getSortHandler, getSortIndicator } =
 *     useSortableData(data, {
 *       initialCol: 'name',
 *       getValue: (row, col) => row[col],
 *     });
 *
 *   <th onClick={getSortHandler('name')}>
 *     Nom {getSortIndicator('name')}
 *   </th>
 *
 * Le getValue par défaut renvoie row[col]. Si une colonne est absente
 * de l'objet (col 'composite'), passer un getValue custom.
 *
 * Retour :
 *   - sorted : tableau trié (référence stable si data/sortCol/sortDir inchangés)
 *   - sortCol, sortDir : état courant
 *   - setSort(col) : toggle asc/desc ou change la colonne (asc par défaut)
 *   - getSortHandler(col) : onClick handler
 *   - getSortIndicator(col) : retourne ' ▲' / ' ▼' / '' selon état
 *   - getThProps(col) : { onClick, className: 'sortable', 'aria-sort': … }
 */
export function useSortableData(data, options = {}) {
  const {
    initialCol = null,
    initialDir = 'asc',
    getValue = (row, col) => (row ? row[col] : undefined),
  } = options;

  const [sortCol, setSortCol] = useState(initialCol);
  const [sortDir, setSortDir] = useState(initialDir);

  const setSort = useCallback((col) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return col;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortCol || !Array.isArray(data)) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const av = getValue(a, sortCol);
      const bv = getValue(b, sortCol);
      // null/undefined toujours en dernier
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      // numérique ?
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      // dates ISO ou objets Date
      if (av instanceof Date && bv instanceof Date) {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sortDir === 'asc' ? -1 : 1;
      if (as > bs) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sortCol, sortDir, getValue]);

  const getSortHandler = useCallback(
    (col) => (e) => {
      // Ignorer si l'événement vient d'un handle de resize ou d'un autre
      // contrôle qui a déjà stoppé la propagation.
      if (e?.defaultPrevented) return;
      setSort(col);
    },
    [setSort],
  );

  const getSortIndicator = useCallback(
    (col) => {
      if (sortCol !== col) return null;
      return sortDir === 'asc' ? ' ▲' : ' ▼';
    },
    [sortCol, sortDir],
  );

  const getThProps = useCallback(
    (col) => ({
      className: 'app-sortable',
      onClick: getSortHandler(col),
      'aria-sort': sortCol === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none',
      role: 'button',
      tabIndex: 0,
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSort(col);
        }
      },
    }),
    [getSortHandler, sortCol, sortDir, setSort],
  );

  return useMemo(
    () => ({
      sorted,
      sortCol,
      sortDir,
      setSort,
      getSortHandler,
      getSortIndicator,
      getThProps,
    }),
    [sorted, sortCol, sortDir, setSort, getSortHandler, getSortIndicator, getThProps],
  );
}

export default useSortableData;
