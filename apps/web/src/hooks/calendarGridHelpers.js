/**
 * Helpers purs pour les calculs de grille calendrier (FIX 2).
 * Découplés de React → testables sans renderer.
 */

export const COLS_BY_VIEW = {
  week: 14, // 7 jours × 2 demi-jours
  month: 62, // 31 jours × 2 demi-jours
};

/**
 * Construit la valeur CSS gridTemplateColumns pour une vue donnée.
 * @param {'week'|'month'} viewMode
 * @returns {string}
 */
export function buildGridTemplateColumns(viewMode = 'week') {
  const cols = COLS_BY_VIEW[viewMode] ?? COLS_BY_VIEW.week;
  const tokenSuffix = viewMode === 'month' ? '-month' : '';
  return `repeat(${cols}, minmax(var(--cal-day-min-width${tokenSuffix}), 1fr))`;
}

/**
 * Calcule {gridColumnStart, gridColumnEnd} (1-based) pour un item placé
 * sur une grille démarrant à `startDate`.
 * @param {object} opts
 * @param {Date|string} opts.startDate
 * @param {Date|string} [opts.endDate]
 * @param {Date}        opts.viewStart    Première date de la vue
 * @param {number}      opts.cols         Nombre total de colonnes
 * @param {number}      [opts.unitsPerDay=2]
 * @returns {{gridColumnStart:number,gridColumnEnd:number}|null}
 */
export function computeGridSpan({ startDate, endDate, viewStart, cols, unitsPerDay = 2 }) {
  if (!viewStart || !startDate) return null;
  const s = startDate instanceof Date ? startDate : new Date(startDate);
  const e = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : s;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;

  const msPerUnit = (24 * 3600 * 1000) / unitsPerDay;
  const startUnit = Math.max(0, Math.floor((s - viewStart) / msPerUnit));
  const endUnit = Math.min(cols, Math.ceil((e - viewStart) / msPerUnit));
  if (endUnit <= startUnit) return null;

  return { gridColumnStart: startUnit + 1, gridColumnEnd: endUnit + 1 };
}
