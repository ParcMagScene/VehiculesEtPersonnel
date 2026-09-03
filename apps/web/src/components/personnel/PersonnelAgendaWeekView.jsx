import { format, isToday, isWeekend } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Ban, Briefcase, Calendar as CalIcon, MapPin, Palmtree } from 'lucide-react';

import { EVENT_COLORS } from './PersonnelAgenda';

export const PersonnelAgendaWeekView = ({ visibleDays, getEventsForDay }) => {
  return (
    <div className="agenda-week">
      <div className="agenda-week-header">
        {visibleDays.map((day) => (
          <div
            key={day.toString()}
            className={`agenda-week-day-header ${isToday(day) ? 'today' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
          >
            <span className="week-day-name">{format(day, 'EEE', { locale: fr })}</span>
            <span className={`week-day-number ${isToday(day) ? 'today-badge' : ''}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>
      <div className="agenda-week-body">
        {visibleDays.map((day) => {
          const dayEvents = getEventsForDay(day);
          return (
            <div
              key={day.toString()}
              className={`agenda-week-day ${isToday(day) ? 'today' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
            >
              {dayEvents.length === 0 && <div className="agenda-day-free">Disponible</div>}
              {dayEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="agenda-event"
                  style={{
                    background: EVENT_COLORS[evt.type]?.bg,
                    borderLeftColor: EVENT_COLORS[evt.type]?.border,
                    color: EVENT_COLORS[evt.type]?.text,
                  }}
                  title={`${evt.title}${evt.subtitle ? ' — ' + evt.subtitle : ''}`}
                >
                  <div className="agenda-event-icon">
                    {evt.type === 'mission' && <Briefcase size={12} />}
                    {evt.type === 'leave' && <Palmtree size={12} />}
                    {evt.type === 'unavailability' && <Ban size={12} />}
                    {evt.type === 'google' && <CalIcon size={12} />}
                  </div>
                  <div className="agenda-event-text">
                    <div className="agenda-event-title">{evt.title}</div>
                    {evt.subtitle && <div className="agenda-event-subtitle">{evt.subtitle}</div>}
                    {evt.location && (
                      <div className="agenda-event-location">
                        <MapPin size={10} /> {evt.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PersonnelAgendaWeekView;
