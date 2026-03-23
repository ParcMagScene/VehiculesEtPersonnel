import { forwardRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

/**
 * SearchBar — Barre de recherche standardisée
 *
 * Usage :
 *   <SearchBar
 *     value={search}
 *     onChange={setSearch}
 *     placeholder="Rechercher un véhicule…"
 *     size="sm"
 *   />
 */
const SearchBar = forwardRef(({
  value = '',
  onChange,
  placeholder = 'Rechercher…',
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const handleChange = useCallback((e) => {
    onChange?.(e.target.value);
  }, [onChange]);

  const handleClear = useCallback(() => {
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
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        {...props}
      />
      {value && (
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
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
