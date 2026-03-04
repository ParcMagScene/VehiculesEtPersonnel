import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { Calendar, Briefcase, AlertCircle, Paperclip, LinkIcon, Plus, Search, X, ChevronLeft, ChevronRight, FileText, BarChart2, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { capitalizeText } from '../utils/dateUtils';
import { AFFAIRE_TYPES, getTypeInfo } from '../utils/affaireConstants';
import { AffaireSlidePanel, AffaireDetailDialog } from './AffaireDetailPanel';
import MonthSelector from './MonthSelector';
import WeekSelector from './WeekSelector';
import './AffairesPanel.css';

const BLImportModal = lazy(() => import('./BLImportModal'));
const BLImportLocPrestaModal = lazy(() => import('./BLImportLocPrestaModal'));
const BLBatchAnalysis = lazy(() => import('./BLBatchAnalysis'));

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return format(d, 'dd MMM yyyy', { locale: fr });
  } catch {
    return dateStr;
  }
};

// Extraire le numéro d'affaire d'un titre d'événement Google
const extractAffaireNumber = (title) => {
  if (!title) return null;
  const match = title.match(/\baf\s*(\d+)\b/i);
  return match ? `AF${match[1]}` : null;
};

// Nettoyer le titre en retirant le numéro d'affaire
const cleanEventTitle = (title, numero) => {
  if (!title || !numero) return title || '';
  const digits = numero.replace(/^AF/i, '');
  const pattern = new RegExp(`\\s*\\baf\\s*${digits}\\b\\s*`, 'gi');
  return title.replace(pattern, ' ').trim();
};

// Calculer le statut temporel d'une affaire
const getAffaireStatus = (affaire, today) => {
  const debut = affaire.dateDebut || '';
  const fin = affaire.dateFin || affaire.dateDebut || '';
  if (!debut) return 'unknown';
  if (fin < today) return 'past';
  if (debut <= today && fin >= today) return 'active';
  return 'upcoming';
};

