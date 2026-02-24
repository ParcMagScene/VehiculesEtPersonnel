import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Save, Calendar, Clock, User, Briefcase, AlertTriangle,
  ChevronDown, ChevronUp, Plus, Minus, Check, Info, Trash2, Edit2, Users, Search,
} from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isWeekend as isWeekendFn, isSameDay, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import './AssignmentDialog.css';

const POSITION_CATEGORIES = [
  { value: 'administratif', label: 'Administration', color: '#7c3aed' },
  { value: 'direction', label: 'Direction technique', color: '#dc2626' },
  { value: 'son', label: 'Son', color: '#3b82f6' },
  { value: 'lumiere', label: 'Lumière', color: '#eab308' },
  { value: 'video', label: 'Vidéo', color: '#8b5cf6' },
  { value: 'plateau', label: 'Plateau', color: '#ef4444' },
  { value: 'backline', label: 'Backline', color: '#f97316' },
  { value: 'costumes', label: 'Costumes', color: '#ec4899' },
  { value: 'electricite', label: 'Électricité', color: '#06b6d4' },
  { value: 'logistique', label: 'Logistique', color: '#10b981' },
  { value: 'captation', label: 'Captation', color: '#6366f1' },
  { value: 'production', label: 'Production', color: '#78716c' },
  { value: 'autre', label: 'Autre', color: '#6b7280' },
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
    setSelectedPositions(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const filtered = positions.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const commonPositions = filtered.filter(p => p.isCommon);
  const positionsByCategory = {};
  filtered.forEach(p => {
    const cat = p.category || 'autre';
    if (!positionsByCategory[cat]) positionsByCategory[cat] = [];
    positionsByCategory[cat].push(p);
  });

  return (
    <div className="asd-field asd-position-selector" ref={containerRef}>
      <label>
        Poste(s) occupé(s)
        {selectedPositions.length > 0 && <span className="asd-count-badge">{selectedPositions.length}</span>}
      </label>

      {/* Zone cliquable : affiche les postes sélectionnés ou placeholder */}
      <div
        className="asd-position-trigger"
        onClick={() => setOpen(prev => !prev)}
      >
        {selectedPositions.length === 0 ? (
          <span className="asd-position-placeholder">Choisir un ou plusieurs postes…</span>
        ) : (
          <div className="asd-position-tags">
            {selectedPositions.map(name => {
              const posObj = positions.find(p => p.name === name);
              const catColor = POSITION_CATEGORIES.find(c => c.value === posObj?.category)?.color || '#6b7280';
              return (
                <span
                  key={name}
                  className="asd-position-tag"
                  style={{ borderColor: catColor, color: catColor }}
                >
                  {name}
                  <span
                    className="asd-position-tag-remove"
                    onClick={(e) => { e.stopPropagation(); toggle(name); }}
                  >×</span>
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
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          </div>

          <div className="asd-position-list">
            {commonPositions.length > 0 && (
              <div className="asd-position-group">
                <div className="asd-position-group-label" style={{ color: '#d97706' }}>⭐ Courants</div>
                {commonPositions.map(p => {
                  const checked = selectedPositions.includes(p.name);
                  const catColor = POSITION_CATEGORIES.find(c => c.value === p.category)?.color || '#6b7280';
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

            {POSITION_CATEGORIES.map(cat => {
              const catPositions = positionsByCategory[cat.value];
              if (!catPositions || catPositions.length === 0) return null;
              return (
                <div key={cat.value} className="asd-position-group">
                  <div className="asd-position-group-label" style={{ color: cat.color }}>{cat.label}</div>
                  {catPositions.map(p => {
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

            {filtered.length === 0 && (
              <div className="asd-position-empty">Aucun poste trouvé</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SKILL_CATEGORIES = [
  { value: 'son', label: 'Son', color: '#3b82f6' },
  { value: 'lumière', label: 'Lumière', color: '#eab308' },
  { value: 'vidéo', label: 'Vidéo', color: '#8b5cf6' },
  { value: 'plateau', label: 'Plateau', color: '#ef4444' },
  { value: 'régie', label: 'Régie', color: '#f97316' },
  { value: 'conduite', label: 'Conduite', color: '#06b6d4' },
  { value: 'logistique', label: 'Logistique', color: '#10b981' },
  { value: 'autre', label: 'Autre', color: '#6b7280' },
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
const AssignmentDialog = ({ person, day, endDay, period, skills, positions = [], editMission, googleEvents = [], onClose, onCreated, onDelete }) => {
  // Sécuriser le jour pour éviter les erreurs
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
      dateDebut: (existingMission.startDate || existingMission.start_date || '').split('T')[0] || null,
      dateFin: (existingMission.endDate || existingMission.end_date || '').split('T')[0] || null,
      source: 'existing',
    };
  });
  const [affaireSearch, setAffaireSearch] = useState('');
  const [showAffaireDropdown, setShowAffaireDropdown] = useState(false);

  // Dates & horaires — pré-remplir depuis mission existante
  const [startDate, setStartDate] = useState(() => {
    try {
      if (existingMission) return (existingMission.startDate || existingMission.start_date || '').split('T')[0] || format(safeDay, 'yyyy-MM-dd');
      return format(safeDay, 'yyyy-MM-dd');
    } catch(e) { console.error('[AssignmentDialog] startDate init error:', e); return format(new Date(), 'yyyy-MM-dd'); }
  });
  const [endDate, setEndDate] = useState(() => {
    try {
      const theEnd = endDay instanceof Date && !isNaN(endDay) ? endDay : safeDay;
      if (existingMission) return (existingMission.endDate || existingMission.end_date || '').split('T')[0] || format(theEnd, 'yyyy-MM-dd');
      return format(theEnd, 'yyyy-MM-dd');
    } catch(e) { console.error('[AssignmentDialog] endDate init error:', e); return format(new Date(), 'yyyy-MM-dd'); }
  });
  const [startTime, setStartTime] = useState(
    existingMission ? (existingMission.startTime || existingMission.start_time || '') : (period === 'PM' ? '14:00' : '08:00')
  );
  const [endTime, setEndTime] = useState(
    existingMission ? (existingMission.endTime || existingMission.end_time || '') : (period === 'PM' ? '19:00' : '13:00')
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
        offDays.forEach(d => { states[d] = 'off'; });
        return states;
      }
    } catch { /* ignore parse error */ }
    return {};
  }); // { 'yyyy-MM-dd': 'on' | 'off' }

  // Poste / compétence — pré-remplir (multi-sélection)
  const [selectedSkillIds, setSelectedSkillIds] = useState(() => {
    if (!existingMission) return [];
    const raw = existingMission.requiredSkills || existingMission.required_skills || existingMission.requiredSkillId || existingMission.required_skill_id;
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch { /* single ID */ }
    const num = parseInt(raw);
    return isNaN(num) ? [] : [num];
  });
  const [selectedPositions, setSelectedPositions] = useState(() => {
    const raw = existingAssignment?.position || existingMission?.position || '';
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;
    } catch { /* single string value */ }
    return raw ? [raw] : [];
  });
  const [status, setStatus] = useState(
    existingAssignment?.status || 'option'
  );
  const [notes, setNotes] = useState(
    existingMission?.notes || existingAssignment?.comment || ''
  );

  // Personnel — pour réaffectation en mode édition
  const [allPersons, setAllPersons] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(person.id);
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Capturer l'état initial pour détecter les modifications
  const initialStateRef = useRef(null);
  useEffect(() => {
    if (!initialStateRef.current && !loading) {
      initialStateRef.current = JSON.stringify({
        selectedAffaire: selectedAffaire?.numeroAffaire,
        startDate, endDate, startTime, endTime,
        dayStates, selectedSkillIds, selectedPositions,
        status, notes, selectedPersonId
      });
    }
  }, [loading]);

  const hasFormChanges = () => {
    if (!initialStateRef.current) return false;
    const current = JSON.stringify({
      selectedAffaire: selectedAffaire?.numeroAffaire,
      startDate, endDate, startTime, endTime,
      dayStates, selectedSkillIds, selectedPositions,
      status, notes, selectedPersonId
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
    if (!googleEvents || googleEvents.length === 0) return [];
    return googleEvents.map(ev => {
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
  }, [googleEvents]);

  // Charger la liste du personnel (pour réaffectation)
  useEffect(() => {
    if (!isEdit) return;
    const loadPersons = async () => {
      try {
        const data = await api.getPersons();
        setAllPersons(data || []);
      } catch (err) {
        console.error('Erreur chargement personnel:', err);
      }
    };
    loadPersons();
  }, [isEdit]);

  const selectedPerson = useMemo(() => {
    if (selectedPersonId === person.id) return person;
    return allPersons.find(p => p.id === selectedPersonId) || person;
  }, [selectedPersonId, person, allPersons]);

  const filteredPersons = useMemo(() => {
    if (!personSearch.trim()) return allPersons;
    const q = personSearch.toLowerCase();
    return allPersons.filter(p =>
      `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(q) ||
      (p.type || '').toLowerCase().includes(q)
    );
  }, [allPersons, personSearch]);

  // Charger les affaires
  useEffect(() => {
    const loadAffaires = async () => {
      try {
        setLoading(true);
        const data = await api.getAffaires();
        // Fusionner affaires DB + Google Calendar (dédupliquer par numéro d'affaire)
        const dbAffaires = data || [];
        const knownNums = new Set(dbAffaires.map(a => a.numeroAffaire).filter(Boolean));
        const extraGoogle = googleAffaires.filter(ga => !ga.numeroAffaire || !knownNums.has(ga.numeroAffaire));
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
    } catch(e) {
      console.error('[AssignmentDialog] rangeDays error:', e);
      return [safeDay];
    }
  }, [startDate, endDate, safeDay]);

  // Initialiser les dayStates quand la plage de dates change
  useEffect(() => {
    setDayStates(prev => {
      const next = {};
      rangeDays.forEach(d => {
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
      filtered = filtered.filter(a =>
        (a.numeroAffaire || '').toLowerCase().includes(q) ||
        (a.titre || '').toLowerCase().includes(q) ||
        (a.client || '').toLowerCase().includes(q) ||
        (a.eventName || '').toLowerCase().includes(q)
      );
    }

    // Trier : celles qui chevauchent la période en premier
    filtered = filtered.map(a => {
      const aStart = a.dateDebut ? a.dateDebut.split('T')[0] : null;
      const aEnd = a.dateFin ? a.dateFin.split('T')[0] : null;
      const overlaps = aStart && aEnd
        ? aStart <= endDate && aEnd >= startDate
        : !aStart && !aEnd
          ? true
          : aStart ? aStart <= endDate : aEnd >= startDate;
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
    const missing = selectedSkillIds.filter(id => !person.skills?.some(s => s.skillId === id));
    if (missing.length === 0) return null;
    const names = missing.map(id => (skills || []).find(s => s.id === id)?.name || 'inconnue');
    return `${person.firstName} ${person.lastName} ne possède pas : ${names.join(', ')}`;
  }, [selectedSkillIds, person, skills]);

  // Calculer les jours ON
  const onDays = useMemo(() => {
    return rangeDays.filter(d => dayStates[format(d, 'yyyy-MM-dd')] !== 'off');
  }, [rangeDays, dayStates]);

  const toggleDayState = (dateKey) => {
    setDayStates(prev => ({
      ...prev,
      [dateKey]: prev[dateKey] === 'off' ? 'on' : 'off',
    }));
  };

  const setAllDays = (state) => {
    setDayStates(prev => {
      const next = {};
      Object.keys(prev).forEach(k => { next[k] = state; });
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
        : selectedPositions.length > 0 ? selectedPositions.join(', ') : `Mission ${format(parseISO(startDate), 'd MMM yyyy', { locale: fr })}`;


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
          console.warn('[AssignmentDialog] Pas d\'assignmentId — affectation non mise à jour');
        }
      } else {
        // ── Mode création ──
        mission = await api.createMission(missionData);

        const assignmentData = {
          mission_id: mission.id,
          person_id: person.id,
          status: status,
          position: positionValue,
          comment: notes || null,
        };

        assignment = await api.createAssignment(assignmentData);

        // Vérifier les warnings
        if (assignment.warnings) {
          const warns = [];
          if (assignment.warnings.conflicts) {
            warns.push(`⚠️ Conflit avec ${assignment.warnings.conflicts.length} autre(s) mission(s)`);
          }
          if (assignment.warnings.unavailabilities) {
            warns.push(`⚠️ ${assignment.warnings.unavailabilities.length} indisponibilité(s) sur cette période`);
          }
          if (warns.length > 0) {
            setError(warns.join('\n'));
          }
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
  const getSkillCategory = (skillId) => {
    const skill = (skills || []).find(s => s.id === parseInt(skillId));
    if (!skill) return null;
    return SKILL_CATEGORIES.find(c => c.value === skill.category);
  };

  // Grouper les compétences par catégorie
  const skillsByCategory = useMemo(() => {
    const groups = {};
    (skills || []).forEach(skill => {
      const cat = skill.category || 'autre';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(skill);
    });
    return groups;
  }, [skills]);

  const dialogContent = (
    <div className="assignment-dialog-overlay" onClick={handleSafeClose}>
      <div className="assignment-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="assignment-dialog-header">
          <div className="assignment-dialog-title">
            {isEdit ? <Edit2 size={20} /> : <Briefcase size={20} />}
            <span>{isEdit ? 'Modifier l\u2019affectation' : 'Nouvelle affectation'}</span>
          </div>
          <div className="assignment-dialog-header-actions">
            {isEdit && onDelete && (
              <button
                className="asd-btn-header-delete"
                onClick={() => onDelete(existingMission)}
                title="Supprimer cette mission"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button className="assignment-dialog-close" onClick={handleSafeClose}>
              <X size={18} />
            </button>
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
                  <span className="asd-person-name">{selectedPerson.firstName} {selectedPerson.lastName}</span>
                  <span className={`asd-person-type type-${selectedPerson.type}`}>
                    {selectedPerson.type === 'permanent' ? 'Permanent' : selectedPerson.contractType || 'Contractuel'}
                  </span>
                  <ChevronDown size={14} className="asd-person-chevron" />
                </div>
                {showPersonDropdown && (
                  <div className="asd-person-dropdown-wrapper">
                    <input
                      type="text"
                      className="asd-person-search"
                      placeholder="Rechercher un personnel…"
                      value={personSearch}
                      onChange={e => setPersonSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="asd-person-dropdown">
                      {filteredPersons.map(p => (
                        <div
                          key={p.id}
                          className={`asd-person-option${p.id === selectedPersonId ? ' selected' : ''}`}
                          onClick={() => {
                            setSelectedPersonId(p.id);
                            setShowPersonDropdown(false);
                            setPersonSearch('');
                          }}
                        >
                          <span className="asd-person-opt-name">{p.firstName} {p.lastName}</span>
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
              <div className="asd-person-badge">
                <span className="asd-person-name">{person.firstName} {person.lastName}</span>
                <span className={`asd-person-type type-${person.type}`}>
                  {person.type === 'permanent' ? 'Permanent' : person.contractType || 'Contractuel'}
                </span>
                {person.skills?.length > 0 && (
                  <div className="asd-person-skills">
                    {person.skills.map(s => {
                      const cat = SKILL_CATEGORIES.find(c => c.value === s.category);
                      return (
                        <span key={s.skillId} className="asd-skill-tag" style={{ backgroundColor: cat?.color + '20', color: cat?.color, borderColor: cat?.color + '40' }}>
                          {s.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
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
                    <span className="asd-affaire-numero">{selectedAffaire.numeroAffaire}</span>
                    <span className="asd-affaire-titre">{selectedAffaire.titre || selectedAffaire.eventName || ''}</span>
                    <span className="asd-affaire-client">{selectedAffaire.client || ''}</span>
                    {selectedAffaire.dateDebut && (
                      <span className="asd-affaire-dates">
                        {format(parseISO(selectedAffaire.dateDebut.split('T')[0]), 'd MMM', { locale: fr })}
                        {selectedAffaire.dateFin && ` → ${format(parseISO(selectedAffaire.dateFin.split('T')[0]), 'd MMM yyyy', { locale: fr })}`}
                      </span>
                    )}
                  </div>
                  <button className="asd-affaire-remove" onClick={() => setSelectedAffaire(null)}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="asd-affaire-dropdown-wrapper">
                  <input
                    type="text"
                    className="asd-affaire-search"
                    placeholder={loading ? 'Chargement…' : `Rechercher parmi ${affaires.length} affaire(s)…`}
                    value={affaireSearch}
                    onChange={e => { setAffaireSearch(e.target.value); setShowAffaireDropdown(true); }}
                    onFocus={() => setShowAffaireDropdown(true)}
                   
                  />
                  {showAffaireDropdown && (
                    <div className="asd-affaire-dropdown">
                      {filteredAffaires.length === 0 ? (
                        <div className="asd-affaire-empty">
                          {affaires.length === 0 ? 'Aucune affaire en base' : 'Aucun résultat pour cette recherche'}
                        </div>
                      ) : (
                        filteredAffaires.slice(0, 20).map(a => (
                          <div
                            key={a.id || a.numeroAffaire}
                            className={`asd-affaire-option ${a._overlaps ? 'overlaps' : 'no-overlap'}`}
                            onClick={() => selectAffaire(a)}
                          >
                            <div className="asd-affaire-opt-left">
                              <span className="asd-affaire-opt-num">{a.numeroAffaire}</span>
                              <span className="asd-affaire-opt-title">{a.titre || a.eventName || ''}</span>
                            </div>
                            <div className="asd-affaire-opt-right">
                              <span className="asd-affaire-opt-client">{a.client || ''}</span>
                              {a.dateDebut && (
                                <span className="asd-affaire-opt-dates">
                                  {format(parseISO(a.dateDebut.split('T')[0]), 'dd/MM', { locale: fr })}
                                  {a.dateFin && ` → ${format(parseISO(a.dateFin.split('T')[0]), 'dd/MM', { locale: fr })}`}
                                </span>
                              )}
                              {!a._overlaps && <span className="asd-affaire-opt-warn">hors période</span>}
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
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="asd-field">
                <label>Fin</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div className="asd-field">
                <label>Heure début</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="asd-field">
                <label>Heure fin</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Jours ON / OFF si multi-jours */}
          {rangeDays.length > 1 && (
            <div className="asd-section">
              <div className="asd-section-label">
                <Calendar size={14} />
                <span>Jours d'activité</span>
                <span className="asd-day-count">{onDays.length}/{rangeDays.length} jour(s) ON</span>
              </div>
              <div className="asd-days-actions">
                <button className="asd-days-btn" onClick={() => setAllDays('on')}>Tous ON</button>
                <button className="asd-days-btn" onClick={() => setAllDays('off')}>Tous OFF</button>
                <button className="asd-days-btn" onClick={() => {
                  // Toggle weekends OFF
                  setDayStates(prev => {
                    const next = { ...prev };
                    rangeDays.forEach(d => {
                      const key = format(d, 'yyyy-MM-dd');
                      if (isWeekendFn(d)) next[key] = next[key] === 'off' ? 'on' : 'off';
                    });
                    return next;
                  });
                }}>Toggle W-E</button>
              </div>
              <div className="asd-days-grid">
                {rangeDays.map(d => {
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
                    const catInfo = SKILL_CATEGORIES.find(c => c.value === cat);
                    return (
                      <div key={cat} className="asd-skills-category">
                        <span className="asd-skills-cat-label" style={{ color: catInfo?.color }}>{catInfo?.label || cat}</span>
                        <div className="asd-skills-cat-items">
                          {catSkills.map(s => {
                            const checked = selectedSkillIds.includes(s.id);
                            return (
                              <div
                                key={s.id}
                                className={`asd-skill-checkbox${checked ? ' checked' : ''}`}
                                style={{ '--skill-color': catInfo?.color || '#6b7280' }}
                                onClick={() => {
                                  setSelectedSkillIds(prev =>
                                    prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
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
            {skillWarnings && (
              <div className="asd-skill-warning">
                <AlertTriangle size={14} />
                <span>{skillWarnings}</span>
              </div>
            )}
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
                    { value: 'confirmed', label: 'Confirmé', color: '#10b981' },
                    { value: 'option', label: 'Option', color: '#f59e0b' },
                    { value: 'proposed', label: 'Proposé', color: '#6b7280' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      className={`asd-status-btn ${status === opt.value ? 'active' : ''}`}
                      style={{ '--btn-color': opt.color }}
                      onClick={() => setStatus(opt.value)}
                    >
                      {status === opt.value && <Check size={12} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="asd-field">
                <label>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes de mission…"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Erreur / Succès */}
          {error && (
            <div className="asd-message asd-error">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="asd-message asd-success">
              <Check size={14} />
              <span>{isEdit ? 'Affectation mise \u00e0 jour !' : 'Affectation cr\u00e9\u00e9e avec succ\u00e8s !'}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="assignment-dialog-footer">
          <button className="asd-btn asd-btn-cancel" onClick={handleSafeClose} disabled={saving}>
            Annuler
          </button>
          <button
            className="asd-btn asd-btn-save"
            onClick={handleSave}
            disabled={saving || success}
          >
            {saving ? (
              <>
                <div className="asd-spinner" />
                Enregistrement…
              </>
            ) : (
              <>
                <Save size={16} />
                {isEdit ? 'Enregistrer' : "Créer l'affectation"}
              </>
            )}
          </button>
        </div>
      </div>

      {showUnsavedWarning && (
        <UnsavedChangesDialog
          onCancel={() => setShowUnsavedWarning(false)}
          onDiscard={onClose}
        />
      )}
    </div>
  );

  return ReactDOM.createPortal(dialogContent, document.body);
};

export default AssignmentDialog;
