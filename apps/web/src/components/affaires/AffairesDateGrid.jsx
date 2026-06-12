import './AffairesDateGrid.css';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Tooltip } from '@/design-system';

/* ─────────── Helpers de date (local, pas UTC) ─────────── */

const fmtISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfDay = (d) => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

// Lundi de la semaine ISO contenant `d`
const startOfWeekMonday = (d) => {
  const out = startOfDay(d);
  const dow = out.getDay(); // 0 = dim, 1 = lun, … 6 = sam
  const offset = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + offset);
  return out;
};

/* ─────────── Calcul des cellules visibles ─────────── */

const computeCells = (mode, anchor) => {
  if (mode === 'week') {
    const start = startOfWeekMonday(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = fmtISO(d);
      return { date: d, key: iso, startStr: iso, endStr: iso };
    });
  }
  if (mode === 'month') {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(y, m, i + 1);
      const iso = fmtISO(d);
      return { date: d, key: iso, startStr: iso, endStr: iso };
    });
  }
  // year : 12 mois
  const y = anchor.getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(y, i, 1);
    const end = new Date(y, i + 1, 0);
    return {
      date: start,
      key: `${y}-${String(i + 1).padStart(2, '0')}`,
      startStr: fmtISO(start),
      endStr: fmtISO(end),
    };
  });
};

const shiftAnchor = (mode, anchor, dir) => {
  const out = new Date(anchor);
  if (mode === 'week') out.setDate(out.getDate() + dir * 7);
  else if (mode === 'month') out.setMonth(out.getMonth() + dir);
  else out.setFullYear(out.getFullYear() + dir);
  return out;
};

const labelForGrid = (mode, anchor) => {
  if (mode === 'week') {
    const s = startOfWeekMonday(anchor);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    const sLab = format(s, 'd MMM', { locale: fr });
    const eLab = format(e, 'd MMM yyyy', { locale: fr });
    return `${sLab} – ${eLab}`;
  }
  if (mode === 'month') {
    const lab = format(anchor, 'MMMM yyyy', { locale: fr });
    return lab.charAt(0).toUpperCase() + lab.slice(1);
  }
  return format(anchor, 'yyyy', { locale: fr });
};

const cellLabel = (cell, mode) => {
  if (mode === 'year') {
    const lab = format(cell.date, 'MMM', { locale: fr });
    return lab.charAt(0).toUpperCase() + lab.slice(1);
  }
  if (mode === 'month') return String(cell.date.getDate());
  // week
  const day = format(cell.date, 'EEE', { locale: fr });
  return `${day.charAt(0).toUpperCase() + day.slice(1)} ${cell.date.getDate()}`;
};

/* ─────────── Composant ─────────── */

