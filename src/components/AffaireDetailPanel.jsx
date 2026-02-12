import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { X, ChevronRight, Calendar, Users, Truck, FileText, MapPin, Briefcase, LinkIcon, Paperclip, Phone, Mail, User, Clock, ExternalLink, FolderOpen, File, Download, Plus, Upload, UserPlus, Check, AlertCircle } from 'lucide-react';
import api, { getApiUrl } from '../utils/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { capitalizeText } from '../utils/dateUtils';
import './AffaireDetailPanel.css';

const ReservationModal = lazy(() => import('./ReservationModal'));
const EventDetailsModal = lazy(() => import('./EventDetailsModal'));

const API_BASE_URL = getApiUrl();

const AFFAIRE_TYPES = [
  { value: 'Prestation', label: 'Prestation', color: '#3b82f6' },
  { value: 'Location', label: 'Location', color: '#f59e0b' },
  { value: 'Installation', label: 'Installation', color: '#10b981' },
  { value: 'Vente', label: 'Vente', color: '#8b5cf6' },
];
const getTypeInfo = (type) => AFFAIRE_TYPES.find(t => t.value === type) || AFFAIRE_TYPES[0];

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00')), 'dd MMM yyyy', { locale: fr });
  } catch { return dateStr; }
};

// Extraire les URL depuis un texte (description Google Calendar)
const extractLinksFromText = (text) => {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"'\)]+/gi;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)].map(url => {
    const isDrive = url.includes('drive.google.com') || url.includes('docs.google.com') || url.includes('sheets.google.com') || url.includes('slides.google.com');
    let label = '';
    if (isDrive) {
      label = 'Google Drive';
      if (url.includes('/folders/')) label = 'Dossier Drive';
      else if (url.includes('docs.google.com')) label = 'Google Docs';
      else if (url.includes('sheets.google.com')) label = 'Google Sheets';
      else if (url.includes('slides.google.com')) label = 'Google Slides';
    } else {
      try { label = new URL(url).hostname; } catch { label = url.slice(0, 50); }
    }
    return { url, label, isDrive };
  });
};

// ═══════════════════════════════════════
// Contenu partagé (sections de détail)
// ═══════════════════════════════════════

