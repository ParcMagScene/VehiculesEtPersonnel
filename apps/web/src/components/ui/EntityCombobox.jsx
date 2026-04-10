// ============================================================
// EntityCombobox — Combobox générique avec autocomplétion
// Remplace les <select> pour toute entité DB (fournisseurs, clients, etc.)
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';
import './EntityCombobox.css';

/**
 * @param {Object}   props
 * @param {string}   props.value         - ID sélectionné (string)
 * @param {function} props.onChange       - (newValue: string) => void
 * @param {Array}    props.options        - [{ id, label }] ou [{ id, name }]
 * @param {string}   [props.placeholder] - Texte quand rien n'est sélectionné
 * @param {boolean}  [props.allowClear]  - Afficher le bouton X (défaut: true)
 * @param {string}   [props.className]   - Classes CSS supplémentaires
 * @param {boolean}  [props.disabled]    - Désactivé
 */
export default function EntityCombobox({
  value,
  onChange,
  options = [],
  placeholder = '— Choisir —',
  allowClear = true,
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalise options → { id, label }
  const items = useMemo(() =>
    options.map(o => ({
      id: String(o.id ?? o.value ?? ''),
      label: o.label || o.name || o.text || String(o.id),
    })),
    [options]
  );

  // Label de la sélection courante
  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const found = items.find(o => o.id === String(value));
    return found ? found.label : '';
  }, [value, items]);

  // Filtrage progressif (insensible accents + casse)
  const normalize = useCallback((s) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    []
  );

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = normalize(query);
    return items.filter(o => normalize(o.label).includes(q));
  }, [items, query, normalize]);

  // Reset highlight quand la liste filtrée change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHighlightIdx(0); }, [filtered]);

  // Scroll l'élément surligné dans la vue
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectItem = useCallback((item) => {
    onChange(item.id);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  }, [onChange]);

  const handleKeyDown = useCallback((e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx]) selectItem(filtered[highlightIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setQuery('');
        break;
      case 'Tab':
        setOpen(false);
        setQuery('');
        break;
      default:
        break;
    }
  }, [open, filtered, highlightIdx, selectItem]);

  const handleInputChange = useCallback((e) => {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  }, [open]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setOpen(prev => {
      if (!prev) setTimeout(() => inputRef.current?.focus(), 0);
      else setQuery('');
      return !prev;
    });
  }, [disabled]);

  return (
    <div
      ref={containerRef}
      className={`entity-combobox ${open ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
    >
      {/* Champ affiché / saisie */}
      <div className="ecb-control" role="button" tabIndex={0} onClick={handleToggle}>
        {open ? (
          <input
            ref={inputRef}
            className="ecb-input"
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedLabel || placeholder}
            autoFocus
          />
        ) : (
          <span className={`ecb-display ${!value ? 'ecb-placeholder' : ''}`}>
            {selectedLabel || placeholder}
          </span>
        )}
        <span className="ecb-icons">
          {allowClear && value && !disabled && (
            <button type="button" className="ecb-clear" onClick={handleClear} tabIndex={-1}>
              <X size={14} />
            </button>
          )}
          <ChevronDown size={14} className={`ecb-chevron ${open ? 'ecb-chevron-up' : ''}`} />
        </span>
      </div>

      {/* Liste déroulante */}
      {open && (
        <ul ref={listRef} className="ecb-dropdown" role="listbox">
          {filtered.length === 0 ? (
            <li className="ecb-no-result">Aucun résultat</li>
          ) : (
            filtered.map((item, idx) => (
              <li
                key={item.id}
                role="option"
                aria-selected={item.id === String(value)}
                className={`ecb-option ${idx === highlightIdx ? 'ecb-highlighted' : ''} ${item.id === String(value) ? 'ecb-selected' : ''}`}
                onMouseEnter={() => setHighlightIdx(idx)}
                onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
