import './AssignmentDialog.css';

import { eachDayOfInterval, format, isSameDay, isWeekend as isWeekendFn, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Edit2,
  Info,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { Button, Dialog, InlineAlert, Input, Spinner, Textarea } from '@/design-system';

import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import api from '../../utils/api';
import AffaireBadge from '../AffaireBadge';

const POSITION_CATEGORIES = [
  { value: 'administratif', label: 'Administration', color: '#7c3aed' },
  { value: 'direction', label: 'Direction technique', color: STATUS_COLORS.dangerDark },
  { value: 'son', label: 'Son', color: STATUS_COLORS.info },
  { value: 'lumiere', label: 'Lumière', color: ACCENT_COLORS.amber },
  { value: 'video', label: 'Vidéo', color: ACCENT_COLORS.violet },
  { value: 'plateau', label: 'Plateau', color: STATUS_COLORS.danger },
  { value: 'backline', label: 'Backline', color: ACCENT_COLORS.orange },
  { value: 'costumes', label: 'Costumes', color: ACCENT_COLORS.pink },
  { value: 'electricite', label: 'Électricité', color: ACCENT_COLORS.cyan },
  { value: 'logistique', label: 'Logistique', color: STATUS_COLORS.success },
  { value: 'captation', label: 'Captation', color: ACCENT_COLORS.indigo },
  { value: 'production', label: 'Production', color: '#78716c' },
  { value: 'autre', label: 'Autre', color: 'var(--theme-text-gray)' },
];

/** Composant autonome : sélecteur multi-postes avec dropdown */
const PositionSelector = ({ positions, selectedPositions, setSelectedPositions }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const toggle = (name) => {
    setSelectedPositions((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const filtered = positions.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const commonPositions = filtered.filter((p) => p.isCommon);
  const positionsByCategory = {};
  filtered.forEach((p) => {
    const cat = p.category || 'autre';
    if (!positionsByCategory[cat]) positionsByCategory[cat] = [];
    positionsByCategory[cat].push(p);
  });

  return (
    <div className="asd-field asd-position-selector" ref={containerRef}>
      <label>
        Poste(s) occupé(s)
        {selectedPositions.length > 0 && (
          <span className="asd-count-badge">{selectedPositions.length}</span>
        )}
      </label>

      {/* Zone cliquable : affiche les postes sélectionnés ou placeholder */}
      <div className="asd-position-trigger" onClick={() => setOpen((prev) => !prev)}>
        {selectedPositions.length === 0 ? (
          <span className="asd-position-placeholder">Choisir un ou plusieurs postes…</span>
        ) : (
          <div className="asd-position-tags">
            {selectedPositions.map((name) => {
              const posObj = positions.find((p) => p.name === name);
              const catColor =
                POSITION_CATEGORIES.find((c) => c.value === posObj?.category)?.color ||
                'var(--theme-text-gray)';
              return (
                <span
                  key={name}
                  className="asd-position-tag"
                  style={{ borderColor: catColor, color: catColor }}
                >
                  {name}
                  <span
                    className="asd-position-tag-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(name);
                    }}
                  >
                    ×
                  </span>
                </span>
              );
            })}
          </div>
        )}
        <ChevronDown size={14} className={`asd-position-chevron ${open ? 'open' : ''}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="asd-position-dropdown">
          <div className="asd-position-search">
            <Search size={14} />
            <Input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="asd-position-list">
            {commonPositions.length > 0 && (
              <div className="asd-position-group">
                <div
                  className="asd-position-group-label"
                  style={{ color: 'var(--theme-warning, #d97706)' }}
                >
                  ⭐ Courants
                </div>
                {commonPositions.map((p) => {
                  const checked = selectedPositions.includes(p.name);
                  const catColor =
                    POSITION_CATEGORIES.find((c) => c.value === p.category)?.color ||
                    'var(--theme-text-gray)';
                  return (
                    <div
                      key={`c-${p.id}`}
                      className={`asd-position-item${checked ? ' selected' : ''}`}
                      onClick={() => toggle(p.name)}
                    >
                      <span className="asd-position-check">{checked ? '✓' : ''}</span>
                      <span className="asd-position-dot" style={{ background: catColor }} />
                      <span className="asd-position-name">{p.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {POSITION_CATEGORIES.map((cat) => {
              const catPositions = positionsByCategory[cat.value];
              if (!catPositions || catPositions.length === 0) return null;
              return (
                <div key={cat.value} className="asd-position-group">
                  <div className="asd-position-group-label" style={{ color: cat.color }}>
                    {cat.label}
                  </div>
                  {catPositions.map((p) => {
                    const checked = selectedPositions.includes(p.name);
                    return (
                      <div
                        key={p.id}
                        className={`asd-position-item${checked ? ' selected' : ''}`}
                        onClick={() => toggle(p.name)}
                      >
                        <span className="asd-position-check">{checked ? '✓' : ''}</span>
                        <span className="asd-position-dot" style={{ background: cat.color }} />
                        <span className="asd-position-name">{p.name}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {filtered.length === 0 && <div className="asd-position-empty">Aucun poste trouvé</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const SKILL_CATEGORIES = [
  { value: 'son', label: 'Son', color: STATUS_COLORS.info },
  { value: 'lumière', label: 'Lumière', color: ACCENT_COLORS.amber },
  { value: 'vidéo', label: 'Vidéo', color: ACCENT_COLORS.violet },
  { value: 'plateau', label: 'Plateau', color: STATUS_COLORS.danger },
  { value: 'régie', label: 'Régie', color: ACCENT_COLORS.orange },
  { value: 'conduite', label: 'Conduite', color: ACCENT_COLORS.cyan },
  { value: 'logistique', label: 'Logistique', color: STATUS_COLORS.success },
  { value: 'autre', label: 'Autre', color: 'var(--theme-text-gray)' },
];

/**
 * AssignmentDialog — Dialog to create or edit a mission + assignment from a planning cell click
 *
 * Props:
 *   person      — the person object (from the row)
 *   day         — the Date clicked
 *   period      — 'AM' | 'PM'
 *   skills      — full skills list
 *   editMission — { mission, assignment } if editing (null for create)
 *   onClose     — close handler
 *   onCreated   — callback after successful creation/update
 *   onDelete    — callback to delete the mission
 */
const EMPTY_GOOGLE_EVENTS = [];

const AssignmentDialog = ({
  person,
  day,
  endDay,
  period,
  skills,
  positions = [],
  editMission,
  googleEvents,
  onClose,
  onCreated,
  onDelete,
}) => {
  // Référence stable pour le tableau vide par défaut
  const stableGoogleEvents = googleEvents || EMPTY_GOOGLE_EVENTS;
  // Sécuriser le jour pour éviter les erreurs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeDay = day instanceof Date && !isNaN(day) ? day : new Date();

  const isEdit = !!editMission;
  const existingMission = editMission?.mission;
  const existingAssignment = editMission?.assignment;

  // State
  const [affaires, setAffaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [selectedAffaire, setSelectedAffaire] = useState(() => {
    if (!existingMission) return null;
    // Reconstruire l'affaire depuis le titre de la mission (format: "NUMAFFAIRE — Titre")
    const title = existingMission.title || '';
    const parts = title.split(' — ');
    const numeroAffaire = parts.length > 1 ? parts[0].trim() : '';
    const titre = parts.length > 1 ? parts.slice(1).join(' — ').trim() : title;
    if (!numeroAffaire && !titre) return null;
    return {
      numeroAffaire,
      titre,
      client: existingMission.clientName || existingMission.client_name || '',
      adresseLivraison: existingMission.locationName || existingMission.location_name || '',
      dateDebut:
        (existingMission.startDate || existingMission.start_date || '').split('T')[0] || null,
      dateFin: (existingMission.endDate || existingMission.end_date || '').split('T')[0] || null,
      source: 'existing',
    };
  });
  const [affaireSearch, setAffaireSearch] = useState('');
  const [showAffaireDropdown, setShowAffaireDropdown] = useState(false);

  // Dates & horaires — pré-remplir depuis mission existante
  const [startDate, setStartDate] = useState(() => {
    try {
      if (existingMission)
        return (
          (existingMission.startDate || existingMission.start_date || '').split('T')[0] ||
          format(safeDay, 'yyyy-MM-dd')
        );
      return format(safeDay, 'yyyy-MM-dd');
    } catch (e) {
      console.error('[AssignmentDialog] startDate init error:', e);
      return format(new Date(), 'yyyy-MM-dd');
    }
  });
  const [endDate, setEndDate] = useState(() => {
    try {
      const theEnd = endDay instanceof Date && !isNaN(endDay) ? endDay : safeDay;
      if (existingMission)
        return (
          (existingMission.endDate || existingMission.end_date || '').split('T')[0] ||
          format(theEnd, 'yyyy-MM-dd')
        );
      return format(theEnd, 'yyyy-MM-dd');
    } catch (e) {
      console.error('[AssignmentDialog] endDate init error:', e);
      return format(new Date(), 'yyyy-MM-dd');
    }
  });
  const [startTime, setStartTime] = useState(
    existingMission
      ? existingMission.startTime || existingMission.start_time || ''
      : period === 'PM'
        ? '14:00'
        : '08:00',
  );
  const [endTime, setEndTime] = useState(
    existingMission
      ? existingMission.endTime || existingMission.end_time || ''
      : period === 'PM'
        ? '19:00'
        : '13:00',
  );

  // Jours ON / OFF — pré-remplir depuis mission existante
  const [dayStates, setDayStates] = useState(() => {
    if (!existingMission) return {};
    // dayStates stocké comme JSON array de jours OFF
    const raw = existingMission.dayStates || existingMission.day_states;
    if (!raw) return {};
    try {
      const offDays = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(offDays)) {
        const states = {};
        offDays.forEach((d) => {
          states[d] = 'off';
        });
        return states;
      }
    } catch {
      /* ignore parse error */
    }
    return {};
  }); // { 'yyyy-MM-dd': 'on' | 'off' }

  // Poste / compétence — pré-remplir (multi-sélection)
  const [selectedSkillIds, setSelectedSkillIds] = useState(() => {
    if (!existingMission) return [];
    const raw =
      existingMission.requiredSkills ||
      existingMission.required_skills ||
      existingMission.requiredSkillId ||
      existingMission.required_skill_id;
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      /* single ID */
    }
    const num = parseInt(raw);
    return isNaN(num) ? [] : [num];
  });
  const [selectedPositions, setSelectedPositions] = useState(() => {
    const raw = existingAssignment?.position || existingMission?.position || '';
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* single string value */
    }
    return raw ? [raw] : [];
  });
  const [status, setStatus] = useState(existingAssignment?.status || 'option');
  const [notes, setNotes] = useState(existingMission?.notes || existingAssignment?.comment || '');

  // Personnel — pour réaffectation en mode édition ou multi-affectation en mode création
  const [allPersons, setAllPersons] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(person.id);
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Multi-affectation : IDs des personnes supplémentaires (en plus de la personne principale)
  const [additionalPersonIds, setAdditionalPersonIds] = useState([]);
  const [showAddPersonDropdown, setShowAddPersonDropdown] = useState(false);
  const [addPersonSearch, setAddPersonSearch] = useState('');
  const addPersonContainerRef = useRef(null);

  // Capturer l'état initial pour détecter les modifications
  const initialStateRef = useRef(null);
  useEffect(() => {
    if (!initialStateRef.current && !loading) {
      initialStateRef.current = JSON.stringify({
        selectedAffaire: selectedAffaire?.numeroAffaire,
        startDate,
        endDate,
        startTime,
        endTime,
        dayStates,
        selectedSkillIds,
        selectedPositions,
        status,
        notes,
        selectedPersonId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const hasFormChanges = () => {
    if (!initialStateRef.current) return false;
    const current = JSON.stringify({
      selectedAffaire: selectedAffaire?.numeroAffaire,
      startDate,
      endDate,
      startTime,
      endTime,
      dayStates,
      selectedSkillIds,
      selectedPositions,
      status,
      notes,
      selectedPersonId,
    });
    return current !== initialStateRef.current;
  };

  const handleSafeClose = () => {
    if (hasFormChanges()) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };

  // Convertir les événements Google Calendar en format affaire
  const googleAffaires = useMemo(() => {
    if (!stableGoogleEvents || stableGoogleEvents.length === 0) return [];
    return stableGoogleEvents.map((ev) => {
      const startRaw = ev.start?.dateTime || ev.start?.date || '';
      const endRaw = ev.end?.dateTime || ev.end?.date || '';
      const dateDebut = startRaw ? startRaw.split('T')[0] : null;
      const dateFin = endRaw ? endRaw.split('T')[0] : null;
      return {
        id: ev.id || null,
        numeroAffaire: ev.affaire || '',
        titre: ev.summary || '',
        client: ev.detectedClient || '',
        dateDebut,
        dateFin,
        adresseLivraison: ev.detectedLocation || ev.location || '',
        eventName: ev.summary || '',
        source: 'google',
      };
    });
  }, [stableGoogleEvents]);

  // Charger la liste du personnel (pour réaffectation ou multi-affectation)
  useEffect(() => {
    const loadPersons = async () => {
      try {
        const data = await api.getPersons();
        setAllPersons(data || []);
      } catch (err) {
        console.error('Erreur chargement personnel:', err);
      }
    };
    loadPersons();
  }, []);

  // Fermer le dropdown d'ajout de personnes au clic extérieur
  useEffect(() => {
    if (!showAddPersonDropdown) return;
    const handleClickOutside = (e) => {
      if (addPersonContainerRef.current && !addPersonContainerRef.current.contains(e.target)) {
        setShowAddPersonDropdown(false);
        setAddPersonSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddPersonDropdown]);

  const selectedPerson = useMemo(() => {
    if (selectedPersonId === person.id) return person;
    return allPersons.find((p) => p.id === selectedPersonId) || person;
  }, [selectedPersonId, person, allPersons]);

  const filteredPersons = useMemo(() => {
    if (!personSearch.trim()) return allPersons;
    const q = personSearch.toLowerCase();
    return allPersons.filter(
      (p) =>
        `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(q) ||
        (p.type || '').toLowerCase().includes(q),
    );
  }, [allPersons, personSearch]);

  // Multi-affectation : personnes supplémentaires résolues
  const additionalPersons = useMemo(() => {
    return additionalPersonIds.map((id) => allPersons.find((p) => p.id === id)).filter(Boolean);
  }, [additionalPersonIds, allPersons]);

  // Multi-affectation : liste filtrée pour ajout (exclure la personne principale et celles déjà ajoutées)
  const filteredAddPersons = useMemo(() => {
    const excludedIds = new Set([person.id, ...additionalPersonIds]);
    let list = allPersons.filter((p) => !excludedIds.has(p.id));
    if (addPersonSearch.trim()) {
      const q = addPersonSearch.toLowerCase();
      list = list.filter(
        (p) =>
          `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(q) ||
          (p.type || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [allPersons, person.id, additionalPersonIds, addPersonSearch]);

  // Charger les affaires
  useEffect(() => {
    const loadAffaires = async () => {
      try {
        setLoading(true);
        const data = await api.getAffaires();
        // Fusionner affaires DB + Google Calendar (dédupliquer par numéro d'affaire)
        const dbAffaires = data || [];
        const knownNums = new Set(dbAffaires.map((a) => a.numeroAffaire).filter(Boolean));
        const extraGoogle = googleAffaires.filter(
          (ga) => !ga.numeroAffaire || !knownNums.has(ga.numeroAffaire),
        );
        setAffaires([...dbAffaires, ...extraGoogle]);
      } catch (err) {
        console.error('Erreur chargement affaires:', err);
        // Fallback : utiliser uniquement les événements Google
        setAffaires(googleAffaires);
      } finally {
        setLoading(false);
      }
    };
    loadAffaires();
  }, [googleAffaires]);

  // Calculer les jours de la plage
  const rangeDays = useMemo(() => {
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (end < start) return [start];
      return eachDayOfInterval({ start, end });
    } catch (e) {
      console.error('[AssignmentDialog] rangeDays error:', e);
      return [safeDay];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, safeDay]);

  // Initialiser les dayStates quand la plage de dates change
  useEffect(() => {
    setDayStates((prev) => {
      const next = {};
      rangeDays.forEach((d) => {
        const key = format(d, 'yyyy-MM-dd');
        next[key] = prev[key] || 'on';
      });
      return next;
    });
  }, [rangeDays]);

  // Filtrer et trier les affaires
  const filteredAffaires = useMemo(() => {
    let filtered = affaires;

    // Filtrer par recherche
    if (affaireSearch.trim()) {
      const q = affaireSearch.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          (a.numeroAffaire || '').toLowerCase().includes(q) ||
          (a.titre || '').toLowerCase().includes(q) ||
          (a.client || '').toLowerCase().includes(q) ||
          (a.eventName || '').toLowerCase().includes(q),
      );
    }

    // Trier : celles qui chevauchent la période en premier
    filtered = filtered.map((a) => {
      const aStart = a.dateDebut ? a.dateDebut.split('T')[0] : null;
      const aEnd = a.dateFin ? a.dateFin.split('T')[0] : null;
      const overlaps =
        aStart && aEnd
          ? aStart <= endDate && aEnd >= startDate
          : !aStart && !aEnd
            ? true
            : aStart
              ? aStart <= endDate
              : aEnd >= startDate;
      return { ...a, _overlaps: overlaps };
    });

    // D'abord celles qui chevauchent, puis les autres
    filtered.sort((a, b) => {
      if (a._overlaps && !b._overlaps) return -1;
      if (!a._overlaps && b._overlaps) return 1;
      return (b.dateDebut || '').localeCompare(a.dateDebut || '');
    });

    return filtered;
  }, [affaires, startDate, endDate, affaireSearch]);

  // Vérifier si la personne a les compétences sélectionnées
  const skillWarnings = useMemo(() => {
    if (!skills || selectedSkillIds.length === 0) return null;
    const missing = selectedSkillIds.filter((id) => !person.skills?.some((s) => s.skillId === id));
    if (missing.length === 0) return null;
    const names = missing.map((id) => (skills || []).find((s) => s.id === id)?.name || 'inconnue');
    return `${person.firstName} ${person.lastName} ne possède pas : ${names.join(', ')}`;
  }, [selectedSkillIds, person, skills]);

  // Calculer les jours ON
  const onDays = useMemo(() => {
    return rangeDays.filter((d) => dayStates[format(d, 'yyyy-MM-dd')] !== 'off');
  }, [rangeDays, dayStates]);

  const toggleDayState = (dateKey) => {
    setDayStates((prev) => ({
      ...prev,
      [dateKey]: prev[dateKey] === 'off' ? 'on' : 'off',
    }));
  };

  const setAllDays = (state) => {
    setDayStates((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => {
        next[k] = state;
      });
      return next;
    });
  };

  // Sauvegarder
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Titre de la mission
      const title = selectedAffaire
        ? `${selectedAffaire.numeroAffaire || ''} — ${selectedAffaire.titre || selectedAffaire.eventName || selectedAffaire.client || 'Mission'}`.trim()
        : selectedPositions.length > 0
          ? selectedPositions.join(', ')
          : `Mission ${format(parseISO(startDate), 'd MMM yyyy', { locale: fr })}`;

      // Sérialiser les jours OFF (on ne stocke que les jours explicitement OFF)
      const offDays = Object.entries(dayStates)
        .filter(([, v]) => v === 'off')
        .map(([k]) => k);
      const dayStatesJson = offDays.length > 0 ? JSON.stringify(offDays) : null;

      // Données mission (snake_case pour le serveur)
      const positionValue = selectedPositions.length > 0 ? JSON.stringify(selectedPositions) : null;
      const missionData = {
        title,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime || null,
        end_time: endTime || null,
        position: positionValue,
        required_skills: selectedSkillIds.length > 0 ? JSON.stringify(selectedSkillIds) : null,
        client_name: selectedAffaire?.client || null,
        location_name: selectedAffaire?.adresseLivraison || null,
        reservation_id: null,
        status: 'open',
        notes: notes || null,
        day_states: dayStatesJson,
      };

      let mission, assignment;

      if (isEdit) {
        // ── Mode édition : mettre à jour ──
        const missionId = existingMission.id;
        mission = await api.updateMission(missionId, missionData);

        // Mettre à jour l'affectation existante
        const assignmentId = existingAssignment?.id;
        if (assignmentId) {
          const assignmentData = {
            person_id: selectedPersonId,
            status: status,
            position: positionValue,
            comment: notes || null,
          };
          assignment = await api.updateAssignment(assignmentId, assignmentData);
        } else {
          console.warn("[AssignmentDialog] Pas d'assignmentId — affectation non mise à jour");
        }
      } else {
        // ── Mode création ──
        mission = await api.createMission(missionData);

        // Tous les person IDs à affecter (principal + supplémentaires)
        const allPersonIdsToAssign = [person.id, ...additionalPersonIds];
        const allWarnings = [];

        for (const personId of allPersonIdsToAssign) {
          const assignmentData = {
            mission_id: mission.id,
            person_id: personId,
            status: status,
            position: positionValue,
            comment: notes || null,
          };

          const result = await api.createAssignment(assignmentData);
          if (!assignment) assignment = result; // garder la première pour le callback

          // Collecter les warnings de chaque affectation
          if (result.warnings) {
            const pName = allPersons.find((p) => p.id === personId);
            const prefix =
              allPersonIdsToAssign.length > 1 && pName
                ? `${pName.firstName} ${pName.lastName}: `
                : '';
            if (result.warnings.conflicts) {
              allWarnings.push(
                `${prefix}⚠️ Conflit avec ${result.warnings.conflicts.length} autre(s) mission(s)`,
              );
            }
            if (result.warnings.unavailabilities) {
              allWarnings.push(
                `${prefix}⚠️ ${result.warnings.unavailabilities.length} indisponibilité(s) sur cette période`,
              );
            }
          }
        }

        if (allWarnings.length > 0) {
          setError(allWarnings.join('\n'));
        }
      }

      setSuccess(true);
      setTimeout(() => {
        if (onCreated) onCreated(mission, assignment);
        onClose();
      }, 800);
    } catch (err) {
      console.error('[AssignmentDialog] ERREUR sauvegarde:', err);
      console.error('[AssignmentDialog] err.message:', err.message);
      console.error('[AssignmentDialog] err.stack:', err.stack);
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Sélectionner une affaire
  const selectAffaire = (affaire) => {
    setSelectedAffaire(affaire);
    setShowAffaireDropdown(false);
    setAffaireSearch('');

    // Pré-remplir les dates si l'affaire en a
    if (affaire.dateDebut) {
      const aStartDate = affaire.dateDebut.split('T')[0];
      const aEndDate = affaire.dateFin ? affaire.dateFin.split('T')[0] : aStartDate;
      // Ne changer les dates que si elles débordent de l'affaire
      if (startDate < aStartDate) setStartDate(aStartDate);
      if (endDate > aEndDate) setEndDate(aEndDate);
    }
  };

  // Raccourci pour la catégorie d'une compétence
  const _getSkillCategory = (skillId) => {
    const skill = (skills || []).find((s) => s.id === parseInt(skillId));
    if (!skill) return null;
    return SKILL_CATEGORIES.find((c) => c.value === skill.category);
  };

  // Grouper les compétences par catégorie
  const skillsByCategory = useMemo(() => {
    const groups = {};
    (skills || []).forEach((skill) => {
      const cat = skill.category || 'autre';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(skill);
    });
    return groups;
  }, [skills]);

  const dialogContent = (
    <div
      className="assignment-dialog-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && handleSafeClose()}
    >
      <div
        className="assignment-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Affectation"
      >
        {/* Header */}
        <div className="assignment-dialog-header">
          <div className="assignment-dialog-title">
            {isEdit ? <Edit2 size={20} /> : <Briefcase size={20} />}
            <span>{isEdit ? 'Modifier l\u2019affectation' : 'Nouvelle affectation'}</span>
          </div>
          <div className="assignment-dialog-header-actions">
            {isEdit && onDelete && (
              <Button
                variant="ghost"
                className="asd-btn-header-delete"
                onClick={() => onDelete(existingMission)}
                title="Supprimer cette mission"
              >
                <Trash2 size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              className="assignment-dialog-close"
              onClick={handleSafeClose}
              aria-label="Fermer"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="assignment-dialog-body">
          {/* Personne */}
          <div className="asd-section asd-person-section">
            <div className="asd-section-label">
              <User size={14} />
              <span>Personnel</span>
              {isEdit && <span className="asd-optional">(cliquer pour changer)</span>}
            </div>
            {isEdit ? (
              <div className="asd-person-selector">
                <div
                  className="asd-person-badge asd-person-selectable"
                  onClick={() => setShowPersonDropdown(!showPersonDropdown)}
                >
                  <span className="asd-person-name">
                    {selectedPerson.firstName} {selectedPerson.lastName}
                  </span>
                  <span className={`asd-person-type type-${selectedPerson.type}`}>
                    {selectedPerson.type === 'permanent'
                      ? 'Permanent'
                      : selectedPerson.contractType || 'Contractuel'}
                  </span>
                  <ChevronDown size={14} className="asd-person-chevron" />
                </div>
                {showPersonDropdown && (
                  <div className="asd-person-dropdown-wrapper">
                    <Input
                      type="text"
                      className="asd-person-search"
                      placeholder="Rechercher un personnel…"
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="asd-person-dropdown">
                      {filteredPersons.map((p) => (
                        <div
                          key={p.id}
                          className={`asd-person-option${p.id === selectedPersonId ? ' selected' : ''}`}
                          onClick={() => {
                            setSelectedPersonId(p.id);
                            setShowPersonDropdown(false);
                            setPersonSearch('');
                          }}
                        >
                          <span className="asd-person-opt-name">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className={`asd-person-opt-type type-${p.type}`}>
                            {p.type === 'permanent' ? 'Perm.' : p.contractType || 'Contr.'}
                          </span>
                          {p.id === selectedPersonId && <Check size={14} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="asd-person-badge">
                  <span className="asd-person-name">
                    {person.firstName} {person.lastName}
                  </span>
                  <span className={`asd-person-type type-${person.type}`}>
                    {person.type === 'permanent'
                      ? 'Permanent'
                      : person.contractType || 'Contractuel'}
                  </span>
                  {person.skills?.length > 0 && (
                    <div className="asd-person-skills">
                      {person.skills.map((s) => {
                        const cat = SKILL_CATEGORIES.find((c) => c.value === s.category);
                        return (
                          <span
                            key={s.skillId}
                            className="asd-skill-tag"
                            style={{
                              backgroundColor: cat?.color + '20',
                              color: cat?.color,
                              borderColor: cat?.color + '40',
                            }}
                          >
                            {s.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Multi-affectation : personnes supplémentaires */}
                {additionalPersons.length > 0 && (
                  <div className="asd-multi-persons">
                    {additionalPersons.map((p) => (
                      <div key={p.id} className="asd-person-badge asd-person-additional">
                        <span className="asd-person-name">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className={`asd-person-type type-${p.type}`}>
                          {p.type === 'permanent' ? 'Perm.' : p.contractType || 'Contr.'}
                        </span>
                        <Button
                          variant="ghost"
                          className="asd-person-remove"
                          onClick={() =>
                            setAdditionalPersonIds((prev) => prev.filter((id) => id !== p.id))
                          }
                          title="Retirer"
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bouton / dropdown d'ajout de personnel supplémentaire */}
                <div className="asd-add-person-wrapper" ref={addPersonContainerRef}>
                  <Button
                    variant="ghost"
                    className="asd-btn-add-person"
                    onClick={() => {
                      setShowAddPersonDropdown(!showAddPersonDropdown);
                      setAddPersonSearch('');
                    }}
                    title="Ajouter un personnel à cette mission"
                  >
                    <Users size={14} />
                    <Plus size={12} />
                    <span>Ajouter personnel</span>
                  </Button>
                  {showAddPersonDropdown && (
                    <div className="asd-add-person-dropdown">
                      <Input
                        type="text"
                        className="asd-person-search"
                        placeholder="Rechercher un personnel…"
                        value={addPersonSearch}
                        onChange={(e) => setAddPersonSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="asd-person-dropdown">
                        {filteredAddPersons.length === 0 ? (
                          <div className="asd-affaire-empty">Aucun personnel disponible</div>
                        ) : (
                          filteredAddPersons.slice(0, 15).map((p) => (
                            <div
                              key={p.id}
                              className="asd-person-option"
                              onClick={() => {
                                setAdditionalPersonIds((prev) => [...prev, p.id]);
                                setAddPersonSearch('');
                              }}
                            >
                              <span className="asd-person-opt-name">
                                {p.firstName} {p.lastName}
                              </span>
                              <span className={`asd-person-opt-type type-${p.type}`}>
                                {p.type === 'permanent' ? 'Perm.' : p.contractType || 'Contr.'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Affaire / Événement */}
          <div className="asd-section">
            <div className="asd-section-label">
              <Calendar size={14} />
              <span>Événement / Affaire</span>
              <span className="asd-optional">(optionnel)</span>
            </div>
            <div className="asd-affaire-selector">
              {selectedAffaire ? (
                <div className="asd-affaire-selected">
                  <div className="asd-affaire-info">
                    <AffaireBadge
                      numero={selectedAffaire.numeroAffaire}
                      type={selectedAffaire.type}
                      size="sm"
                    />
                    <span className="asd-affaire-titre">
                      {selectedAffaire.titre || selectedAffaire.eventName || ''}
                    </span>
                    <span className="asd-affaire-client">{selectedAffaire.client || ''}</span>
                    {selectedAffaire.dateDebut && (
                      <span className="asd-affaire-dates">
                        {format(parseISO(selectedAffaire.dateDebut.split('T')[0]), 'd MMM', {
                          locale: fr,
                        })}
                        {selectedAffaire.dateFin &&
                          ` → ${format(parseISO(selectedAffaire.dateFin.split('T')[0]), 'd MMM yyyy', { locale: fr })}`}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    className="asd-affaire-remove"
                    onClick={() => setSelectedAffaire(null)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <div className="asd-affaire-dropdown-wrapper">
                  <Input
                    type="text"
                    className="asd-affaire-search"
                    placeholder={
                      loading ? 'Chargement…' : `Rechercher parmi ${affaires.length} affaire(s)…`
                    }
                    value={affaireSearch}
                    onChange={(e) => {
                      setAffaireSearch(e.target.value);
                      setShowAffaireDropdown(true);
                    }}
                    onFocus={() => setShowAffaireDropdown(true)}
                  />
                  {showAffaireDropdown && (
                    <div className="asd-affaire-dropdown">
                      {filteredAffaires.length === 0 ? (
                        <div className="asd-affaire-empty">
                          {affaires.length === 0
                            ? 'Aucune affaire en base'
                            : 'Aucun résultat pour cette recherche'}
                        </div>
                      ) : (
                        filteredAffaires.slice(0, 20).map((a) => (
                          <div
                            key={a.id || a.numeroAffaire}
                            className={`asd-affaire-option ${a._overlaps ? 'overlaps' : 'no-overlap'}`}
                            onClick={() => selectAffaire(a)}
                          >
                            <div className="asd-affaire-opt-left">
                              <AffaireBadge numero={a.numeroAffaire} type={a.type} size="sm" />
                              <span className="asd-affaire-opt-title">
                                {a.titre || a.eventName || ''}
                              </span>
                            </div>
                            <div className="asd-affaire-opt-right">
                              <span className="asd-affaire-opt-client">{a.client || ''}</span>
                              {a.dateDebut && (
                                <span className="asd-affaire-opt-dates">
                                  {format(parseISO(a.dateDebut.split('T')[0]), 'dd/MM', {
                                    locale: fr,
                                  })}
                                  {a.dateFin &&
                                    ` → ${format(parseISO(a.dateFin.split('T')[0]), 'dd/MM', { locale: fr })}`}
                                </span>
                              )}
                              {!a._overlaps && (
                                <span className="asd-affaire-opt-warn">hors période</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Dates & Horaires */}
          <div className="asd-section">
            <div className="asd-section-label">
              <Clock size={14} />
              <span>Dates & Horaires</span>
            </div>
            <div className="asd-dates-grid">
              <div className="asd-field">
                <label>Début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="asd-field">
                <label>Fin</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="asd-field">
                <label>Heure début</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="asd-field">
                <label>Heure fin</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Jours ON / OFF si multi-jours */}
          {rangeDays.length > 1 && (
            <div className="asd-section">
              <div className="asd-section-label">
                <Calendar size={14} />
                <span>Jours d'activité</span>
                <span className="asd-day-count">
                  {onDays.length}/{rangeDays.length} jour(s) ON
                </span>
              </div>
              <div className="asd-days-actions">
                <Button variant="ghost" className="asd-days-btn" onClick={() => setAllDays('on')}>
                  Tous ON
                </Button>
                <Button variant="ghost" className="asd-days-btn" onClick={() => setAllDays('off')}>
                  Tous OFF
                </Button>
                <Button
                  variant="ghost"
                  className="asd-days-btn"
                  onClick={() => {
                    // Toggle weekends OFF
                    setDayStates((prev) => {
                      const next = { ...prev };
                      rangeDays.forEach((d) => {
                        const key = format(d, 'yyyy-MM-dd');
                        if (isWeekendFn(d)) next[key] = next[key] === 'off' ? 'on' : 'off';
                      });
                      return next;
                    });
                  }}
                >
                  Toggle W-E
                </Button>
              </div>
              <div className="asd-days-grid">
                {rangeDays.map((d) => {
                  const key = format(d, 'yyyy-MM-dd');
                  const isOff = dayStates[key] === 'off';
                  const weekend = isWeekendFn(d);
                  const today = isSameDay(d, new Date());
                  return (
                    <div
                      key={key}
                      className={`asd-day-cell ${isOff ? 'off' : 'on'} ${weekend ? 'weekend' : ''} ${today ? 'today' : ''}`}
                      onClick={() => toggleDayState(key)}
                      title={`${format(d, 'EEEE d MMMM', { locale: fr })} — ${isOff ? 'OFF' : 'ON'}`}
                    >
                      <span className="asd-day-label">{format(d, 'EEE', { locale: fr })}</span>
                      <span className="asd-day-num">{format(d, 'd', { locale: fr })}</span>
                      <span className={`asd-day-state ${isOff ? 'off' : 'on'}`}>
                        {isOff ? 'OFF' : 'ON'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Poste / Compétence requise */}
          <div className="asd-section">
            <div className="asd-section-label">
              <Briefcase size={14} />
              <span>Poste & Compétence</span>
            </div>
            <div className="asd-post-grid">
              <PositionSelector
                positions={positions}
                selectedPositions={selectedPositions}
                setSelectedPositions={setSelectedPositions}
              />
              <div className="asd-field">
                <label>Compétences requises</label>
                <div className="asd-skills-multi">
                  {Object.entries(skillsByCategory).map(([cat, catSkills]) => {
                    const catInfo = SKILL_CATEGORIES.find((c) => c.value === cat);
                    return (
                      <div key={cat} className="asd-skills-category">
                        <span className="asd-skills-cat-label" style={{ color: catInfo?.color }}>
                          {catInfo?.label || cat}
                        </span>
                        <div className="asd-skills-cat-items">
                          {catSkills.map((s) => {
                            const checked = selectedSkillIds.includes(s.id);
                            return (
                              <div
                                key={s.id}
                                className={`asd-skill-checkbox${checked ? ' checked' : ''}`}
                                style={{
                                  '--skill-color': catInfo?.color || 'var(--theme-text-gray)',
                                }}
                                onClick={() => {
                                  setSelectedSkillIds((prev) =>
                                    prev.includes(s.id)
                                      ? prev.filter((id) => id !== s.id)
                                      : [...prev, s.id],
                                  );
                                }}
                              >
                                {checked && <Check size={10} />}
                                <span className="asd-skill-check-name">{s.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Warning compétences non détenues */}
            {skillWarnings && <InlineAlert variant="warning">{skillWarnings}</InlineAlert>}
          </div>

          {/* Statut & Notes */}
          <div className="asd-section">
            <div className="asd-section-label">
              <Info size={14} />
              <span>Statut & Notes</span>
            </div>
            <div className="asd-status-grid">
              <div className="asd-field">
                <label>Statut de l'affectation</label>
                <div className="asd-status-options">
                  {[
                    { value: 'confirmed', label: 'Confirmé', color: STATUS_COLORS.success },
                    { value: 'option', label: 'Option', color: STATUS_COLORS.warning },
                    { value: 'proposed', label: 'Proposé', color: 'var(--theme-text-gray)' },
                  ].map((opt) => (
                    <Button
                      variant="ghost"
                      key={opt.value}
                      className={`asd-status-btn ${status === opt.value ? 'active' : ''}`}
                      style={{ '--btn-color': opt.color }}
                      onClick={() => setStatus(opt.value)}
                    >
                      {status === opt.value && <Check size={12} />}
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="asd-field">
                <label>Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes de mission…"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Erreur / Succès */}
          {error && <InlineAlert>{error}</InlineAlert>}
          {success && (
            <InlineAlert variant="success">
              {isEdit
                ? 'Affectation mise à jour !'
                : additionalPersonIds.length > 0
                  ? `${1 + additionalPersonIds.length} affectations créées avec succès !`
                  : 'Affectation créée avec succès !'}
            </InlineAlert>
          )}
        </div>

        {/* Footer */}
        <div className="assignment-dialog-footer">
          <Button
            variant="ghost"
            className="asd-btn asd-btn-cancel"
            onClick={handleSafeClose}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button
            variant="ghost"
            className="asd-btn asd-btn-save"
            onClick={handleSave}
            disabled={saving || success}
          >
            {saving ? (
              <>
                <Spinner size="sm" />
                Enregistrement…
              </>
            ) : (
              <>
                <Save size={16} />
                {isEdit
                  ? 'Enregistrer'
                  : additionalPersonIds.length > 0
                    ? `Créer ${1 + additionalPersonIds.length} affectations`
                    : "Créer l'affectation"}
              </>
            )}
          </Button>
        </div>
      </div>

      <Dialog
        open={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={() => {
          setShowUnsavedWarning(false);
          onClose();
        }}
        title="Modifications non enregistrées"
        variant="warning"
        confirmLabel="Ne pas enregistrer"
        cancelLabel="Continuer l'édition"
        confirmVariant="danger"
      >
        Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?
      </Dialog>
    </div>
  );

  return ReactDOM.createPortal(dialogContent, document.body);
};

export default React.memo(AssignmentDialog);
