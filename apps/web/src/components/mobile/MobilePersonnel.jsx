import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, Mail, Star, Shield, Truck, User, Calendar } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval, startOfDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../utils/api';
import { formatPhoneDisplay } from '../PhoneInput';
import './MobilePersonnel.css';
import { Spinner, Avatar } from '@/design-system';

const skillIcon = (skillName) => {
  if (!skillName) return <Star size={12} />;
  const n = skillName.toLowerCase();
  if (n.includes('conduite')) return <Truck size={12} />;
  if (n.includes('sécurité') || n.includes('securite') || n.includes('habilitation')) return <Shield size={12} />;
  return <Star size={12} />;
};

const MISSION_COLORS = {
  confirmed: '#10b981',
  draft: '#94a3b8',
  cancelled: '#ef4444',
};

const TASK_SOURCE_COLORS = {
  affaire: '#3b82f6',
  manual: '#f59e0b',
  display_event: '#8b5cf6',
  google_event: '#06b6d4',
};

function MobilePersonnel({ onBack, currentUser }) {
  const [persons, setPersons] = useState([]);
  const [planning, setPlanning] = useState({ missions: [], availabilities: [], taskAssignments: [] });
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
  const [myPersonId, setMyPersonId] = useState(null);

  const isSimpleUser = currentUser && !currentUser.isAdmin;

  // Personnes permanentes actives uniquement
  const permanentPersons = useMemo(
    () => persons.filter(p => p.status === 'active' && p.type === 'permanent'),
    [persons]
  );

  // Plage de dates selon le mode
  const dateRange = useMemo(() => {
    if (viewMode === 'day') {
      return { start: currentDate, end: currentDate };
    }
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const we = endOfWeek(currentDate, { weekStartsOn: 1 });
    return { start: ws, end: we };
  }, [viewMode, currentDate]);

  // Jours affichés en mode semaine
  const weekDays = useMemo(() => {
    if (viewMode === 'day') return [currentDate];
    const days = [];
    let d = dateRange.start;
    while (d <= dateRange.end) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [viewMode, currentDate, dateRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');

      // Charger les personnes pour résoudre le lien user → person
      const persData = await api.getPersons();
      setPersons(persData);

      // Pour un utilisateur simple, trouver son person_id
      let personId = myPersonId;
      if (isSimpleUser && !personId && currentUser?.id) {
        const myPerson = persData.find(p => p.userId == currentUser.id || p.user_id == currentUser.id);
        if (myPerson) {
          personId = myPerson.id;
          setMyPersonId(myPerson.id);
        }
      }

      const planParams = { startDate: startStr, endDate: endStr };
      if (isSimpleUser && personId) planParams.personId = personId;

      const planData = await api.getPersonnelPlanning(planParams);
      setPlanning(planData);
    } catch (err) {
      console.error('Erreur chargement planning personnel:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, isSimpleUser, currentUser?.id, myPersonId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Missions d'une personne pour un jour
  const getMissionsForPersonDay = useCallback((personId, day) => {
    return planning.missions.filter(m => {
      const hasAssignment = m.assignments?.some(a => a.personId === personId || a.person_id === personId);
      if (!hasAssignment) return false;
      if (m.status === 'cancelled') return false;
      try {
        const mStart = startOfDay(parseISO(m.startDate || m.start_date));
        const mEnd = startOfDay(parseISO(m.endDate || m.end_date));
        return isWithinInterval(startOfDay(day), { start: mStart, end: mEnd });
      } catch { return false; }
    });
  }, [planning.missions]);

  // Indisponibilités d'une personne pour un jour
  const getUnavailForPersonDay = useCallback((personId, day) => {
    return planning.availabilities.filter(a => {
      if ((a.personId || a.person_id) !== personId) return false;
      try {
        const aStart = startOfDay(parseISO(a.startDate || a.start_date));
        const aEnd = startOfDay(parseISO(a.endDate || a.end_date));
        return isWithinInterval(startOfDay(day), { start: aStart, end: aEnd });
      } catch { return false; }
    });
  }, [planning.availabilities]);

  // Tâches assignées d'une personne pour un jour
  const getTasksForPersonDay = useCallback((personId, day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return (planning.taskAssignments || []).filter(ta => {
      if ((ta.person_id || ta.personId) !== personId) return false;
      return ta.date === dayStr;
    });
  }, [planning.taskAssignments]);

  const navigate = (dir) => {
    const delta = viewMode === 'day' ? 1 : 7;
    setCurrentDate(prev => addDays(prev, dir * delta));
  };

  // Vue détail personne
  if (selectedPerson) {
    const p = selectedPerson;
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
    return (
      <div className="mobile-personnel">
        <div className="mpers-header">
          <button className="mpers-back" onClick={() => setSelectedPerson(null)}>
            <ArrowLeft size={20} />
          </button>
          <h2>{fullName || `Personnel #${p.id}`}</h2>
        </div>

        <div className="mpers-detail">
          <div className="mpers-detail-top">
            {p.photo ? (
              <img src={`/avatars/${p.photo}`} alt="" className="mpers-detail-photo" />
            ) : (
              <Avatar name={fullName} size="xl" />
            )}
            <h3>{fullName}</h3>
            <span className={`mpers-status-tag ${p.status === 'active' ? 'active' : 'inactive'}`}>
              {p.status === 'active' ? 'Actif' : 'Inactif'}
            </span>
            {p.contractType && (
              <span className="mpers-contract">{p.contractType}</span>
            )}
          </div>

          {/* Coordonnées */}
          <div className="mpers-section">
            <h4>Coordonnées</h4>
            {p.email && (
              <a href={`mailto:${p.email}`} className="mpers-info-row">
                <Mail size={16} />
                <span>{p.email}</span>
              </a>
            )}
            {p.phone && (
              <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} className="mpers-info-row">
                <Phone size={16} />
                <span>{formatPhoneDisplay(p.phone)}</span>
              </a>
            )}
            {!p.email && !p.phone && (
              <p className="mpers-empty-info">Aucune coordonnée renseignée</p>
            )}
          </div>

          {/* Compétences */}
          <div className="mpers-section">
            <h4>Compétences</h4>
            {p.skills?.length > 0 ? (
              <div className="mpers-skills">
                {p.skills.map((skill, i) => (
                  <div key={i} className="mpers-skill-chip">
                    {skillIcon(skill.name)}
                    <span>{skill.name}</span>
                    {skill.level && <span className="mpers-skill-level">{skill.level}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mpers-empty-info">Aucune compétence enregistrée</p>
            )}
          </div>

          {/* Postes par défaut */}
          {p.defaultPositions?.length > 0 && (
            <div className="mpers-section">
              <h4>Postes par défaut</h4>
              <div className="mpers-positions">
                {p.defaultPositions.map((pos, i) => (
                  <span key={i} className="mpers-position-tag">{pos}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {p.notes && (
            <div className="mpers-section">
              <h4>Notes</h4>
              <p className="mpers-notes">{p.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vue planning
  const isToday = isSameDay(currentDate, new Date());

  return (
    <div className="mobile-personnel">
      <div className="mpers-header">
        <button className="mpers-back" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h2>{isSimpleUser ? 'Mon planning' : 'Personnel'}</h2>
        <div className="mpers-view-toggle">
          <button className={viewMode === 'day' ? 'active' : ''} onClick={() => setViewMode('day')}>Jour</button>
          <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>Semaine</button>
        </div>
      </div>

      {/* Navigation date */}
      <div className="mpers-date-nav">
        <button className="mpers-nav-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <button className={`mpers-date-label ${isToday ? 'today' : ''}`} onClick={() => setCurrentDate(startOfDay(new Date()))}>
          {viewMode === 'day'
            ? format(currentDate, 'EEEE d MMMM', { locale: fr })
            : `${format(dateRange.start, 'd MMM', { locale: fr })} — ${format(dateRange.end, 'd MMM', { locale: fr })}`
          }
        </button>
        <button className="mpers-nav-btn" onClick={() => navigate(1)}>
          <ChevronRight size={20} />
        </button>
      </div>
      {!isToday && (
        <button className="mpers-today-btn" onClick={() => setCurrentDate(startOfDay(new Date()))}>
          Aujourd'hui
        </button>
      )}

      {loading ? (
        <div className="mpers-loading">
          <Spinner size="lg" />
          <p>Chargement...</p>
        </div>
      ) : isSimpleUser ? (
        /* ═══ VUE UTILISATEUR SIMPLE — Mon planning ═══ */
        (() => {
          const myPerson = persons.find(p => p.id === myPersonId);
          if (!myPerson) {
            return (
              <div className="mpers-empty-list">
                <User size={40} />
                <p>Aucun profil personnel associé à votre compte</p>
              </div>
            );
          }
          const fullName = `${myPerson.firstName || ''} ${myPerson.lastName || ''}`.trim();

          if (viewMode === 'day') {
            const missions = getMissionsForPersonDay(myPersonId, currentDate);
            const unavail = getUnavailForPersonDay(myPersonId, currentDate);
            const tasks = getTasksForPersonDay(myPersonId, currentDate);
            const isUnavailable = unavail.length > 0;
            const hasContent = missions.length > 0 || tasks.length > 0;
            return (
              <div className="mpers-my-planning">
                {/* En-tête profil */}
                <div className="mpers-my-profile">
                  {myPerson.photo ? (
                    <img src={`/avatars/${myPerson.photo}`} alt="" className="mpers-my-avatar-img" />
                  ) : (
                    <Avatar name={fullName} size={48} />
                  )}
                  <div className="mpers-my-name">{fullName}</div>
                </div>

                {/* Statut du jour */}
                {isUnavailable ? (
                  <div className="mpers-my-section">
                    <h4>Indisponibilité</h4>
                    {unavail.map((u, i) => (
                      <div key={i} className="mpers-my-unavail-card">
                        <span className="mpers-my-unavail-reason">{u.reason || 'Indisponible'}</span>
                        {(u.startDate || u.start_date) && (
                          <span className="mpers-my-unavail-dates">
                            Du {format(parseISO(u.startDate || u.start_date), 'd MMM', { locale: fr })} au {format(parseISO(u.endDate || u.end_date), 'd MMM', { locale: fr })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Missions */}
                {missions.length > 0 && (
                  <div className="mpers-my-section">
                    <h4>Missions</h4>
                    {missions.map(m => (
                      <div key={m.id} className="mpers-my-mission-card" style={{ borderLeftColor: MISSION_COLORS[m.status] || '#3b82f6' }}>
                        <div className="mpers-my-mission-title">{m.title || m.affaire || 'Mission'}</div>
                        {(m.clientName || m.client_name) && (
                          <div className="mpers-my-mission-client">{m.clientName || m.client_name}</div>
                        )}
                        {(m.startTime || m.start_time) && (
                          <div className="mpers-my-mission-time">
                            <Calendar size={14} /> {m.startTime || m.start_time}{(m.endTime || m.end_time) ? ` — ${m.endTime || m.end_time}` : ''}
                          </div>
                        )}
                        {(m.location || m.address) && (
                          <div className="mpers-my-mission-location">{m.location || m.address}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tâches */}
                {tasks.length > 0 && (
                  <div className="mpers-my-section">
                    <h4>Tâches</h4>
                    {tasks.map(ta => (
                      <div key={ta.id} className="mpers-my-task-card" style={{ borderLeftColor: TASK_SOURCE_COLORS[ta.source_type] || '#f59e0b' }}>
                        <div className="mpers-my-task-title">{ta.title || ta.affaire_num || 'Tâche'}</div>
                        {ta.section && <div className="mpers-my-task-section">{ta.section}</div>}
                        {ta.period && <div className="mpers-my-task-period">{ta.period}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Rien de prévu */}
                {!isUnavailable && !hasContent && (
                  <div className="mpers-my-free">
                    <Calendar size={32} />
                    <p>Aucune activité prévue ce jour</p>
                  </div>
                )}
              </div>
            );
          }

          // Vue semaine simple user
          return (
            <div className="mpers-my-planning">
              <div className="mpers-my-profile">
                {myPerson.photo ? (
                  <img src={`/avatars/${myPerson.photo}`} alt="" className="mpers-my-avatar-img" />
                ) : (
                  <Avatar name={fullName} size={48} />
                )}
                <div className="mpers-my-name">{fullName}</div>
              </div>

              <div className="mpers-my-week-grid">
                {weekDays.map(d => {
                  const missions = getMissionsForPersonDay(myPersonId, d);
                  const unavail = getUnavailForPersonDay(myPersonId, d);
                  const tasks = getTasksForPersonDay(myPersonId, d);
                  const isUnavailable = unavail.length > 0;
                  const hasContent = missions.length > 0 || tasks.length > 0;
                  const isDayToday = isSameDay(d, new Date());
                  return (
                    <div
                      key={d.toISOString()}
                      className={`mpers-my-week-day ${isUnavailable ? 'unavail' : ''} ${isDayToday ? 'today' : ''}`}
                      onClick={() => { setCurrentDate(d); setViewMode('day'); }}
                    >
                      <div className="mpers-my-week-day-header">
                        <span className="mpers-my-week-day-name">{format(d, 'EEE', { locale: fr })}</span>
                        <span className="mpers-my-week-day-num">{format(d, 'd')}</span>
                      </div>
                      <div className="mpers-my-week-day-content">
                        {isUnavailable ? (
                          <div className="mpers-my-week-unavail">{unavail[0].reason || 'Absent'}</div>
                        ) : hasContent ? (
                          <>
                            {missions.map(m => (
                              <div key={m.id} className="mpers-my-week-mission" style={{ borderLeftColor: MISSION_COLORS[m.status] || '#3b82f6' }}>
                                {m.title || m.affaire || 'Mission'}
                              </div>
                            ))}
                            {tasks.map(ta => (
                              <div key={ta.id} className="mpers-my-week-task" style={{ borderLeftColor: TASK_SOURCE_COLORS[ta.source_type] || '#f59e0b' }}>
                                {ta.title || ta.affaire_num || 'Tâche'}
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="mpers-my-week-free">—</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      ) : viewMode === 'day' ? (
        /* ═══ VUE JOUR ═══ */
        <div className="mpers-day-list">
          {permanentPersons.length === 0 ? (
            <div className="mpers-empty-list">
              <User size={40} />
              <p>Aucun personnel permanent</p>
            </div>
          ) : permanentPersons.map(p => {
            const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
            const missions = getMissionsForPersonDay(p.id, currentDate);
            const unavail = getUnavailForPersonDay(p.id, currentDate);
            const tasks = getTasksForPersonDay(p.id, currentDate);
            const isUnavailable = unavail.length > 0;
            return (
              <div key={p.id} className={`mpers-day-row ${isUnavailable ? 'unavailable' : ''}`} onClick={() => setSelectedPerson(p)}>
                {p.photo ? (
                  <img src={`/avatars/${p.photo}`} alt="" className="mpers-avatar-img" loading="lazy" />
                ) : (
                  <Avatar name={fullName} size="md" />
                )}
                <div className="mpers-day-info">
                  <div className="mpers-day-name">{fullName}</div>
                  {isUnavailable ? (
                    <span className="mpers-unavail-tag">{unavail[0].reason || 'Indisponible'}</span>
                  ) : (missions.length > 0 || tasks.length > 0) ? (
                    <div className="mpers-day-missions">
                      {missions.map(m => (
                        <div key={m.id} className="mpers-mission-chip" style={{ '--mission-color': MISSION_COLORS[m.status] || '#3b82f6' }}>
                          <span className="mpers-mission-dot" />
                          <span className="mpers-mission-title">{m.title || m.affaire || 'Mission'}</span>
                          {(m.startTime || m.start_time) && (
                            <span className="mpers-mission-time">{m.startTime || m.start_time}</span>
                          )}
                        </div>
                      ))}
                      {tasks.map(ta => (
                        <div key={ta.id} className="mpers-task-chip" style={{ '--task-color': TASK_SOURCE_COLORS[ta.source_type] || '#f59e0b' }}>
                          <span className="mpers-task-dot" />
                          <span className="mpers-mission-title">{ta.title || ta.affaire_num || 'Tâche'}</span>
                          {ta.period && <span className="mpers-mission-time">{ta.period}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="mpers-free-tag">Disponible</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ═══ VUE SEMAINE ═══ */
        <div className="mpers-week-view">
          <div className="mpers-week-container">
            {/* Colonne fixe noms */}
            <div className="mpers-week-names">
              <div className="mpers-week-names-header">Équipe</div>
              {permanentPersons.map(p => {
                const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
                return (
                  <div key={p.id} className="mpers-week-person" onClick={() => setSelectedPerson(p)}>
                    {p.photo ? (
                      <img src={`/avatars/${p.photo}`} alt="" className="mpers-week-avatar-img" />
                    ) : (
                      <Avatar name={fullName} size={30} />
                    )}
                    <div className="mpers-week-person-info">
                      <span className="mpers-week-person-name">{p.firstName || ''}</span>
                      <span className="mpers-week-person-last">{p.lastName || ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grille scrollable */}
            <div className="mpers-week-grid-scroll">
              {/* En-tête jours */}
              <div className="mpers-week-days-header">
                {weekDays.map(d => (
                  <div
                    key={d.toISOString()}
                    className={`mpers-week-day-col ${isSameDay(d, new Date()) ? 'today' : ''}`}
                    onClick={() => { setCurrentDate(d); setViewMode('day'); }}
                  >
                    <span className="mpers-week-day-name">{format(d, 'EEE', { locale: fr })}</span>
                    <span className="mpers-week-day-num">{format(d, 'd')}</span>
                  </div>
                ))}
              </div>
              {/* Lignes grille */}
              <div className="mpers-week-grid">
                {permanentPersons.map(p => (
                  <div key={p.id} className="mpers-week-grid-row">
                    {weekDays.map(d => {
                      const missions = getMissionsForPersonDay(p.id, d);
                      const unavail = getUnavailForPersonDay(p.id, d);
                      const tasks = getTasksForPersonDay(p.id, d);
                      const isUnavailable = unavail.length > 0;
                      const hasContent = missions.length > 0 || tasks.length > 0;
                      return (
                        <div
                          key={d.toISOString()}
                          className={`mpers-week-cell ${isUnavailable ? 'unavail' : ''}`}
                        >
                          {isUnavailable ? (
                            <div className="mpers-cell-unavail">
                              <span>{unavail[0].reason || 'Absent'}</span>
                            </div>
                          ) : hasContent ? (
                            <>
                              {missions.map(m => (
                                <div key={m.id} className="mpers-cell-mission" style={{ borderLeftColor: MISSION_COLORS[m.status] || '#3b82f6' }}>
                                  <span className="mpers-cell-mission-title">{m.title || m.affaire || 'Mission'}</span>
                                  {(m.clientName || m.client_name) && (
                                    <span className="mpers-cell-mission-client">{m.clientName || m.client_name}</span>
                                  )}
                                </div>
                              ))}
                              {tasks.map(ta => (
                                <div key={ta.id} className="mpers-cell-mission" style={{ borderLeftColor: TASK_SOURCE_COLORS[ta.source_type] || '#f59e0b' }}>
                                  <span className="mpers-cell-mission-title">{ta.title || ta.affaire_num || 'Tâche'}</span>
                                </div>
                              ))}
                            </>
                          ) : (
                            <div className="mpers-cell-free">
                              <span className="mpers-cell-free-dot" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Légende */}
          <div className="mpers-week-legend">
            <span><span className="mpers-legend-dot busy" /> Mission</span>
            <span><span className="mpers-legend-dot task" /> Tâche</span>
            <span><span className="mpers-legend-dot unavail" /> Indisponible</span>
            <span><span className="mpers-legend-dot free" /> Disponible</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobilePersonnel;
