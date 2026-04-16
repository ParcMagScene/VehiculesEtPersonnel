/**
 * FilterBar — Barre de filtres avec boutons
 *
 * Usage :
 *   <FilterBar
 *     value={filter}
 *     onChange={setFilter}
 *     options={[
 *       { value: 'all', label: 'Tous', count: 42 },
 *       { value: 'active', label: 'Actifs', count: 30 },
 *       { value: 'archived', label: 'Archivés', count: 12 },
 *     ]}
 *   />
 */
export default function FilterBar({ value, onChange, options = [], size = 'md', className = '' }) {
  return (
    <div className={`ui-filter-bar ui-filter-bar--${size} ${className}`} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`ui-filter-btn ${value === opt.value ? 'ui-filter-btn--active' : ''}`}
          onClick={() => onChange?.(opt.value)}
          disabled={opt.disabled}
        >
          {opt.icon && <span className="ui-filter-btn__icon">{opt.icon}</span>}
          <span>{opt.label}</span>
          {opt.count != null && <span className="ui-filter-btn__count">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}