const AffaireDetailContent = ({ affaire, reservations = [], missions = [], persons = [], googleEventIds = [], editable = false, onDataChanged, onNavigateToEntity }) => {
  const typeInfo = getTypeInfo(affaire.type);

  // ═══ États pour les actions (mode éditable) ═══
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showPersonnelForm, setShowPersonnelForm] = useState(false);
  const [actionData, setActionData] = useState({ vehicles: [], clients: [], drivers: [], locations: [], persons: [] });
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [missionTitle, setMissionTitle] = useState('');
  const [actionFeedback, setActionFeedback] = useState(null);
  const fileInputRef = useRef(null);

  // ═══ États pour consultation réservation / événement ═══
  const [viewedReservation, setViewedReservation] = useState(null);
  const [viewedEvent, setViewedEvent] = useState(null);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Charger les Google Calendar events liés
  useEffect(() => {
    if (!googleEventIds || googleEventIds.length === 0) { setGoogleEvents([]); return; }
    const fetchEvents = async () => {
      setIsLoadingEvents(true);
      const token = localStorage.getItem('google_access_token');
      const tokenExpiry = localStorage.getItem('google_token_expiry');
      if (!token || !tokenExpiry || Date.now() > parseInt(tokenExpiry, 10)) { setGoogleEvents([]); setIsLoadingEvents(false); return; }
      try {
        let calendarId = 'primary';
        try { const c = await api.getGoogleCalendarId(); calendarId = c?.value || 'primary'; } catch {}
        const events = [];
        for (const eventId of googleEventIds) {
          try {
            const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (resp.ok) {
              const ev = await resp.json();
              ev.affaire = affaire.numeroAffaire;
              events.push(ev);
            }
          } catch {}
        }
        setGoogleEvents(events);
      } catch { setGoogleEvents([]); }
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
        promises.push(api.getVehicles(), api.getClients(), api.getDrivers(), api.getLocations());
        const [vehicles, clients, drivers, locations] = await Promise.all(promises);
        setActionData(prev => ({ ...prev, vehicles, clients, drivers, locations }));
      } else if (what === 'personnel') {
        const persons = await api.getPersons();
        setActionData(prev => ({ ...prev, persons: Array.isArray(persons) ? persons : [] }));
      }
    } catch (err) {
      console.error('Erreur chargement données action:', err);
    } finally {
      setIsLoadingAction(false);
    }
  }, []);

  // Ouvrir une réservation existante (clic sur resa liée)
  const handleViewReservation = useCallback(async (resa) => {
    if (actionData.vehicles.length === 0) {
      await loadActionData('reservation');
    }
    setViewedReservation(resa);
  }, [actionData.vehicles.length, loadActionData]);

  // Ouvrir le modal de réservation (création)
  const handleOpenReservation = useCallback(async () => {
    await loadActionData('reservation');
    setShowReservationModal(true);
  }, [loadActionData]);

  // Sauvegarder une réservation depuis le dialog
  const handleSaveReservation = useCallback(async (formData) => {
    try {
      if (Array.isArray(formData)) {
        for (const data of formData) {
          await api.createReservation({ id: `${Date.now()}.${Math.random()}`, ...data });
        }
      } else {
        await api.createReservation({ id: `${Date.now()}.${Math.random()}`, ...formData });
      }
      setShowReservationModal(false);
      setActionFeedback({ type: 'success', message: 'Réservation créée avec succès' });
      setTimeout(() => setActionFeedback(null), 3000);
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error('Erreur création réservation:', err);
      setActionFeedback({ type: 'error', message: 'Erreur: ' + err.message });
      setTimeout(() => setActionFeedback(null), 4000);
    }
  }, [onDataChanged]);

  // Upload de fichier
  const handleFileUpload = useCallback(async (files) => {
    if (!files || files.length === 0 || !affaire.numeroAffaire) return;
    setUploadProgress('upload');
    const token = localStorage.getItem('auth_token');
    let successCount = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('affaireId', affaire.numeroAffaire);
        const resp = await fetch(`${API_BASE_URL}/upload-attachment`, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: fd,
        });
        if (resp.ok) successCount++;
      } catch (err) {
        console.error('Erreur upload:', err);
      }
    }
    setUploadProgress(null);
    setShowUploadForm(false);
    if (successCount > 0) {
      setActionFeedback({ type: 'success', message: `${successCount} fichier(s) importé(s)` });
      if (onDataChanged) onDataChanged();
    } else {
      setActionFeedback({ type: 'error', message: 'Erreur lors de l\'import' });
    }
    setTimeout(() => setActionFeedback(null), 3000);
  }, [affaire.numeroAffaire, onDataChanged]);

  // Assigner du personnel
  const handleAssignPersonnel = useCallback(async () => {
    if (!selectedPersonId) return;
    try {
      // Trouver une réservation liée pour créer la mission
      const linkedResa = reservations.find(r => {
        if (r.affaire && r.affaire.toUpperCase() === affaire.numeroAffaire?.toUpperCase()) return true;
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
      setActionFeedback({ type: 'success', message: 'Personnel affecté avec succès' });
      setTimeout(() => setActionFeedback(null), 3000);
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error('Erreur affectation:', err);
      setActionFeedback({ type: 'error', message: 'Erreur: ' + err.message });
      setTimeout(() => setActionFeedback(null), 4000);
    }
  }, [selectedPersonId, missionTitle, affaire, reservations, onDataChanged]);

  // Réservations liées (par numéro d'affaire OU par googleEventId)
  const linkedReservations = useMemo(() => {
    if (!affaire.numeroAffaire) return [];
    const eventIdSet = new Set(googleEventIds || []);
    return reservations.filter(r => {
      // Match par champ affaire
      if (r.affaire && r.affaire.toUpperCase() === affaire.numeroAffaire.toUpperCase()) return true;
      // Match par googleEventId (lié à un événement Google de cette affaire)
      if (r.googleEventId && eventIdSet.has(r.googleEventId)) return true;
      return false;
    });
  }, [reservations, affaire.numeroAffaire, googleEventIds]);

  // Missions liées (via affaire direct OU via reservation_id des réservations liées)
  const linkedMissions = useMemo(() => {
    const resaIds = new Set(linkedReservations.map(r => String(r.id)));
    const affaireUpper = affaire.numeroAffaire?.toUpperCase();
    return missions.filter(m => {
      // Match direct par champ affaire de la mission
      if (m.affaire && m.affaire.toUpperCase() === affaireUpper) return true;
      // Match par reservation_id (lien indirect via réservation)
      if ((m.reservationId || m.reservation_id) && resaIds.has(String(m.reservationId || m.reservation_id))) return true;
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
            } catch { /* ignore */ }
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

  // Pièces jointes locales
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  useEffect(() => {
    if (!affaire.numeroAffaire) { setAttachmentFiles([]); return; }
    const loadAttachments = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const resp = await fetch(`${API_BASE_URL}/attachments/${encodeURIComponent(affaire.numeroAffaire)}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (resp.ok) {
          const data = await resp.json();
          setAttachmentFiles(data.files || []);
        } else {
          setAttachmentFiles([]);
        }
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
      {/* ═══ Section 1 : Détails basiques ═══ */}
      <section className="detail-section">
        <h3 className="detail-section-title">
          <Briefcase size={15} /> Détails
        </h3>
        <div className="detail-grid">
          <div className="detail-field">
            <label>N° Affaire</label>
            <span className="detail-numero">{affaire.numeroAffaire || '—'}</span>
          </div>
          <div className="detail-field">
            <label>Type</label>
            <span className="affaire-type-badge" style={{ background: typeInfo.color }}>{typeInfo.label}</span>
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
              <label><Phone size={12} /> Téléphone</label>
              <span>{affaire.tel}</span>
            </div>
          )}
          <div className="detail-field full-width">
            <label><Calendar size={12} /> Période</label>
            <span>
              {fmtDate(affaire.dateDebut)}
              {affaire.dateFin && affaire.dateFin !== affaire.dateDebut && <> → {fmtDate(affaire.dateFin)}</>}
              {duration && <span className="detail-duration">({duration} jour{duration > 1 ? 's' : ''})</span>}
            </span>
          </div>
          <div className="detail-field full-width">
            <label><MapPin size={12} /> Lieu</label>
            <span>{capitalizeText(affaire.adresseLivraison) || '—'}</span>
          </div>
          {(affaire.eventName || affaire.titre) && (
            <div className="detail-field full-width">
              <label><FileText size={12} /> Titre / Événement</label>
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
              <span className="detail-source-tag">{affaire.source === 'db' ? 'Base de données' : affaire.source === 'auto' ? 'Auto-détecté' : 'Google Calendar'}</span>
            </div>
          )}
        </div>
      </section>

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
            <button className="section-action-btn" onClick={handleOpenReservation} disabled={isLoadingAction} title="Nouvelle réservation">
              <Plus size={13} /> Réservation
            </button>
          )}
        </h3>
        {linkedReservations.length === 0 ? (
          <p className="detail-empty">Aucune réservation liée à cette affaire</p>
        ) : (
          <div className="detail-list">
            {linkedReservations.map(r => (
              <div key={r.id} className="detail-list-item resa-item clickable" onClick={() => handleViewReservation(r)} title="Cliquer pour ouvrir la réservation">
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
                    {onNavigateToEntity && r.vehicleId && <ExternalLink size={10} className="entity-link-icon" />}
                  </strong>
                  {r.immatriculation && <span className="resa-immat">{r.immatriculation}</span>}
                </div>
                <div className="resa-dates">
                  <Clock size={12} />
                  {fmtDate(r.startDate)} {r.startPeriod === 'morning' ? 'matin' : r.startPeriod === 'afternoon' ? 'après-midi' : r.startPeriod || ''}
                  {r.endDate && r.endDate !== r.startDate && <> → {fmtDate(r.endDate)} {r.endPeriod === 'morning' ? 'matin' : r.endPeriod === 'afternoon' ? 'après-midi' : r.endPeriod || ''}</>}
                </div>
                {r.driverName && (
                  <div className="resa-driver"><User size={12} /> {r.driverName}</div>
                )}
                {r.locationName && (
                  <div className="resa-location"><MapPin size={12} /> {r.locationName}</div>
                )}
                {r.comment && (
                  <div className="resa-comment">{r.comment}</div>
                )}
                <span className={`resa-status status-${r.status || 'confirmed'}`}>{r.status === 'confirmed' ? 'Confirmée' : r.status === 'pending' ? 'En attente' : r.status || 'Confirmée'}</span>
                <ChevronRight size={14} className="resa-chevron" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ Section 2b : Événements Google Calendar liés ═══ */}
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
              {googleEvents.map(ev => (
                <div key={ev.id} className="detail-list-item event-item clickable" onClick={() => setViewedEvent(ev)} title="Cliquer pour voir les détails de l'événement">
                  <div className="event-summary">
                    <Calendar size={13} />
                    <strong>{ev.summary || 'Événement'}</strong>
                  </div>
                  <div className="event-dates">
                    <Clock size={12} />
                    {ev.start?.date ? fmtDate(ev.start.date) : ev.start?.dateTime ? fmtDate(ev.start.dateTime.split('T')[0]) : '—'}
                    {(ev.end?.date || ev.end?.dateTime) && <> → {ev.end?.date ? fmtDate(ev.end.date) : fmtDate(ev.end.dateTime.split('T')[0])}</>}
                  </div>
                  {ev.location && (
                    <div className="event-location"><MapPin size={12} /> {ev.location}</div>
                  )}
                  {ev.description && (
                    <div className="event-description">{ev.description.slice(0, 100)}{ev.description.length > 100 ? '…' : ''}</div>
                  )}
                  <ChevronRight size={14} className="resa-chevron" />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ Section 3 : Personnel affecté ═══ */}
      <section className="detail-section">
        <h3 className="detail-section-title">
          <Users size={15} /> Personnel affecté
          <span className="section-count">{assignedPersonnel.length}</span>
          {editable && (
            <button className="section-action-btn personnel-btn" onClick={async () => { await loadActionData('personnel'); setShowPersonnelForm(true); }} disabled={isLoadingAction} title="Affecter du personnel">
              <UserPlus size={13} /> Affecter
            </button>
          )}
        </h3>
        {/* Mini-formulaire d'affectation */}
        {showPersonnelForm && (
          <div className="inline-action-form">
            <div className="inline-form-row">
              <select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)} className="inline-select">
                <option value="">— Choisir une personne —</option>
                {actionData.persons.map(p => (
                  <option key={p.id} value={p.id}>{p.firstName || p.first_name} {p.lastName || p.last_name}{p.type ? ` (${p.type})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="inline-form-row">
              <input type="text" placeholder="Titre de la mission (optionnel)" value={missionTitle} onChange={e => setMissionTitle(e.target.value)} className="inline-input" />
            </div>
            <div className="inline-form-actions">
              <button className="inline-btn confirm" onClick={handleAssignPersonnel} disabled={!selectedPersonId}>
                <Check size={13} /> Affecter
              </button>
              <button className="inline-btn cancel" onClick={() => setShowPersonnelForm(false)}>Annuler</button>
            </div>
          </div>
        )}
        {assignedPersonnel.length === 0 ? (
          <p className="detail-empty">Aucun personnel affecté à cette affaire</p>
        ) : (
          <div className="detail-list">
            {assignedPersonnel.map(p => (
              <div
                key={p.id}
                className={`detail-list-item person-item${onNavigateToEntity ? ' clickable' : ''}`}
                onClick={() => { if (onNavigateToEntity) onNavigateToEntity('person', { id: p.id }); }}
                title={onNavigateToEntity ? 'Voir dans le module Personnel' : undefined}
              >
                <div className="person-header-row">
                  <div className="person-avatar-small">
                    {p.photo ? (
                      <img src={`${API_BASE_URL.replace('/api', '')}/avatars/${p.photo}`} alt="" className="person-avatar-img" />
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <div className="person-identity">
                    <div className="person-name">
                      <strong>{p.firstName} {p.lastName}</strong>
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
                      <div className="person-contact-line"><Phone size={11} /> {p.phone}</div>
                    )}
                    {p.email && (
                      <div className="person-contact-line"><Mail size={11} /> {p.email}</div>
                    )}
                  </div>
                  <span className={`person-status status-${p.status}`}>
                    {p.status === 'confirmed' ? 'Confirmé' : p.status === 'option' ? 'Option' : p.status === 'accepted' ? 'Accepté' : p.status === 'proposed' ? 'Proposé' : p.status === 'declined' ? 'Refusé' : p.status || '—'}
                  </span>
                </div>
                {/* Postes habituels */}
                {p.positions.length > 0 && (
                  <div className="person-tags-row">
                    <Briefcase size={11} />
                    {p.positions.slice(0, 4).map((pos, i) => (
                      <span key={i} className="person-position-chip">{pos}</span>
                    ))}
                    {p.positions.length > 4 && <span className="person-more">+{p.positions.length - 4}</span>}
                  </div>
                )}
                {/* Compétences */}
                {p.skills.length > 0 && (
                  <div className="person-tags-row skills-row">
                    <AlertCircle size={11} />
                    {p.skills.slice(0, 4).map((sk, i) => (
                      <span key={i} className="person-skill-chip">{sk}</span>
                    ))}
                    {p.skills.length > 4 && <span className="person-more">+{p.skills.length - 4}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ Section 4 : Pièces et liens joints ═══ */}
      <section className="detail-section">
        <h3 className="detail-section-title">
          <Paperclip size={15} /> Pièces et liens joints
          {editable && (
            <button className="section-action-btn upload-btn" onClick={() => setShowUploadForm(v => !v)} title="Importer un fichier">
              <Upload size={13} /> Importer
            </button>
          )}
        </h3>
        {/* Zone d'upload */}
        {showUploadForm && (
          <div
            className={`upload-zone ${uploadDragging ? 'dragging' : ''} ${uploadProgress ? 'uploading' : ''}`}
            onDragOver={e => { e.preventDefault(); setUploadDragging(true); }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={e => { e.preventDefault(); setUploadDragging(false); handleFileUpload(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" multiple hidden onChange={e => handleFileUpload(e.target.files)} />
            {uploadProgress ? (
              <><div className="upload-spinner" /> Import en cours...</>
            ) : (
              <><Upload size={20} /><span>Glissez des fichiers ici ou cliquez pour parcourir</span></>
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
              driveLinks.push({ url: r.googleDriveLink, label: 'Lien Drive', fromResa: r.vehicleName || r.id });
            }
          }

          // 3. Liens extraits de la description Google Calendar
          const descLinks = descriptionLinks.filter(link => {
            // Éviter les doublons avec les liens Drive des réservations
            return !driveLinks.some(dl => dl.url === link.url);
          });

          // 4. Liens vers les événements Google Calendar (utiliser htmlLink de l'API)
          const calendarLinks = googleEvents
            .filter(ev => ev.htmlLink)
            .map(ev => ({ url: ev.htmlLink, label: ev.summary || 'Événement Google Calendar', isCalendar: true }));

          const totalItems = attachmentFiles.length + driveLinks.length + descLinks.length + calendarLinks.length;

          if (totalItems === 0) {
            return <p className="detail-empty">Aucune pièce jointe ou lien</p>;
          }

          return (
            <div className="detail-list">
              {/* Fichiers locaux */}
              {hasLocalFiles && (
                <>
                  <div className="detail-list-subheader"><FolderOpen size={12} /> Fichiers ({attachmentFiles.length})</div>
                  {attachmentFiles.map((file, i) => (
                    <a key={`file-${i}`} href={`${API_BASE_URL.replace('/api', '')}${file.url}`} target="_blank" rel="noopener noreferrer" className="detail-list-item link-item file-item">
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
                  <div className="detail-list-subheader"><LinkIcon size={12} /> Liens Drive ({driveLinks.length})</div>
                  {driveLinks.map((link, i) => (
                    <a key={`drive-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="detail-list-item link-item">
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
                  <div className="detail-list-subheader"><FileText size={12} /> Liens (description)</div>
                  {descLinks.map((link, i) => (
                    <a key={`desc-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className={`detail-list-item link-item${link.isDrive ? ' drive-link' : ''}`}>
                      <LinkIcon size={13} />
                      <span className="link-name">{link.label}</span>
                      <ExternalLink size={12} className="link-external-icon" />
                    </a>
                  ))}
                </>
              )}
              {/* Lien vers l'événement Google Calendar */}
              {calendarLinks.map((link, i) => (
                <a key={`cal-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="detail-list-item link-item calendar-link">
                  <Calendar size={13} />
                  <span className="link-name">{link.label}</span>
                  <ExternalLink size={12} className="link-external-icon" />
                </a>
              ))}
            </div>
          );
        })()}
      </section>

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
            currentUser={{ isAdmin: true }}
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
                await api.updateReservation(viewedReservation.id, { ...data, id: viewedReservation.id });
                setViewedReservation(null);
                setActionFeedback({ type: 'success', message: 'Réservation mise à jour' });
                setTimeout(() => setActionFeedback(null), 3000);
                if (onDataChanged) onDataChanged();
              } catch (err) {
                setActionFeedback({ type: 'error', message: 'Erreur: ' + err.message });
                setTimeout(() => setActionFeedback(null), 4000);
              }
            }}
            onDelete={async () => {
              try {
                await api.deleteReservation(viewedReservation.id);
                setViewedReservation(null);
                setActionFeedback({ type: 'success', message: 'Réservation supprimée' });
                setTimeout(() => setActionFeedback(null), 3000);
                if (onDataChanged) onDataChanged();
              } catch (err) {
                setActionFeedback({ type: 'error', message: 'Erreur: ' + err.message });
                setTimeout(() => setActionFeedback(null), 4000);
              }
            }}
            onClose={() => setViewedReservation(null)}
            currentUser={{ isAdmin: true }}
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
            currentUser={{ isAdmin: true }}
          />
        </Suspense>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// Volet glissant (panneau droit)
// ═══════════════════════════════════════

const AffaireSlidePanel = ({ affaire, reservations, googleEventIds = [], onClose, onOpenDialog, onNavigateToEntity }) => {
  const [missions, setMissions] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (affaire) {
      // Phase 1 : rend le panneau dans le DOM (width: 0)
      setIsVisible(true);
      setIsClosing(false);
      // Phase 2 : après une frame, ajoute la classe 'open' pour déclencher la transition
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsOpen(true);
        });
      });
      api.request('/missions').then(data => {
        setMissions(Array.isArray(data) ? data : []);
      }).catch(() => setMissions([]));
      return () => cancelAnimationFrame(raf);
    } else {
      setIsOpen(false);
      setIsClosing(true);
      const timer = setTimeout(() => { setIsVisible(false); setIsClosing(false); }, 350);
      return () => clearTimeout(timer);
    }
  }, [affaire]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  }, [onClose]);

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
    <div className={`affaire-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`} ref={panelRef}>
      <div className="slide-panel-header">
        <div className="slide-panel-title-row">
          <span className="slide-panel-numero">{currentAffaire.numeroAffaire}</span>
          <span className="slide-panel-type" style={{ background: typeInfo.color }}>{typeInfo.label}</span>
        </div>
        <button className="slide-panel-close" onClick={handleClose} title="Fermer">
          <X size={18} />
        </button>
      </div>
      <div className="slide-panel-body">
        <AffaireDetailContent affaire={currentAffaire} reservations={reservations} missions={missions} googleEventIds={googleEventIds} onNavigateToEntity={onNavigateToEntity} />
      </div>
      <div className="slide-panel-footer">
        <button className="slide-panel-open-btn" onClick={() => { if (onOpenDialog) onOpenDialog(currentAffaire); }}>
          <ExternalLink size={14} /> Ouvrir la fiche
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// Dialog (modal plein écran)
// ═══════════════════════════════════════

const AffaireDetailDialog = ({ affaire, reservations, googleEventIds = [], onClose, onDataChanged, onNavigateToEntity }) => {
  const [missions, setMissions] = useState([]);
  const [isClosing, setIsClosing] = useState(false);

  const refreshMissions = useCallback(() => {
    if (!affaire) return;
    api.request('/missions').then(data => {
      setMissions(Array.isArray(data) ? data : []);
    }).catch(() => setMissions([]));
  }, [affaire]);

  useEffect(() => {
    if (!affaire) return;
    setIsClosing(false);
    refreshMissions();
  }, [affaire, refreshMissions]);

  const handleDataChanged = useCallback(() => {
    refreshMissions();
    if (onDataChanged) onDataChanged();
  }, [refreshMissions, onDataChanged]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  }, [onClose]);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    if (affaire) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [affaire, handleClose]);

  if (!affaire) return null;

  const typeInfo = getTypeInfo(affaire.type);

  return (
    <div className={`affaire-dialog-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`affaire-dialog ${isClosing ? 'closing' : ''}`}>
        <div className="dialog-header">
          <div className="dialog-title-row">
            <span className="dialog-numero">{affaire.numeroAffaire}</span>
            <span className="dialog-type" style={{ background: typeInfo.color }}>{typeInfo.label}</span>
            {affaire.client && <span className="dialog-client">{capitalizeText(affaire.client)}</span>}
          </div>
          <button className="dialog-close" onClick={handleClose} title="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="dialog-body">
          <AffaireDetailContent affaire={affaire} reservations={reservations} missions={missions} googleEventIds={googleEventIds} editable={true} onDataChanged={handleDataChanged} onNavigateToEntity={onNavigateToEntity} />
        </div>
      </div>
    </div>
  );
};

export { AffaireSlidePanel, AffaireDetailDialog };
export default AffaireSlidePanel;
