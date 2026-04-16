import { Search, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

/**
 * SearchBar — Barre de recherche standardisée
 *
 * Usage :
 *   <SearchBar
 *     value={search}
 *     onChange={setSearch}
 *     placeholder="Rechercher un véhicule…"
 *     size="sm"
 *     debounce={300}
 *   />
 */
const SearchBar = forwardRef(
  (
    {
      value = '',
      onChange,
      placeholder = 'Rechercher…',
      size = 'md',
      debounce = 0,
      className = '',
      ...props
    },
    ref,
  ) => {
    const [localValue, setLocalValue] = useState(value);
    const timerRef = useRef(null);

    // Sync external value → local (controlled mode)
    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const emit = useCallback(
      (v) => {
        if (debounce > 0) {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => onChange?.(v), debounce);
        } else {
          onChange?.(v);
        }
      },
      [onChange, debounce],
    );

    // Cleanup timer on unmount
    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handleChange = useCallback(
      (e) => {
        const v = e.target.value;
        setLocalValue(v);
        emit(v);
      },
      [emit],
    );

    const handleClear = useCallback(() => {
      setLocalValue('');
      clearTimeout(timerRef.current);
      onChange?.('');
    }, [onChange]);

    const iconSize = size === 'sm' ? 14 : 16;

    return (
      <div className={`ui-search-bar ui-search-bar--${size} ${className}`}>
        <Search size={iconSize} className="ui-search-bar__icon" />
        <input
          ref={ref}
          type="text"
          className="ui-search-bar__input"
          value={debounce > 0 ? localValue : value}
          onChange={handleChange}
          placeholder={placeholder}
          {...props}
        />
        {(debounce > 0 ? localValue : value) && (
          <button
            type="button"
            className="ui-search-bar__clear"
            onClick={handleClear}
            aria-label="Effacer la recherche"
          >
            <X size={size === 'sm' ? 12 : 14} />
          </button>
        )}
      </div>
    );
  },
);

SearchBar.displayName = 'SearchBar';

export default SearchBar;
