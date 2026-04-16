import {
  eachWeekOfInterval,
  endOfMonth,
  format,
  getWeek,
  isToday,
  isWeekend,
  startOfMonth,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import React from 'react';

import { Tooltip } from '@/design-system';

const CalendarHeaders = ({
  view,
  days,
  currentDate,
  gridColumns,
  handleMonthClick,
  handleWeekClick,
  handleDayClick,
}) => (
  <div className="calendar-headers-scroll-area">
    <div
      className={`calendar-grid-headers ${view}-view`}
      style={{ gridTemplateColumns: gridColumns }}
    >
      {view === 'day' ? (
        <div className="calendar-header">
          <div
            className={`calendar-header-cell day-header day-view-header ${isToday(currentDate) ? 'today' : ''}`}
          >
            <div className="day-name">Matin</div>
            <div className="day-number">{format(currentDate, 'EEEE d MMMM', { locale: fr })}</div>
          </div>
          <div
            className={`calendar-header-cell day-header day-view-header ${isToday(currentDate) ? 'today' : ''}`}
          >
            <div className="day-name">Après-midi</div>
          </div>
        </div>
      ) : view === 'year' ? (
        <div className="calendar-header">
          {days.map((monthDate, monthIndex) => {
            const monthStart = startOfMonth(monthDate);
            const monthEnd = endOfMonth(monthDate);
            const weeksInMonth = eachWeekOfInterval(
              { start: monthStart, end: monthEnd },
              { weekStartsOn: 1 },
            );
            return (
              <div
                key={monthIndex}
                className="calendar-header-cell month-header clickable"
                onClick={() => handleMonthClick(monthIndex)}
                title="Cliquer pour voir le mois"
              >
                <div className="month-name">{format(monthDate, 'MMMM', { locale: fr })}</div>
                <div className="weeks-in-month">
                  {weeksInMonth.map((weekStart, idx) => {
                    const weekNum = getWeek(weekStart, { weekStartsOn: 1 });
                    return (
                      <Tooltip key={idx} content="Cliquer pour voir la semaine" position="bottom">
                        <span
                          className="week-number-small clickable"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWeekClick(weekStart);
                          }}
                        >
                          S{weekNum}
                        </span>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="calendar-header">
            {days.map((day, index) => (
              <div
                key={index}
                className={`calendar-header-cell day-header ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today' : ''} ${view === 'month' ? 'clickable' : ''}`}
                style={{ gridColumn: 'span 2' }}
                data-day-index={index}
                onClick={() => view === 'month' && handleDayClick(day)}
                title={view === 'month' ? 'Cliquer pour voir la semaine' : undefined}
              >
                <div>
                  <div className="day-name">{format(day, 'EEEE', { locale: fr })}</div>
                  <div className="day-number">{format(day, 'd MMM', { locale: fr })}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="calendar-subheader">
            {days.map((day, index) => (
              <React.Fragment key={index}>
                <div
                  className={`calendar-header-cell period-cell ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today today-left' : ''}`}
                  data-day-index={index}
                >
                  AM
                </div>
                <div
                  className={`calendar-header-cell period-cell ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today today-right' : ''}`}
                  data-day-index={index}
                >
                  PM
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
);

export default React.memo(CalendarHeaders);
