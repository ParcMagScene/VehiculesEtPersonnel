import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { format, addDays, parseISO, isToday, isTomorrow, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import './GoogleCalendarBanner.css';
import EventDetailsModal from './EventDetailsModal';
import api from '../utils/api';
import logger, { oauthLogger } from '../utils/logger';
import { capitalizeText } from '../utils/dateUtils';
import { Search, X, RefreshCw, Plus, Truck, Users } from 'lucide-react';

// Code splitting - Lazy loading
const AffaireImportModal = lazy(() => import('./AffaireImportModal'));

function GoogleCalendarBanner({ calendarConfig, view, currentDate, currentUser, activeModule, onScroll, onEventClick, onEventsChange, clients, locations, reservations = [], onEventHover, onRequestEditReservation, onRequestViewEvent, onReservationsRefresh, onNewReservation, onNewAssignment, onNewAffaire }) {
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
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [clickedCell, setClickedCell] = useState(null);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [googleCalendarId, setGoogleCalendarId] = useState(null);
  
  const [affairesWithAttachments, setAffairesWithAttachments] = useState([]);
  const [attachmentCounts, setAttachmentCounts] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const searchInputRef = useRef(null);

  // Cache pour éviter de recharger les mêmes données
  const eventsCache = useRef({});
  const fetchTimeoutRef = useRef(null);
  // Ref pour stocker le resolver des Promises de renouvellement de token
  const renewalResolverRef = useRef(null);
  // Compteur d'échecs silencieux consécutifs (pour éviter les popups en boucle)
  const silentFailCountRef = useRef(0);
  // Guard de session pour éviter les tentatives de popup répétées
  const popupAttemptedRef = useRef(false);

  // Charger la configuration Google depuis le backend
  useEffect(() => {
    const loadGoogleConfig = async () => {
      try {
        const [clientIdData, calendarIdData] = await Promise.all([
          api.getGoogleClientId(),
          api.getGoogleCalendarId()
        ]);
        // Extraire juste la valeur, pas l'objet entier
        setGoogleClientId(clientIdData?.value || null);
        setGoogleCalendarId(calendarIdData?.value || null);
      } catch (error) {
        console.error('Erreur lors du chargement de la configuration Google:', error);
      }
    };
    loadGoogleConfig();
  }, []);

  // Charger l'index des affaires ayant des pièces jointes
  useEffect(() => {
    const loadAttachmentsIndex = async () => {
      try {
        const data = await api.getAttachmentsIndex();
        setAffairesWithAttachments(data.affaires || []);
        setAttachmentCounts(data.counts || {});
      } catch (e) {
        // silencieux
      }
    };
    loadAttachmentsIndex();
    // Rafraîchir toutes les 60s
    const interval = setInterval(loadAttachmentsIndex, 60000);
    return () => clearInterval(interval);
  }, []);

  // Notifier le parent quand les événements changent
  useEffect(() => {
    if (onEventsChange) {
      onEventsChange(events);
    }
  }, [events, onEventsChange]);

  // Exposer la fonction pour ouvrir un événement depuis l'extérieur
  useEffect(() => {
    if (onRequestViewEvent) {
      onRequestViewEvent(handleCellClick);
    }
  }, [onRequestViewEvent]);

  // Synchroniser les largeurs avec le calendrier principal (ou le planning personnel)
  useEffect(() => {
    const syncWidths = () => {
      // Chercher la grille principale : Calendar (.calendar-grid) ou PersonnelPanel (.pp-grid)
      const calendarGrid = document.querySelector('.calendar-grid') || document.querySelector('.pp-grid');
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
    const timer4 = setTimeout(syncWidths, 500);

    // Observer les changements de taille du calendrier ou du planning personnel
    const calendarGrid = document.querySelector('.calendar-grid') || document.querySelector('.pp-grid');
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
      // Chercher la zone de scroll principale : Calendar ou PersonnelPanel
      const calendarScrollArea = document.querySelector('.calendar-scroll-area') || document.querySelector('.pp-scroll-area');
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

  // Centrer sur la date actuelle quand elle change (synchroniser avec le calendrier principal ou personnel)
  useEffect(() => {
    if (view === 'month' || view === 'year') {
      const timeouts = [];
      
      const syncScroll = () => {
        const calendarScrollArea = document.querySelector('.calendar-scroll-area') || document.querySelector('.pp-scroll-area');
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

  // Ouvrir le modal de détails d'événement
  const handleCellClick = (event = null) => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  const handleCloseEventDetails = () => {
    setEventDetailsOpen(false);
    setSelectedEvent(null);
  };

  // Ouvrir l'ancien modal d'import d'affaire depuis le modal de détails
  const handleOpenAffaireImport = (event) => {
    setEventDetailsOpen(false);
    setSelectedEvent(event);
    setModalOpen(true);
  };

  // Ouvrir le modal de création de réservation classique
  const handleCreateReservationFromEvent = (event) => {
    // Fermer le modal de détails et notifier le parent pour ouvrir ReservationModal
    setEventDetailsOpen(false);
    if (onEventClick) {
      onEventClick(event);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedEvent(null);
    setClickedCell(null);
  };

  // Fonction helper pour les appels API Google avec gestion du retry en cas d'erreur 401
  const googleApiCall = async (url, options = {}, retryCount = 0) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 && retryCount === 0) {
        // Token invalide, essayer de renouveler et réessayer une fois
        oauthLogger.log('⚠️ API call 401, tentative de renouvellement...');
        try {
          const newToken = await renewAccessToken();
          if (newToken) {
            oauthLogger.log('✅ Token renouvelé, nouvelle tentative API...');
            // Réessayer avec le nouveau token
            const retryOptions = {
              ...options,
              headers: {
                ...options.headers,
                'Authorization': `Bearer ${newToken}`,
              },
            };
            return fetch(url, retryOptions);
          }
        } catch (err) {
          oauthLogger.log('❌ Échec du renouvellement:', err.message);
          setIsSignedIn(false);
          setAccessToken(null);
          localStorage.removeItem('google_access_token');
          localStorage.removeItem('google_token_expiry');
          throw new Error('Session expirée. Veuillez vous reconnecter.');
        }
      }
      return response; // Retourner la réponse même si erreur pour que l'appelant puisse la gérer
    }

    return response;
  };

  const handleEventCreated = async (newEventData) => {
    // Créer l'événement dans Google Calendar
    try {
      const response = await googleApiCall(
        `https://www.googleapis.com/calendar/v3/calendars/${googleCalendarId || 'primary'}/events`,
        {
          method: 'POST',
          headers: {
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
      alert('Erreur lors de la création de l\'événement: ' + error.message);
      throw error;
    }
  };

  const handleEventUpdated = async (eventId, updates) => {
    // Mettre à jour l'événement dans Google Calendar
    try {
      const eventToUpdate = events.find(e => e.id === eventId);
      if (!eventToUpdate) return;

      const response = await googleApiCall(
        `https://www.googleapis.com/calendar/v3/calendars/${googleCalendarId || 'primary'}/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
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
      alert('Erreur lors de la mise à jour de l\'événement: ' + error.message);
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
    const refreshToken = localStorage.getItem('google_refresh_token');
    const autoSignin = localStorage.getItem('google_auto_signin');
    
    if (savedToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry, 10);
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      
      // Si le token est encore valide (avec une marge de 5 minutes)
      if (timeUntilExpiry > 5 * 60 * 1000) {
        setAccessToken(savedToken);
        setIsSignedIn(true);
        testToken(savedToken);
        // Charger immédiatement les événements
        if (googleCalendarId) {
          fetchEvents(savedToken);
        }
      } else if (autoSignin === 'true') {
        // Token expiré mais auto-signin activé, on demande un nouveau token silencieusement
        // Le token sera renouvelé par le useEffect suivant quand tokenClient sera prêt
      } else {
        oauthLogger.log('⏰ Token expiré, nettoyage');
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        setIsSignedIn(false);
        setAccessToken(null);
      }
    } else if (autoSignin === 'true' && tokenClient) {
      // Pas de token sauvegardé mais auto-signin activé
      // Ne pas lancer automatiquement car ça peut être bloqué par le navigateur
      // L'utilisateur devra cliquer sur "Se connecter"
      oauthLogger.log('🔐 Auto-signin activé mais pas de token - l\'utilisateur doit se reconnecter');
    }
  }, [tokenClient, googleCalendarId]);

  // Configurer le renouvellement automatique du token avant expiration
  useEffect(() => {
    if (!accessToken || !tokenClient) return;

    const tokenExpiry = localStorage.getItem('google_token_expiry');
    if (!tokenExpiry) return;

    const expiryTime = parseInt(tokenExpiry, 10);
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    
    oauthLogger.log('⏰ Token expire dans:', Math.round(timeUntilExpiry / 1000 / 60), 'minutes');
    
    // Ne pas programmer de renouvellement si le token est déjà expiré
    if (timeUntilExpiry <= 0) {
      oauthLogger.log('⏰ Token déjà expiré, pas de renouvellement programmé');
      return;
    }
    
    // Renouveler 15 minutes avant l'expiration pour avoir une grande marge
    const renewalTime = Math.max(0, timeUntilExpiry - 15 * 60 * 1000);
    
    const timer = setTimeout(async () => {
      oauthLogger.log('⏰ Renouvellement programmé déclenché (silencieux)');
      try {
        await renewAccessToken();
        oauthLogger.log('✅ Renouvellement programmé réussi');
      } catch (err) {
        oauthLogger.log('❌ Échec du renouvellement programmé:', err.message);
        // Ne PAS déconnecter immédiatement — le token peut encore fonctionner
        // On affiche juste un avertissement, le retry 401 gèrera la re-auth si nécessaire
        oauthLogger.log('⚠️ Le token sera renouvelé à la prochaine requête API si nécessaire');
      }
    }, renewalTime);

    return () => clearTimeout(timer);
  }, [accessToken, tokenClient]);

  const renewAccessToken = () => {
    if (tokenClient) {
      oauthLogger.log('🔄 Renouvellement du token...');
      const lastRefresh = localStorage.getItem('google_last_refresh');
      const now = Date.now();
      
      // Éviter les renouvellements trop fréquents (minimum 30 secondes entre chaque)
      if (lastRefresh && (now - parseInt(lastRefresh, 10)) < 30000) {
        oauthLogger.log('⏳ Renouvellement trop récent, on attend...');
        return Promise.reject(new Error('Renouvellement trop récent'));
      }
      
      return new Promise((resolve, reject) => {
        try {
          // Stocker le resolver pour que le callback principal puisse le résoudre
          renewalResolverRef.current = { resolve, reject };
          localStorage.setItem('google_last_refresh', now.toString());
          
          // Demander un nouveau token de manière silencieuse (le callback principal gèrera la réponse)
          tokenClient.requestAccessToken({ prompt: '' });
        } catch (err) {
          oauthLogger.log('❌ Exception renouvellement:', err);
          renewalResolverRef.current = null;
          reject(err);
        }
      });
    } else {
      oauthLogger.warn('⚠️ Token client non disponible pour le renouvellement');
      return Promise.reject(new Error('Token client non disponible'));
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
        // Token valide - les événements sont chargés automatiquement
        return true;
      } else if (response.status === 401) {
        // Token invalide, essayer de renouveler
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        try {
          const newToken = await renewAccessToken();
          if (newToken) {
            return true;
          }
        } catch (err) {
          oauthLogger.log('❌ Échec du renouvellement:', err.message);
          setIsSignedIn(false);
          setAccessToken(null);
        }
        return false;
      } else {
        oauthLogger.log('⚠️ Token invalide (status ' + response.status + ')');
        return false;
      }
    } catch (err) {
      oauthLogger.log('❌ Erreur test token:', err.message);
      return false;
    }
  };

  useEffect(() => {
    if (!googleClientId) return;

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
  }, [googleClientId]);

  const initializeGIS = () => {
    if (!window.google || !googleClientId) return;

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'https://www.googleapis.com/auth/calendar',
        ux_mode: 'popup',
        callback: (response) => {
          if (response.error) {
            console.error('❌ Erreur OAuth:', response.error);
            
            // Si une Promise de renouvellement est en attente, la rejeter
            if (renewalResolverRef.current) {
              renewalResolverRef.current.reject(new Error(response.error));
              renewalResolverRef.current = null;
            }
            
            // Si c'est une erreur de consentement et que ce n'est pas un renouvellement silencieux
            if (response.error === 'access_denied') {
              oauthLogger.log('⚠️ Accès refusé par l\'utilisateur');
              localStorage.removeItem('google_auto_signin');
              setError('Accès refusé. Veuillez autoriser l\'accès à Google Calendar.');
            } else if (response.error === 'popup_closed_by_user') {
              oauthLogger.log('⚠️ Popup fermée par l\'utilisateur');
              setError('Connexion annulée');
            } else if (response.error === 'immediate_failed') {
              // Le renouvellement silencieux a échoué — NE PAS supprimer google_auto_signin
              // L'utilisateur a déjà autorisé l'app, on garde cette info pour la prochaine tentative
              silentFailCountRef.current += 1;
              oauthLogger.log('🔄 Renouvellement silencieux échoué (tentative', silentFailCountRef.current, ') — on réessaiera');
            }
            return;
          }
          
          oauthLogger.log('✅ Token reçu, expiration dans:', response.expires_in, 'secondes (≈', Math.round(response.expires_in / 60), 'minutes)');
          
          // Réinitialiser le compteur d'échecs silencieux
          silentFailCountRef.current = 0;
          popupAttemptedRef.current = false;
          
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
          
          // Si une Promise de renouvellement est en attente, la résoudre
          if (renewalResolverRef.current) {
            oauthLogger.log('✅ Résolution de la Promise de renouvellement');
            renewalResolverRef.current.resolve(response.access_token);
            renewalResolverRef.current = null;
          }
        },
      });

      setTokenClient(client);
      
      // Auto-reconnexion si l'utilisateur était connecté précédemment
      const autoSignin = localStorage.getItem('google_auto_signin');
      const savedToken = localStorage.getItem('google_access_token');
      const tokenExpiry = localStorage.getItem('google_token_expiry');
      
      if (autoSignin === 'true' && savedToken && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry, 10);
        const now = Date.now();
        const timeUntilExpiry = expiryTime - now;
        
        // Si le token est encore valide, pas besoin de redemander
        if (timeUntilExpiry > 5 * 60 * 1000) {
          oauthLogger.log('✅ Token existant encore valide, pas de renouvellement nécessaire');
        } else {
          // Token expiré — NE PAS ouvrir de popup automatiquement
          // L'utilisateur devra cliquer sur "Se connecter" manuellement
          oauthLogger.log('⏰ Token expiré, l\'utilisateur devra cliquer sur "Se connecter"');
        }
      }
    } catch (err) {
      setError('Erreur d\'initialisation: ' + err.message);
    }
  };

  // Refetch events when view or currentDate changes
  useEffect(() => {
    if (!isSignedIn || !accessToken) return;
    
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
  }, [view, currentDate, isSignedIn, accessToken, googleCalendarId]);

  const handleSignIn = () => {
    if (tokenClient) {
      setError(null);
      const hasAuthorized = localStorage.getItem('google_auto_signin');
      let promptType;
      if (hasAuthorized === 'true' && !popupAttemptedRef.current) {
        // Déjà autorisé et pas encore tenté cette session : tentative silencieuse unique
        promptType = '';
        popupAttemptedRef.current = true;
      } else {
        // Soit jamais autorisé, soit la tentative silencieuse a déjà échoué → consent direct
        promptType = 'consent';
      }
      oauthLogger.log('🔐 Connexion Google - prompt:', promptType || 'silencieux');
      tokenClient.requestAccessToken({ prompt: promptType });
    }
  };

  const handleReconnect = () => {
    if (tokenClient) {
      setError(null);
      oauthLogger.log('🔄 Reconnexion Google - sélection du compte');
      // Forcer la sélection du compte Google
      tokenClient.requestAccessToken({ prompt: 'select_account' });
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

  const fetchEvents = async (token, retryCount = 0) => {
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

      const calendarId = googleCalendarId || 'primary';
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `timeMin=${timeMin.toISOString()}&` +
        `timeMax=${timeMax.toISOString()}&` +
        `singleEvents=true&` +
        `maxResults=2500&` +
        `orderBy=startTime`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 && retryCount === 0) {
          // Token invalide, essayer de renouveler et réessayer une fois
          oauthLogger.log('⚠️ Token invalide (401), tentative de renouvellement...');
          try {
            const newToken = await renewAccessToken();
            if (newToken) {
              // Réessayer avec le nouveau token
              return fetchEvents(newToken, retryCount + 1);
            }
          } catch (err) {
            oauthLogger.log('❌ Échec du renouvellement:', err.message);
            setIsSignedIn(false);
            setAccessToken(null);
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_token_expiry');
            throw new Error('Session expirée. Veuillez vous reconnecter.');
          }
        }
        // Si 404, le calendrier partagé n'est pas encore dans la liste de l'utilisateur
        // On tente de l'ajouter automatiquement via calendarList.insert, puis on retente
        if (response.status === 404 && calendarId !== 'primary' && retryCount === 0) {
          console.warn('⚠️ Calendrier', calendarId, 'introuvable (404). Tentative d\'ajout automatique à la liste...');
          try {
            const addResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ id: calendarId }),
            });
            if (addResponse.ok || addResponse.status === 409) {
              // 409 = déjà dans la liste, on retente quand même
              return fetchEvents(token, retryCount + 1);
            } else {
              const errText = await addResponse.text();
              console.warn('⚠️ Impossible d\'ajouter le calendrier à la liste:', addResponse.status, errText);
            }
          } catch (addErr) {
            console.warn('⚠️ Erreur lors de l\'ajout du calendrier:', addErr.message);
          }
          // Fallback sur le calendrier principal si l'ajout a échoué
          console.warn('↪ Fallback sur le calendrier principal');
          const fallbackUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${timeMin.toISOString()}&` +
            `timeMax=${timeMax.toISOString()}&` +
            `singleEvents=true&` +
            `maxResults=2500&` +
            `orderBy=startTime`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            let filteredItems = fallbackData.items || [];
            const enrichedEvents = filteredItems.map(event => analyzeEventTitle(event));
            setEvents(enrichedEvents);
            const cacheKey = `${view}-${format(currentDate, 'yyyy-MM-dd')}`;
            eventsCache.current[cacheKey] = enrichedEvents;
            return;
          }
        }
        const errorText = await response.text();
        console.error('❌ Erreur API:', response.status, errorText);
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      
      // Utiliser tous les événements du calendrier (c'est un calendrier partagé)
      let filteredItems = data.items || [];
      
      const enrichedEvents = filteredItems.map(event => analyzeEventTitle(event));
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
    const eventLocation = event.location || '';
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

    // Détecter un lieu existant (recherche insensible à la casse dans le titre ET dans le champ location de l'événement)
    if (locations && locations.length > 0) {
      const foundLocation = locations.find(location => {
        const titleMatch = title.toLowerCase().includes(location.name.toLowerCase());
        const locationFieldMatch = eventLocation.toLowerCase().includes(location.name.toLowerCase());
        
        // Chercher aussi par adresse si elle existe
        let addressMatch = false;
        if (location.address && eventLocation) {
          // Recherche partielle dans l'adresse (POI)
          const locationParts = eventLocation.toLowerCase().split(',').map(p => p.trim());
          const addressParts = location.address.toLowerCase().split(',').map(p => p.trim());
          
          // Vérifier si au moins une partie de l'adresse correspond
          addressMatch = addressParts.some(addrPart => 
            locationParts.some(locPart => 
              locPart.includes(addrPart) || addrPart.includes(locPart)
            )
          );
        }
        
        return titleMatch || locationFieldMatch || addressMatch;
      });
      
      if (foundLocation) {
        enrichedEvent.detectedLocation = foundLocation.name;
      }
    }

    return enrichedEvent;
  };

  const days = useMemo(() => {
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
      oauthLogger.log('📅 Mois affichés en vue année:', months.length, 'Premier:', format(months[0], 'yyyy-MM-dd'), 'Dernier:', format(months[11], 'yyyy-MM-dd'));
      return months;
    }
    return [];
  }, [view, currentDate]);

  const eventBlocks = useMemo(() => {
    const isPersonnelMode = activeModule === 'personnel';
    const eventBlocks = [];
    const processedEvents = new Set();

    // Pour la vue année, filtrer les événements par année affichée
    const filteredEvents = view === 'year'
      ? events.filter(event => {
          const eventStart = event.start.dateTime ? parseISO(event.start.dateTime) : parseISO(event.start.date);
          return eventStart.getFullYear() === currentDate.getFullYear();
        })
      : events;

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

    // Filtrer par recherche (nom ou numéro d'affaire)
    const searchLower = searchFilter.trim().toLowerCase();

    events.forEach(event => {
      if (processedEvents.has(event.id)) return;
      processedEvents.add(event.id);

      // Appliquer le filtre de recherche
      if (searchLower) {
        const summary = (event.summary || '').toLowerCase();
        const affaire = (event.affaire || '').toLowerCase();
        const location = (event.location || '').toLowerCase();
        if (!summary.includes(searchLower) && !affaire.includes(searchLower) && !location.includes(searchLower)) {
          return; // skip cet événement
        }
      }

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
          oauthLogger.log('📅 Événement année:', event.summary, 'Début:', eventStart.toISOString().slice(0,10), 'Fin:', eventEnd.toISOString().slice(0,10), 'StartIndex:', startMonthIndex, 'Span:', span);
          
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
            startIndex: isPersonnelMode ? startIndex : startIndex * 2,
            span: isPersonnelMode ? span : span * 2,
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
    
    return eventBlocks;
  }, [view, currentDate, events, days, searchFilter, activeModule]);

  // Toujours afficher le banner, même sans clientId configuré (pour permettre la configuration)
  if (!googleClientId) {
    return (
      <div className="google-calendar-banner auth">
        <div className="banner-content">
          <div className="auth-prompt">
            <h3>📅 Synchronisation Google Calendar</h3>
            <p>⚠️ Configuration manquante</p>
            <p>Veuillez configurer le Client ID Google dans le panneau de gestion (onglet Config Google)</p>
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
            <button 
              onClick={handleSignIn} 
              className="signin-button"
              disabled={!tokenClient}
            >
              {tokenClient ? 'Se connecter avec Google' : 'Chargement...'}
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
            <div className="banner-header-top">
              {displayMode === 'closed' ? (
                <span>Évènements</span>
              ) : (
                <div className="banner-title-stack">
                  <span>Locations</span>
                  <span>Prestations</span>
                  <span>Installations</span>
                  <button
                    className="banner-reconnect-google"
                    onClick={handleReconnect}
                    title="Reconnecter / changer de compte Google"
                  >
                    <RefreshCw size={12} />
                    <span>Compte Google</span>
                  </button>
                </div>
              )}
              <div className="banner-header-actions">
                {displayMode !== 'closed' && (
                  <button
                    className={`banner-search-toggle ${searchOpen ? 'active' : ''}`}
                    onClick={() => {
                      setSearchOpen(prev => !prev);
                      if (searchOpen) setSearchFilter('');
                      else setTimeout(() => searchInputRef.current?.focus(), 100);
                    }}
                    title="Rechercher un événement"
                  >
                    <Search size={14} />
                  </button>
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
            {searchOpen && displayMode !== 'closed' && (
              <div className="banner-search-bar">
                <Search size={13} className="banner-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="banner-search-input"
                  placeholder="Nom, n° affaire…"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearchFilter(''); setSearchOpen(false); } }}
                />
                {searchFilter && (
                  <button className="banner-search-clear" onClick={() => { setSearchFilter(''); searchInputRef.current?.focus(); }}>
                    <X size={12} />
                  </button>
                )}
                <span className="banner-search-count">{eventBlocks.length}</span>
              </div>
            )}
            {/* Bouton contextuel : Nouvelle réservation / Nouvelle affectation / Nouvelle affaire */}
            <button
              className="banner-new-action-btn"
              onClick={activeModule === 'affaires' ? onNewAffaire : activeModule === 'personnel' ? onNewAssignment : onNewReservation}
              title={activeModule === 'affaires' ? 'Nouvelle affaire' : activeModule === 'personnel' ? 'Nouvelle affectation' : 'Nouvelle réservation'}
            >
              <Plus size={14} />
              <span>{activeModule === 'affaires' ? 'Nouvelle affaire' : activeModule === 'personnel' ? 'Nouvelle affectation' : 'Nouvelle réservation'}</span>
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
              {view === 'week' && days.flatMap((day, dayIndex) => {
                const dayIsToday = isToday(day);
                if (activeModule === 'personnel') {
                  return [
                    <div key={dayIndex} className={`grid-line ${dayIsToday ? 'today' : ''}`} />
                  ];
                }
                return [
                  <div key={`${dayIndex}-am`} className={`grid-line ${dayIsToday ? 'today today-left' : ''}`} />,
                  <div key={`${dayIndex}-pm`} className={`grid-line ${dayIsToday ? 'today today-right' : ''}`} />
                ];
              })}
              {view === 'month' && days.flatMap((day, dayIndex) => {
                const dayIsToday = isToday(day);
                if (activeModule === 'personnel') {
                  return [
                    <div key={dayIndex} className={`grid-line ${dayIsToday ? 'today' : ''}`} />
                  ];
                }
                return [
                  <div key={`${dayIndex}-am`} className={`grid-line ${dayIsToday ? 'today today-left' : ''}`} />,
                  <div key={`${dayIndex}-pm`} className={`grid-line ${dayIsToday ? 'today today-right' : ''}`} />
                ];
              })}
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
                // Détecter si le titre contient "RDV" (insensible à la casse)
                const isRdv = /\brdv\b/i.test(eventBlock.summary);

                return (
                  <div 
                    key={`${eventBlock.eventId}-${idx}`}
                    className={`event-block-span clickable ${hasLinkedReservations ? 'linked' : ''} ${isRdv ? 'rdv-highlight' : ''}`}
                    style={{ 
                      gridColumn: `${eventBlock.startIndex + 1} / span ${eventBlock.span}`,
                      backgroundColor: eventBlock.color + '40',
                      borderLeft: `3px solid ${eventBlock.color}`
                    }}
                    title={hasLinkedReservations 
                      ? `${eventBlock.summary}${eventBlock.affaire ? ' - ' + eventBlock.affaire : ''}${eventBlock.location ? ' - ' + eventBlock.location : ''}${eventBlock.time ? ' - ' + eventBlock.time : ''}${eventBlock.affaire && attachmentCounts[eventBlock.affaire] ? '\n📎 ' + attachmentCounts[eventBlock.affaire] + ' pièce(s) jointe(s)' : ''}\n\n${linkedReservations.length} réservation(s) liée(s)\nCliquer pour modifier`
                      : `${eventBlock.summary}${eventBlock.affaire ? ' - ' + eventBlock.affaire : ''}${eventBlock.location ? ' - ' + eventBlock.location : ''}${eventBlock.time ? ' - ' + eventBlock.time : ''}${eventBlock.affaire && attachmentCounts[eventBlock.affaire] ? '\n📎 ' + attachmentCounts[eventBlock.affaire] + ' pièce(s) jointe(s)' : ''}\n\nCliquer pour importer une affaire`
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
                    <div className="event-content">
                      <span className="event-summary">{capitalizeText(eventBlock.summary)}</span>
                      {hasLinkedReservations && (
                        <span className="event-linked-indicator" title={`${linkedReservations.length} réservation(s) liée(s)`}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13 8C13 5.79086 11.2091 4 9 4H7C4.79086 4 3 5.79086 3 8C3 10.2091 4.79086 12 7 12H9C11.2091 12 13 10.2091 13 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <path d="M6 8H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </span>
                      )}
                      {eventBlock.affaire && affairesWithAttachments.includes(eventBlock.affaire) && (
                        <span className="event-attachment-indicator" title={`${attachmentCounts[eventBlock.affaire] || ''} pièce(s) jointe(s)`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                          <span className="attachment-count">{attachmentCounts[eventBlock.affaire]}</span>
                        </span>
                      )}
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
    
    {/* Modal de détails d'événement */}
    <EventDetailsModal
      isOpen={eventDetailsOpen}
      onClose={handleCloseEventDetails}
      event={selectedEvent}
      reservations={reservations}
      onRequestEditReservation={onRequestEditReservation}
      onRequestCreateReservation={handleCreateReservationFromEvent}
      onEventCreated={handleOpenAffaireImport}
      onEventUpdated={handleEventUpdated}
      onReservationsRefresh={onReservationsRefresh}
      currentUser={currentUser}
    />
    
    {/* Modal d'import d'affaires (ouvert depuis le modal de détails) */}
    {modalOpen && (
      <Suspense fallback={<div className="loading-overlay"><div className="loading-spinner"></div></div>}>
        <AffaireImportModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          event={selectedEvent}
          onEventCreated={handleEventCreated}
          onEventUpdated={handleEventUpdated}
          onRequestEditReservation={onRequestEditReservation}
        />
      </Suspense>
    )}
    </>
  );
}

export default GoogleCalendarBanner;
