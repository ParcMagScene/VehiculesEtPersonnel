import './AffaireDetailPanel.css';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  File,
  FileText,
  FolderOpen,
  Hash,
  LinkIcon,
  Loader,
  Mail,
  MapPin,
  Package,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  User,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Avatar, Button, Input, Select, Spinner, Table, Textarea, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useAnnotateBP } from '../../hooks/useAnnotateBP';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import usePersonnelFavorites from '../../hooks/usePersonnelFavorites';
import { useSlidePanelClose } from '../../hooks/useSlidePanelClose';
import { AFFAIRE_TYPE_SECTIONS, AFFAIRE_TYPES, getTypeInfo } from '../../utils/affaireConstants';
import {
  AFFAIRE_STATUS_MAP,
  getAvailableTransitions,
  STEP_TEMPLATES,
} from '../../utils/affaireWorkflow';
import api, { getApiUrl } from '../../utils/api';
import { capitalizeText } from '../../utils/dateUtils';
import { formatDateSimple } from '../../utils/formatUtils';
import { refreshBus } from '../../utils/refresh-bus';
import AddressAutocomplete from '../AddressAutocomplete';
import AffaireBadge from '../AffaireBadge';
import { formatPhoneDisplay } from '../PhoneInput';

const ReservationModal = lazy(() => import('../vehicles/ReservationModal'));
const EventDetailsModal = lazy(() => import('../planning/EventDetailsModal'));
const BLImportModal = lazy(() => import('./BLImportModal'));
const BLImportLocPrestaModal = lazy(() => import('./BLImportLocPrestaModal'));
const DynamicDisplayDialog = lazy(() => import('../DynamicDisplayDialog'));
const GenerateOrdersModal = lazy(() => import('./GenerateOrdersModal'));
const BPAnnotationViewer = lazy(() => import('./BPAnnotationViewer'));

const API_BASE_URL = getApiUrl();

// ═══ Étapes de tâches opérationnelles ═══
const TASK_STEPS = [
  {
    key: 'preparation',
    label: 'Préparation',
    emoji: '🔧',
    icon: Wrench,
    color: ACCENT_COLORS.indigo,
    defaultSection: 'prep_locations',
  },
  {
    key: 'chargement',
    label: 'Chargement',
    emoji: '📦',
    icon: Package,
    color: STATUS_COLORS.warning,
    defaultSection: 'chargement',
  },
  {
    key: 'depart',
    label: 'Départ',
    emoji: '🚀',
    icon: ArrowRight,
    color: STATUS_COLORS.info,
    defaultSection: 'depart',
  },
  {
    key: 'livraison',
    label: 'Livraison',
    emoji: '🚚',
    icon: Truck,
    color: ACCENT_COLORS.orange,
    defaultSection: 'courses',
  },
  {
    key: 'enlevement',
    label: 'Enlèvement',
    emoji: '📦',
    icon: Truck,
    color: STATUS_COLORS.success,
    defaultSection: 'enlevement',
  },
  {
    key: 'retour',
    label: 'Retour',
    emoji: '↩️',
    icon: RotateCcw,
    color: ACCENT_COLORS.violet,
    defaultSection: 'retour',
  },
  {
    key: 'recuperation',
    label: 'Récupération',
    emoji: '📥',
    icon: Package,
    color: STATUS_COLORS.danger,
    defaultSection: 'recuperation',
  },
  {
    key: 'installation',
    label: 'Installation',
    emoji: '🛠️',
    icon: Wrench,
    color: STATUS_COLORS.success,
    defaultSection: 'installation',
  },
  {
    key: 'montage',
    label: 'Montage',
    emoji: '🔩',
    icon: Wrench,
    color: ACCENT_COLORS.cyanDark,
    defaultSection: 'montage',
  },
  {
    key: 'demontage',
    label: 'Démontage',
    emoji: '🔧',
    icon: Wrench,
    color: STATUS_COLORS.dangerDark,
    defaultSection: 'demontage',
  },
];

// Étapes filtrées par type d'affaire (Phase 9)
const getVisibleSteps = (type) => {
  const templateKeys = STEP_TEMPLATES[type];
  if (!templateKeys) return TASK_STEPS;
  return TASK_STEPS.filter((s) => templateKeys.includes(s.key));
};

const TASK_STATUS_MAP = {
  pending: { label: 'En attente', color: '#94a3b8', bg: '#f1f5f9' },
  in_progress: { label: 'En cours', color: STATUS_COLORS.warning, bg: '#fef3c7' },
  done: { label: 'Terminé', color: STATUS_COLORS.success, bg: '#d1fae5' },
  cancelled: { label: 'Annulé', color: STATUS_COLORS.danger, bg: '#fee2e2' },
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00')), 'dd MMM yyyy', {
      locale: fr,
    });
  } catch {
    return dateStr;
  }
};

// Extraire les URL depuis un texte (description Google Calendar)
const extractLinksFromText = (text) => {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"')]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)].map((url) => {
    const isDrive =
      url.includes('drive.google.com') ||
      url.includes('docs.google.com') ||
      url.includes('sheets.google.com') ||
      url.includes('slides.google.com');
    let label = '';
    if (isDrive) {
      label = 'Google Drive';
      if (url.includes('/folders/')) label = 'Dossier Drive';
      else if (url.includes('docs.google.com')) label = 'Google Docs';
      else if (url.includes('sheets.google.com')) label = 'Google Sheets';
      else if (url.includes('slides.google.com')) label = 'Google Slides';
    } else {
      try {
        label = new URL(url).hostname;
      } catch {
        label = url.slice(0, 50);
      }
    }
    return { url, label, isDrive };
  });
};

// ═══════════════════════════════════════
// Contenu partagé (sections de détail)
// ═══════════════════════════════════════

