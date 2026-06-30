import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/design-system';
import MonthSelector from '../MonthSelector';
import WeekSelector from '../WeekSelector';
import YearSelector from '../YearSelector';

// ═══════════════════════════════════════════════════════════════
// PlanningHeader Component
// Date navigation, view selectors, calendar pickers
// ═══════════════════════════════════════════════════════════════

export const PlanningHeader = ({
  view,
  setView,
  currentDate,
  setCurrentDate,
  getDateLabel,
  ppShowTodayHighlight,
  goToPrevious,
  goToNext,
  goToToday,
  showMonthSelector,
  setShowMonthSelector,
  showWeekSelector,
  setShowWeekSelector,
  showYearSelector,
  setShowYearSelector,
}) => {
  const viewOptions = ['week', 'month', 'year'];

  return (
    <div className="pp-header">
      <div className="pp-header-left">
        {/* Navigation buttons */}
        <Button variant="ghost" size="sm" onClick={goToPrevious}>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="ghost" size="sm" onClick={goToNext}>
          <ChevronRight size={16} />
        </Button>
        {ppShowTodayHighlight && (
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
        )}

        {/* Period selector button with date label */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (view === 'week') setShowWeekSelector(!showWeekSelector);
            else if (view === 'month') setShowMonthSelector(!showMonthSelector);
            else setShowYearSelector(!showYearSelector);
          }}
        >
          <Calendar size={16} />
          <span className="pp-period-label">{getDateLabel()}</span>
        </Button>
      </div>

      <div className="pp-header-right">
        {/* View toggle buttons */}
        {viewOptions.map((v) => (
          <Button
            key={v}
            variant={view === v ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setView(v)}
          >
            {v === 'week' ? 'Semaine' : v === 'month' ? 'Mois' : 'Année'}
          </Button>
        ))}
      </div>

      {/* Date selector modals */}
      {showMonthSelector && (
        <MonthSelector
          selected={currentDate}
          onSelect={(date) => {
            setCurrentDate?.(date);
            setShowMonthSelector(false);
          }}
        />
      )}
      {showWeekSelector && (
        <WeekSelector
          selected={currentDate}
          onSelect={(date) => {
            setCurrentDate?.(date);
            setShowWeekSelector(false);
          }}
        />
      )}
      {showYearSelector && (
        <YearSelector
          selected={currentDate}
          onSelect={(date) => {
            setCurrentDate?.(date);
            setShowYearSelector(false);
          }}
        />
      )}
    </div>
  );
};

export default PlanningHeader;
