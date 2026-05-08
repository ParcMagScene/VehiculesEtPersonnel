/**
 * useCalendarGrid — hook utilitaire pour les grilles calendrier eM@g (FIX 2).
 *
 * Wrapper React minimal autour de `calendarGridHelpers` (logique pure testable).
 *
 * Usage :
 *   const { gridStyle, spanFor, cols } = useCalendarGrid({ viewMode: 'week', viewStart });
 *   <div style={gridStyle}>{items.map(it => <div style={spanFor(it)}/>)}</div>
 */

import { useCallback, useMemo } from 'react';

import { COLS_BY_VIEW, buildGridTemplateColumns, computeGridSpan } from './calendarGridHelpers.js';

export function useCalendarGrid({ viewMode = 'week', viewStart, unitsPerDay = 2 } = {}) {
  const cols = COLS_BY_VIEW[viewMode] ?? COLS_BY_VIEW.week;

  const gridStyle = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: buildGridTemplateColumns(viewMode),
      gap: 'var(--cal-gap, 0)',
    }),
    [viewMode],
  );

  const spanFor = useCallback(
    (item) =>
      computeGridSpan({
        startDate: item?.startDate,
        endDate: item?.endDate,
        viewStart,
        cols,
        unitsPerDay,
      }),
    [viewStart, cols, unitsPerDay],
  );

  return { cols, gridStyle, spanFor };
}

export default useCalendarGrid;
