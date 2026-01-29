import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, addDays, parseISO, isToday, isTomorrow, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import './GoogleCalendarBanner.css';
import AffaireImportModal from './AffaireImportModal';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [clickedCell, setClickedCell] = useState(null);
  
  // Cache pour éviter de recharger les mêmes données
  const eventsCache = useRef({});
  const fetchTimeoutRef = useRef(null);

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
        
        console.log('📏 Synchronisation colonnes banner:', view, 'Colonnes:', columnWidths.length);
      }
    };

    // Attendre que le DOM soit complètement rendu après changement de vue
    const timer1 = setTimeout(syncWidths, 50);
    const timer2 = setTimeout(syncWidths, 150);
    const timer3 = setTimeout(syncWidths, 300);
    const timer4 = setTimeout(syncWidths, 500);

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
      clearTimeout(timer4);
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

  // Ouvrir le modal pour créer/modifier une affaire
  const handleCellClick = (event = null) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedEvent(null);
    setClickedCell(null);
  };

  const handleEventCreated = async (newEventData) => {
    // Créer l'événement dans Google Calendar
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarConfig.calendarId || 'primary'}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newEventData),
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de la création de l\'événement');
      }

      const createdEvent = await response.json();
      
      // Recharger les événements
      await fetchEvents(accessToken);
      
      return createdEvent;
    } catch (error) {
      console.error('Erreur création événement:', error);
      alert('Erreur lors de la création de l\'événement');
      throw error;
    }
  };

  const handleEventUpdated = async (eventId, updates) => {
    // Mettre à jour l'événement dans Google Calendar
    try {
      const eventToUpdate = events.find(e => e.id === eventId);
      if (!eventToUpdate) return;

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarConfig.calendarId || 'primary'}/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour de l\'événement');
      }

      // Recharger les événements
      await fetchEvents(accessToken);
    } catch (error) {
      console.error('Erreur mise à jour événement:', error);
      alert('Erreur lors de la mise à jour de l\'événement');
      throw error;
    }
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
      const timeUntilExpiry = expiryTime - now;
      
      console.log('🔍 Vérification du token sauvegardé, expire dans:', Math.round(timeUntilExpiry / 1000 / 60), 'minutes');
      
      // Vérifier si le token est encore valide (avec une marge de 10 minutes)
      if (timeUntilExpiry > 10 * 60 * 1000) {
        console.log('✅ Token valide, restauration de la session');
        setAccessToken(savedToken);
        setIsSignedIn(true);
        testToken(savedToken);
      } else {
        console.log('⏰ Token expiré ou proche de l\'expiration, nettoyage');
        // Token expiré, nettoyer et forcer une nouvelle connexion
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        localStorage.removeItem('google_auto_signin');
        setIsSignedIn(false);
        setAccessToken(null);
      }
    }
  }, []);

  // Configurer le renouvellement automatique du token avant expiration
  useEffect(() => {
    if (!accessToken || !tokenClient) return;

    const tokenExpiry = localStorage.getItem('google_token_expiry');
    if (!tokenExpiry) return;

    const expiryTime = parseInt(tokenExpiry, 10);
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    
    console.log('⏰ Token expire dans:', Math.round(timeUntilExpiry / 1000 / 60), 'minutes');
    
    // Renouveler 10 minutes avant l'expiration (au lieu de 5) pour plus de marge
    const renewalTime = Math.max(0, timeUntilExpiry - 10 * 60 * 1000);
    
    const timer = setTimeout(() => {
      console.log('⏰ Renouvellement programmé déclenché');
      // Renouvellement automatique silencieux
      tokenClient.requestAccessToken({ prompt: '' });
    }, renewalTime);

    return () => clearTimeout(timer);
  }, [accessToken, tokenClient]);

  const renewAccessToken = () => {
    if (tokenClient) {
      console.log('🔄 Renouvellement du token...');
      const lastRefresh = localStorage.getItem('google_last_refresh');
      const now = Date.now();
      
      // Éviter les renouvellements trop fréquents (minimum 30 secondes entre chaque)
      if (lastRefresh && (now - parseInt(lastRefresh, 10)) < 30000) {
        console.log('⏳ Renouvellement trop récent, on attend...');
        return;
      }
      
      // Demander un nouveau token de manière silencieuse (sans popup si possible)
      tokenClient.requestAccessToken({ prompt: '' });
    } else {
      console.warn('⚠️ Token client non disponible pour le renouvellement');
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
        scope: 'https://www.googleapis.com/auth/calendar',
        ux_mode: 'popup',
        callback: (response) => {
          if (response.error) {
            console.error('Erreur OAuth:', response.error);
            // Si c'est une erreur de consentement, nettoyer et forcer une nouvelle connexion
            if (response.error === 'access_denied' || response.error === 'consent_required') {
              localStorage.removeItem('google_auto_signin');
            }
            setError('Erreur d\'authentification: ' + response.error);
            return;
          }
          
          console.log('✅ Token reçu, expiration dans:', response.expires_in, 'secondes');
          
          // Sauvegarder le token et sa date d'expiration dans localStorage
          const expiryTime = Date.now() + (response.expires_in || 3600) * 1000;
          localStorage.setItem('google_access_token', response.access_token);
          localStorage.setItem('google_token_expiry', expiryTime.toString());
          localStorage.setItem('google_auto_signin', 'true');
          localStorage.setItem('google_last_refresh', Date.now().toString());
          
          setAccessToken(response.access_token);
          setIsSignedIn(true);
          setError(null);
          fetchEvents(response.access_token);
        },
      });

      setTokenClient(client);
      
      // Auto-reconnexion si l'utilisateur était connecté précédemment
      const autoSignin = localStorage.getItem('google_auto_signin');
      const savedToken = localStorage.getItem('google_access_token');
      
      if (autoSignin === 'true') {
        setTimeout(() => {
          // Essayer de renouveler le token silencieusement avec prompt: 'none'
          // Cela permet une connexion automatique sans popup
          client.requestAccessToken({ prompt: 'none' });
        }, 500);
      }
    } catch (err) {
      setError('Erreur d\'initialisation: ' + err.message);
    }
  };

  // Refetch events when view or currentDate changes
  useEffect(() => {
    if (!isSignedIn || !accessToken || loading) return;
    
    // Debouncing - attendre 300ms avant de charger
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
      // Créer une clé de cache basée sur la vue et la date
      const cacheKey = `${view}-${format(currentDate, 'yyyy-MM-dd')}`;
      
      // Vérifier si on a déjà ces données en cache
      if (eventsCache.current[cacheKey]) {
        setEvents(eventsCache.current[cacheKey]);
        return;
      }
      
      fetchEvents(accessToken);
    }, 300);
    
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
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
    // Supprimer tous les tokens et marqueurs de localStorage
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
    localStorage.removeItem('google_auto_signin');
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
        // Récupérer uniquement l'année affichée
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
        `maxResults=2500&` +
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
      
      // Mettre en cache les événements
      const cacheKey = `${view}-${format(currentDate, 'yyyy-MM-dd')}`;
      eventsCache.current[cacheKey] = enrichedEvents;
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
      // Utiliser eachMonthOfInterval comme Calendar pour synchroniser la grille
      const months = eachMonthOfInterval({
        start: startOfYear(currentDate),
        end: endOfYear(currentDate)
      });
      console.log('📅 Mois affichés en vue année:', months.length, 'Premier:', format(months[0], 'yyyy-MM-dd'), 'Dernier:', format(months[11], 'yyyy-MM-dd'));
      return months;
    }
    return [];
  };

  const getEventBlocks = () => {
    const days = getDaysToShow();
    const eventBlocks = [];
    const processedEvents = new Set();

    // Pour la vue année, filtrer les événements par année affichée
    const filteredEvents = view === 'year'
      ? events.filter(event => {
          const eventStart = event.start.dateTime ? parseISO(event.start.dateTime) : parseISO(event.start.date);
          return eventStart.getFullYear() === currentDate.getFullYear();
        })
      : events;

    console.log('🎯 getEventBlocks appelé - Vue:', view, 'Événements disponibles:', events.length, view === 'year' ? `Filtrés pour ${currentDate.getFullYear()}: ${filteredEvents.length}` : '', 'Jours:', days.length);

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

        const eventStartMonth = eventStart.getFullYear() * 12 + eventStart.getMonth();
        const eventEndMonth = eventEnd.getFullYear() * 12 + eventEnd.getMonth();

        days.forEach((monthDate, monthIndex) => {
          const monthValue = monthDate.getFullYear() * 12 + monthDate.getMonth();

          if (eventStartMonth <= monthValue && eventEndMonth >= monthValue) {
            if (startMonthIndex === -1) {
              startMonthIndex = monthIndex;
            }
            span++;
          }
        });

        if (startMonthIndex !== -1) {
          console.log('📅 Événement année:', event.summary, 'Début:', eventStart.toISOString().slice(0,10), 'Fin:', eventEnd.toISOString().slice(0,10), 'StartIndex:', startMonthIndex, 'Span:', span);
          
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

    // Trier les blocs par index de début (chronologique)
    eventBlocks.sort((a, b) => {
      if (a.startIndex !== b.startIndex) {
        return a.startIndex - b.startIndex;
      }
      // Si même index de début, trier par durée (plus long d'abord)
      return b.span - a.span;
    });

    console.log('📊 Blocs événements générés:', eventBlocks.length, 'pour vue:', view);
    
    return eventBlocks;
  };

  const days = getDaysToShow();
  const eventBlocks = getEventBlocks();
  
  console.log('🔄 Rendu GoogleCalendarBanner - Vue:', view, 'Events state:', events.length, 'EventBlocks:', eventBlocks.length);

  // Toujours afficher le banner, même sans clientId configuré (pour permettre la configuration)
  if (!calendarConfig?.clientId) {
    return (
      <div className="google-calendar-banner auth">
        <div className="banner-content">
          <div className="auth-prompt">
            <h3>📅 Synchronisation Google Calendar</h3>
            <p>⚠️ Configuration manquante</p>
            <p>Veuillez configurer le Client ID Google dans le panneau de gestion (⚙️ Paramètres → Google Calendar)</p>
          </div>
        </div>
      </div>
    );
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

  // Ne pas masquer le banner si aucun événement, garder la structure pour la cohérence visuelle
  // if (events.length === 0) {
  //   return null;
  // }

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
                      : `${eventBlock.summary}${eventBlock.affaire ? ' - ' + eventBlock.affaire : ''}${eventBlock.location ? ' - ' + eventBlock.location : ''}${eventBlock.time ? ' - ' + eventBlock.time : ''}\n\nCliquer pour importer une affaire`
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
                      handleCellClick(eventBlock.event);
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
    
    {/* Modal d'import d'affaires */}
    <AffaireImportModal
      isOpen={modalOpen}
      onClose={handleCloseModal}
      event={selectedEvent}
      onEventCreated={handleEventCreated}
      onEventUpdated={handleEventUpdated}
      onRequestEditReservation={onRequestEditReservation}
    />
    </>
  );
}

export default GoogleCalendarBanner;
