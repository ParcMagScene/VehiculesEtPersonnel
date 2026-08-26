import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * useResizableColumns — gère la largeur des colonnes d'un <table>
 * avec persistance localStorage par tableId.
 *
 * Usage :
 *   const { widths, getResizerProps, getColProps } = useResizableColumns(
 *     'orders-list',
 *     { ref: 140, fournisseur: 180, affaire: 160, date: 110, statut: 120, articles: 80, total: 110, actions: 110 }
 *   );
 *
 *   <colgroup>
 *     {Object.keys(defaults).map(k => <col key={k} {...getColProps(k)} />)}
 *   </colgroup>
 *   <thead>
 *     <tr>
 *       <th>Référence<span {...getResizerProps('ref')} /></th>
 *       …
 *     </tr>
 *   </thead>
 */
const STORAGE_PREFIX = 'app-table-widths:';
const MIN_WIDTH = 40;

export function useResizableColumns(tableId, defaults) {
  const storageKey = STORAGE_PREFIX + tableId;

  const [widths, setWidths] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // merge (au cas où on ajoute une colonne plus tard)
          return { ...defaults, ...parsed };
        }
      }
    } catch (_e) {
      /* localStorage indisponible ou JSON invalide */
    }
    return { ...defaults };
  });

  // Sauvegarde différée pour limiter les écritures.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(widths));
      } catch (_e) {
        /* quota / privacy mode */
      }
    }, 250);
    return () => clearTimeout(saveTimer.current);
  }, [widths, storageKey]);

  // Drag state via ref pour éviter les rerenders pendant le mousemove.
  const dragRef = useRef(null);

  const onMouseMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    const next = Math.max(MIN_WIDTH, drag.startWidth + delta);
    setWidths((prev) => (prev[drag.key] === next ? prev : { ...prev, [drag.key]: next }));
  }, []);

  const stopDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (drag.handleEl) drag.handleEl.classList.remove('is-resizing');
    document.body.classList.remove('app-col-resizing');
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stopDrag);
  }, [onMouseMove]);

  useEffect(
    () => () => {
      // cleanup si démonté pendant un drag
      stopDrag();
    },
    [stopDrag],
  );

  const startDrag = useCallback(
    (event, key) => {
      event.preventDefault();
      event.stopPropagation();
      const handleEl = event.currentTarget;
      dragRef.current = {
        key,
        startX: event.clientX,
        startWidth: widths[key] || defaults[key] || 100,
        handleEl,
      };
      handleEl.classList.add('is-resizing');
      document.body.classList.add('app-col-resizing');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stopDrag);
    },
    [widths, defaults, onMouseMove, stopDrag],
  );

  const reset = useCallback(() => {
    setWidths({ ...defaults });
    try {
      localStorage.removeItem(storageKey);
    } catch (_e) {
      /* ignore */
    }
  }, [defaults, storageKey]);

  const getResizerProps = useCallback(
    (key) => ({
      className: 'app-col-resize-handle',
      onMouseDown: (e) => startDrag(e, key),
      onClick: (e) => e.stopPropagation(), // ne pas déclencher le tri du <th>
      role: 'separator',
      'aria-orientation': 'vertical',
    }),
    [startDrag],
  );

  const getColProps = useCallback(
    (key) => ({
      style: { width: `${widths[key] || defaults[key] || 100}px` },
    }),
    [widths, defaults],
  );

  return useMemo(
    () => ({
      widths,
      getResizerProps,
      getColProps,
      reset,
    }),
    [widths, getResizerProps, getColProps, reset],
  );
}

export default useResizableColumns;
