import React from 'react';
import { isToday, isSameMonth, isWeekend, format } from 'date-fns';

import { EVENT_COLORS } from './PersonnelAgenda';

export const PersonnelAgendaMonthView = ({ visibleDays, agendaDate, getEventsForDay }) => {
  return (
    <div className="agenda-month">
      <div className="agenda-month-header">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="agenda-month-day-label">
            {d}
          </div>
        ))}
      </div>
      <div className="agenda-month-grid">
        {/* Padding for first week */}
        {(() => {
          const firstDay = visibleDays[0];
          const dayOfWeek = (firstDay.getDay() + 6) % 7; // 0=Mon
          const padding = [];
          for (let i = 0; i < dayOfWeek; i++) {
            padding.push(<div key={`pad-${i}`} className="agenda-month-cell empty" />);
          }
          return padding;
        })()}
        {visibleDays.map((day) => {
          const dayEvents = getEventsForDay(day);
          return (
            <div
              key={day.toString()}
              className={`agenda-month-cell ${isToday(day) ? 'today' : ''} ${!isSameMonth(day, agendaDate) ? 'other-month' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
            >
              <div className="month-cell-date">
                <span className={isToday(day) ? 'today-badge' : ''}>{format(day, 'd')}</span>
              </div>
              <div className="month-cell-events">
                {dayEvents.slice(0, 3).map((evt) => (
                  <div
                    key={evt.id}
                    className="month-event-dot"
                    style={{
                      background: EVENT_COLORS[evt.type]?.border,
                    }}
                    title={evt.title}
                  >
                    <span className="month-event-label">{evt.title}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="month-event-more">+{dayEvents.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PersonnelAgendaMonthView;