const AffairesPanel = ({ reservations = [], onNavigateToEntity }) => {
  const [dbAffaires, setDbAffaires] = useState([]);
  const [googleAffaires, setGoogleAffaires] = useState([]);
  const [googleEventIdsMap, setGoogleEventIdsMap] = useState({}); // { AF32844: ['eventId1', 'eventId2', ...] }
  const [attachmentsIndex, setAttachmentsIndex] = useState({ affaires: [], counts: {} }); // index des pièces jointes locales
  const [personnelCountsMap, setPersonnelCountsMap] = useState({}); // { AF32512: 2, AF32854: 1, ... }
  const [isLoading, setIsLoading] = useState(true);

  // Filtres internes (anciennement dans App.jsx / Header)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateStart, setFilterDateStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [filterDateEnd, setFilterDateEnd] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  });
  const [showArchived, setShowArchived] = useState(false);
  const [slidingMode, setSlidingMode] = useState(true);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [error, setError] = useState(null);
  const [googleError, setGoogleError] = useState(null);
  const [sortBy, setSortBy] = useState('dateDebut');
  const [sortOrder, setSortOrder] = useState('desc');
  const googleCalendarIdRef = useRef(null);

  // Sélection / détail affaire
  const [selectedAffaire, setSelectedAffaire] = useState(null);
  const [dialogAffaire, setDialogAffaire] = useState(null);
  const clickTimerRef = useRef(null);

  // BL Import modal
  const [showBLImport, setShowBLImport] = useState(false);
  const [showBLImportLocPresta, setShowBLImportLocPresta] = useState(false);
  const [blImportAffaireId, setBlImportAffaireId] = useState(null);
  const [showBatchAnalysis, setShowBatchAnalysis] = useState(false);

  // Timeline / frise chronologique
  const timelineRef = useRef(null);
  const listRef = useRef(null);
  const [cursorRatio, setCursorRatio] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Charger les affaires depuis l'API (DB serveur + auto-détection réservations)
  const loadDbAffaires = useCallback(async () => {
    try {
      const data = await api.getAffaires();
      setDbAffaires(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur chargement affaires DB:', err);
      setError('Impossible de charger les affaires depuis le serveur');
      setDbAffaires([]);
    }
  }, []);

  // Charger les événements Google Calendar et en extraire les affaires
  const loadGoogleAffaires = useCallback(async () => {
    setIsLoadingGoogle(true);
    setGoogleError(null);
    try {
      // Récupérer le token Google depuis localStorage
      const token = localStorage.getItem('google_access_token');
      const tokenExpiry = localStorage.getItem('google_token_expiry');
      
      if (!token || !tokenExpiry || Date.now() > parseInt(tokenExpiry, 10)) {
        setGoogleAffaires([]);
        return;
      }

      // Récupérer le calendar ID depuis la config
      let calendarId = googleCalendarIdRef.current;
      if (!calendarId) {
        try {
          const calData = await api.getGoogleCalendarId();
          calendarId = calData?.value || 'primary';
          googleCalendarIdRef.current = calendarId;
        } catch {
          calendarId = 'primary';
        }
      }

      // Plage large : 6 mois en arrière, 6 mois en avant
      const now = new Date();
      const timeMin = startOfMonth(subMonths(now, 6));
      const timeMax = endOfMonth(addMonths(now, 6));

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&` +
        `singleEvents=true&maxResults=2500&orderBy=startTime`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setGoogleError('Token Google expiré — reconnectez-vous depuis le bandeau calendrier');
        } else {
          console.error('📅 AffairesPanel: Erreur Google API', response.status);
          setGoogleError(`Erreur Google Calendar (${response.status})`);
        }
        setGoogleAffaires([]);
        return;
      }

      const data = await response.json();
      const events = data.items || [];

      // Extraire les affaires des événements
      const affaireMap = new Map(); // numeroAffaire → affaire data
      const eventIdsMap = {}; // numeroAffaire → [googleEventId, ...]

      for (const event of events) {
        const numero = extractAffaireNumber(event.summary);
        if (!numero) continue;

        // Accumuler les IDs d'événement Google par affaire
        if (!eventIdsMap[numero]) eventIdsMap[numero] = [];
        eventIdsMap[numero].push(event.id);

        const startDate = event.start?.date || (event.start?.dateTime ? event.start.dateTime.split('T')[0] : '');
        const endDate = event.end?.date || (event.end?.dateTime ? event.end.dateTime.split('T')[0] : '');
        // Pour les événements "all-day", Google donne la date de fin exclusive => reculer d'1j
        let adjustedEndDate = endDate;
        if (event.end?.date && !event.end?.dateTime && endDate) {
          const d = new Date(endDate + 'T00:00:00');
          d.setDate(d.getDate() - 1);
          adjustedEndDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const existing = affaireMap.get(numero);
        if (existing) {
          // Fusionner : étendre la plage de dates, accumuler les events
          if (startDate && (!existing.dateDebut || startDate < existing.dateDebut)) existing.dateDebut = startDate;
          if (adjustedEndDate && (!existing.dateFin || adjustedEndDate > existing.dateFin)) existing.dateFin = adjustedEndDate;
          existing.googleEventCount = (existing.googleEventCount || 1) + 1;
          // Garder le client détecté si pas encore trouvé
          if (!existing.eventName && event.summary) {
            existing.eventName = cleanEventTitle(event.summary, numero);
          }
        } else {
          affaireMap.set(numero, {
            id: null,
            numeroAffaire: numero,
            type: 'Prestation',
            client: '',
            interlocuteur: '',
            tel: '',
            fax: '',
            dateDebut: startDate,
            dateFin: adjustedEndDate || startDate,
            devis: '',
            adresseLivraison: event.location || '',
            titre: cleanEventTitle(event.summary, numero),
            description: event.description || '',
            googleEventId: event.id,
            eventName: cleanEventTitle(event.summary, numero),
            reservationCount: 0,
            vehicleCount: 0,
            personnelCount: 0,
            googleEventCount: 1,
            source: 'google',
          });
        }
      }

      setGoogleAffaires(Array.from(affaireMap.values()));
      setGoogleEventIdsMap(eventIdsMap);
    } catch (err) {
      console.error('Erreur chargement affaires Google:', err);
      setGoogleError('Impossible de charger les événements Google Calendar');
      setGoogleAffaires([]);
    } finally {
      setIsLoadingGoogle(false);
    }
  }, []);

  // Charger l'index des pièces jointes locales
  const loadAttachmentsIndex = useCallback(async () => {
    try {
      const data = await api.getAttachmentsIndex();
      setAttachmentsIndex(data || { affaires: [], counts: {} });
    } catch {
      setAttachmentsIndex({ affaires: [], counts: {} });
    }
  }, []);

  // Charger les comptages de personnel par affaire
  const loadPersonnelCounts = useCallback(async () => {
    try {
      const data = await api.getAffairesPersonnelCounts();
      setPersonnelCountsMap(data || {});
    } catch {
      setPersonnelCountsMap({});
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      setError(null);
      await Promise.all([loadDbAffaires(), loadGoogleAffaires(), loadAttachmentsIndex(), loadPersonnelCounts()]);
      setIsLoading(false);
    };
    loadAll();
  }, [loadDbAffaires, loadGoogleAffaires, loadAttachmentsIndex, loadPersonnelCounts]);

  // Fusionner les affaires : DB prend priorité, puis réservations (source: 'auto'), puis Google
  const affaires = useMemo(() => {
    const merged = new Map();

    // 1. D'abord les affaires DB (priorité max)
    for (const a of dbAffaires) {
      merged.set(a.numeroAffaire, { ...a });
    }

    // 2. Ensuite les affaires Google (compléter/ajouter)
    for (const ga of googleAffaires) {
      const existing = merged.get(ga.numeroAffaire);
      if (existing) {
        // L'affaire existe en DB — enrichir avec les infos Google manquantes
        if (!existing.adresseLivraison && ga.adresseLivraison) existing.adresseLivraison = ga.adresseLivraison;
        if (!existing.eventName && ga.eventName) existing.eventName = ga.eventName;
        if (!existing.titre && ga.titre) existing.titre = ga.titre;
        if (!existing.description && ga.description) existing.description = ga.description;
        // Étendre les dates si Google a une plus grande plage
        if (ga.dateDebut && (!existing.dateDebut || ga.dateDebut < existing.dateDebut)) existing.dateDebut = ga.dateDebut;
        if (ga.dateFin && (!existing.dateFin || ga.dateFin > existing.dateFin)) existing.dateFin = ga.dateFin;
        existing.googleEventCount = ga.googleEventCount || 1;
      } else {
        // Nouvelle affaire connue uniquement de Google
        merged.set(ga.numeroAffaire, { ...ga });
      }
    }

    return Array.from(merged.values());
  }, [dbAffaires, googleAffaires]);

  // Enrichir les affaires avec les indicateurs (event Google, pièces jointes, liens Drive)
  // + récupérer client, prestation et lieu depuis les réservations liées si manquants
  const enrichedAffaires = useMemo(() => {
    return affaires.map(a => {
      const num = a.numeroAffaire;
      const hasGoogleEvent = !!(googleEventIdsMap[num] && googleEventIdsMap[num].length > 0);
      const localAttachmentCount = attachmentsIndex.counts?.[num] || 0;
      const eventIdSet = new Set(googleEventIdsMap[num] || []);
      let driveLinksCount = 0;
      let resaCount = 0;
      let resaClient = '';
      let resaPrestation = '';
      let resaLieu = '';
      for (const r of reservations) {
        if ((r.affaire && r.affaire.toUpperCase() === num?.toUpperCase()) || (r.googleEventId && eventIdSet.has(r.googleEventId))) {
          resaCount++;
          if (r.googleDriveLinks && r.googleDriveLinks.length > 0) driveLinksCount += r.googleDriveLinks.length;
          else if (r.googleDriveLink && r.googleDriveLink.trim()) driveLinksCount += 1;
          if (!resaClient && r.clientName) resaClient = r.clientName;
          if (!resaPrestation && r.prestationName) resaPrestation = r.prestationName;
          if (!resaLieu && r.locationName) resaLieu = r.locationName;
        }
      }
      // Mettre à jour personnelCount depuis le map backend (plus fiable que le count statique)
      const persCount = personnelCountsMap[num?.toUpperCase()] || a.personnelCount || 0;
      return {
        ...a,
        hasGoogleEvent,
        localAttachmentCount,
        driveLinksCount,
        totalPieces: localAttachmentCount + driveLinksCount,
        reservationCount: resaCount,
        personnelCount: persCount,
        client: a.client || resaClient,
        titre: a.titre || resaPrestation,
        adresseLivraison: a.adresseLivraison || resaLieu,
      };
    });
  }, [affaires, googleEventIdsMap, attachmentsIndex, reservations, personnelCountsMap]);

  // Aujourd'hui au format YYYY-MM-DD
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // ═══ Navigation dates (anciennement dans Header) ═══
  const fmtDateISO = (d) => d.toISOString().slice(0, 10);

  const getAffaireRange = useCallback((anchorDate, mode, sliding) => {
    const d = new Date(anchorDate);
    d.setHours(0, 0, 0, 0);
    if (mode === 'week') {
      if (sliding) {
        const s = new Date(d); s.setDate(d.getDate() - 1);
        const e = new Date(d); e.setDate(d.getDate() + 6);
        return { start: s, end: e };
      } else {
        const s = new Date(d); s.setDate(d.getDate() - d.getDay() + 1);
        if (d.getDay() === 0) s.setDate(s.getDate() - 7);
        const e = new Date(s); e.setDate(s.getDate() + 6);
        return { start: s, end: e };
      }
    } else {
      if (sliding) {
        const s = new Date(d); s.setDate(d.getDate() - 7);
        const e = new Date(d); e.setDate(d.getDate() + 21);
        return { start: s, end: e };
      } else {
        const s = new Date(d.getFullYear(), d.getMonth(), 1);
        const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return { start: s, end: e };
      }
    }
  }, []);

  const applyAffaireRange = useCallback((anchorDate, mode, sliding) => {
    const { start, end } = getAffaireRange(anchorDate, mode, sliding);
    setFilterDateStart(fmtDateISO(start));
    setFilterDateEnd(fmtDateISO(end));
  }, [getAffaireRange]);

  const goToPrevious = useCallback(() => {
    if (!filterDateStart) return;
    const current = new Date(filterDateStart);
    if (viewMode === 'week') {
      current.setDate(current.getDate() - 7);
    } else {
      current.setMonth(current.getMonth() - 1);
    }
    if (!slidingMode) {
      applyAffaireRange(current, viewMode, false);
    } else {
      const end = new Date(filterDateEnd);
      if (viewMode === 'week') {
        end.setDate(end.getDate() - 7);
      } else {
        end.setMonth(end.getMonth() - 1);
      }
      setFilterDateStart(fmtDateISO(current));
      setFilterDateEnd(fmtDateISO(end));
    }
  }, [filterDateStart, filterDateEnd, viewMode, slidingMode, applyAffaireRange]);

  const goToNext = useCallback(() => {
    if (!filterDateStart) return;
    const current = new Date(filterDateStart);
    if (viewMode === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
    if (!slidingMode) {
      applyAffaireRange(current, viewMode, false);
    } else {
      const end = new Date(filterDateEnd);
      if (viewMode === 'week') {
        end.setDate(end.getDate() + 7);
      } else {
        end.setMonth(end.getMonth() + 1);
      }
      setFilterDateStart(fmtDateISO(current));
      setFilterDateEnd(fmtDateISO(end));
    }
  }, [filterDateStart, filterDateEnd, viewMode, slidingMode, applyAffaireRange]);

  const goToToday = useCallback(() => {
    applyAffaireRange(new Date(), viewMode, slidingMode);
  }, [viewMode, slidingMode, applyAffaireRange]);

  const isCurrentPeriod = useMemo(() => {
    if (!filterDateStart || !filterDateEnd) return true;
    const { start, end } = getAffaireRange(new Date(), viewMode, slidingMode);
    return filterDateStart === fmtDateISO(start) && filterDateEnd === fmtDateISO(end);
  }, [filterDateStart, filterDateEnd, viewMode, slidingMode, getAffaireRange]);

  const dateLabel = useMemo(() => {
    if (!filterDateStart || !filterDateEnd) return 'Toutes les dates';
    const start = new Date(filterDateStart + 'T00:00:00');
    const end = new Date(filterDateEnd + 'T00:00:00');
    if (viewMode === 'week') {
      const label = `${format(start, 'd', { locale: fr })} - ${format(end, 'd MMMM yyyy', { locale: fr })}`;
      return label.charAt(0).toUpperCase() + label.slice(1);
    } else {
      if (!slidingMode) {
        const label = format(start, 'MMMM yyyy', { locale: fr });
        return label.charAt(0).toUpperCase() + label.slice(1);
      } else {
        const label = `${format(start, 'd MMM', { locale: fr })} - ${format(end, 'd MMM yyyy', { locale: fr })}`;
        return label.charAt(0).toUpperCase() + label.slice(1);
      }
    }
  }, [filterDateStart, filterDateEnd, viewMode, slidingMode]);

  const handleViewModeChange = useCallback((newMode) => {
    setViewMode(newMode);
    const anchor = filterDateStart ? new Date(filterDateStart) : new Date();
    applyAffaireRange(anchor, newMode, slidingMode);
  }, [filterDateStart, slidingMode, applyAffaireRange]);

  // Filtrer et trier
  const filteredAffaires = useMemo(() => {
    let result = [...enrichedAffaires];
    const today = new Date().toISOString().slice(0, 10);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const archiveThreshold = oneWeekAgo.toISOString().slice(0, 10);

    // Marquer les affaires archivées (terminées depuis + d'1 semaine)
    // N'archiver que si une date_fin explicite est définie et dépassée
    result = result.map(a => {
      const isArchived = a.dateFin ? a.dateFin < archiveThreshold : false;
      return { ...a, isArchived };
    });

    // Filtrer les archivées sauf si showArchived
    if (!showArchived) {
      result = result.filter(a => !a.isArchived);
    }
    // Filtre recherche texte
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a =>
        (a.numeroAffaire || '').toLowerCase().includes(term) ||
        (a.client || '').toLowerCase().includes(term) ||
        (a.eventName || '').toLowerCase().includes(term) ||
        (a.titre || '').toLowerCase().includes(term) ||
        (a.adresseLivraison || '').toLowerCase().includes(term)
      );
    }

    // Filtre par type
    if (filterType) {
      result = result.filter(a => a.type === filterType);
    }

    // Filtre par période (personnalisé)
    // Les affaires sans dates sont toujours incluses (elles ne doivent pas disparaître)
    if (filterDateStart) {
      result = result.filter(a => {
        const d = a.dateFin || a.dateDebut;
        if (!d) return true; // Pas de date → ne pas filtrer
        return d >= filterDateStart;
      });
    }
    if (filterDateEnd) {
      result = result.filter(a => {
        const d = a.dateDebut;
        if (!d) return true; // Pas de date → ne pas filtrer
        return d <= filterDateEnd;
      });
    }

    // Tri
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'dateDebut') {
        cmp = (a.dateDebut || '').localeCompare(b.dateDebut || '');
      } else if (sortBy === 'type') {
        cmp = (a.type || '').localeCompare(b.type || '');
      } else if (sortBy === 'numero') {
        cmp = (a.numeroAffaire || '').localeCompare(b.numeroAffaire || '');
      } else if (sortBy === 'client') {
        cmp = (a.client || '').localeCompare(b.client || '');
      } else if (sortBy === 'titre') {
        cmp = (a.eventName || a.titre || '').localeCompare(b.eventName || b.titre || '');
      } else if (sortBy === 'lieu') {
        cmp = (a.adresseLivraison || '').localeCompare(b.adresseLivraison || '');
      } else if (sortBy === 'resa') {
        cmp = (a.reservationCount || 0) - (b.reservationCount || 0);
      } else if (sortBy === 'pers') {
        cmp = (a.personnelCount || 0) - (b.personnelCount || 0);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [enrichedAffaires, searchTerm, filterType, filterDateStart, filterDateEnd, sortBy, sortOrder, showArchived]);

  // ═══ Frise chronologique — calculs ═══

  // Période affichée sur la frise
  const periodRange = useMemo(() => {
    let start = filterDateStart;
    let end = filterDateEnd;
    // Si pas de filtre dates (mode "Tout"), calculer depuis les données ou 1 an
    if (!start && !end) {
      const dates = filteredAffaires.reduce((acc, a) => {
        if (a.dateDebut) acc.push(a.dateDebut);
        if (a.dateFin) acc.push(a.dateFin);
        return acc;
      }, []);
      if (dates.length > 0) {
        dates.sort();
        start = dates[0];
        end = dates[dates.length - 1];
        // Ajouter un peu de marge
        const s = new Date(start + 'T00:00:00');
        const e = new Date(end + 'T23:59:59');
        s.setDate(s.getDate() - 3);
        e.setDate(e.getDate() + 3);
        start = s.toISOString().slice(0, 10);
        end = e.toISOString().slice(0, 10);
      } else {
        const now = new Date();
        const ys = startOfYear(now);
        const ye = endOfYear(now);
        start = ys.toISOString().slice(0, 10);
        end = ye.toISOString().slice(0, 10);
      }
    } else if (!start) {
      start = end;
    } else if (!end) {
      end = start;
    }
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');
    const totalMs = Math.max(1, endDate.getTime() - startDate.getTime());
    const totalDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));
    return { start, end, startDate, endDate, totalMs, totalDays };
  }, [filterDateStart, filterDateEnd, filteredAffaires]);

  // Marqueurs de dates sur la frise
  const timelineMarkers = useMemo(() => {
    const { startDate, endDate, totalDays, totalMs } = periodRange;
    const markers = [];
    let intervalDays;
    if (totalDays <= 8) intervalDays = 1;
    else if (totalDays <= 35) intervalDays = 7;
    else if (totalDays <= 100) intervalDays = 14;
    else intervalDays = 30;
    let d = new Date(startDate);
    while (d <= endDate) {
      const ratio = (d.getTime() - startDate.getTime()) / totalMs;
      let label;
      if (totalDays <= 8) label = format(d, 'EEE dd', { locale: fr });
      else if (totalDays <= 35) label = format(d, 'dd MMM', { locale: fr });
      else label = format(d, 'MMM yy', { locale: fr });
      markers.push({ ratio: Math.min(ratio, 1), label });
      d = new Date(d.getTime() + intervalDays * 86400000);
    }
    return markers;
  }, [periodRange]);

  // Position du marqueur "Aujourd'hui"
  const todayRatio = useMemo(() => {
    const { startDate, endDate, totalMs } = periodRange;
    const now = new Date(); now.setHours(12, 0, 0, 0);
    if (now < startDate || now > endDate) return null;
    return (now.getTime() - startDate.getTime()) / totalMs;
  }, [periodRange]);

  // Blocs affaires sur la frise
  const timelineBlocks = useMemo(() => {
    const { startDate, totalMs } = periodRange;
    return filteredAffaires.map(a => {
      const aStart = new Date((a.dateDebut || periodRange.start) + 'T00:00:00');
      const aEnd = new Date((a.dateFin || a.dateDebut || periodRange.start) + 'T23:59:59');
      const left = Math.max(0, (aStart.getTime() - startDate.getTime()) / totalMs);
      const right = Math.min(1, (aEnd.getTime() - startDate.getTime()) / totalMs);
      const typeInfo = getTypeInfo(a.type);
      return { id: a.id || a.numeroAffaire, left, width: Math.max(0.004, right - left), color: typeInfo.color, numero: a.numeroAffaire };
    });
  }, [filteredAffaires, periodRange]);

  // Date correspondant à la position du curseur
  const cursorDate = useMemo(() => {
    if (cursorRatio === null) return null;
    return new Date(periodRange.startDate.getTime() + cursorRatio * periodRange.totalMs);
  }, [cursorRatio, periodRange]);

  // Affaires surlignées (chevauchant la date du curseur)
  const highlightedIds = useMemo(() => {
    if (!cursorDate) return new Set();
    const cursorStr = cursorDate.toISOString().slice(0, 10);
    const ids = new Set();
    filteredAffaires.forEach(a => {
      const debut = a.dateDebut || '';
      const fin = a.dateFin || a.dateDebut || '';
      if (debut <= cursorStr && fin >= cursorStr) ids.add(a.id || a.numeroAffaire);
    });
    return ids;
  }, [cursorDate, filteredAffaires]);

  // Scroll vers la première affaire surlignée
  useEffect(() => {
    if (highlightedIds.size === 0 || !listRef.current) return;
    const firstId = [...highlightedIds][0];
    const row = listRef.current.querySelector(`[data-affaire-id="${CSS.escape(String(firstId))}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightedIds]);

  // Drag handlers pour la frise
  const handleTimelineMouseDown = useCallback((e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCursorRatio(ratio);
    setIsDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      setCursorRatio(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging]);

  // Reset curseur quand la période change
  useEffect(() => { setCursorRatio(null); }, [filterDateStart, filterDateEnd]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const hasActiveFilters = filterType || filterDateStart || filterDateEnd || searchTerm;

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    await Promise.all([loadDbAffaires(), loadGoogleAffaires()]);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="affaires-panel">
        <div className="affaires-loading">
          <div className="loading-spinner"></div>
          <p>Chargement des affaires...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="affaires-panel">
      {error && (
        <div className="affaires-error">
          <AlertCircle size={16} /> {error}
          <button onClick={handleRefresh}>Réessayer</button>
        </div>
      )}
      {googleError && (
        <div className="affaires-warning">
          <AlertCircle size={16} /> {googleError}
        </div>
      )}
      {isLoadingGoogle && (
        <div className="affaires-google-loading">
          <div className="loading-spinner small"></div>
          <span>Synchronisation Google Calendar...</span>
        </div>
      )}

      {/* Compteur + Bouton nouvelle affaire + Frise chronologique */}
      <div className="affaires-info-bar">
        <div className="affaires-count-box">
          <span className="affaires-count-number">{filteredAffaires.length}</span>
          <span className="affaires-count-label">affaire{filteredAffaires.length !== 1 ? 's' : ''}</span>
        </div>

        <button
          className="affaires-new-btn"
          onClick={async () => {
            try {
              const newAffaire = {
                numeroAffaire: `AF${Date.now().toString().slice(-5)}`,
                nom: '',
                client: '',
                interlocuteur: '',
                tel: '',
                type: 'Prestation',
                dateDebut: format(new Date(), 'yyyy-MM-dd'),
                dateFin: '',
                adresseLivraison: '',
                description: '',
                devis: '',
                source: 'db',
              };
              const created = await api.createOrUpdateAffaire(newAffaire);
              await loadDbAffaires();
              setDialogAffaire({ ...newAffaire, id: created.id, ...created });
            } catch (err) {
              console.error('Erreur création affaire:', err);
            }
          }}
          title="Nouvelle affaire"
        >
          <Plus size={14} />
          <span>Nouvelle affaire</span>
        </button>

        {/* Frise chronologique */}
        <div className="affaires-timeline" ref={timelineRef} onMouseDown={handleTimelineMouseDown}>
          <div className="timeline-track">
            {timelineMarkers.map((m, i) => (
              <div key={i} className="timeline-marker" style={{ left: `${m.ratio * 100}%` }}>
                <span className="marker-tick" />
                <span className="marker-label">{m.label}</span>
              </div>
            ))}
            {timelineBlocks.map((b, i) => (
              <div
                key={b.id || i}
                className={`timeline-block${highlightedIds.has(b.id) ? ' tl-highlighted' : ''}`}
                style={{ left: `${b.left * 100}%`, width: `${b.width * 100}%`, background: b.color }}
                title={b.numero}
              />
            ))}
            {todayRatio !== null && (
              <div className="timeline-today" style={{ left: `${todayRatio * 100}%` }} title="Aujourd'hui" />
            )}
            {cursorRatio !== null && (
              <div className="timeline-cursor" style={{ left: `${cursorRatio * 100}%` }}>
                <div className="cursor-line" />
                <div className="cursor-handle" />
                <div className="cursor-date">
                  {cursorDate && format(cursorDate, 'dd MMM yyyy', { locale: fr })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar : recherche + filtres + navigation dates */}
      <div className="affaires-toolbar-bar">
        <div className="affaires-toolbar-actions">
          {/* Recherche */}
          <div className="affaires-tb-search">
            <Search size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher affaire..."
            />
            {searchTerm && <button className="affaires-tb-search-clear" onClick={() => setSearchTerm('')}><X size={12} /></button>}
          </div>

          {/* Type — sélecteur horizontal */}
          <div className="affaires-type-selector">
            <button
              className={`affaires-type-btn${!filterType ? ' active' : ''}`}
              onClick={() => setFilterType('')}
              title="Tous les types"
            >
              Tous
            </button>
            {AFFAIRE_TYPES.map(t => (
              <button
                key={t.value}
                className={`affaires-type-btn${filterType === t.value ? ' active' : ''}`}
                style={filterType === t.value ? { '--type-color': t.color } : {}}
                onClick={() => setFilterType(filterType === t.value ? '' : t.value)}
                title={t.label}
              >
                <span className="affaires-type-icon">{t.icon}</span>
                <span className="affaires-type-label">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="affaires-tb-divider" />

          {/* Vue semaine / mois */}
          <div className="affaires-tb-view-selector">
            <button className={`affaires-tb-view-btn${viewMode === 'week' ? ' active' : ''}`} onClick={() => handleViewModeChange('week')}>Sem.</button>
            <button className={`affaires-tb-view-btn${viewMode === 'month' ? ' active' : ''}`} onClick={() => handleViewModeChange('month')}>Mois</button>
          </div>

          {/* Navigation dates */}
          <button className="affaires-tb-nav-btn" onClick={goToPrevious} title="Période précédente"><ChevronLeft size={16} /></button>
          <button className={`affaires-tb-nav-btn${!isCurrentPeriod ? ' today-hl' : ''}`} onClick={goToToday}>Aujourd'hui</button>
          <button className="affaires-tb-nav-btn" onClick={goToNext} title="Période suivante"><ChevronRight size={16} /></button>
          <div
            className="affaires-tb-date-label"
            onClick={() => { viewMode === 'month' ? setShowMonthSelector(true) : setShowWeekSelector(true); }}
            title={viewMode === 'month' ? 'Sélectionner un mois' : 'Sélectionner une semaine'}
          >
            {dateLabel}
          </div>

          <div className="affaires-tb-divider" />

          {/* Glissant */}
          <label className="affaires-tb-toggle" title={slidingMode ? 'Mode glissant' : 'Mode calendaire'}>
            <input type="checkbox" checked={slidingMode} onChange={e => {
              const newSliding = e.target.checked;
              setSlidingMode(newSliding);
              if (filterDateStart) {
                applyAffaireRange(new Date(filterDateStart), viewMode, newSliding);
              }
            }} />
            <span>Glissant</span>
          </label>

          {/* Archivées */}
          <label className="affaires-tb-toggle" title="Afficher les affaires terminées depuis plus d'une semaine">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            <span>Archivées</span>
          </label>

          <div className="affaires-tb-divider" />

          {/* Import BL — dynamique selon le filtre type actif */}
          {(!filterType || filterType === 'Vente' || filterType === 'Installation') && (
            <button
              className="affaires-tb-bl-import-btn"
              onClick={() => { setBlImportAffaireId(null); setShowBLImport(true); }}
              title="Importer un BL Vente / Installation"
            >
              <FileText size={14} /> BL Vente
            </button>
          )}
          {(!filterType || filterType === 'Location' || filterType === 'Prestation') && (
            <button
              className="affaires-tb-bl-import-btn loc-presta"
              onClick={() => { setBlImportAffaireId(null); setShowBLImportLocPresta(true); }}
              title="Importer un Bon de Préparation (Location / Prestation)"
            >
              <FileText size={14} /> BP Loc/Presta
            </button>
          )}
          <button
            className="affaires-tb-bl-import-btn"
            onClick={() => setShowBatchAnalysis(true)}
            title="Analyse batch des BL PDF"
            style={{ gap: 4 }}
          >
            <BarChart2 size={14} /> Analyse batch
          </button>

          <div className="affaires-tb-divider" />

          {/* Refresh + compteur */}
          <button
            className="affaires-tb-nav-btn"
            onClick={handleRefresh}
            title="Rafraîchir les affaires"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw size={14} />
          </button>
          <span className="affaires-tb-count" title={`${filteredAffaires.length} affaire(s) affichée(s) sur ${enrichedAffaires.length} total`}>
            {filteredAffaires.length}/{enrichedAffaires.length}
          </span>
        </div>
      </div>

      {/* Corps : liste + volet détail côte à côte */}
      <div className="affaires-body">
        {/* Liste des affaires */}
        <div className="affaires-list" ref={listRef}>
        {filteredAffaires.length === 0 ? (
          <div className="affaires-empty">
            <Briefcase size={48} strokeWidth={1} />
            <p>{hasActiveFilters ? 'Aucune affaire ne correspond aux critères' : 'Aucune affaire trouvée'}</p>
          </div>
        ) : (
          <>
            {/* En-tête du tableau (cliquable pour trier) */}
            <div className="affaire-table-header">
              <span className="ath-status"></span>
              <span className="ath-numero sortable" onClick={() => toggleSort('numero')}>
                N° Affaire {sortBy === 'numero' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </span>
              <span className="ath-type sortable" onClick={() => toggleSort('type')}>
                Type {sortBy === 'type' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </span>
              <span className="ath-dates sortable" onClick={() => toggleSort('dateDebut')}>
                Période {sortBy === 'dateDebut' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </span>
              <span className="ath-client sortable" onClick={() => toggleSort('client')}>
                Client {sortBy === 'client' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </span>
              <span className="ath-titre sortable" onClick={() => toggleSort('titre')}>
                Titre / Événement {sortBy === 'titre' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </span>
              <span className="ath-lieu sortable" onClick={() => toggleSort('lieu')}>
                Lieu {sortBy === 'lieu' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </span>
              <span className="ath-icons"></span>
              <span className="ath-resa sortable" onClick={() => toggleSort('resa')}>
                Résa {sortBy === 'resa' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </span>
              <span className="ath-pers sortable" onClick={() => toggleSort('pers')}>
                Pers {sortBy === 'pers' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
              </span>
            </div>
            {/* Lignes */}
            {filteredAffaires.map(affaire => {
              const typeInfo = getTypeInfo(affaire.type);
              const status = getAffaireStatus(affaire, today);
              const affaireKey = affaire.id || affaire.numeroAffaire;
              const isHighlighted = highlightedIds.has(affaireKey);
              return (
                <div
                  key={affaireKey}
                  data-affaire-id={affaireKey}
                  className={`affaire-row status-${status}${affaire.isArchived ? ' archived' : ''}${isHighlighted ? ' highlighted' : ''}${selectedAffaire && (selectedAffaire.id || selectedAffaire.numeroAffaire) === affaireKey ? ' selected' : ''}`}
                  onClick={() => {
                    clearTimeout(clickTimerRef.current);
                    clickTimerRef.current = setTimeout(() => {
                      setSelectedAffaire(prev => (prev && (prev.id || prev.numeroAffaire) === affaireKey) ? null : affaire);
                    }, 200);
                  }}
                  onDoubleClick={() => {
                    clearTimeout(clickTimerRef.current);
                    setDialogAffaire(affaire);
                  }}
                >
                  <span className="ar-status">
                    {affaire.isArchived ? (
                      <span className="status-dot archived" title="Archivée" />
                    ) : (
                      <span className={`status-dot ${status}`} title={status === 'active' ? 'En cours' : status === 'upcoming' ? 'À venir' : 'Terminée'} />
                    )}
                  </span>
                  <span className="ar-numero">{affaire.numeroAffaire || '—'}</span>
                  <span className="ar-type">
                    <span className="affaire-type-tag" style={{ background: typeInfo.color }}>{typeInfo.label}</span>
                  </span>
                  <span className="ar-dates">
                    {formatDate(affaire.dateDebut)}
                    {affaire.dateFin && affaire.dateFin !== affaire.dateDebut && (
                      <> → {formatDate(affaire.dateFin)}</>
                    )}
                  </span>
                  <span className="ar-client" title={affaire.client || ''}>{capitalizeText(affaire.client) || '—'}</span>
                  <span className="ar-titre" title={affaire.eventName || affaire.titre || ''}>
                    {affaire.hasGoogleEvent && <Calendar size={11} className="ar-event-icon" title={`${affaire.googleEventCount || 1} événement(s) Google`} />}
                    {capitalizeText(affaire.eventName || affaire.titre) || '—'}
                  </span>
                  <span className="ar-lieu" title={affaire.adresseLivraison || ''}>{capitalizeText(affaire.adresseLivraison) || '—'}</span>
                  <span className="ar-icons">
                    {affaire.localAttachmentCount > 0 && (
                      <span className="ar-icon-badge file-badge" title={`${affaire.localAttachmentCount} fichier(s)`}>
                        <Paperclip size={11} />
                        <span className="badge-count">{affaire.localAttachmentCount}</span>
                      </span>
                    )}
                    {affaire.driveLinksCount > 0 && (
                      <span className="ar-icon-badge link-badge" title={`${affaire.driveLinksCount} lien(s) Drive`}>
                        <LinkIcon size={11} />
                        <span className="badge-count">{affaire.driveLinksCount}</span>
                      </span>
                    )}
                  </span>
                  <span className="ar-resa">{affaire.reservationCount || 0}</span>
                  <span className="ar-pers">{affaire.personnelCount || 0}</span>
                </div>
              );
            })}
          </>
        )}
        </div>

        {/* Volet de détail (clic simple) */}
        <AffaireSlidePanel
          affaire={selectedAffaire}
          reservations={reservations}
          googleEventIds={selectedAffaire ? (googleEventIdsMap[selectedAffaire.numeroAffaire] || []) : []}
          onClose={() => setSelectedAffaire(null)}
          onOpenDialog={(aff) => { setSelectedAffaire(null); setDialogAffaire(aff); }}
          onNavigateToEntity={onNavigateToEntity}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Dialog de détail (double-clic) */}
      <AffaireDetailDialog
        affaire={dialogAffaire}
        reservations={reservations}
        googleEventIds={dialogAffaire ? (googleEventIdsMap[dialogAffaire.numeroAffaire] || []) : []}
        onClose={() => setDialogAffaire(null)}
        onDataChanged={(updatedAffaire) => { if (updatedAffaire) setDialogAffaire(updatedAffaire); loadDbAffaires(); }}
        onNavigateToEntity={onNavigateToEntity}
      />

      {/* FAB création rapide d'affaire */}
      <button
        className="affaire-fab-create"
        onClick={async () => {
          try {
            const newAffaire = {
              numeroAffaire: `AF${Date.now().toString().slice(-5)}`,
              nom: '',
              client: '',
              interlocuteur: '',
              tel: '',
              type: 'Prestation',
              dateDebut: format(new Date(), 'yyyy-MM-dd'),
              dateFin: '',
              adresseLivraison: '',
              description: '',
              devis: '',
              source: 'db',
            };
            const created = await api.createOrUpdateAffaire(newAffaire);
            await loadDbAffaires();
            setDialogAffaire({ ...newAffaire, id: created.id, ...created });
          } catch (err) {
            console.error('Erreur création affaire:', err);
          }
        }}
        title="Nouvelle affaire"
      >
        <Plus size={22} />
      </button>

      {/* Sélecteurs de date */}
      {showMonthSelector && (
        <MonthSelector
          currentDate={filterDateStart ? new Date(filterDateStart + 'T00:00:00') : new Date()}
          onSelectMonth={(date) => {
            applyAffaireRange(date, 'month', slidingMode);
            setShowMonthSelector(false);
          }}
          onClose={() => setShowMonthSelector(false)}
          reservations={reservations}
        />
      )}
      {showWeekSelector && (
        <WeekSelector
          currentDate={filterDateStart ? new Date(filterDateStart + 'T00:00:00') : new Date()}
          onSelectWeek={(date) => {
            applyAffaireRange(date, 'week', slidingMode);
            setShowWeekSelector(false);
          }}
          onClose={() => setShowWeekSelector(false)}
          reservations={reservations}
        />
      )}

      {/* BL Import Modal */}
      {showBLImport && (
        <Suspense fallback={null}>
          <BLImportModal
            onClose={() => { setShowBLImport(false); setBlImportAffaireId(null); }}
            onImported={() => { setShowBLImport(false); setBlImportAffaireId(null); handleRefresh(); }}
            defaultAffaireId={blImportAffaireId}
          />
        </Suspense>
      )}

      {/* BL Import Loc/Presta Modal */}
      {showBLImportLocPresta && (
        <Suspense fallback={null}>
          <BLImportLocPrestaModal
            onClose={() => { setShowBLImportLocPresta(false); setBlImportAffaireId(null); }}
            onImported={() => { setShowBLImportLocPresta(false); setBlImportAffaireId(null); handleRefresh(); }}
            defaultAffaireId={blImportAffaireId}
          />
        </Suspense>
      )}

      {/* Batch Analysis Modal */}
      {showBatchAnalysis && (
        <Suspense fallback={null}>
          <BLBatchAnalysis onClose={() => setShowBatchAnalysis(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default AffairesPanel;