const MODES = [
  { key: 'week', label: 'Sem.' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
];

const AffairesDateGrid = ({
  mode,
  onModeChange,
  anchor,
  onAnchorChange,
  filterStart,
  filterEnd,
  onFilterChange,
}) => {
  const cells = useMemo(() => computeCells(mode, anchor), [mode, anchor]);
  const todayStr = useMemo(() => fmtISO(startOfDay(new Date())), []);
  const gridLabel = useMemo(() => labelForGrid(mode, anchor), [mode, anchor]);
  const gridRef = useRef(null);
  const [drag, setDrag] = useState(null);

  // Sélection visible (intersection [filterStart,filterEnd] × cellules affichées)
  const selection = useMemo(() => {
    if (!filterStart || !filterEnd) return null;
    let first = -1;
    let last = -1;
    cells.forEach((c, i) => {
      if (c.endStr >= filterStart && c.startStr <= filterEnd) {
        if (first === -1) first = i;
        last = i;
      }
    });
    if (first === -1) return null;
    return {
      first,
      last,
      overflowLeft: cells[first].startStr > filterStart,
      overflowRight: cells[last].endStr < filterEnd,
    };
  }, [cells, filterStart, filterEnd]);

  // Sélection à afficher (preview en cours de drag prend le dessus)
  const displayedSelection = useMemo(() => {
    if (drag) {
      const lo = Math.max(0, Math.min(drag.startIdx, drag.endIdx));
      const hi = Math.min(cells.length - 1, Math.max(drag.startIdx, drag.endIdx));
      return { first: lo, last: hi, overflowLeft: false, overflowRight: false };
    }
    return selection;
  }, [drag, selection, cells.length]);

  const cellIndexAtPos = useCallback(
    (clientX) => {
      if (!gridRef.current) return -1;
      const rect = gridRef.current.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(cells.length - 1, Math.floor(ratio * cells.length)));
    },
    [cells.length],
  );

  // Drag-select sur cellule vide
  const handleCellMouseDown = useCallback((e, idx) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDrag({ type: 'select', startIdx: idx, endIdx: idx });
  }, []);

  // Drag sur poignée gauche / droite / corps
  const handleSelectionMouseDown = useCallback(
    (e, kind) => {
      if (e.button !== 0 || !selection) return;
      e.preventDefault();
      e.stopPropagation();
      if (kind === 'resize-l') {
        setDrag({
          type: 'resize-l',
          startIdx: selection.last, // pivot fixe = bord droit
          endIdx: selection.first,
        });
      } else if (kind === 'resize-r') {
        setDrag({
          type: 'resize-r',
          startIdx: selection.first, // pivot fixe = bord gauche
          endIdx: selection.last,
        });
      } else {
        setDrag({
          type: 'move',
          startIdx: selection.first,
          endIdx: selection.last,
          downIdx: cellIndexAtPos(e.clientX),
          origFirst: selection.first,
          origLast: selection.last,
        });
      }
    },
    [selection, cellIndexAtPos],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const idx = cellIndexAtPos(e.clientX);
      if (idx < 0) return;
      setDrag((prev) => {
        if (!prev) return prev;
        if (prev.type === 'move') {
          const delta = idx - prev.downIdx;
          const len = prev.origLast - prev.origFirst;
          let f = prev.origFirst + delta;
          let l = prev.origLast + delta;
          if (f < 0) {
            f = 0;
            l = len;
          }
          if (l > cells.length - 1) {
            l = cells.length - 1;
            f = l - len;
          }
          return { ...prev, startIdx: f, endIdx: l };
        }
        // select / resize-l / resize-r
        return { ...prev, endIdx: idx };
      });
    };
    const onUp = () => {
      setDrag((prev) => {
        if (!prev) return null;
        const lo = Math.max(0, Math.min(prev.startIdx, prev.endIdx));
        const hi = Math.min(cells.length - 1, Math.max(prev.startIdx, prev.endIdx));
        const newStart = cells[lo].startStr;
        const newEnd = cells[hi].endStr;
        if (newStart !== filterStart || newEnd !== filterEnd) {
          onFilterChange?.(newStart, newEnd);
        }
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, cellIndexAtPos, cells, filterStart, filterEnd, onFilterChange]);

  const goPrev = () => onAnchorChange(shiftAnchor(mode, anchor, -1));
  const goNext = () => onAnchorChange(shiftAnchor(mode, anchor, +1));
  const goToday = () => onAnchorChange(new Date());

  const isToday = (cell) => mode !== 'year' && cell.startStr === todayStr;
  const isCurrentMonth = (cell) =>
    mode === 'year' &&
    cell.date.getFullYear() === new Date().getFullYear() &&
    cell.date.getMonth() === new Date().getMonth();

  return (
    <div className="affaires-grid-widget">
      <div className="adg-controls">
        <div className="adg-mode-selector">
          {MODES.map((m) => (
            <Button
              key={m.key}
              variant="ghost"
              className={`adg-mode-btn${mode === m.key ? ' active' : ''}`}
              onClick={() => onModeChange(m.key)}
            >
              {m.label}
            </Button>
          ))}
        </div>

        <Tooltip content="Période précédente">
          <Button
            variant="ghost"
            className="adg-nav-btn"
            onClick={goPrev}
            aria-label="Période précédente"
          >
            <ChevronLeft size={16} />
          </Button>
        </Tooltip>
        <Tooltip content="Aller à aujourd'hui">
          <Button
            variant="ghost"
            className="adg-nav-btn adg-today-btn"
            onClick={goToday}
            aria-label="Aujourd'hui"
          >
            <CalendarClock size={14} />
          </Button>
        </Tooltip>
        <Tooltip content="Période suivante">
          <Button
            variant="ghost"
            className="adg-nav-btn"
            onClick={goNext}
            aria-label="Période suivante"
          >
            <ChevronRight size={16} />
          </Button>
        </Tooltip>

        <div className="adg-label" title={gridLabel}>
          {gridLabel}
        </div>
      </div>

      <div
        className={`adg-grid mode-${mode}`}
        ref={gridRef}
        style={{ '--cell-count': cells.length }}
        role="group"
        aria-label="Sélection de la période"
      >
        {cells.map((cell, idx) => (
          <div
            key={cell.key}
            className={`adg-cell${isToday(cell) ? ' is-today' : ''}${
              isCurrentMonth(cell) ? ' is-current-month' : ''
            }`}
            onMouseDown={(e) => handleCellMouseDown(e, idx)}
            title={
              mode === 'year'
                ? format(cell.date, 'MMMM yyyy', { locale: fr })
                : format(cell.date, 'EEEE d MMMM yyyy', { locale: fr })
            }
          >
            <span className="adg-cell-label">{cellLabel(cell, mode)}</span>
          </div>
        ))}

        {displayedSelection && (
          <div
            className={`adg-selection${drag ? ' is-dragging' : ''}`}
            style={{
              left: `${(displayedSelection.first / cells.length) * 100}%`,
              width: `${
                ((displayedSelection.last - displayedSelection.first + 1) / cells.length) * 100
              }%`,
            }}
            onMouseDown={(e) => handleSelectionMouseDown(e, 'move')}
            role="slider"
            tabIndex={0}
            aria-label="Plage sélectionnée — déplacer ou redimensionner via les poignées"
            aria-valuemin={0}
            aria-valuemax={cells.length - 1}
            aria-valuenow={displayedSelection.first}
            aria-valuetext={`Du ${cells[displayedSelection.first]?.label ?? ''} au ${cells[displayedSelection.last]?.label ?? ''}`}
          >
            <div
              className="adg-handle adg-handle-left"
              onMouseDown={(e) => handleSelectionMouseDown(e, 'resize-l')}
              role="separator"
              aria-label="Début de la sélection"
              title="Glisser pour ajuster le début"
            />
            <div
              className="adg-handle adg-handle-right"
              onMouseDown={(e) => handleSelectionMouseDown(e, 'resize-r')}
              role="separator"
              aria-label="Fin de la sélection"
              title="Glisser pour ajuster la fin"
            />
            {selection?.overflowLeft && !drag && (
              <span className="adg-overflow adg-overflow-l" aria-hidden="true">
                «
              </span>
            )}
            {selection?.overflowRight && !drag && (
              <span className="adg-overflow adg-overflow-r" aria-hidden="true">
                »
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AffairesDateGrid;
