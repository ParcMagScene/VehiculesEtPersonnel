import './AddTaskModal.css';

import { Briefcase, Clock, MapPin, Plus, Search, Truck, Unlink, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Button,
  FormField,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
} from '@/design-system';

import { STATUS } from '../../constants';
import { PLANNING_SECTIONS } from '../../constants/colors';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import usePersonnelFavorites from '../../hooks/usePersonnelFavorites';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { safeParseDate } from '../../utils/dateUtils';
import { refreshBus } from '../../utils/refresh-bus';
import AddressAutocomplete from '../AddressAutocomplete';
import AffaireBadge from '../AffaireBadge';

// ═══ Constantes (depuis colorConstants) ═══
const {
  rdv: _rdv,
  evenements: _evenements,
  depot: _depot,
  ...ADD_TASK_SECTIONS
} = PLANNING_SECTIONS;
const SECTIONS = ADD_TASK_SECTIONS;

const EVENT_TYPES = {
  preparation: { label: 'Préparation', emoji: '🔧' },
  enlevement: { label: 'Enlèvement', emoji: '📦' },
  livraison: { label: 'Livraison', emoji: '🚚' },
  depart: { label: 'Départ', emoji: '🚀' },
  retour: { label: 'Retour', emoji: '↩️' },
  recuperation: { label: 'Récupération', emoji: '📥' },
  montage: { label: 'Montage', emoji: '🔩' },
  demontage: { label: 'Démontage', emoji: '🔧' },
};

const VEHICLE_SECTIONS = new Set([
  'courses',
  'chargement',
  'depart',
  'enlevement',
  'retour',
  'recuperation',
]);
const COURSE_SECTION = 'courses';

