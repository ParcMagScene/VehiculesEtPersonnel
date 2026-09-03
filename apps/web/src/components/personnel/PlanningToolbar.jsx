import { Filter } from 'lucide-react';

import { SearchBar, Select } from '@/design-system';

import { PERSON_TYPES } from './personnelConstants';

// ═══════════════════════════════════════════════════════════════
// PlanningToolbar Component
// Search, filtering, and personnel type selection
// ═══════════════════════════════════════════════════════════════

export const PlanningToolbar = ({
  planningSearch,
  setPlanningSearch,
  planningFilter,
  setPlanningFilter,
  filteredCount,
  totalCount,
}) => {
  const typeOptions = [{ value: '', label: 'Tous les types' }, ...PERSON_TYPES];

  return (
    <div className="pp-toolbar">
      <div className="pp-toolbar-left">
        <SearchBar
          placeholder="Chercher un prénom, un nom..."
          value={planningSearch}
          onChange={(e) => setPlanningSearch(e.target.value)}
        />
      </div>

      <div className="pp-toolbar-right">
        <Select
          value={planningFilter}
          onChange={(e) => setPlanningFilter(e.target.value)}
          className="pp-filter-select"
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        {filteredCount !== totalCount && (
          <span className="pp-filter-badge">
            <Filter size={14} />
            {filteredCount} / {totalCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default PlanningToolbar;