const AffaireDetailContent = ({
  affaire,
  reservations = [],
  missions = [],
  _persons = [],
  googleEventIds = [],
  editable = false,
  onDataChanged,
  onNavigateToEntity,
  isEditing = false,
  editForm = null,
  setEditForm = null,
  currentUser,
}) => {
  const typeInfo = getTypeInfo(isEditing && editForm ? editForm.type : affaire.type);

  // ═══ États pour les actions (mode éditable) ═══
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showPersonnelForm, setShowPersonnelForm] = useState(false);
  const [actionData, setActionData] = useState({
    vehicles: [],
    clients: [],
    drivers: [],
    locations: [],
    persons: [],
  });
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [missionTitle, setMissionTitle] = useState('');
  const [actionFeedback, setActionFeedback] = useState(null);
  const [generatingOrders, setGeneratingOrders] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  // ═══ Phase 9 — Workflow state ═══
  const [statusHistory, setStatusHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [annotatingBL, setAnnotatingBL] = useState(null); // bl import object en cours d'annotation
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const { getFavoriteDisplayName, sortPersonsByFavorites } = usePersonnelFavorites();
  const fileInputRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  const {
    annotate,
    reset: resetAnnotation,
    annotationResult,
    isLoading: _annotationLoading,
  } = useAnnotateBP({
    toast: { error: (msg) => showFeedback({ type: 'error', message: msg }, 4000) },
  });

  // ═══ Autocomplete Client & Interlocuteur ═══
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const clientDropdownRef = useRef(null);
  const contactDropdownRef = useRef(null);

  // Recherche clients dans l'annuaire
  const searchClients = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setClientSuggestions([]);
      return;
    }
    try {
      const resp = await api.getAnnuaireClients({ search: query, limit: 10 });
      setClientSuggestions(resp?.data || []);
    } catch {
      setClientSuggestions([]);
    }
  }, []);

  // Recherche contacts dans l'annuaire
  const searchContacts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setContactSuggestions([]);
      return;
    }
    try {
      const resp = await api.getAnnuaireContacts({ search: query, limit: 10 });
      setContactSuggestions(resp?.data || []);
    } catch {
      setContactSuggestions([]);
    }
  }, []);

  // Fermer les dropdowns quand on clique ailleurs
  useEffect(() => {
    const handleClick = (e) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target))
        setShowClientDropdown(false);
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target))
        setShowContactDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cleanup feedback timer on unmount
  useEffect(() => () => clearTimeout(feedbackTimerRef.current), []);

  const showFeedback = useCallback((msg, duration = 3000) => {
    clearTimeout(feedbackTimerRef.current);
    setActionFeedback(msg);
    feedbackTimerRef.current = setTimeout(() => setActionFeedback(null), duration);
  }, []);

  // ═══ Phase 9 — Handlers workflow ═══
  const currentStatus =
    AFFAIRE_STATUS_MAP[affaire.status || 'brouillon'] || AFFAIRE_STATUS_MAP.brouillon;
  const availableTransitions = useMemo(
    () => getAvailableTransitions(affaire.status || 'brouillon'),
    [affaire.status],
  );

  const handleChangeStatus = useCallback(
    async (toStatus, force = false) => {
      if (!affaire.id) {
        showFeedback({ type: 'error', message: 'Affaire non enregistrée en base' }, 4000);
        return;
      }
      setStatusLoading(true);
      try {
        const result = await api.changeAffaireStatus(affaire.id, toStatus, { force });
        void result;
        showFeedback({
          type: 'success',
          message: `Statut → ${AFFAIRE_STATUS_MAP[toStatus]?.label || toStatus}`,
        });
        if (onDataChanged) onDataChanged();
      } catch (err) {
        const data = err.data || err;
        if (data?.canForce) {
          showFeedback({ type: 'warning', message: `${data.error} (forcer possible)` }, 6000);
        } else {
          showFeedback({ type: 'error', message: data?.error || err.message }, 4000);
        }
      } finally {
        setStatusLoading(false);
      }
    },
    [affaire.id, showFeedback, onDataChanged],
  );

  const handleApplyTemplate = useCallback(
    async (replace = false) => {
      if (!affaire.id) return;
      try {
        const result = await api.applyStepTemplate(affaire.id, { replace });
        showFeedback({ type: 'success', message: `${result.count} étape(s) créée(s)` });
        if (onDataChanged) onDataChanged();
      } catch (err) {
        const data = err.data || err;
        showFeedback({ type: 'error', message: data?.error || err.message }, 4000);
      }
    },
    [affaire.id, showFeedback, onDataChanged],
  );

  const loadHistory = useCallback(async () => {
    if (!affaire.id) return;
    try {
      const data = await api.getAffaireHistory(affaire.id);
      setStatusHistory(data || []);
    } catch {
      setStatusHistory([]);
    }
  }, [affaire.id]);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  // ═══ États pour consultation réservation / événement ═══
  const [viewedReservation, setViewedReservation] = useState(null);
  const [viewedEvent, setViewedEvent] = useState(null);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Charger les Google Calendar events liés
  useEffect(() => {
    if (!googleEventIds || googleEventIds.length === 0) {
      setGoogleEvents([]);
      return;
    }
    const fetchEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const serviceStatus = await api.getCalendarServiceStatus();
        if (!serviceStatus?.configured) {
          setGoogleEvents([]);
          setIsLoadingEvents(false);
          return;
        }
        const events = [];
        for (const eventId of googleEventIds) {
          try {
            const ev = await api.getGoogleEventV2(eventId);
            ev.affaire = affaire.numeroAffaire;
            events.push(ev);
          } catch {}
        }
        setGoogleEvents(events);
      } catch {
        setGoogleEvents([]);
      }
      setIsLoadingEvents(false);
    };
    fetchEvents();
  }, [googleEventIds, affaire.numeroAffaire]);

  // Charger les données nécessaires aux actions
  const loadActionData = useCallback(async (what) => {
    setIsLoadingAction(true);
    try {
      const promises = [];
      if (what === 'reservation') {
        promises.push(api.getVehicles(), api.getClients(), api.getLocations());
        const [vehicles, clients, locations] = await Promise.all(promises);
        setActionData((prev) => ({ ...prev, vehicles, clients, drivers: [], locations }));
      } else if (what === 'personnel') {
        const persons = await api.getPersons();
        setActionData((prev) => ({ ...prev, persons: Array.isArray(persons) ? persons : [] }));
      }
    } catch (err) {
      console.error('Erreur chargement données action:', err);
    } finally {
      setIsLoadingAction(false);
    }
  }, []);

  // Ouvrir une réservation existante (clic sur resa liée)
  const handleViewReservation = useCallback(
    async (resa) => {
      if (actionData.vehicles.length === 0) {
        await loadActionData('reservation');
      }
      setViewedReservation(resa);
    },
    [actionData.vehicles.length, loadActionData],
  );

  // Ouvrir le modal de réservation (création)
  const handleOpenReservation = useCallback(async () => {
    await loadActionData('reservation');
    setShowReservationModal(true);
  }, [loadActionData]);

  // Sauvegarder une réservation depuis le dialog
  const handleSaveReservation = useCallback(
    async (formData) => {
      try {
        if (Array.isArray(formData)) {
          for (const data of formData) {
            await api.createReservation({ id: `${Date.now()}.${Math.random()}`, ...data });
          }
        } else {
          await api.createReservation({ id: `${Date.now()}.${Math.random()}`, ...formData });
        }
        setShowReservationModal(false);
        showFeedback({ type: 'success', message: 'Réservation créée avec succès' });
        if (onDataChanged) onDataChanged();
      } catch (err) {
        console.error('Erreur création réservation:', err);
        showFeedback({ type: 'error', message: 'Erreur: ' + err.message }, 4000);
      }
    },
    [onDataChanged, showFeedback],
  );

  // Upload de fichier
  const handleFileUpload = useCallback(
    async (files) => {
      if (!files || files.length === 0 || !affaire.numeroAffaire) return;
      setUploadProgress('upload');
      let successCount = 0;
      for (const file of files) {
        try {
          await api.uploadAttachment(file, affaire.numeroAffaire);
          successCount++;
        } catch (err) {
          console.error('Erreur upload:', err);
        }
      }
      setUploadProgress(null);
      setShowUploadForm(false);
      if (successCount > 0) {
        showFeedback({ type: 'success', message: `${successCount} fichier(s) importé(s)` });
        if (onDataChanged) onDataChanged();
      } else {
        showFeedback({ type: 'error', message: "Erreur lors de l'import" });
      }
    },
    [affaire.numeroAffaire, onDataChanged, showFeedback],
  );

  // Assigner du personnel
  const handleAssignPersonnel = useCallback(async () => {
    if (!selectedPersonId) return;
    try {
      // Trouver une réservation liée pour créer la mission
      const linkedResa = reservations.find((r) => {
        if (r.affaire && r.affaire.toUpperCase() === affaire.numeroAffaire?.toUpperCase())
          return true;
        return false;
      });
      // Créer une mission liée à l'affaire
      const mission = await api.createMission({
        title: missionTitle || `Mission ${affaire.numeroAffaire}`,
        affaire: affaire.numeroAffaire,
        start_date: affaire.dateDebut,
        end_date: affaire.dateFin || affaire.dateDebut,
        location_name: affaire.adresseLivraison || '',
        status: 'planned',
        reservation_id: linkedResa?.id || null,
        notes: `Affaire ${affaire.numeroAffaire}`,
      });
      // Créer l'affectation
      await api.createAssignment({
        mission_id: mission.id,
        person_id: parseInt(selectedPersonId),
        status: 'proposed',
      });
      setShowPersonnelForm(false);
      setSelectedPersonId('');
      setMissionTitle('');
      showFeedback({ type: 'success', message: 'Personnel affecté avec succès' });
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error('Erreur affectation:', err);
      showFeedback({ type: 'error', message: 'Erreur: ' + err.message }, 4000);
    }
  }, [selectedPersonId, missionTitle, affaire, reservations, onDataChanged, showFeedback]);

  // Réservations liées (par numéro d'affaire OU par googleEventId)
  const linkedReservations = useMemo(() => {
    if (!affaire.numeroAffaire) return [];
    const eventIdSet = new Set(googleEventIds || []);
    return reservations.filter((r) => {
      // Match par champ affaire
      if (r.affaire && r.affaire.toUpperCase() === affaire.numeroAffaire.toUpperCase()) return true;
      // Match par googleEventId (lié à un événement Google de cette affaire)
      if (r.googleEventId && eventIdSet.has(r.googleEventId)) return true;
      return false;
    });
  }, [reservations, affaire.numeroAffaire, googleEventIds]);

  // Missions liées (via affaire direct OU via reservation_id des réservations liées)
  const linkedMissions = useMemo(() => {
    const resaIds = new Set(linkedReservations.map((r) => String(r.id)));
    const affaireUpper = affaire.numeroAffaire?.toUpperCase();
    return missions.filter((m) => {
      // Match direct par champ affaire de la mission
      if (m.affaire && m.affaire.toUpperCase() === affaireUpper) return true;
      // Match par reservation_id (lien indirect via réservation)
      if (
        (m.reservationId || m.reservation_id) &&
        resaIds.has(String(m.reservationId || m.reservation_id))
      )
        return true;
      return false;
    });
  }, [missions, linkedReservations, affaire.numeroAffaire]);

  // Personnel unique affecté
  const assignedPersonnel = useMemo(() => {
    const personMap = new Map();
    for (const m of linkedMissions) {
      if (m.assignments) {
        for (const a of m.assignments) {
          const pid = String(a.personId || a.person_id);
          if (!personMap.has(pid)) {
            // Parser les postes habituels
            let positions = [];
            try {
              const raw = a.defaultPositions || a.default_positions;
              positions = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
            } catch {
              /* ignore */
            }
            personMap.set(pid, {
              id: pid,
              firstName: a.firstName || a.first_name,
              lastName: a.lastName || a.last_name,
              phone: a.phone,
              email: a.email,
              photo: a.photo,
              type: a.personType || a.person_type,
              contractType: a.contractType || a.contract_type,
              positions,
              skills: a.skills || [],
              missionTitle: m.title,
              status: a.status,
            });
          }
        }
      }
    }
    return Array.from(personMap.values());
  }, [linkedMissions]);

  const sortedActionPersons = useMemo(
    () => sortPersonsByFavorites(actionData.persons || []),
    [actionData.persons, sortPersonsByFavorites],
  );

  // ═══ BL imports liés à l'affaire ═══
  const [linkedBLImports, setLinkedBLImports] = useState([]);
  useEffect(() => {
    if (!affaire.numeroAffaire) {
      setLinkedBLImports([]);
      return;
    }
    const loadBLImports = async () => {
      try {
        const imports = await api.getBLImports({ affaire_id: affaire.numeroAffaire });
        setLinkedBLImports(Array.isArray(imports) ? imports : []);
      } catch {
        setLinkedBLImports([]);
      }
    };
    loadBLImports();
  }, [affaire.numeroAffaire]);

  // ═══ Affaires liées (Tournée) ═══
  const [linkedAffaires, setLinkedAffaires] = useState({ children: [], parents: [] });
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkSearchResults, setLinkSearchResults] = useState([]);

  const loadLinkedAffaires = useCallback(async () => {
    if (!affaire.id) return;
    setIsLoadingLinks(true);
    try {
      const data = await api.getAffaireLinks(affaire.id);
      setLinkedAffaires({ children: data.children || [], parents: data.parents || [] });
    } catch {
      setLinkedAffaires({ children: [], parents: [] });
    }
    setIsLoadingLinks(false);
  }, [affaire.id]);

  useEffect(() => {
    loadLinkedAffaires();
  }, [loadLinkedAffaires]);

  // Recherche d'affaires à lier
  const handleLinkSearch = useCallback(
    async (query) => {
      setLinkSearchQuery(query);
      if (query.length < 2) {
        setLinkSearchResults([]);
        return;
      }
      try {
        const all = await api.getAffaires();
        const existing = new Set([
          affaire.id,
          ...linkedAffaires.children.map((c) => c.id),
          ...linkedAffaires.parents.map((p) => p.id),
        ]);
        const q = query.toLowerCase();
        setLinkSearchResults(
          (Array.isArray(all) ? all : [])
            .filter(
              (a) =>
                !existing.has(a.id) &&
                ((a.numeroAffaire || '').toLowerCase().includes(q) ||
                  (a.client || '').toLowerCase().includes(q) ||
                  (a.titre || a.eventName || '').toLowerCase().includes(q)),
            )
            .slice(0, 8),
        );
      } catch {
        setLinkSearchResults([]);
      }
    },
    [affaire.id, linkedAffaires],
  );

  const handleAddLink = useCallback(
    async (childAffaireId) => {
      try {
        await api.createAffaireLink(affaire.id, childAffaireId);
        setShowLinkSearch(false);
        setLinkSearchQuery('');
        setLinkSearchResults([]);
        loadLinkedAffaires();
        showFeedback({ type: 'success', message: 'Affaire liée avec succès' });
      } catch (err) {
        showFeedback({ type: 'error', message: err.message || 'Erreur de liaison' }, 4000);
      }
    },
    [affaire.id, loadLinkedAffaires, showFeedback],
  );

  const handleRemoveLink = useCallback(
    (linkId) => {
      confirm({
        title: 'Supprimer le lien',
        message: 'Supprimer ce lien entre affaires ?',
        variant: 'danger',
        confirmLabel: 'Supprimer',
        onConfirm: async () => {
          try {
            await api.deleteAffaireLink(affaire.id, linkId);
            loadLinkedAffaires();
            showFeedback({ type: 'success', message: 'Lien supprimé' });
          } catch (err) {
            showFeedback({ type: 'error', message: err.message || 'Erreur' }, 4000);
          }
        },
      });
    },
    [affaire.id, loadLinkedAffaires, showFeedback, confirm],
  );

  const allLinkedAffaires = useMemo(
    () => [
      ...linkedAffaires.parents.map((p) => ({ ...p, relation: 'parent' })),
      ...linkedAffaires.children.map((c) => ({ ...c, relation: 'child' })),
    ],
    [linkedAffaires],
  );

  // ═══ Tâches de planification liées à l'affaire ═══
  const [affaireTasks, setAffaireTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);

  // État des étapes — initialisé à partir des tâches existantes
  const [taskSteps, setTaskSteps] = useState(() => {
    const init = {};
    TASK_STEPS.forEach((s) => {
      init[s.key] = {
        enabled: false,
        date: '',
        time: '',
        endTime: '',
        period: '',
        notes: '',
        taskId: null,
        status: STATUS.PENDING,
      };
    });
    return init;
  });

  const loadAffaireTasks = useCallback(async () => {
    if (!affaire.numeroAffaire) {
      setAffaireTasks([]);
      return;
    }
    setIsLoadingTasks(true);
    try {
      const tasks = await api.getTasks({ affaire_num: affaire.numeroAffaire });
      const list = Array.isArray(tasks) ? tasks : [];
      setAffaireTasks(list);
      // Synchroniser les toggles avec les tâches existantes
      const updated = {};
      TASK_STEPS.forEach((step) => {
        const existing = list.find((t) =>
          (t.title || '').toLowerCase().includes(step.label.toLowerCase()),
        );
        updated[step.key] = existing
          ? {
              enabled: true,
              date: existing.date || '',
              time: existing.time || '',
              endTime: existing.end_time || '',
              period: existing.period || '',
              notes: existing.notes || '',
              taskId: existing.id,
              status: existing.status || 'pending',
            }
          : {
              enabled: false,
              date: affaire.dateDebut || '',
              time: '',
              endTime: '',
              period: step.key === 'preparation' || step.key === 'chargement' ? 'AM' : 'PM',
              notes: '',
              taskId: null,
              status: STATUS.PENDING,
            };
      });
      setTaskSteps(updated);
    } catch {
      setAffaireTasks([]);
    }
    setIsLoadingTasks(false);
  }, [affaire.numeroAffaire, affaire.dateDebut]);

  useEffect(() => {
    loadAffaireTasks();
  }, [loadAffaireTasks]);

  const toggleTaskStep = useCallback((key, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setTaskSteps((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  }, []);

  const updateTaskStep = (key, field, value) => {
    setTaskSteps((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const getSectionForStep = useCallback(
    (stepKey) => {
      if (stepKey === 'preparation') {
        return AFFAIRE_TYPE_SECTIONS[affaire.type] || 'prep_locations';
      }
      return TASK_STEPS.find((s) => s.key === stepKey)?.defaultSection || 'manual';
    },
    [affaire.type],
  );

  // Sauvegarder toutes les modifications d'étapes
  const handleSaveTaskSteps = useCallback(async () => {
    setSavingTasks(true);
    try {
      const eventName =
        affaire.eventName || affaire.event_name || affaire.titre || affaire.numeroAffaire;
      const toCreate = [];
      const toUpdate = [];
      const toDelete = [];

      for (const step of TASK_STEPS) {
        const s = taskSteps[step.key];
        if (!s) continue;
        if (s.enabled && !s.taskId) {
          // Nouvelle étape activée → créer
          toCreate.push({
            date: s.date,
            period: s.period || null,
            time: s.time || null,
            end_time: s.endTime || null,
            section: getSectionForStep(step.key),
            title: `${step.emoji} ${step.label}`,
            notes: s.notes || '',
            source_type: 'affaire',
            source_id: affaire.id ? String(affaire.id) : null,
            affaire_num: affaire.numeroAffaire,
            google_event_title: eventName,
            status: s.status || 'pending',
          });
        } else if (s.enabled && s.taskId) {
          // Étape existante modifiée → mettre à jour
          toUpdate.push({
            id: s.taskId,
            date: s.date,
            period: s.period || null,
            time: s.time || null,
            end_time: s.endTime || null,
            section: getSectionForStep(step.key),
            title: `${step.emoji} ${step.label}`,
            google_event_title: eventName,
            notes: s.notes || '',
            status: s.status || 'pending',
          });
        } else if (!s.enabled && s.taskId) {
          // Étape désactivée qui existait → supprimer
          toDelete.push(s.taskId);
        }
      }

      // Exécuter les opérations
      if (toCreate.length > 0) await api.createTasksBatch(toCreate);
      for (const upd of toUpdate) await api.updateTask(upd.id, upd);
      for (const id of toDelete) await api.deleteTask(id);

      const total = toCreate.length + toUpdate.length + toDelete.length;
      if (total > 0) {
        refreshBus.publish('planning');
        showFeedback({
          type: 'success',
          message: `Planification mise à jour (${toCreate.length} créée${toCreate.length > 1 ? 's' : ''}, ${toUpdate.length} modifiée${toUpdate.length > 1 ? 's' : ''}, ${toDelete.length} supprimée${toDelete.length > 1 ? 's' : ''})`,
        });
        loadAffaireTasks();
        if (onDataChanged) onDataChanged();
      }
    } catch (err) {
      console.error('Erreur sauvegarde tâches:', err);
      showFeedback({ type: 'error', message: 'Erreur: ' + err.message }, 4000);
    } finally {
      setSavingTasks(false);
    }
  }, [taskSteps, affaire, getSectionForStep, showFeedback, loadAffaireTasks, onDataChanged]);

  // Nombre d'étapes activées
  const visibleSteps = useMemo(() => getVisibleSteps(affaire.type), [affaire.type]);
  const enabledStepCount = useMemo(
    () => visibleSteps.filter((s) => taskSteps[s.key]?.enabled).length,
    [taskSteps, visibleSteps],
  );
  // Vérifier si des changements non sauvegardés existent
  const hasTaskChanges = useMemo(() => {
    for (const step of visibleSteps) {
      const s = taskSteps[step.key];
      if (!s) continue;
      const existingTask = affaireTasks.find((t) => t.id === s.taskId);
      if (s.enabled && !s.taskId) return true; // nouvelle étape activée
      if (!s.enabled && s.taskId) return true; // étape existante désactivée
      if (s.enabled && existingTask) {
        if (s.date !== (existingTask.date || '')) return true;
        if (s.time !== (existingTask.time || '')) return true;
        if (s.endTime !== (existingTask.end_time || '')) return true;
        if (s.period !== (existingTask.period || '')) return true;
        if (s.notes !== (existingTask.notes || '')) return true;
      }
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSteps, affaireTasks]);

  // ═══ Articles BL (Vente uniquement : tous items des BL Vente + section VENTE/VTE des BP Location/Prestation) ═══
  const [blArticles, setBlArticles] = useState([]);
  const showArticles = true;
  useEffect(() => {
    if (!affaire.numeroAffaire || !showArticles) {
      setBlArticles([]);
      return;
    }
    const loadArticles = async () => {
      try {
        const allItems = [];
        const seen = new Set();
        for (const bl of linkedBLImports) {
          const dt = bl.doc_type || bl.docType || '';
          const at = bl.affaire_type || bl.affaireType || '';
          const isVenteBL = dt === 'bl_vente' || at === 'Vente';
          let pd = bl.parsedData || bl.parsed_data;
          if (typeof pd === 'string') {
            try {
              pd = JSON.parse(pd);
            } catch {
              continue;
            }
          }
          if (pd?.items && Array.isArray(pd.items)) {
            for (const item of pd.items) {
              // Pour les BP Location/Prestation, ne garder que les items de section VENTE/VTE
              if (!isVenteBL) {
                const sec = (item.section || '').toUpperCase();
                if (sec !== 'VENTE' && sec !== 'VTE') continue;
              }
              const ref = item.code || item.reference || '';
              const key = `${ref}|${item.description || ''}|${item.quantity || ''}`;
              if (!seen.has(key)) {
                seen.add(key);
                // Enrichir le fournisseur depuis la description (marque avant ou après •)
                let fournisseur = item.fournisseur || null;
                if (!fournisseur && item.description) {
                  const before = item.description.match(
                    /^([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9\s&'./-]{0,30}?)\s*[•·]/,
                  );
                  if (before) {
                    fournisseur = before[1].trim();
                  } else {
                    const after = item.description.match(
                      /[•·]\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9\s&'./-]{1,30})\s*$/,
                    );
                    if (after) fournisseur = after[1].trim();
                  }
                }
                allItems.push({ ...item, code: ref, fournisseur, blFilename: bl.filename });
              }
            }
          }
        }
        setBlArticles(allItems);
      } catch {
        setBlArticles([]);
      }
    };
    loadArticles();
  }, [affaire.numeroAffaire, showArticles, linkedBLImports]);

  // ═══ Générer commandes depuis articles BL ═══
  const _handleGenerateOrders = () => {
    if (blArticles.length === 0 || generatingOrders) return;
    const fournisseurs = [...new Set(blArticles.map((a) => a.fournisseur).filter(Boolean))];
    if (fournisseurs.length === 0) {
      showFeedback('⚠ Aucun fournisseur identifié dans les articles');
      return;
    }
    confirm({
      title: 'Générer les commandes',
      message: `Générer ${fournisseurs.length} commande${fournisseurs.length > 1 ? 's' : ''} (${fournisseurs.join(', ')}) pour ${blArticles.length} article${blArticles.length > 1 ? 's' : ''} ?`,
      variant: 'confirm',
      confirmLabel: 'Générer',
      onConfirm: async () => {
        setGeneratingOrders(true);
        try {
          const result = await api.generateOrdersFromBL({
            affaire_id: affaire.numeroAffaire,
            affaire_reference: affaire.reference || affaire.numeroAffaire,
            items: blArticles,
          });
          showFeedback(
            `✅ ${result.message} — ${result.orders.map((o) => o.reference).join(', ')}`,
            5000,
          );
          if (onDataChanged) onDataChanged();
        } catch (err) {
          showFeedback(`❌ Erreur : ${err.message || 'Erreur serveur'}`);
        } finally {
          setGeneratingOrders(false);
        }
      },
    });
  };

  // ═══ Suppression d'un BL/BP importé ═══
  const handleDeleteBL = (bl) => {
    const docLabel = affaire.type === 'Location' || affaire.type === 'Prestation' ? 'BP' : 'BL';
    confirm({
      title: `Supprimer le ${docLabel}`,
      message: `Supprimer le ${docLabel} "${bl.filename}" ? Cette action est irréversible.`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteBLImport(bl.id);
          setLinkedBLImports((prev) => prev.filter((b) => b.id !== bl.id));
          showFeedback(`✅ ${docLabel} supprimé`);
          if (onDataChanged) onDataChanged();
        } catch (err) {
          showFeedback(`❌ Erreur : ${err.message || 'Erreur serveur'}`);
        }
      },
    });
  };

  // ═══ Articles BP (Location / Prestation) — liaison matériel ═══
  const [bpItems, setBpItems] = useState({ items: [], total: 0, matched: 0, unmatched: 0 });
  const showBPArticles = affaire.type === 'Location' || affaire.type === 'Prestation';
  useEffect(() => {
    if (!affaire.numeroAffaire || !showBPArticles) {
      setBpItems({ items: [], total: 0, matched: 0, unmatched: 0 });
      return;
    }
    const loadBPItems = async () => {
      try {
        const data = await api.getBPItems({ affaire_id: affaire.numeroAffaire });
        setBpItems(data || { items: [], total: 0, matched: 0, unmatched: 0 });
      } catch {
        setBpItems({ items: [], total: 0, matched: 0, unmatched: 0 });
      }
    };
    loadBPItems();
  }, [affaire.numeroAffaire, showBPArticles, linkedBLImports]);

  // Séparer les items BP en Matériel et Articles (Vente)
  const bpMaterielItems = useMemo(
    () => (bpItems.items || []).filter((i) => i.item_type !== 'article'),
    [bpItems.items],
  );
  const bpArticleItems = useMemo(
    () => (bpItems.items || []).filter((i) => i.item_type === 'article'),
    [bpItems.items],
  );

  // Regrouper le matériel BP par section
  const bpItemsBySection = useMemo(() => {
    const sections = {};
    for (const item of bpMaterielItems) {
      const sec = item.section || 'Autre';
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push(item);
    }
    return sections;
  }, [bpMaterielItems]);

  // Regrouper les articles Vente BP par section
  const bpArticlesBySection = useMemo(() => {
    const sections = {};
    for (const item of bpArticleItems) {
      const sec = item.section || 'Vente';
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push(item);
    }
    return sections;
  }, [bpArticleItems]);

  // Pièces jointes locales
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  useEffect(() => {
    if (!affaire.numeroAffaire) {
      setAttachmentFiles([]);
      return;
    }
    const loadAttachments = async () => {
      try {
        const data = await api.getAttachments(affaire.numeroAffaire);
        setAttachmentFiles(data.files || []);
      } catch {
        setAttachmentFiles([]);
      }
    };
    loadAttachments();
  }, [affaire.numeroAffaire]);

  // Liens extraits de la description Google Calendar
  const descriptionLinks = useMemo(() => {
    return extractLinksFromText(affaire.description);
  }, [affaire.description]);

  // Calculer la durée
  const duration = useMemo(() => {
    if (!affaire.dateDebut) return null;
    const start = new Date(affaire.dateDebut + 'T00:00:00');
    const end = new Date((affaire.dateFin || affaire.dateDebut) + 'T23:59:59');
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return days;
  }, [affaire.dateDebut, affaire.dateFin]);

  return (
    <div className="affaire-detail-content">
      {/* ═══ Phase 9 : Workflow — Statut & Transitions ═══ */}
      <section className="detail-section workflow-section">
        <div className="workflow-status-row">
          <span
            className="workflow-status-badge"
            style={{ background: currentStatus.color, color: '#fff' }}
          >
            {currentStatus.emoji} {currentStatus.label}
          </span>
          {editable && availableTransitions.length > 0 && (
            <div className="workflow-transition-btns">
              {availableTransitions.map((t) => (
                <Button
                  key={t.value}
                  variant="ghost"
                  className="workflow-transition-btn"
                  style={{ borderColor: t.color, color: t.color }}
                  onClick={() => handleChangeStatus(t.value)}
                  disabled={statusLoading}
                >
                  {t.emoji} {t.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        {editable && affaire.id && (
          <div className="workflow-actions-row">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleApplyTemplate()}
              title="Générer les étapes depuis le template du type"
            >
              <ClipboardList size={14} /> Appliquer template
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
              <Clock size={14} /> {showHistory ? 'Masquer' : 'Historique'}
            </Button>
          </div>
        )}
        {showHistory && statusHistory.length > 0 && (
          <div className="workflow-history">
            {statusHistory.map((h) => {
              const from = AFFAIRE_STATUS_MAP[h.from_status];
              const to = AFFAIRE_STATUS_MAP[h.to_status];
              return (
                <div key={h.id} className="workflow-history-item">
                  <span className="wh-date">{fmtDate(h.changed_at)}</span>
                  {from && (
                    <span className="wh-badge" style={{ background: from.color, color: '#fff' }}>
                      {from.emoji} {from.label}
                    </span>
                  )}
                  <ArrowRight size={12} className="wh-arrow" />
                  {to && (
                    <span className="wh-badge" style={{ background: to.color, color: '#fff' }}>
                      {to.emoji} {to.label}
                    </span>
                  )}
                  {h.changed_by_name && <span className="wh-user">{h.changed_by_name}</span>}
                  {h.notes && <span className="wh-notes">{h.notes}</span>}
                </div>
              );
            })}
          </div>
        )}
        {showHistory && statusHistory.length === 0 && (
          <p className="wh-empty">Aucune transition enregistrée</p>
        )}
      </section>

      {/* ═══ Section 1 : Détails basiques ═══ */}
      <section className="detail-section">
        <h3 className="detail-section-title">
          <Briefcase size={15} /> Détails
        </h3>
        {isEditing && editForm && setEditForm ? (
          <div className="detail-grid edit-mode">
            <div className="detail-field full-width">
              <label>Nom</label>
              <Input
                type="text"
                value={editForm.nom}
                onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                className="edit-input"
                placeholder="Nom de l'affaire"
              />
            </div>
            <div className="detail-field">
              <label>N° Affaire</label>
              <Input
                type="text"
                value={editForm.numeroAffaire}
                onChange={(e) => setEditForm((f) => ({ ...f, numeroAffaire: e.target.value }))}
                className="edit-input"
              />
            </div>
            <div className="detail-field">
              <label>Type</label>
              <Select
                value={editForm.type}
                onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                className="edit-input"
              >
                {AFFAIRE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="detail-field u-relative" ref={clientDropdownRef}>
              <label>Client</label>
              <Input
                type="text"
                value={editForm.client}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditForm((f) => ({ ...f, client: val }));
                  searchClients(val);
                  setShowClientDropdown(true);
                }}
                onFocus={() => {
                  if (editForm.client?.length >= 2) {
                    searchClients(editForm.client);
                    setShowClientDropdown(true);
                  }
                }}
                className="edit-input"
                placeholder="Rechercher un client..."
                autoComplete="off"
              />
              {showClientDropdown && clientSuggestions.length > 0 && (
                <ul className="autocomplete-dropdown">
                  {clientSuggestions.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => {
                        setEditForm((f) => ({ ...f, client: c.name }));
                        setShowClientDropdown(false);
                        setClientSuggestions([]);
                      }}
                    >
                      <span className="ac-name">{c.name}</span>
                      {c.city && <span className="ac-detail">{c.city}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="detail-field u-relative" ref={contactDropdownRef}>
              <label>Interlocuteur</label>
              <Input
                type="text"
                value={editForm.interlocuteur}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditForm((f) => ({ ...f, interlocuteur: val }));
                  searchContacts(val);
                  setShowContactDropdown(true);
                }}
                onFocus={() => {
                  if (editForm.interlocuteur?.length >= 2) {
                    searchContacts(editForm.interlocuteur);
                    setShowContactDropdown(true);
                  }
                }}
                className="edit-input"
                placeholder="Rechercher un contact..."
                autoComplete="off"
              />
              {showContactDropdown && contactSuggestions.length > 0 && (
                <ul className="autocomplete-dropdown">
                  {contactSuggestions.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => {
                        const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ');
                        setEditForm((f) => ({
                          ...f,
                          interlocuteur: fullName,
                          tel: f.tel || c.phone || '',
                        }));
                        setShowContactDropdown(false);
                        setContactSuggestions([]);
                      }}
                    >
                      <span className="ac-name">
                        {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                      </span>
                      {c.client_name && <span className="ac-detail">{c.client_name}</span>}
                      {c.job_title && <span className="ac-detail">— {c.job_title}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="detail-field">
              <label>
                <Phone size={12} /> Téléphone
              </label>
              <Input
                type="text"
                value={editForm.tel}
                onChange={(e) => setEditForm((f) => ({ ...f, tel: e.target.value }))}
                className="edit-input"
              />
            </div>
            <div className="detail-field">
              <label>Devis</label>
              <Input
                type="text"
                value={editForm.devis}
                onChange={(e) => setEditForm((f) => ({ ...f, devis: e.target.value }))}
                className="edit-input"
              />
            </div>
            <div className="detail-field">
              <label>
                <Calendar size={12} /> Date début
              </label>
              <input
                type="date"
                value={editForm.dateDebut}
                onChange={(e) => setEditForm((f) => ({ ...f, dateDebut: e.target.value }))}
                className="edit-input"
              />
            </div>
            <div className="detail-field">
              <label>
                <Calendar size={12} /> Date fin
              </label>
              <input
                type="date"
                value={editForm.dateFin}
                onChange={(e) => setEditForm((f) => ({ ...f, dateFin: e.target.value }))}
                className="edit-input"
              />
            </div>
            <div className="detail-field full-width">
              <label>
                <MapPin size={12} /> Lieu / Adresse
              </label>
              <AddressAutocomplete
                value={editForm.adresseLivraison}
                onChange={(val) => setEditForm((f) => ({ ...f, adresseLivraison: val }))}
                className="edit-input"
                placeholder="Saisir une adresse..."
              />
            </div>
            <div className="detail-field full-width">
              <label>
                <FileText size={12} /> Titre / Événement
              </label>
              <Input
                type="text"
                value={editForm.titre}
                onChange={(e) => setEditForm((f) => ({ ...f, titre: e.target.value }))}
                className="edit-input"
              />
            </div>
            <div className="detail-field full-width">
              <label>Description</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className="edit-input edit-textarea"
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="detail-grid">
            {affaire.nom && (
              <div className="detail-field full-width">
                <label>Nom</label>
                <span className="detail-nom">{affaire.nom}</span>
              </div>
            )}
            <div className="detail-field">
              <label>N° Affaire</label>
              <span className="detail-numero">{affaire.numeroAffaire || '—'}</span>
            </div>
            <div className="detail-field">
              <label>Type</label>
              <span className="affaire-type-badge" style={{ background: typeInfo.color }}>
                {typeInfo.label}
              </span>
            </div>
            <div className="detail-field">
              <label>Client</label>
              <span>{capitalizeText(affaire.client) || '—'}</span>
            </div>
            <div className="detail-field">
              <label>Interlocuteur</label>
              <span>{capitalizeText(affaire.interlocuteur) || '—'}</span>
            </div>
            {affaire.tel && (
              <div className="detail-field">
                <label>
                  <Phone size={12} /> Téléphone
                </label>
                <span>{formatPhoneDisplay(affaire.tel)}</span>
              </div>
            )}
            <div className="detail-field full-width">
              <label>
                <Calendar size={12} /> Période
              </label>
              <span>
                {fmtDate(affaire.dateDebut)}
                {affaire.dateFin && affaire.dateFin !== affaire.dateDebut && (
                  <> → {fmtDate(affaire.dateFin)}</>
                )}
                {duration && (
                  <span className="detail-duration">
                    ({duration} jour{duration > 1 ? 's' : ''})
                  </span>
                )}
              </span>
            </div>
            <div className="detail-field full-width">
              <label>
                <MapPin size={12} /> Lieu
              </label>
              <span>{capitalizeText(affaire.adresseLivraison) || '—'}</span>
            </div>
            {(affaire.eventName || affaire.titre) && (
              <div className="detail-field full-width">
                <label>
                  <FileText size={12} /> Titre / Événement
                </label>
                <span>{capitalizeText(affaire.eventName || affaire.titre)}</span>
              </div>
            )}
            {affaire.description && (
              <div className="detail-field full-width">
                <label>Description</label>
                <p className="detail-description">{affaire.description}</p>
              </div>
            )}
            {affaire.devis && (
              <div className="detail-field">
                <label>Devis</label>
                <span>{affaire.devis}</span>
              </div>
            )}
            {affaire.source && (
              <div className="detail-field">
                <label>Source</label>
                <span className="detail-source-tag">
                  {affaire.source === 'db'
                    ? 'Base de données'
                    : affaire.source === 'auto'
                      ? 'Auto-détecté'
                      : 'Google Calendar'}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ═══ Section 1b : Événements Google Calendar liés ═══ */}
      {googleEventIds && googleEventIds.length > 0 && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <Calendar size={15} /> Événements Google
            <span className="section-count">{googleEvents.length || googleEventIds.length}</span>
          </h3>
          {isLoadingEvents ? (
            <p className="detail-empty">Chargement des événements...</p>
          ) : googleEvents.length === 0 ? (
            <p className="detail-empty">Aucun événement chargé (vérifiez la connexion Google)</p>
          ) : (
            <div className="detail-list">
              {googleEvents.map((ev) => (
                <div
                  role="button"
                  tabIndex={0}
                  key={ev.id}
                  className="detail-list-item event-item clickable"
                  onClick={() => setViewedEvent(ev)}
                  title="Cliquer pour voir les détails de l'événement"
                >
                  <div className="event-summary">
                    <Calendar size={13} />
                    <strong>{ev.summary || 'Événement'}</strong>
                  </div>
                  <div className="event-dates">
                    <Clock size={12} />
                    {ev.start?.date
                      ? fmtDate(ev.start.date)
                      : ev.start?.dateTime
                        ? fmtDate(ev.start.dateTime.split('T')[0])
                        : '—'}
                    {(ev.end?.date || ev.end?.dateTime) && (
                      <>
                        {' '}
                        →{' '}
                        {ev.end?.date
                          ? fmtDate(ev.end.date)
                          : fmtDate(ev.end.dateTime.split('T')[0])}
                      </>
                    )}
                  </div>
                  {ev.location && (
                    <div className="event-location">
                      <MapPin size={12} /> {ev.location}
                    </div>
                  )}
                  {ev.description && (
                    <div className="event-description">
                      {ev.description.slice(0, 100)}
                      {ev.description.length > 100 ? '…' : ''}
                    </div>
                  )}
                  <ChevronRight size={14} className="resa-chevron" />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ Section : BL / BP importés ═══ */}
      {linkedBLImports.length > 0 && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <FileText size={15} /> BL / BP importés
            <span className="section-count">{linkedBLImports.length}</span>
          </h3>
          <div className="bl-imports-list">
            {linkedBLImports.map((bl) => {
              let pd = bl.parsedData || bl.parsed_data;
              if (typeof pd === 'string') {
                try {
                  pd = JSON.parse(pd);
                } catch {
                  pd = null;
                }
              }
              const sectionsCount = pd?.sections?.length || 0;
              const itemsCount = pd?.items?.length || 0;
              const docLabel =
                pd?.docTypeLabel ||
                (bl.affaireType === 'Vente' ? 'BL Vente' : 'Bon de Préparation');
              return (
                <div
                  key={bl.id}
                  className="bl-import-card"
                  style={{ cursor: bl.filePath ? 'pointer' : 'default' }}
                  onClick={
                    bl.filePath
                      ? async () => {
                          setAnnotatingBL(bl);
                          await annotate(affaire.numeroAffaire, bl.id);
                        }
                      : undefined
                  }
                  title={bl.filePath ? 'Cliquer pour voir le PDF annoté' : undefined}
                >
                  <div className="bl-import-icon">
                    <FileText size={16} />
                  </div>
                  <div className="bl-import-info">
                    <div className="bl-import-filename">{bl.filename || 'Import'}</div>
                    <div className="bl-import-meta">
                      <span className="bl-import-type-badge">{docLabel}</span>
                      {sectionsCount > 0 && (
                        <span>
                          {sectionsCount} section{sectionsCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {itemsCount > 0 && (
                        <span>
                          {itemsCount} article{itemsCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {bl.createdAt && (
                        <span>
                          <Clock size={11} /> {formatDateSimple(bl.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`bl-import-status ${bl.status || 'pending'}`}>
                    {bl.status === STATUS.VALIDATED
                      ? 'Validé'
                      : bl.status === STATUS.REJECTED
                        ? 'Rejeté'
                        : 'En attente'}
                  </div>
                  {editable && (
                    <Tooltip content="Supprimer ce BL/BP" position="bottom">
                      <Button
                        variant="ghost"
                        className="bl-import-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBL(bl);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ Feedback action ═══ */}
      {actionFeedback && (
        <div className={`action-feedback ${actionFeedback.type}`}>
          {actionFeedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {actionFeedback.message}
        </div>
      )}

      {/* ═══ Section 2 : Réservations liées ═══ */}
      <section className="detail-section">
        <h3 className="detail-section-title">
          <Truck size={15} /> Réservations liées
          <span className="section-count">{linkedReservations.length}</span>
          {editable && (
            <Tooltip content="Nouvelle réservation" position="bottom">
              <Button
                variant="ghost"
                className="section-action-btn"
                onClick={handleOpenReservation}
                disabled={isLoadingAction}
              >
                <Plus size={13} /> Réservation
              </Button>
            </Tooltip>
          )}
        </h3>
        {linkedReservations.length === 0 ? (
          <p className="detail-empty">Aucune réservation liée à cette affaire</p>
        ) : (
          <div className="detail-list">
            {linkedReservations.map((r) => (
              <div
                role="button"
                tabIndex={0}
                key={r.id}
                className="detail-list-item resa-item clickable"
                onClick={() => handleViewReservation(r)}
                title="Cliquer pour ouvrir la réservation"
              >
                <div className="resa-vehicle">
                  <Truck size={13} />
                  <strong
                    className={onNavigateToEntity ? 'entity-link' : ''}
                    onClick={(e) => {
                      if (onNavigateToEntity && r.vehicleId) {
                        e.stopPropagation();
                        onNavigateToEntity('vehicle', { id: r.vehicleId });
                      }
                    }}
                    title={onNavigateToEntity ? 'Voir le véhicule dans le module Parc' : undefined}
                  >
                    {r.vehicleName || 'Véhicule'}
                    {onNavigateToEntity && r.vehicleId && (
                      <ExternalLink size={10} className="entity-link-icon" />
                    )}
                  </strong>
                  {r.immatriculation && <span className="resa-immat">{r.immatriculation}</span>}
                </div>
                <div className="resa-dates">
                  <Clock size={12} />
                  {fmtDate(r.startDate)}{' '}
                  {r.startPeriod === 'morning'
                    ? 'matin'
                    : r.startPeriod === 'afternoon'
                      ? 'après-midi'
                      : r.startPeriod || ''}
                  {r.endDate && r.endDate !== r.startDate && (
                    <>
                      {' '}
                      → {fmtDate(r.endDate)}{' '}
                      {r.endPeriod === 'morning'
                        ? 'matin'
                        : r.endPeriod === 'afternoon'
                          ? 'après-midi'
                          : r.endPeriod || ''}
                    </>
                  )}
                </div>
                {r.driverName && (
                  <div className="resa-driver">
                    <User size={12} /> {r.driverName}
                  </div>
                )}
                {r.locationName && (
                  <div className="resa-location">
                    <MapPin size={12} /> {r.locationName}
                  </div>
                )}
                {r.comment && <div className="resa-comment">{r.comment}</div>}
                <span className={`resa-status status-${r.status || 'confirmed'}`}>
                  {r.status === STATUS.CONFIRMED
                    ? 'Confirmée'
                    : r.status === STATUS.PENDING
                      ? 'En attente'
                      : r.status || 'Confirmée'}
                </span>
                <ChevronRight size={14} className="resa-chevron" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ Section 2a : Affaires liées (Tournée) ═══ */}
      {(affaire.type === 'Tournée' || allLinkedAffaires.length > 0) && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <LinkIcon size={15} /> Affaires liées
            <span className="section-count">{allLinkedAffaires.length}</span>
            {editable && (
              <Tooltip content="Lier une affaire" position="bottom">
                <Button
                  variant="ghost"
                  className="section-action-btn"
                  onClick={() => setShowLinkSearch(!showLinkSearch)}
                >
                  <Plus size={13} /> Lier
                </Button>
              </Tooltip>
            )}
          </h3>
          {showLinkSearch && (
            <div className="link-search-wrapper">
              <Input
                type="text"
                className="link-search-input"
                placeholder="Rechercher une affaire à lier…"
                value={linkSearchQuery}
                onChange={(e) => handleLinkSearch(e.target.value)}
                autoFocus
              />
              {linkSearchResults.length > 0 && (
                <div className="link-search-results">
                  {linkSearchResults.map((a) => (
                    <div
                      key={a.id}
                      className="link-search-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleAddLink(a.id)}
                    >
                      <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                      <span className="link-search-client">{a.client || '—'}</span>
                      <span className="link-search-title">{a.titre || a.eventName || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {isLoadingLinks ? (
            <p className="detail-empty">Chargement…</p>
          ) : allLinkedAffaires.length === 0 ? (
            <p className="detail-empty">
              Aucune affaire liée — utilisez le bouton "Lier" pour associer des affaires
            </p>
          ) : (
            <div className="detail-list">
              {allLinkedAffaires.map((linked) => (
                <div
                  key={linked.link_id || linked.id}
                  className="detail-list-item linked-affaire-item"
                >
                  <div className="linked-affaire-main">
                    <AffaireBadge
                      numero={linked.numeroAffaire}
                      type={linked.type}
                      size="sm"
                      onNavigate={
                        onNavigateToEntity
                          ? () => onNavigateToEntity('affaire', { numero: linked.numeroAffaire })
                          : undefined
                      }
                    />
                    <div className="linked-affaire-info">
                      <span className="linked-affaire-client">{linked.client || '—'}</span>
                      {(linked.titre || linked.eventName) && (
                        <span className="linked-affaire-title">
                          {linked.titre || linked.eventName}
                        </span>
                      )}
                    </div>
                    <span className="linked-affaire-relation">
                      {linked.relation === 'parent' ? '↑ Parent' : '↓ Enfant'}
                    </span>
                  </div>
                  {editable && (
                    <Tooltip content="Supprimer le lien" position="bottom">
                      <Button
                        variant="ghost"
                        className="linked-affaire-remove"
                        onClick={() => handleRemoveLink(linked.link_id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ Section 2b : Planification opérationnelle (rétractable) ═══ */}
      <section className="detail-section">
        <h3
          className="detail-section-title collapsible u-cursor-pointer u-select-none"
          onClick={() => setPlanningOpen((v) => !v)}
        >
          <ClipboardList size={15} /> Planification
          <span className="section-count">
            {enabledStepCount}/{visibleSteps.length}
          </span>
          <ChevronDown size={16} className={`section-toggle-icon${planningOpen ? ' open' : ''}`} />
        </h3>

        {planningOpen &&
          (isLoadingTasks ? (
            <p className="detail-empty">Chargement...</p>
          ) : (
            <div className="task-steps-list">
              {visibleSteps.map((step) => {
                const s = taskSteps[step.key];
                if (!s) return null;
                const Icon = step.icon;
                const statusInfo = TASK_STATUS_MAP[s.status] || TASK_STATUS_MAP.pending;
                return (
                  <div
                    key={step.key}
                    className={`task-step-item ${s.enabled ? 'enabled' : ''}`}
                    style={s.enabled ? { borderLeftColor: step.color } : {}}
                  >
                    <div
                      className="task-step-header u-cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => toggleTaskStep(step.key, e)}
                    >
                      <div
                        className="task-step-check"
                        style={s.enabled ? { background: step.color, borderColor: step.color } : {}}
                      >
                        {s.enabled && <Check size={10} color="#fff" />}
                      </div>
                      <Icon size={14} style={{ color: step.color }} />
                      <span className="task-step-label">
                        {step.emoji} {step.label}
                      </span>
                      {s.enabled && s.taskId && (
                        <span
                          className="task-step-status"
                          style={{ background: statusInfo.bg, color: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </span>
                      )}
                      {s.enabled && s.date && (
                        <span className="task-step-date">
                          {fmtDate(s.date)}
                          {s.period ? ` · ${s.period === 'AM' ? 'Matin' : 'Après-midi'}` : ''}
                        </span>
                      )}
                    </div>
                    {s.enabled && (
                      <div className="task-step-fields" onClick={(e) => e.stopPropagation()}>
                        <div className="tsf-row">
                          <label>Date</label>
                          <input
                            type="date"
                            value={s.date}
                            onChange={(e) => updateTaskStep(step.key, 'date', e.target.value)}
                          />
                          <Tooltip content="Aujourd'hui" position="bottom">
                            <Button
                              variant="ghost"
                              type="button"
                              className="tsf-today-btn"
                              onClick={() =>
                                updateTaskStep(step.key, 'date', format(new Date(), 'yyyy-MM-dd'))
                              }
                            >
                              Auj.
                            </Button>
                          </Tooltip>
                          <label>Période</label>
                          <Select
                            value={s.period}
                            onChange={(e) => updateTaskStep(step.key, 'period', e.target.value)}
                          >
                            <option value="AM">Matin</option>
                            <option value="PM">Après-midi</option>
                          </Select>
                        </div>
                        <div className="tsf-row">
                          <label>Début</label>
                          <input
                            type="time"
                            value={s.time}
                            onChange={(e) => updateTaskStep(step.key, 'time', e.target.value)}
                          />
                          <label>Fin</label>
                          <input
                            type="time"
                            value={s.endTime}
                            onChange={(e) => updateTaskStep(step.key, 'endTime', e.target.value)}
                          />
                        </div>
                        <div className="tsf-row">
                          <label>Notes</label>
                          <Input
                            type="text"
                            placeholder="Notes..."
                            value={s.notes}
                            onChange={(e) => updateTaskStep(step.key, 'notes', e.target.value)}
                            className="tsf-notes"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bouton Enregistrer si des changements existent */}
              {hasTaskChanges && (
                <div className="task-form-actions">
                  <Button variant="ghost" className="section-action-btn" onClick={loadAffaireTasks}>
                    Annuler
                  </Button>
                  <Button
                    variant="ghost"
                    className="section-action-btn primary"
                    onClick={handleSaveTaskSteps}
                    disabled={savingTasks}
                  >
                    {savingTasks ? <Loader size={13} className="spin" /> : <Save size={13} />}
                    Enregistrer la planification
                  </Button>
                </div>
              )}
            </div>
          ))}
      </section>

      {/* ═══ Section 3 : Personnel affecté ═══ */}
      <section className="detail-section">
        <h3 className="detail-section-title">
          <Users size={15} /> Personnel affecté
          <span className="section-count">{assignedPersonnel.length}</span>
          {editable && (
            <Tooltip content="Affecter du personnel" position="bottom">
              <Button
                variant="ghost"
                className="section-action-btn personnel-btn"
                onClick={async () => {
                  await loadActionData('personnel');
                  setShowPersonnelForm(true);
                }}
                disabled={isLoadingAction}
              >
                <UserPlus size={13} /> Affecter
              </Button>
            </Tooltip>
          )}
        </h3>
        {/* Mini-formulaire d'affectation */}
        {showPersonnelForm && (
          <div className="inline-action-form">
            <div className="inline-form-row">
              <Select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="inline-select"
              >
                <option value="">— Choisir une personne —</option>
                {sortedActionPersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getFavoriteDisplayName(p)}
                    {p.type ? ` (${p.type})` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div className="inline-form-row">
              <Input
                type="text"
                placeholder="Titre de la mission (optionnel)"
                value={missionTitle}
                onChange={(e) => setMissionTitle(e.target.value)}
                className="inline-input"
              />
            </div>
            <div className="inline-form-actions">
              <Button
                variant="ghost"
                className="inline-btn confirm"
                onClick={handleAssignPersonnel}
                disabled={!selectedPersonId}
              >
                <Check size={13} /> Affecter
              </Button>
              <Button
                variant="ghost"
                className="inline-btn cancel"
                onClick={() => setShowPersonnelForm(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
        {assignedPersonnel.length === 0 ? (
          <p className="detail-empty">Aucun personnel affecté à cette affaire</p>
        ) : (
          <div className="detail-list">
            {assignedPersonnel.map((p) => (
              <div
                key={p.id}
                className={`detail-list-item person-item${onNavigateToEntity ? ' clickable' : ''}`}
                onClick={() => {
                  if (onNavigateToEntity) onNavigateToEntity('person', { id: p.id });
                }}
                title={onNavigateToEntity ? 'Voir dans le module Personnel' : undefined}
              >
                <div className="person-header-row">
                  <Avatar
                    name={`${p.firstName} ${p.lastName}`}
                    avatar={p.photo ? `/avatars/${p.photo}` : undefined}
                    size="sm"
                  />
                  <div className="person-identity">
                    <div className="person-name">
                      <strong>
                        {p.firstName} {p.lastName}
                      </strong>
                      {p.type && (
                        <span className={`person-type-tag type-${p.type}`}>
                          {p.type === 'permanent' ? 'Permanent' : 'Contractuel'}
                        </span>
                      )}
                      {p.type === 'contractuel' && p.contractType && (
                        <span className="person-type-tag contract-tag">{p.contractType}</span>
                      )}
                    </div>
                    {p.phone && (
                      <div className="person-contact-line">
                        <Phone size={11} /> {formatPhoneDisplay(p.phone)}
                      </div>
                    )}
                    {p.email && (
                      <div className="person-contact-line">
                        <Mail size={11} /> {p.email}
                      </div>
                    )}
                  </div>
                  <span className={`person-status status-${p.status}`}>
                    {p.status === STATUS.CONFIRMED
                      ? 'Confirmé'
                      : p.status === 'option'
                        ? 'Option'
                        : p.status === STATUS.ACCEPTED
                          ? 'Accepté'
                          : p.status === 'proposed'
                            ? 'Proposé'
                            : p.status === 'declined'
                              ? 'Refusé'
                              : p.status || '—'}
                  </span>
                </div>
                {/* Postes habituels */}
                {p.positions.length > 0 && (
                  <div className="person-tags-row">
                    <Briefcase size={11} />
                    {p.positions.slice(0, 4).map((pos, i) => (
                      <span key={i} className="person-position-chip">
                        {pos}
                      </span>
                    ))}
                    {p.positions.length > 4 && (
                      <span className="person-more">+{p.positions.length - 4}</span>
                    )}
                  </div>
                )}
                {/* Compétences */}
                {p.skills.length > 0 && (
                  <div className="person-tags-row skills-row">
                    <AlertCircle size={11} />
                    {p.skills.slice(0, 4).map((sk, i) => (
                      <span key={i} className="person-skill-chip">
                        {sk}
                      </span>
                    ))}
                    {p.skills.length > 4 && (
                      <span className="person-more">+{p.skills.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ Section : Pièces et liens joints ═══ */}
      <section className="detail-section">
        <h3 className="detail-section-title">
          <Paperclip size={15} /> Pièces et liens joints
          {editable && (
            <Tooltip content="Importer un fichier" position="bottom">
              <Button
                variant="ghost"
                className="section-action-btn upload-btn"
                onClick={() => setShowUploadForm((v) => !v)}
              >
                <Upload size={13} /> Importer
              </Button>
            </Tooltip>
          )}
        </h3>
        {/* Zone d'upload */}
        {showUploadForm && (
          <div
            className={`upload-zone ${uploadDragging ? 'dragging' : ''} ${uploadProgress ? 'uploading' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setUploadDragging(true);
            }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setUploadDragging(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            {uploadProgress ? (
              <>
                <Spinner size="sm" /> Import en cours...
              </>
            ) : (
              <>
                <Upload size={20} />
                <span>Glissez des fichiers ici ou cliquez pour parcourir</span>
              </>
            )}
          </div>
        )}
        {(() => {
          // 1. Pièces jointes locales (dossier public/attachments/AFxxxxx)
          const hasLocalFiles = attachmentFiles.length > 0;

          // 2. Liens Drive depuis les réservations liées
          const driveLinks = [];
          for (const r of linkedReservations) {
            if (r.googleDriveLinks && r.googleDriveLinks.length > 0) {
              for (const link of r.googleDriveLinks) {
                driveLinks.push({ ...link, fromResa: r.vehicleName || r.id });
              }
            } else if (r.googleDriveLink && r.googleDriveLink.trim()) {
              driveLinks.push({
                url: r.googleDriveLink,
                label: 'Lien Drive',
                fromResa: r.vehicleName || r.id,
              });
            }
          }

          // 3. Liens extraits de la description Google Calendar
          const descLinks = descriptionLinks.filter((link) => {
            // Éviter les doublons avec les liens Drive des réservations
            return !driveLinks.some((dl) => dl.url === link.url);
          });

          const totalItems = attachmentFiles.length + driveLinks.length + descLinks.length;

          if (totalItems === 0) {
            return <p className="detail-empty">Aucune pièce jointe ou lien</p>;
          }

          return (
            <div className="detail-list">
              {/* Fichiers locaux */}
              {hasLocalFiles && (
                <>
                  <div className="detail-list-subheader">
                    <FolderOpen size={12} /> Fichiers ({attachmentFiles.length})
                  </div>
                  {attachmentFiles.map((file, i) => (
                    <a
                      key={`file-${i}`}
                      href={`${API_BASE_URL.replace('/api', '')}${file.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="detail-list-item link-item file-item"
                    >
                      <File size={13} />
                      <span className="link-name">{file.name}</span>
                      {file.size && <span className="link-source">{file.size}</span>}
                      <Download size={12} className="link-external-icon" />
                    </a>
                  ))}
                </>
              )}
              {/* Liens Drive des réservations */}
              {driveLinks.length > 0 && (
                <>
                  <div className="detail-list-subheader">
                    <LinkIcon size={12} /> Liens Drive ({driveLinks.length})
                  </div>
                  {driveLinks.map((link, i) => (
                    <a
                      key={`drive-${i}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="detail-list-item link-item"
                    >
                      <LinkIcon size={13} />
                      <span className="link-name">{link.label || link.url}</span>
                      {link.fromResa && <span className="link-source">via {link.fromResa}</span>}
                      <ExternalLink size={12} className="link-external-icon" />
                    </a>
                  ))}
                </>
              )}
              {/* Liens extraits de la description */}
              {descLinks.length > 0 && (
                <>
                  <div className="detail-list-subheader">
                    <FileText size={12} /> Liens (description)
                  </div>
                  {descLinks.map((link, i) => (
                    <a
                      key={`desc-${i}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`detail-list-item link-item${link.isDrive ? ' drive-link' : ''}`}
                    >
                      <LinkIcon size={13} />
                      <span className="link-name">{link.label}</span>
                      <ExternalLink size={12} className="link-external-icon" />
                    </a>
                  ))}
                </>
              )}
            </div>
          );
        })()}
      </section>

      {/* ═══ Section 5 : Articles ═══ */}
      {showArticles && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <Package size={15} /> Articles
            <span className="section-count">{blArticles.length}</span>
          </h3>
          {blArticles.length === 0 ? (
            <>
              <p className="detail-empty">
                Aucun article — importez un BL pour alimenter cette liste
              </p>
              {editable && linkedBLImports.length > 0 && (
                <Button
                  variant="ghost"
                  className="generate-orders-btn"
                  onClick={() => setShowOrdersModal(true)}
                >
                  <ShoppingCart size={14} />
                  Créer / Mettre à jour les commandes
                </Button>
              )}
            </>
          ) : (
            <div className="articles-table-wrapper">
              <Table className="articles-table">
                <thead>
                  <tr>
                    <th className="art-col-code">Réf.</th>
                    <th className="art-col-desc">Désignation</th>
                    <th className="art-col-qty">Qté</th>
                    <th className="art-col-fournisseur">Fournisseur</th>
                  </tr>
                </thead>
                <tbody>
                  {blArticles.map((item, i) => (
                    <tr
                      key={i}
                      className={
                        item.code === 'VTE' || item.code === 'LOC'
                          ? 'article-row highlight'
                          : 'article-row'
                      }
                    >
                      <td className="art-code">
                        <Hash size={11} />
                        <span>{item.code || '—'}</span>
                      </td>
                      <td className="art-desc">{item.description || '—'}</td>
                      <td className="art-qty">{item.quantity ?? '—'}</td>
                      <td className="art-fournisseur">{item.fournisseur || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="articles-summary">
                <span>
                  {blArticles.length} article{blArticles.length > 1 ? 's' : ''}
                </span>
                {(() => {
                  const fournisseurs = [
                    ...new Set(blArticles.map((a) => a.fournisseur).filter(Boolean)),
                  ];
                  if (fournisseurs.length === 0) return null;
                  return (
                    <span className="articles-fournisseurs">
                      {fournisseurs.length} fournisseur{fournisseurs.length > 1 ? 's' : ''} :{' '}
                      {fournisseurs.join(', ')}
                    </span>
                  );
                })()}
              </div>
              {/* Bouton générer/mettre à jour commandes */}
              {editable && linkedBLImports.length > 0 && (
                <Button
                  variant="ghost"
                  className="generate-orders-btn"
                  onClick={() => setShowOrdersModal(true)}
                >
                  <ShoppingCart size={14} />
                  Créer / Mettre à jour les commandes
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {/* ═══ Section 5b : Matériel BP (Location / Prestation) ═══ */}
      {showBPArticles && bpMaterielItems.length > 0 && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <Package size={15} /> Matériel BP
            <span className="section-count">{bpMaterielItems.length}</span>
            <span
              className="bp-match-badge"
              style={{
                marginLeft: 8,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: bpMaterielItems.every(
                  (i) => i.matchStatus === 'matched' || i.matchStatus === 'manual',
                )
                  ? 'var(--theme-success-bg-strong)'
                  : 'var(--btn-warning-bg)',
                color: bpMaterielItems.every(
                  (i) => i.matchStatus === 'matched' || i.matchStatus === 'manual',
                )
                  ? 'var(--theme-success-text-alt)'
                  : 'var(--theme-warning-text)',
              }}
            >
              {
                bpMaterielItems.filter(
                  (i) => i.matchStatus === 'matched' || i.matchStatus === 'manual',
                ).length
              }
              /{bpMaterielItems.length} liés au matériel
            </span>
          </h3>
          <div className="bp-items-wrapper">
            {Object.entries(bpItemsBySection).map(([section, items]) => (
              <div key={section} className="bp-section-group">
                <div
                  className="bp-section-title"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 10px',
                    background: 'var(--theme-bg-tertiary)',
                    borderRadius: 6,
                    marginBottom: 6,
                    color: 'var(--theme-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {section}{' '}
                  <span className="u-opacity-70" style={{ fontWeight: 400 }}>
                    ({items.length})
                  </span>
                </div>
                <Table className="articles-table">
                  <thead>
                    <tr>
                      <th className="art-col-code">Réf.</th>
                      <th className="art-col-desc">Désignation</th>
                      <th className="art-col-qty">Qté</th>
                      <th style={{ width: 100 }}>Matériel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="article-row">
                        <td className="art-code">
                          <Hash size={11} />
                          <span>{item.reference || '—'}</span>
                        </td>
                        <td className="art-desc">{item.description || '—'}</td>
                        <td className="art-qty">{item.quantity ?? '—'}</td>
                        <td>
                          {item.matchStatus === 'matched' || item.matchStatus === 'manual' ? (
                            <span
                              title={item.catalogName || item.catalogReference}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 11,
                                color: 'var(--theme-success-text-alt)',
                                fontWeight: 500,
                              }}
                            >
                              <LinkIcon size={11} /> {item.catalogReference || 'Lié'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: STATUS_COLORS.warningDark }}>
                              Non lié
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ))}
            <div className="articles-summary">
              <span>
                {bpMaterielItems.length} matériel{bpMaterielItems.length > 1 ? 's' : ''}
              </span>
              <span>
                {
                  bpMaterielItems.filter(
                    (i) => i.matchStatus === 'matched' || i.matchStatus === 'manual',
                  ).length
                }{' '}
                lié
                {bpMaterielItems.filter(
                  (i) => i.matchStatus === 'matched' || i.matchStatus === 'manual',
                ).length > 1
                  ? 's'
                  : ''}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Section 5c : Articles Vente BP ═══ */}
      {showBPArticles && bpArticleItems.length > 0 && (
        <section className="detail-section">
          <h3 className="detail-section-title">
            <ShoppingCart size={15} /> Articles Vente
            <span className="section-count">{bpArticleItems.length}</span>
            <span
              className="bp-match-badge"
              style={{
                marginLeft: 8,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: bpArticleItems.every((i) => i.supplierArticleId || i.stockItemId)
                  ? 'var(--theme-success-bg-strong)'
                  : 'var(--btn-warning-bg)',
                color: bpArticleItems.every((i) => i.supplierArticleId || i.stockItemId)
                  ? 'var(--theme-success-text-alt)'
                  : 'var(--theme-warning-text)',
              }}
            >
              {bpArticleItems.filter((i) => i.supplierArticleId || i.stockItemId).length}/
              {bpArticleItems.length} liés
            </span>
          </h3>
          <div className="bp-items-wrapper">
            {Object.entries(bpArticlesBySection).map(([section, items]) => (
              <div key={section} className="bp-section-group">
                <div
                  className="bp-section-title"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 10px',
                    background: 'var(--theme-bg-tertiary)',
                    borderRadius: 6,
                    marginBottom: 6,
                    color: 'var(--theme-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {section}{' '}
                  <span className="u-opacity-70" style={{ fontWeight: 400 }}>
                    ({items.length})
                  </span>
                </div>
                <Table className="articles-table">
                  <thead>
                    <tr>
                      <th className="art-col-code">Réf.</th>
                      <th className="art-col-desc">Désignation</th>
                      <th className="art-col-qty">Qté</th>
                      <th style={{ width: 130 }}>Liaison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="article-row">
                        <td className="art-code">
                          <Hash size={11} />
                          <span>{item.reference || '—'}</span>
                        </td>
                        <td className="art-desc">{item.description || '—'}</td>
                        <td className="art-qty">{item.quantity ?? '—'}</td>
                        <td>
                          {item.supplierArticleId ? (
                            <span
                              title={item.supplierArticleName}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 11,
                                color: 'var(--theme-success-text-alt)',
                                fontWeight: 500,
                              }}
                            >
                              <LinkIcon size={11} /> {item.supplierArticleRef || 'Catalogue'}
                            </span>
                          ) : item.stockItemId ? (
                            <span
                              title={item.stockItemName}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 11,
                                color: 'var(--theme-success-text-alt)',
                                fontWeight: 500,
                              }}
                            >
                              <LinkIcon size={11} /> {item.stockItemRef || 'Stock'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: STATUS_COLORS.warningDark }}>
                              Non lié
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ))}
            <div className="articles-summary">
              <span>
                {bpArticleItems.length} article{bpArticleItems.length > 1 ? 's' : ''} vente
              </span>
              <span>
                {bpArticleItems.filter((i) => i.supplierArticleId || i.stockItemId).length} lié
                {bpArticleItems.filter((i) => i.supplierArticleId || i.stockItemId).length > 1
                  ? 's'
                  : ''}
              </span>
            </div>
            {/* Bouton commandes — seulement pour articles vente */}
            {editable && linkedBLImports.length > 0 && (
              <Button
                variant="ghost"
                className="generate-orders-btn"
                onClick={() => setShowOrdersModal(true)}
              >
                <ShoppingCart size={14} />
                Créer / Mettre à jour les commandes
              </Button>
            )}
          </div>
        </section>
      )}

      {/* ═══ Modal de réservation (création) ═══ */}
      {showReservationModal && (
        <Suspense fallback={<div className="action-loading">Chargement...</div>}>
          <ReservationModal
            slot={{
              vehicleId: null,
              date: affaire.dateDebut || format(new Date(), 'yyyy-MM-dd'),
              period: 'morning',
              endDate: affaire.dateFin || affaire.dateDebut || format(new Date(), 'yyyy-MM-dd'),
              endPeriod: 'afternoon',
            }}
            reservation={null}
            vehicles={actionData.vehicles}
            clients={actionData.clients}
            drivers={actionData.drivers}
            locations={actionData.locations}
            onSave={handleSaveReservation}
            onDelete={() => {}}
            onClose={() => setShowReservationModal(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {/* ═══ Modal de réservation (consultation) ═══ */}
      {viewedReservation && (
        <Suspense fallback={<div className="action-loading">Chargement...</div>}>
          <ReservationModal
            slot={null}
            reservation={viewedReservation}
            vehicles={actionData.vehicles}
            clients={actionData.clients}
            drivers={actionData.drivers}
            locations={actionData.locations}
            onSave={async (data) => {
              try {
                await api.updateReservation(viewedReservation.id, {
                  ...data,
                  id: viewedReservation.id,
                });
                setViewedReservation(null);
                showFeedback({ type: 'success', message: 'Réservation mise à jour' });
                if (onDataChanged) onDataChanged();
              } catch (err) {
                showFeedback({ type: 'error', message: 'Erreur: ' + err.message }, 4000);
              }
            }}
            onDelete={async () => {
              try {
                await api.deleteReservation(viewedReservation.id);
                setViewedReservation(null);
                showFeedback({ type: 'success', message: 'Réservation supprimée' });
                if (onDataChanged) onDataChanged();
              } catch (err) {
                showFeedback({ type: 'error', message: 'Erreur: ' + err.message }, 4000);
              }
            }}
            onClose={() => setViewedReservation(null)}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {/* ═══ Modal EventDetails (consultation événement Google) ═══ */}
      {viewedEvent && (
        <Suspense fallback={<div className="action-loading">Chargement...</div>}>
          <EventDetailsModal
            isOpen={!!viewedEvent}
            onClose={() => setViewedEvent(null)}
            event={viewedEvent}
            reservations={reservations}
            currentUser={currentUser}
          />
        </Suspense>
      )}

      {/* ═══ Modal commandes (créer/mettre à jour) ═══ */}
      {showOrdersModal && (
        <Suspense fallback={<div className="action-loading">Chargement...</div>}>
          <GenerateOrdersModal
            affaireId={affaire.numeroAffaire}
            affaireReference={affaire.reference || affaire.numeroAffaire}
            onClose={() => setShowOrdersModal(false)}
            onGenerated={() => {
              if (onDataChanged) onDataChanged();
            }}
          />
        </Suspense>
      )}

      {/* ═══ Modal annotation BP ═══ */}
      {annotatingBL && annotationResult && (
        <Suspense fallback={<div className="action-loading">Chargement annotation…</div>}>
          <BPAnnotationViewer
            annotationResult={annotationResult}
            pdfUrl={annotatingBL.filePath ? `/bl-imports/${annotatingBL.filePath}` : null}
            onClose={() => {
              setAnnotatingBL(null);
              resetAnnotation();
            }}
          />
        </Suspense>
      )}

      {ConfirmDialogRenderer}
    </div>
  );
};

// ═══════════════════════════════════════
// Volet glissant (panneau droit)
// ═══════════════════════════════════════

const AffaireSlidePanel = ({
  affaire,
  reservations,
  googleEventIds = [],
  onClose,
  onOpenDialog,
  onNavigateToEntity,
  onRefresh,
  currentUser,
}) => {
  const [missions, setMissions] = useState([]);
  const [showBLImport, setShowBLImport] = useState(false);
  const [showDisplayDialog, setShowDisplayDialog] = useState(false);
  const [hasBLImports, setHasBLImports] = useState(false);
  const panelRef = useRef(null);
  const { isVisible, isOpen, isClosing, handleClose } = useSlidePanelClose(affaire, onClose);

  // Fetch missions et BL imports quand une affaire est sélectionnée
  useEffect(() => {
    if (!affaire) return undefined;
    let cancelled = false;
    api
      .request('/missions')
      .then((data) => {
        if (!cancelled) setMissions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMissions([]);
      });
    api
      .getBLImports({ affaire_id: affaire.numeroAffaire })
      .then((data) => {
        if (!cancelled) setHasBLImports(Array.isArray(data) && data.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasBLImports(false);
      });
    return () => {
      cancelled = true;
    };
  }, [affaire]);

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        const row = e.target.closest('.affaire-row');
        if (!row) handleClose();
      }
    };
    if (affaire && isVisible) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [affaire, isVisible, handleClose]);

  if (!isVisible && !affaire) return null;

  const currentAffaire = affaire || {};
  const typeInfo = getTypeInfo(currentAffaire.type);

  return (
    <div
      className={`affaire-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`}
      ref={panelRef}
    >
      <div className="slide-panel-header">
        <div className="slide-panel-title-row">
          <span className="slide-panel-numero">{currentAffaire.numeroAffaire}</span>
          <span className="slide-panel-type" style={{ background: typeInfo.color }}>
            {typeInfo.label}
          </span>
          {(() => {
            const st = AFFAIRE_STATUS_MAP[currentAffaire.status || 'brouillon'];
            return st ? (
              <span
                className="workflow-status-badge"
                style={{
                  background: st.color,
                  color: '#fff',
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                }}
              >
                {st.emoji} {st.label}
              </span>
            ) : null;
          })()}
        </div>
        <Tooltip content="Fermer">
          <Button variant="ghost" className="slide-panel-close" onClick={handleClose}>
            <X size={18} />
          </Button>
        </Tooltip>
      </div>
      <div className="slide-panel-body">
        <AffaireDetailContent
          affaire={currentAffaire}
          reservations={reservations}
          missions={missions}
          googleEventIds={googleEventIds}
          editable={true}
          onDataChanged={onRefresh}
          onNavigateToEntity={onNavigateToEntity}
          currentUser={currentUser}
        />
      </div>
      <div className="slide-panel-footer">
        <Button
          variant="ghost"
          className="slide-panel-bl-btn"
          onClick={() => setShowBLImport(true)}
          title={hasBLImports ? 'Mettre à jour le BL/BP' : 'Importer un BL/BP'}
        >
          {hasBLImports ? (
            <>
              <RefreshCw size={14} /> MAJ BL
            </>
          ) : (
            <>
              <FileText size={14} /> Import BL
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          className="slide-panel-open-btn"
          onClick={() => {
            if (onOpenDialog) onOpenDialog(currentAffaire);
          }}
        >
          <ExternalLink size={14} /> Ouvrir la fiche
        </Button>
      </div>
      {showBLImport && (
        <Suspense fallback={null}>
          {['Location', 'Prestation'].includes(currentAffaire.type) ? (
            <BLImportLocPrestaModal
              onClose={() => setShowBLImport(false)}
              onImported={() => {
                setShowBLImport(false);
                setHasBLImports(true);
                if (onRefresh) onRefresh();
              }}
              defaultAffaireId={currentAffaire.numeroAffaire}
              defaultAffaireType={currentAffaire.type}
            />
          ) : (
            <BLImportModal
              onClose={() => setShowBLImport(false)}
              onImported={() => {
                setShowBLImport(false);
                setHasBLImports(true);
                if (onRefresh) onRefresh();
              }}
              defaultAffaireId={currentAffaire.numeroAffaire}
              defaultAffaireType={currentAffaire.type}
            />
          )}
        </Suspense>
      )}
      {showDisplayDialog && (
        <Suspense fallback={null}>
          <DynamicDisplayDialog
            defaultDate={null}
            defaultAffaireId={currentAffaire.numeroAffaire}
            onSave={() => setShowDisplayDialog(false)}
            onClose={() => setShowDisplayDialog(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// Dialog (modal plein écran)
// ═══════════════════════════════════════

const AffaireDetailDialog = ({
  affaire,
  reservations,
  googleEventIds = [],
  onClose,
  onDataChanged,
  onNavigateToEntity,
  currentUser,
}) => {
  const [missions, setMissions] = useState([]);
  const [isClosing, setIsClosing] = useState(false);
  const [showBLImport, setShowBLImport] = useState(false);
  const [showDisplayDialog, setShowDisplayDialog] = useState(false);
  const [hasBLImports, setHasBLImports] = useState(false);

  // ═══ Mode édition ═══
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const affaireIdRef = useRef(null);

  const startEditing = useCallback(() => {
    // Pré-remplir nom : valeur existante, sinon event_name, sinon client
    const defaultNom = affaire.nom || affaire.eventName || affaire.client || '';
    setEditForm({
      nom: defaultNom,
      numeroAffaire: affaire.numeroAffaire || '',
      type: affaire.type || 'Prestation',
      client: affaire.client || '',
      interlocuteur: affaire.interlocuteur || '',
      tel: affaire.tel || '',
      fax: affaire.fax || '',
      dateDebut: affaire.dateDebut || '',
      dateFin: affaire.dateFin || '',
      devis: affaire.devis || '',
      adresseLivraison: affaire.adresseLivraison || '',
      titre: affaire.titre || affaire.eventName || '',
      description: affaire.description || '',
      googleEventId: affaire.googleEventId || '',
      eventName: affaire.eventName || '',
    });
    setIsEditing(true);
  }, [affaire]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditForm(null);
  }, []);

  const saveEditing = useCallback(async () => {
    if (!editForm || isSaving) return;
    setIsSaving(true);
    try {
      const payload = {
        numero_affaire: editForm.numeroAffaire,
        nom: editForm.nom,
        type: editForm.type,
        client: editForm.client,
        interlocuteur: editForm.interlocuteur,
        tel: editForm.tel,
        fax: editForm.fax || '',
        date_debut: editForm.dateDebut,
        date_fin: editForm.dateFin,
        devis: editForm.devis,
        adresse_livraison: editForm.adresseLivraison,
        titre: editForm.titre,
        description: editForm.description,
        google_event_id: editForm.googleEventId || '',
        event_name: editForm.eventName || editForm.titre || '',
      };
      let result;
      if (affaire.id) {
        result = await api.updateAffaire(affaire.id, payload);
      } else {
        result = await api.createOrUpdateAffaire(payload);
      }
      // Construire l'objet affaire mis à jour (camelCase) pour le parent
      const updatedAffaire = {
        ...affaire,
        id: result?.id || affaire.id,
        nom: editForm.nom,
        numeroAffaire: editForm.numeroAffaire,
        type: editForm.type,
        client: editForm.client,
        interlocuteur: editForm.interlocuteur,
        tel: editForm.tel,
        fax: editForm.fax || '',
        dateDebut: editForm.dateDebut,
        dateFin: editForm.dateFin,
        devis: editForm.devis,
        adresseLivraison: editForm.adresseLivraison,
        titre: editForm.titre,
        description: editForm.description,
        googleEventId: editForm.googleEventId || '',
        eventName: editForm.eventName || editForm.titre || '',
        source: affaire.source || 'db',
      };
      setIsEditing(false);
      setEditForm(null);
      if (onDataChanged) onDataChanged(updatedAffaire);
    } catch (err) {
      console.error('Erreur sauvegarde affaire:', err);
      alert('Erreur lors de la sauvegarde : ' + (err.message || 'Erreur serveur'));
    } finally {
      setIsSaving(false);
    }
  }, [editForm, isSaving, affaire, onDataChanged]);

  const refreshMissions = useCallback(() => {
    if (!affaire) return;
    api
      .request('/missions')
      .then((data) => {
        setMissions(Array.isArray(data) ? data : []);
      })
      .catch(() => setMissions([]));
  }, [affaire]);

  useEffect(() => {
    if (!affaire) return;
    // Skip if same affaire (avoid re-triggers from parent re-renders)
    if (affaireIdRef.current === affaire.numeroAffaire) return;
    affaireIdRef.current = affaire.numeroAffaire;
    setIsClosing(false);
    setIsEditing(false);
    setEditForm(null);
    refreshMissions();
    // Check if BL/BP already imported
    api
      .getBLImports({ affaire_id: affaire.numeroAffaire })
      .then((data) => {
        setHasBLImports(Array.isArray(data) && data.length > 0);
      })
      .catch(() => setHasBLImports(false));
  }, [affaire, refreshMissions]);

  const handleDataChanged = useCallback(() => {
    refreshMissions();
    if (onDataChanged) onDataChanged();
  }, [refreshMissions, onDataChanged]);

  const handleClose = useCallback(() => {
    if (isEditing) {
      cancelEditing();
      return;
    }
    setIsClosing(true);
    setTimeout(() => {
      affaireIdRef.current = null;
      onClose();
    }, 200);
  }, [onClose, isEditing, cancelEditing]);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    if (affaire) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [affaire, handleClose]);

  if (!affaire) return null;

  const typeInfo = getTypeInfo(isEditing && editForm ? editForm.type : affaire.type);

  return (
    <div
      className={`affaire-dialog-overlay${isClosing ? ' closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="affaire-dialog">
        <div className="dialog-header">
          <div className="dialog-title-row">
            <span className="dialog-numero">
              {isEditing && editForm ? editForm.numeroAffaire : affaire.numeroAffaire}
            </span>
            <span className="dialog-type" style={{ background: typeInfo.color }}>
              {typeInfo.label}
            </span>
            {!isEditing && (affaire.nom || affaire.client) && (
              <span className="dialog-client">{capitalizeText(affaire.nom || affaire.client)}</span>
            )}
            {isEditing && (editForm?.nom || editForm?.client) && (
              <span className="dialog-client">
                {capitalizeText(editForm.nom || editForm.client)}
              </span>
            )}
          </div>
          <div className="dialog-header-actions">
            {isEditing ? (
              <>
                <Tooltip content="Annuler les modifications" position="bottom">
                  <Button variant="ghost" className="dialog-cancel-btn" onClick={cancelEditing}>
                    <X size={15} /> Annuler
                  </Button>
                </Tooltip>
                <Tooltip content="Enregistrer les modifications" position="bottom">
                  <Button
                    variant="ghost"
                    className="dialog-save-btn"
                    onClick={saveEditing}
                    disabled={isSaving}
                  >
                    <Save size={15} /> {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip content="Modifier les informations de l'affaire" position="bottom">
                  <Button variant="ghost" className="dialog-edit-btn" onClick={startEditing}>
                    <Edit3 size={15} /> Modifier
                  </Button>
                </Tooltip>
                <Button
                  variant="ghost"
                  className="dialog-bl-btn"
                  onClick={() => setShowBLImport(true)}
                  title={hasBLImports ? 'Mettre à jour le BL/BP' : 'Importer un BL/BP'}
                >
                  {hasBLImports ? (
                    <>
                      <RefreshCw size={15} /> MAJ BL
                    </>
                  ) : (
                    <>
                      <FileText size={15} /> Import BL
                    </>
                  )}
                </Button>
              </>
            )}
            <Tooltip content={isEditing ? 'Annuler' : 'Fermer'}>
              <Button variant="ghost" className="dialog-close" onClick={handleClose}>
                <X size={20} />
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="dialog-body">
          <AffaireDetailContent
            affaire={affaire}
            reservations={reservations}
            missions={missions}
            googleEventIds={googleEventIds}
            editable={!isEditing}
            onDataChanged={handleDataChanged}
            onNavigateToEntity={onNavigateToEntity}
            isEditing={isEditing}
            editForm={editForm}
            setEditForm={setEditForm}
            currentUser={currentUser}
          />
        </div>
      </div>

      {showBLImport && (
        <Suspense fallback={null}>
          {['Location', 'Prestation'].includes(affaire.type) ? (
            <BLImportLocPrestaModal
              onClose={() => setShowBLImport(false)}
              onImported={() => {
                setShowBLImport(false);
                setHasBLImports(true);
                handleDataChanged();
              }}
              defaultAffaireId={affaire.numeroAffaire}
              defaultAffaireType={affaire.type}
            />
          ) : (
            <BLImportModal
              onClose={() => setShowBLImport(false)}
              onImported={() => {
                setShowBLImport(false);
                setHasBLImports(true);
                handleDataChanged();
              }}
              defaultAffaireId={affaire.numeroAffaire}
              defaultAffaireType={affaire.type}
            />
          )}
        </Suspense>
      )}
      {showDisplayDialog && (
        <Suspense fallback={null}>
          <DynamicDisplayDialog
            defaultDate={null}
            defaultAffaireId={affaire.numeroAffaire}
            onSave={() => {
              setShowDisplayDialog(false);
              handleDataChanged();
            }}
            onClose={() => setShowDisplayDialog(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export { AffaireDetailDialog, AffaireSlidePanel };
export default React.memo(AffaireSlidePanel);