export default function AddTaskModal({
  isOpen,
  onClose,
  selectedDate,
  persons,
  affaires,
  allAffaires,
  googleEvents,
  icalEvents,
  vehicles,
  reservations,
  onTaskCreated,
  loadVehiclesAndReservations,
}) {
  const toast = useToast();
  const { getFavoriteDisplayName, sortPersonsByFavorites } = usePersonnelFavorites();
  const sortedPersons = useMemo(
    () => sortPersonsByFavorites(persons || []),
    [persons, sortPersonsByFavorites],
  );

  // Form state
  const [section, setSection] = useState('manual');
  const [title, setTitle] = useState('');
  const [courseType, setCourseType] = useState('');
  const [personId, setPersonId] = useState('');
  const [client, setClient] = useState('');
  const [time, setTime] = useState('');
  const [period, setPeriod] = useState('AM');
  // Date éditable de la tâche : initialisée depuis selectedDate (jour ouvert
  // dans le planning) mais l'utilisateur peut choisir un autre jour avant
  // de valider. Format ISO YYYY-MM-DD attendu par l'input type="date".
  const [taskDate, setTaskDate] = useState(selectedDate || '');
  // Periode 'JOURNEE' = journee entiere : on envoie all_day=1 + period='AM'
  // + time=null au backend (qui n'accepte que AM/PM/null pour period).
  const isAllDay = period === 'JOURNEE';
  const [affaireNum, setAffaireNum] = useState('');
  const [googleEventId, setGoogleEventId] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const { resetDirty, guardClose } = useDirtyForm(
    {
      section,
      title,
      courseType,
      personId,
      client,
      time,
      period,
      taskDate,
      affaireNum,
      googleEventId,
      reservationId,
      vehicleId,
      locationAddress,
    },
    { confirmer: confirm },
  );
  const handleSafeClose = guardClose(onClose);

  // Affaire autocomplete
  const [affaireSearch, setAffaireSearch] = useState('');
  const [affaireOpen, setAffaireOpen] = useState(false);
  const [loadedAllAffaires, setLoadedAllAffaires] = useState([]);
  const affaireRef = useRef(null);

  // Locations eMag (enregistrées)
  const [emagLocations, setEmagLocations] = useState([]);

  // Load eMag locations + all affaires
  useEffect(() => {
    if (isOpen) {
      api
        .getLocations()
        .then(setEmagLocations)
        .catch(() => {});
      api
        .getAffaires()
        .then((data) => setLoadedAllAffaires(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSection('manual');
      setTitle('');
      setCourseType('');
      setPersonId('');
      setClient('');
      setTime('');
      setPeriod('AM');
      setTaskDate(selectedDate || '');
      setAffaireNum('');
      setGoogleEventId('');
      setReservationId('');
      setVehicleId('');
      setLocationAddress('');
      setAffaireSearch('');
      setAffaireOpen(false);
      resetDirty();
    }
    // selectedDate volontairement omis : on initialise la date uniquement
    // à l'ouverture du modal, pas à chaque changement de date externe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close affaire dropdown on outside click
  useEffect(() => {
    if (!affaireOpen) return;
    const handle = (e) => {
      if (affaireRef.current && !affaireRef.current.contains(e.target)) setAffaireOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [affaireOpen]);

  // Filtered affaires
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allAffairesList =
    loadedAllAffaires.length > 0 ? loadedAllAffaires : allAffaires || affaires || [];
  const filteredAffaires = useMemo(() => {
    if (!affaireSearch.trim()) return allAffairesList.slice(0, 30);
    const q = affaireSearch.toLowerCase();
    return allAffairesList
      .filter(
        (a) =>
          (a.numeroAffaire || '').toLowerCase().includes(q) ||
          (a.client || '').toLowerCase().includes(q) ||
          (a.nom || '').toLowerCase().includes(q) ||
          (a.titre || '').toLowerCase().includes(q),
      )
      .slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAffairesList, affaireSearch]);

  const selectedAffaire = useMemo(() => {
    return affaireNum ? allAffairesList.find((a) => a.numeroAffaire === affaireNum) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAffairesList, affaireNum]);

  const clientSuggestions = useMemo(() => {
    const seen = new Set();
    return allAffairesList
      .map((a) => (a.client || '').trim())
      .filter((name) => {
        if (!name) return false;
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [allAffairesList]);

  // All events for dropdown
  const allEvents = useMemo(
    () => [...(googleEvents || []), ...(icalEvents || [])],
    [googleEvents, icalEvents],
  );

  // Reservations filtered for date
  const dayReservations = useMemo(() => {
    return (reservations || []).filter(
      (r) => r.startDate <= selectedDate && r.endDate >= selectedDate,
    );
  }, [reservations, selectedDate]);

  // Liste plate (chaînes) pour alimenter l'autocomplete d'adresse via
  // `prioritySuggestions` (les lieux enregistrés apparaissent en haut du
  // dropdown Google Places).
  const locationSuggestionStrings = useMemo(() => {
    const values = [];
    const seen = new Set();
    const push = (raw) => {
      const v = String(raw || '').trim();
      const key = v.toLowerCase();
      if (!v || seen.has(key)) return;
      seen.add(key);
      values.push(v);
    };
    emagLocations.forEach((loc) => {
      push(loc?.name);
      push(loc?.address);
    });
    return values;
  }, [emagLocations]);

  const locationRef = useRef(null);

  // ═══ Submit ═══
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.warning('Titre requis');
      return;
    }
    setSubmitting(true);
    try {
      let effectiveSection = section;

      // Build final title
      let finalTitle = title.trim();
      finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
      if (section === COURSE_SECTION && courseType) {
        const typeInfo = EVENT_TYPES[courseType];
        if (typeInfo) finalTitle = `${typeInfo.emoji} ${typeInfo.label} — ${finalTitle}`;
      }

      // Handle vehicle reservation
      let finalReservationId = null;
      if (reservationId && reservationId !== '__new__') {
        finalReservationId = reservationId;
      } else if (reservationId === '__new__' && vehicleId) {
        try {
          const newRez = await api.createReservation({
            id: `${Date.now()}.${Math.random()}`,
            vehicle_id: vehicleId,
            start_date: taskDate || selectedDate,
            start_period: period || 'AM',
            end_date: taskDate || selectedDate,
            end_period: period || 'PM',
            client_name: client || selectedAffaire?.client || '',
            driver_name: personId
              ? persons.find((p) => String(p.id) === String(personId))?.firstName || ''
              : '',
            prestation_name: finalTitle,
            affaire: affaireNum || '',
            notes: '',
          });
          finalReservationId = newRez.id;
          if (loadVehiclesAndReservations) loadVehiclesAndReservations();
        } catch {
          toast.error('Erreur création réservation véhicule');
          setSubmitting(false);
          return;
        }
      }

      // Source type
      const selectedGoogEvent = googleEventId
        ? allEvents.find((e) => e.id === googleEventId)
        : null;
      const sourceType = selectedGoogEvent
        ? selectedGoogEvent._source === 'ical'
          ? 'ical_event'
          : 'google_event'
        : selectedAffaire
          ? 'affaire'
          : 'manual';

      await api.createTask({
        date: taskDate || selectedDate,
        period: isAllDay ? 'AM' : period || 'AM',
        all_day: isAllDay ? 1 : 0,
        time: isAllDay ? null : time || null,
        section: effectiveSection,
        title: finalTitle,
        person_id: personId || null,
        status: STATUS.PENDING,
        source_type: sourceType,
        source_id: selectedGoogEvent?.id || null,
        google_event_title: selectedGoogEvent?.summary || selectedGoogEvent?.title || null,
        affaire_num: affaireNum || null,
        reservation_id: finalReservationId,
        location_address: locationAddress || null,
        client_name: (client || selectedAffaire?.client || '').trim() || null,
      });

      refreshBus.publish('planning');
      toast.success('Tâche ajoutée');
      resetDirty();
      onTaskCreated();
      onClose();
    } catch {
      toast.error('Erreur création tâche');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-set period from time (sauf si Journee deja choisie)
  const handleTimeChange = (val) => {
    setTime(val);
    if (val && period !== 'JOURNEE') {
      const h = parseInt(val.split(':')[0], 10);
      setPeriod(h < 12 ? 'AM' : 'PM');
    }
  };

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleSafeClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // --- PATCH PORTAL ---
  // Définition des variables d'affichage conditionnel

  const showCourseType = section === COURSE_SECTION;
  const showLocation = section === COURSE_SECTION || VEHICLE_SECTIONS.has(section);
  const showVehicle = VEHICLE_SECTIONS.has(section);

  // ModalManager : <Modal> portail seul vers #emag-modal-root, plus besoin
  // de double-wrapper createPortal (cause de backdrops orphelins / overlays
  // transparents). Cf. apps/web/src/utils/modalManager.js.
  return (
    <>
      <Modal open onClose={handleSafeClose} size="lg" className="atm-modal no-drag-resize">
        <ModalHeader icon={<Plus size={18} />} onClose={handleSafeClose}>
          Nouvelle tâche
        </ModalHeader>

        <ModalBody className="atm-body">
          {/* Section / Type de tâche */}
          <FormField className="atm-field" label="Type de tâche">
            <Select
              value={section}
              onChange={(e) => {
                const key = e.target.value;
                setSection(key);
                if (key === COURSE_SECTION) {
                  // Pré-sélection 'livraison' par défaut pour que le badge
                  // apparaisse même si l'utilisateur ne touche pas au sous-type.
                  setCourseType((prev) => prev || 'livraison');
                } else {
                  setCourseType('');
                }
                if (!VEHICLE_SECTIONS.has(key)) {
                  setReservationId('');
                  setVehicleId('');
                }
                if (key !== COURSE_SECTION) setLocationAddress('');
              }}
            >
              {Object.entries(SECTIONS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.emoji} {info.label}
                </option>
              ))}
            </Select>
          </FormField>

          {/* Course type (sous-type) */}
          {showCourseType && (
            <FormField className="atm-field" label="Type de course">
              <Select value={courseType} onChange={(e) => setCourseType(e.target.value)}>
                {Object.entries(EVENT_TYPES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.emoji} {info.label}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {/* Titre */}
          <FormField className="atm-field" label="Titre" required>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) setTitle(v.charAt(0).toUpperCase() + v.slice(1));
              }}
              placeholder="Titre de la tâche..."
              autoFocus
              spellCheck
              lang="fr"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) handleSubmit();
              }}
            />
          </FormField>

          {/* Affaire */}
          <div className="atm-field" ref={affaireRef}>
            <label>
              <Briefcase size={13} /> Affaire
            </label>
            {affaireNum ? (
              <div className="atm-affaire-selected">
                <AffaireBadge numero={affaireNum} type={selectedAffaire?.type} />
                <span className="atm-affaire-client">{selectedAffaire?.client || ''}</span>
                <Button
                  variant="ghost"
                  type="button"
                  className="atm-affaire-clear"
                  onClick={() => {
                    setAffaireNum('');
                    setClient('');
                    setAffaireSearch('');
                  }}
                >
                  <Unlink size={12} />
                </Button>
              </div>
            ) : (
              <div className="atm-affaire-wrap">
                <Search size={13} className="atm-affaire-icon" />
                <Input
                  type="text"
                  value={affaireSearch}
                  onChange={(e) => {
                    setAffaireSearch(e.target.value);
                    setAffaireOpen(true);
                  }}
                  onFocus={() => setAffaireOpen(true)}
                  placeholder="N° affaire, client…"
                  className="atm-affaire-input"
                />
                {affaireOpen && (
                  <div className="atm-affaire-dropdown">
                    {filteredAffaires.length === 0 ? (
                      <div className="atm-affaire-empty">Aucune affaire trouvée</div>
                    ) : (
                      filteredAffaires.map((a) => (
                        <Button
                          variant="ghost"
                          key={a.numeroAffaire}
                          type="button"
                          className="atm-affaire-option"
                          onClick={() => {
                            setAffaireNum(a.numeroAffaire);
                            setGoogleEventId('');
                            setClient(a.client || '');
                            if (!title) setTitle(a.nom || a.event_name || '');
                            setAffaireSearch('');
                            setAffaireOpen(false);
                          }}
                        >
                          <span className="atm-affaire-opt-num">{a.numeroAffaire}</span>
                          <span className="atm-affaire-opt-client">{a.client || a.nom || ''}</span>
                        </Button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Google / iCal Event */}
          {allEvents.length > 0 && (
            <FormField className="atm-field" label="Événement associé">
              <Select
                value={googleEventId}
                onChange={(e) => {
                  const evId = e.target.value;
                  setGoogleEventId(evId);
                  setAffaireNum('');
                  if (evId) {
                    const ev = allEvents.find((ev2) => ev2.id === evId);
                    if (ev) {
                      const summary = ev.summary || ev.title || '';
                      setTitle(summary);
                      const startDT =
                        ev._source === 'ical' ? ev.start || '' : ev.start?.dateTime || '';
                      if (startDT && startDT.includes('T')) {
                        const d = safeParseDate(startDT);
                        if (d) {
                          setTime(
                            d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                          );
                          setPeriod(d.getHours() < 12 ? 'AM' : 'PM');
                        }
                      }
                      // Detection client depuis l'evenement :
                      // 1) si le summary contient un n affaire connu, prendre son client
                      // 2) sinon utiliser organizer.displayName / location en fallback
                      const upperSummary = summary.toUpperCase();
                      const matched = (affaires || []).find(
                        (a) =>
                          a.numeroAffaire &&
                          upperSummary.includes(String(a.numeroAffaire).toUpperCase()),
                      );
                      const inferred =
                        matched?.client || ev.organizer?.displayName || ev.organizer?.email || '';
                      if (inferred) setClient(inferred);
                    }
                  }
                }}
              >
                <option value="">— Événement Google / iCal —</option>
                {allEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.summary || ev.title || '(sans titre)'}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {/* Lieu (courses) */}
          {showLocation && (
            <div className="atm-field atm-field-location" ref={locationRef}>
              <label>
                <MapPin size={13} /> Lieu
              </label>
              <AddressAutocomplete
                value={locationAddress}
                onChange={(val) => setLocationAddress(val)}
                placeholder="Adresse ou lieu de la course…"
                className="atm-location-input"
                prioritySuggestions={locationSuggestionStrings}
              />
            </div>
          )}

          {/* Responsable + Client (row) */}
          <div className="atm-row">
            <FormField
              className="atm-field atm-field-half"
              label={
                <>
                  <User size={13} /> Responsable
                </>
              }
            >
              <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">— Aucun —</option>
                {sortedPersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getFavoriteDisplayName(p)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField className="atm-field atm-field-half" label="Client">
              <Input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Client..."
                list="atm-client-suggestions"
              />
              {clientSuggestions.length > 0 && (
                <datalist id="atm-client-suggestions">
                  {clientSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
            </FormField>
          </div>

          {/* Véhicule (si section compatible) */}
          {showVehicle && (
            <FormField
              className="atm-field"
              label={
                <>
                  <Truck size={13} /> Réservation véhicule
                </>
              }
            >
              <Select
                value={reservationId}
                onChange={(e) => {
                  setReservationId(e.target.value);
                  if (e.target.value !== '__new__') setVehicleId('');
                }}
              >
                <option value="">— Aucune —</option>
                {dayReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    🚗 {r.vehicleName || '?'} {r.immatriculation ? `(${r.immatriculation})` : ''} —{' '}
                    {r.clientName || r.prestationName || r.driverName || 'Sans nom'}
                  </option>
                ))}
                <option value="__new__">＋ Nouvelle réservation…</option>
              </Select>
              {reservationId === '__new__' && (
                <Select
                  className="atm-vehicle-select"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                >
                  <option value="">— Véhicule —</option>
                  {(vehicles || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.registration ? `(${v.registration})` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}

          {/* Date + Heure + Periode
            - Date : permet de cibler un autre jour que celui ouvert dans le planning.
            - Periode 'Journee' : envoie all_day=1 et masque l'heure. */}
          <div className="atm-row">
            <FormField className="atm-field atm-field-half" label="Date">
              <Input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
            </FormField>
            <FormField className="atm-field atm-field-half" label="Période">
              <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="AM">AM (Matin)</option>
                <option value="PM">PM (Après-midi)</option>
                <option value="JOURNEE">Journée (toute la journée)</option>
              </Select>
            </FormField>
          </div>

          {/* Heure (masquee si Journee) */}
          {!isAllDay && (
            <div className="atm-row">
              <FormField
                className="atm-field atm-field-half"
                label={
                  <>
                    <Clock size={13} /> Heure
                  </>
                }
              >
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeChange(e.target.value)}
                />
              </FormField>
              <div className="atm-field atm-field-half" />
            </div>
          )}
        </ModalBody>

        <ModalFooter className="atm-footer">
          <Button variant="ghost" onClick={handleSafeClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? (
              'Ajout…'
            ) : (
              <>
                <Plus size={15} /> Ajouter
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>
      {ConfirmDialogRenderer}
    </>
  );
}
