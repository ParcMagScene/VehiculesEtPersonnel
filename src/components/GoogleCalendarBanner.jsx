import React, { useState, useEffect } from 'react';
import { format, addDays, parseISO, isToday, isTomorrow, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import './GoogleCalendarBanner.css';

function GoogleCalendarBanner({ calendarConfig, view, currentDate, onScroll, onEventClick, onEventsChange, clients, locations, reservations = [], onEventHover, onRequestEditReservation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [tokenClient, setTokenClient] = useState(null);
  const [displayMode, setDisplayMode] = useState('compact'); // 'closed', 'compact'
  const [bannerHeight, setBannerHeight] = useState(200);
  const [isResizing, setIsResizing] = useState(false);

  // Notifier le parent quand les événements changent
  useEffect(() => {
    if (onEventsChange) {
      onEventsChange(events);
    }
  }, [events, onEventsChange]);

  // Synchroniser les largeurs avec le calendrier principal
  useEffect(() => {
    const syncWidths = () => {
      const calendarGrid = document.querySelector('.calendar-grid');
      const bannerGrid = document.querySelector('.banner-grid');
      const bannerScrollArea = document.querySelector('.banner-scroll-area');
      
      if (calendarGrid && bannerGrid && bannerScrollArea) {
        // Copier les colonnes calculées du calendrier pour toutes les vues
        const gridComputedStyle = window.getComputedStyle(calendarGrid);
        const gridColumns = gridComputedStyle.gridTemplateColumns;
        const columnWidths = gridColumns.split(' ').map(width => width);
        bannerGrid.style.gridTemplateColumns = columnWidths.join(' ');
      }
    };

    // Attendre que le DOM soit complètement rendu après changement de vue
    const timer1 = setTimeout(syncWidths, 50);
    const timer2 = setTimeout(syncWidths, 150);
    const timer3 = setTimeout(syncWidths, 300);

    // Observer les changements de taille du calendrier
    const calendarGrid = document.querySelector('.calendar-grid');
    let resizeObserver;
    
    if (calendarGrid) {
      resizeObserver = new ResizeObserver(syncWidths);
      resizeObserver.observe(calendarGrid);
    }

    // Synchroniser lors du resize de la fenêtre
    window.addEventListener('resize', syncWidths);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', syncWidths);
    };
  }, [view, currentDate, events.length]);

  // Synchroniser le scroll entre le calendrier et le banner
  useEffect(() => {
    let cleanupFn = null;
    
    const attachScrollListeners = () => {
      const calendarScrollArea = document.querySelector('.calendar-scroll-area');
      const bannerScrollArea = document.querySelector('.banner-scroll-area');
      
      if (!calendarScrollArea || !bannerScrollArea) {
        setTimeout(attachScrollListeners, 50);
        return;
      }

      let isScrolling = false;

      const handleCalendarScroll = () => {
        if (!isScrolling) {
          isScrolling = true;
          bannerScrollArea.scrollLeft = calendarScrollArea.scrollLeft;
          requestAnimationFrame(() => {
            isScrolling = false;
          });
        }
      };

      const handleBannerScroll = () => {
        if (!isScrolling) {
          isScrolling = true;
          calendarScrollArea.scrollLeft = bannerScrollArea.scrollLeft;
          requestAnimationFrame(() => {
            isScrolling = false;
          });
        }
      };

      calendarScrollArea.addEventListener('scroll', handleCalendarScroll);
      bannerScrollArea.addEventListener('scroll', handleBannerScroll);

      cleanupFn = () => {
        calendarScrollArea.removeEventListener('scroll', handleCalendarScroll);
        bannerScrollArea.removeEventListener('scroll', handleBannerScroll);
      };
    };

    const timer = setTimeout(attachScrollListeners, 100);

    return () => {
      clearTimeout(timer);
      if (cleanupFn) cleanupFn();
    };
  }, [events.length, view]);

  // Centrer sur la date actuelle quand elle change (synchroniser avec le calendrier principal)
  useEffect(() => {
    if (view === 'month' || view === 'year') {
      const timeouts = [];
      
      const syncScroll = () => {
        const calendarScrollArea = document.querySelector('.calendar-scroll-area');
        const bannerScrollArea = document.querySelector('.banner-scroll-area');
        
        if (calendarScrollArea && bannerScrollArea) {
          bannerScrollArea.scrollLeft = calendarScrollArea.scrollLeft;
        }
      };

      // Synchroniser plusieurs fois pour s'assurer que c'est bien aligné
      timeouts.push(setTimeout(syncScroll, 60));
      timeouts.push(setTimeout(syncScroll, 160));
      timeouts.push(setTimeout(syncScroll, 310));
      timeouts.push(setTimeout(syncScroll, 500));

      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [view, currentDate]);

  const handleScroll = (e) => {
    if (onScroll) {
      onScroll(e.target.scrollLeft);
    }
  };

  const cycleDisplayMode = () => {
    setDisplayMode(prev => prev === 'closed' ? 'compact' : 'closed');
  };

  // Gestion du redimensionnement
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = bannerHeight;
    
    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.min(Math.max(startHeight + deltaY, 100), 600);
      setBannerHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Charger le token depuis localStorage au démarrage
  useEffect(() => {
    const savedToken = localStorage.getItem('google_access_token');
    const tokenExpiry = localStorage.getItem('google_token_expiry');
    
    if (savedToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry, 10);
      const now = Date.now();
      
      // Vérifier si le token est encore valide (avec une marge de 5 minutes)
      if (now < expiryTime - 5 * 60 * 1000) {
        setAccessToken(savedToken);
        setIsSignedIn(true);
        testToken(savedToken);
      } else {
        // Token expiré, essayer de le renouveler automatiquement
        renewAccessToken();
      }
    }
  }, []);

  // Configurer le renouvellement automatique du token avant expiration
  useEffect(() => {
    if (!accessToken) return;

    const tokenExpiry = localStorage.getItem('google_token_expiry');
    if (!tokenExpiry) return;

    const expiryTime = parseInt(tokenExpiry, 10);
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    
    // Renouveler 5 minutes avant l'expiration
    const renewalTime = timeUntilExpiry - 5 * 60 * 1000;
    
    if (renewalTime > 0) {
      const timer = setTimeout(() => {
        renewAccessToken();
      }, renewalTime);

      return () => clearTimeout(timer);
    } else {
      // Si déjà expiré ou sur le point d'expirer, renouveler immédiatement
      renewAccessToken();
    }
  }, [accessToken]);

  const renewAccessToken = () => {
    if (tokenClient) {
      // Demander un nouveau token de manière silencieuse (sans popup si possible)
      tokenClient.requestAccessToken({ prompt: '' });
    }
  };

  const testToken = async (token) => {
    try {
      // Tester le token avec une requête simple
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Token valide - les événements seront chargés par le useEffect
      } else {
        // Token invalide, essayer de renouveler
        renewAccessToken();
      }
    } catch (err) {
      // Erreur réseau ou autre, essayer de renouveler
      renewAccessToken();
    }
  };

  useEffect(() => {
    if (!calendarConfig?.clientId) return;

    // Charger le script Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGIS;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [calendarConfig?.clientId]);

  const initializeGIS = () => {
    if (!window.google || !calendarConfig?.clientId) return;

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: calendarConfig.clientId,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: (response) => {
          if (response.error) {
            setError('Erreur d\'authentification: ' + response.error);
            return;
          }
          // Sauvegarder le token et sa date d'expiration dans localStorage
          // Les tokens OAuth2 expirent généralement après 1 heure (3600 secondes)
          const expiryTime = Date.now() + (response.expires_in || 3600) * 1000;
          localStorage.setItem('google_access_token', response.access_token);
          localStorage.setItem('google_token_expiry', expiryTime.toString());
          setAccessToken(response.access_token);
          setIsSignedIn(true);
          setError(null);
          fetchEvents(response.access_token);
        },
      });

      setTokenClient(client);
      
      // Si un token existe déjà, essayer de le renouveler silencieusement
      const savedToken = localStorage.getItem('google_access_token');
      if (savedToken) {
        setTimeout(() => {
          client.requestAccessToken({ prompt: '' });
        }, 500);
      }
    } catch (err) {
      setError('Erreur d\'initialisation: ' + err.message);
    }
  };

  // Refetch events when view or currentDate changes
  useEffect(() => {
    if (isSignedIn && accessToken && !loading) {
      fetchEvents(accessToken);
    }
  }, [view, currentDate, isSignedIn, accessToken]);

  const handleSignIn = () => {
    if (tokenClient) {
      setError(null);
      // prompt: '' permet une reconnexion silencieuse si l'utilisateur a déjà autorisé
      tokenClient.requestAccessToken({ prompt: '' });
    }
  };

  const handleSignOut = () => {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    // Supprimer le token et sa date d'expiration de localStorage
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
    setAccessToken(null);
    setIsSignedIn(false);
    setEvents([]);
  };

  const fetchEvents = async (token) => {
    setLoading(true);
    setError(null);

    try {
      let timeMin, timeMax;

      if (view === 'week') {
        timeMin = startOfWeek(currentDate, { weekStartsOn: 1 });
        timeMax = endOfWeek(currentDate, { weekStartsOn: 1 });
      } else if (view === 'month') {
        timeMin = startOfMonth(currentDate);
        timeMax = endOfMonth(currentDate);
      } else if (view === 'year') {
        timeMin = startOfYear(currentDate);
        timeMax = endOfYear(currentDate);
      } else {
        setEvents([]);
        setLoading(false);
        return;
      }

      const calendarId = calendarConfig.calendarId || 'primary';
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `timeMin=${timeMin.toISOString()}&` +
        `timeMax=${timeMax.toISOString()}&` +
        `singleEvents=true&` +
        `orderBy=startTime`;

      console.log('🔍 Récupération événements Google Calendar');
      console.log('   Vue:', view);
      console.log('   Plage:', timeMin.toISOString(), '→', timeMax.toISOString());
      console.log('   Calendar ID:', calendarId);
      console.log('   URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erreur API:', response.status, errorText);
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Événements reçus:', data.items?.length || 0);
      if (data.items && data.items.length > 0) {
        console.log('   Premiers événements:', data.items.slice(0, 3).map(e => ({
          summary: e.summary,
          start: e.start,
          end: e.end
        })));
      }
      
      const enrichedEvents = (data.items || []).map(event => analyzeEventTitle(event));
      setEvents(enrichedEvents);
    } catch (err) {
      console.error('❌ Erreur fetchEvents:', err);
      setError('Impossible de récupérer les événements: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Analyse le titre de l'événement pour extraire client, lieu et affaire
  const analyzeEventTitle = (event) => {
    const title = event.summary || '';
    const enrichedEvent = { ...event };

    // Détecter le numéro d'affaire (formats: "af 32744", "AF 32744", "af32744", "AF32744")
    const affaireMatch = title.match(/\baf\s*(\d+)\b/i);
    if (affaireMatch) {
      enrichedEvent.affaire = `AF${affaireMatch[1]}`;
    }

    // Détecter un client existant (recherche insensible à la casse)
    if (clients && clients.length > 0) {
      const foundClient = clients.find(client => 
        title.toLowerCase().includes(client.name.toLowerCase())
      );
      if (foundClient) {
        enrichedEvent.detectedClient = foundClient.name;
      }
    }

    // Détecter un lieu existant (recherche insensible à la casse)
    if (locations && locations.length > 0) {
      const foundLocation = locations.find(location => 
        title.toLowerCase().includes(location.name.toLowerCase())
      );
      if (foundLocation) {
        enrichedEvent.detectedLocation = foundLocation.name;
      }
    }

    return enrichedEvent;
  };

  const getDaysToShow = () => {
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      });
    } else if (view === 'month') {
      return eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      });
    } else if (view === 'year') {
      return eachMonthOfInterval({
        start: startOfYear(currentDate),
        end: endOfYear(currentDate),
      });
    }
    return [];
  };

  const getEventBlocks = () => {
    const days = getDaysToShow();
    const eventBlocks = [];
    const processedEvents = new Set();

    // Mapping des colorId Google Calendar vers des couleurs hexadécimales
    const googleColorMap = {
      '1': '#a4bdfc', // Lavande
      '2': '#7ae7bf', // Sauge
      '3': '#dbadff', // Raisin
      '4': '#ff887c', // Flamant
      '5': '#fbd75b', // Banane
      '6': '#ffb878', // Mandarine
      '7': '#46d6db', // Paon
      '8': '#e1e1e1', // Graphite
      '9': '#5484ed', // Bleuet
      '10': '#51b749', // Basilic
      '11': '#dc2127', // Tomate
    };

    // Couleurs de repli si pas de colorId
    const fallbackColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    let colorIndex = 0;

    events.forEach(event => {
      if (processedEvents.has(event.id)) return;
      processedEvents.add(event.id);

      const eventStart = event.start.dateTime ? parseISO(event.start.dateTime) : parseISO(event.start.date);
      const eventEnd = event.end.dateTime ? parseISO(event.end.dateTime) : parseISO(event.end.date);
      
      // Utiliser la couleur Google si disponible, sinon couleur de repli
      const eventColor = event.colorId && googleColorMap[event.colorId] 
        ? googleColorMap[event.colorId]
        : fallbackColors[colorIndex++ % fallbackColors.length];

      if (view === 'year') {
        // Vue année : calculer la span en mois
        let startMonthIndex = -1;
        let span = 0;

        days.forEach((monthDate, monthIndex) => {
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);

          if (eventStart <= monthEnd && eventEnd >= monthStart) {
            if (startMonthIndex === -1) {
              startMonthIndex = monthIndex;
            }
            span++;
          }
        });

        if (startMonthIndex !== -1) {
          // Nettoyer le titre en supprimant le numéro d'affaire
          let cleanTitle = event.summary || '(Sans titre)';
          cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
          cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
          
          eventBlocks.push({
            eventId: event.id,
            summary: cleanTitle,
            color: eventColor,
            location: event.location,
            time: event.start.dateTime ? format(eventStart, 'HH:mm', { locale: fr }) : null,
            affaire: event.affaire,
            startIndex: startMonthIndex,
            span,
            event: event // Données complètes pour la création de réservation
          });
        }
      } else {
        // Vues semaine/mois : calculer la span en jours (colonnes)
        const slots = [];

        days.forEach((day, dayIndex) => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);

          // Vérifier si l'événement touche ce jour
          if (eventStart < dayEnd && eventEnd > dayStart) {
            slots.push(dayIndex);
          }
        });

        if (slots.length > 0) {
          const startIndex = Math.min(...slots);
          const endIndex = Math.max(...slots);
          const span = endIndex - startIndex + 1;
          
          // Nettoyer le titre en supprimant le numéro d'affaire
          let cleanTitle = event.summary || '(Sans titre)';
          cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
          cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
          
          eventBlocks.push({
            eventId: event.id,
            summary: cleanTitle,
            color: eventColor,
            location: event.location,
            time: event.start.dateTime ? format(eventStart, 'HH:mm', { locale: fr }) : null,
            affaire: event.affaire,
            startIndex: startIndex * 2, // Chaque jour = 2 colonnes dans la grille (AM+PM)
            span: span * 2, // Chaque jour occupe 2 colonnes
            event: event // Données complètes pour la création de réservation
          });
        }
      }
    });

    return eventBlocks;
  };

  const days = getDaysToShow();
  const eventBlocks = getEventBlocks();

  if (!calendarConfig?.clientId) {
    return null;
  }

  if (!isSignedIn) {
    return (
      <div className="google-calendar-banner auth">
        <div className="banner-content">
          <div className="auth-prompt">
            <h3>📅 Synchronisation Google Calendar</h3>
            <p>Connectez-vous pour afficher vos événements personnels</p>
            <button onClick={handleSignIn} className="signin-button">
              Se connecter avec Google
            </button>
            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="google-calendar-banner loading">
        Chargement des événements...
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  const getModeIcon = () => {
    return displayMode === 'closed' ? '▼' : '▲';
  };

  const getModeLabel = () => {
    return displayMode === 'closed' ? 'Fermé' : 'Réduit';
  };

  return (
    <>
      <div className={`google-calendar-banner-grid ${displayMode}`}>
        <div className="calendar-banner">
        {/* Colonne véhicules fixe à gauche */}
        <div className="banner-vehicle-column">
          <div className="banner-vehicle-header">
            {displayMode === 'closed' ? (
              <span>Évènements</span>
            ) : (
              <div className="banner-title-stack">
                <span>Locations</span>
                <span>Prestations</span>
                <span>Installations</span>
              </div>
            )}
            <button 
              className="toggle-banner-button" 
              onClick={cycleDisplayMode} 
              title={getModeLabel()}
            >
              {getModeIcon()}
            </button>
          </div>
        </div>

        {/* Grille scrollable à droite */}
        <div 
          className="banner-scroll-area" 
          onScroll={handleScroll}
          style={displayMode === 'compact' ? { height: `${bannerHeight}px` } : undefined}
        >
          <div className={`banner-grid ${view}-view`}>
            {/* Lignes de séparation alignées sur les colonnes */}
            <div className="banner-grid-lines">
              {view === 'week' && days.flatMap((day, dayIndex) => [
                <div key={`${dayIndex}-am`} className="grid-line" />,
                <div key={`${dayIndex}-pm`} className="grid-line" />
              ])}
              {view === 'month' && days.flatMap((day, dayIndex) => [
                <div key={`${dayIndex}-am`} className="grid-line" />,
                <div key={`${dayIndex}-pm`} className="grid-line" />
              ])}
              {view === 'year' && days.map((month, index) => (
                <div key={index} className="grid-line" />
              ))}
            </div>
            {/* Ligne des événements */}
            <div className="banner-events-row">
              {eventBlocks.map((eventBlock, idx) => {
                // Trouver les réservations liées à cet événement
                const linkedReservations = reservations.filter(r => r.googleEventId === eventBlock.eventId);
                const hasLinkedReservations = linkedReservations.length > 0;

                return (
                  <div 
                    key={`${eventBlock.eventId}-${idx}`}
                    className={`event-block-span clickable ${hasLinkedReservations ? 'linked' : ''}`}
                    style={{ 
                      gridColumn: `${eventBlock.startIndex + 1} / span ${eventBlock.span}`,
                      backgroundColor: eventBlock.color + '40',
                      borderLeft: `3px solid ${eventBlock.color}`
                    }}
                    title={hasLinkedReservations 
                      ? `${eventBlock.summary}${eventBlock.affaire ? ' - ' + eventBlock.affaire : ''}${eventBlock.location ? ' - ' + eventBlock.location : ''}${eventBlock.time ? ' - ' + eventBlock.time : ''}\n\n${linkedReservations.length} réservation(s) liée(s)\nCliquer pour modifier`
                      : `${eventBlock.summary}${eventBlock.affaire ? ' - ' + eventBlock.affaire : ''}${eventBlock.location ? ' - ' + eventBlock.location : ''}${eventBlock.time ? ' - ' + eventBlock.time : ''}\n\nCliquer pour créer une réservation`
                    }
                    onMouseEnter={() => {
                      if (onEventHover && hasLinkedReservations) {
                        onEventHover(eventBlock.eventId);
                      }
                    }}
                    onMouseLeave={() => {
                      if (onEventHover) {
                        onEventHover(null);
                      }
                    }}
                    onClick={() => {
                      if (!eventBlock.event) return;

                      if (hasLinkedReservations) {
                        // Ouvrir directement le modal de la première réservation liée
                        const firstReservation = linkedReservations[0];
                        if (onRequestEditReservation) {
                          onRequestEditReservation(firstReservation);
                        }
                      } else if (onEventClick) {
                        // Demander confirmation pour créer une nouvelle réservation
                        if (window.confirm(`Créer des réservations pour "${eventBlock.summary}" ?`)) {
                          onEventClick(eventBlock.event);
                        }
                      }
                    }}
                  >
                    {hasLinkedReservations && (
                      <div className="event-linked-indicator" title={`${linkedReservations.length} réservation(s) liée(s)`}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13 8C13 5.79086 11.2091 4 9 4H7C4.79086 4 3 5.79086 3 8C3 10.2091 4.79086 12 7 12H9C11.2091 12 13 10.2091 13 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M6 8H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                    )}
                    <div className="event-content">
                      <span className="event-summary">{eventBlock.summary}</span>
                      {eventBlock.affaire && <span className="event-affaire">{eventBlock.affaire}</span>}
                      {eventBlock.time && <span className="event-time">{eventBlock.time}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Poignée de redimensionnement */}
      <div 
        onMouseDown={handleMouseDown}
        style={{
          width: '100%',
          height: '12px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          cursor: 'ns-resize',
          display: displayMode === 'compact' ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderTop: '1px solid #cbd5e0',
          borderBottom: '2px solid #3b82f6',
          transition: 'background 0.2s',
          userSelect: 'none',
          position: 'relative',
          zIndex: 200,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }}
      >
        <div style={{ color: 'white', fontSize: '12px', lineHeight: 1, letterSpacing: '-2px', fontWeight: 'bold', pointerEvents: 'none' }}>⋮⋮⋮</div>
      </div>
    </div>
    </>
  );
}

export default GoogleCalendarBanner;
