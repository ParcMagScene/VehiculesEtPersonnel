import './TaskEditModal.css';

/* eslint-disable no-misleading-character-class */
import {
  Briefcase,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  GitMerge,
  Link2,
  Loader,
  MapPin,
  Save,
  Search,
  Unlink,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, EntityCombobox, Input, ModalLayout, Select, Textarea } from '@/design-system';

import { useDirtyForm } from '../../hooks/useDirtyForm';
import usePersonnelFavorites from '../../hooks/usePersonnelFavorites';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import AddressAutocomplete from '../AddressAutocomplete';
import AffaireBadge from '../AffaireBadge';

const SECTIONS = {
  rdv: 'Rendez-vous',
  taches_prioritaires: 'Tâches Prioritaires',
  courses: 'Courses',
  prep_locations: 'Préparations Locations',
  prep_prestations: 'Préparations Prestations',
  prep_ventes: 'Préparations Ventes',
  prep_installations: 'Préparations Installations',
  chargement: 'Chargement',
  depart: 'Départ',
  enlevement: 'Enlèvement',
  retour: 'Retour',
  recuperation: 'Récupération',
  installation: 'Installation',
  montage: 'Montage',
  demontage: 'Démontage',
  intervention: 'Intervention',
  depot: 'Dépôt',
  prep_tournees: 'Préparations Tournées',
  evenements: 'Autres Événements',
  taches_secondaires: 'Tâches Secondaires',
  manual: 'Autres',
};

// Sections aliasées vers "courses"
const COURSE_SECTIONS = new Set(['courses', 'enlevement', 'retour', 'recuperation']);

const COURSE_PREFIXES = {
  livraison: '🚚 Livraison',
  enlevement: '📦 Enlèvement',
  retour: '↩️ Retour',
  recuperation: '📥 Récupération',
};

const detectCourseType = (task) => {
  const bySection = {
    enlevement: 'enlevement',
    retour: 'retour',
    recuperation: 'recuperation',
  };
  if (bySection[task.section]) return bySection[task.section];

  const evType = task.eventType || task.event_type;
  if (evType && COURSE_PREFIXES[evType]) return evType;

  const raw = task.title || '';
  const match = raw.match(
    /^(?:[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*)?(Livraison|R(?:e|é)cup(?:e|é)ration|Recuperation|Enl(?:e|è)vement|Enlevement|Retour)\b/iu,
  );
  if (!match) return null;
  const normalized = match[1]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const map = {
    livraison: 'livraison',
    recuperation: 'recuperation',
    enlevement: 'enlevement',
    retour: 'retour',
  };
  return map[normalized] || null;
};

// Initialise le titre dans la modale d'édition :
// retire emoji + préfixe opérationnel + suffixe " — googleEventTitle" pour toutes les sections.
const initTitle = (task) => {
  const raw = task.title || '';
  const googleTitle = task.googleEventTitle || task.google_event_title || '';

  // 1. Retirer le préfixe emoji
  // eslint-disable-next-line no-misleading-character-class
  let t = raw
    .replace(
      /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u,
      '',
    )
    .trim();

  // 2. Retirer le label de section opérationnel
  t = t
    .replace(
      /^(Livraison|R(?:e|é)cup(?:e|é)ration|Recuperation|Enl(?:e|è)vement|Enlevement|Retour|Pr(?:e|é)paration|Preparation|Chargement|D(?:e|é)part|Installation|Montage|D(?:e|é)montage|Demontage|Intervention)\s*[—–\-:]?\s*/iu,
      '',
    )
    .trim();

  // 3. Retirer le suffixe " — googleEventTitle" si identique
  if (googleTitle) {
    const sep = ' — ';
    const idx = t.indexOf(sep);
    if (idx >= 0) {
      const suffix = t.slice(idx + sep.length).trim();
      if (suffix.toLowerCase() === googleTitle.trim().toLowerCase()) {
        t = t.slice(0, idx).trim();
      }
    }
  }

  return t || raw;
};

function TaskEditModal({ task, persons = [], onSave, onClose }) {
  const toast = useToast();
  const { isFavorite, sortPersonsByFavorites } = usePersonnelFavorites();
  const sourceType = task.sourceType || task.source_type || '';
  const titleInputRef = useRef(null);
  const titleAutoSelectDoneRef = useRef(false);
  const sortedPersons = useMemo(
    () => sortPersonsByFavorites(persons || []),
    [persons, sortPersonsByFavorites],
  );
  const [saving, setSaving] = useState(false);
  const [affaires, setAffaires] = useState([]);
  const [affaireSearch, setAffaireSearch] = useState('');
  const [affaireDropdownOpen, setAffaireDropdownOpen] = useState(false);
  const affaireRef = useRef(null);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState([]);
  const [mergeLoadingState, setMergeLoadingState] = useState(false);
  const [merging, setMerging] = useState(false);

  const [form, setForm] = useState({
    title: initTitle(task),
    date: task.date || '',
    period: task.period || 'AM',
    time: task.time || '',
    endTime: task.endTime || '',
    notes: task.notes || '',
    personId: task.personId || '',
    section: task.section || 'manual',
    status: task.status || 'pending',
    affaireNum: task.affaireNum || task.affaire_num || '',
    locationAddress: task.locationAddress || task.location_address || '',
  });

  // Charger les affaires
  useEffect(() => {
    api
      .getAffaires()
      .then((data) => {
        setAffaires(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  // Fermer le dropdown si clic extérieur
  useEffect(() => {
    const handleClick = (e) => {
      if (affaireRef.current && !affaireRef.current.contains(e.target)) {
        setAffaireDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sync if task changes
  useEffect(() => {
    setMergeOpen(false);
    setMergeCandidates([]);
    titleAutoSelectDoneRef.current = false;
    setForm({
      title: initTitle(task),
      date: task.date || '',
      period: task.period || 'AM',
      time: task.time || '',
      endTime: task.endTime || '',
      notes: task.notes || '',
      personId: task.personId || '',
      section: task.section || 'manual',
      status: task.status || 'pending',
      affaireNum: task.affaireNum || task.affaire_num || '',
      locationAddress: task.locationAddress || task.location_address || '',
    });
  }, [task]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      const el = titleInputRef.current;
      if (!el || titleAutoSelectDoneRef.current) return;
      el.focus();
      el.select();
      titleAutoSelectDoneRef.current = true;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [task?.id]);

  const { isDirty: _isDirty, guardClose } = useDirtyForm(form);
  const safeClose = guardClose(onClose);

  // Filtrer les affaires selon la recherche
  const filteredAffaires = useMemo(() => {
    if (!affaireSearch.trim()) return affaires.slice(0, 30);
    const q = affaireSearch.toLowerCase();
    return affaires
      .filter(
        (a) =>
          (a.numeroAffaire || '').toLowerCase().includes(q) ||
          (a.client || '').toLowerCase().includes(q) ||
          (a.titre || a.nom || '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [affaires, affaireSearch]);

  const selectedAffaire = useMemo(() => {
    if (!form.affaireNum) return null;
    return affaires.find((a) => a.numeroAffaire === form.affaireNum) || null;
  }, [affaires, form.affaireNum]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openMerge = async () => {
    setMergeOpen(true);
    if (mergeCandidates.length > 0) return;
    setMergeLoadingState(true);
    try {
      const data = await api.getTasks({ date: task.date });
      setMergeCandidates(
        (Array.isArray(data) ? data : data?.tasks || []).filter((t) => t.id !== task.id),
      );
    } catch {
      setMergeCandidates([]);
    } finally {
      setMergeLoadingState(false);
    }
  };

  const handleMerge = async (targetId) => {
    setMerging(true);
    try {
      await api.mergeTasks(task.id, targetId);
      toast.success('Tâches fusionnées');
      onSave?.();
      onClose();
    } catch {
      toast.error('Erreur lors de la fusion');
    } finally {
      setMerging(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Auto-capitaliser la première lettre du titre
      const capitalizedTitle = form.title.trim();
      let finalTitle = capitalizedTitle
        ? capitalizedTitle.charAt(0).toUpperCase() + capitalizedTitle.slice(1)
        : task.title;

      // Pour les tâches Google "courses", on préserve le préfixe opérationnel
      // afin que le badge (Livraison/Enlèvement/Retour/Récupération) reste stable.
      if (sourceType === 'google_event' && COURSE_SECTIONS.has(form.section)) {
        const courseType = detectCourseType(task);
        const prefix = courseType ? COURSE_PREFIXES[courseType] : null;
        if (prefix && finalTitle) {
          const cleanedTitle = finalTitle
            .replace(
              /^(?:[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*)?(Livraison|R(?:e|é)cup(?:e|é)ration|Recuperation|Enl(?:e|è)vement|Enlevement|Retour)\s*[—–\-:]?\s*/iu,
              '',
            )
            .trim();
          finalTitle = cleanedTitle ? `${prefix} — ${cleanedTitle}` : prefix;
        }
      }

      await api.updateTask(task.id, {
        title: finalTitle,
        date: form.date,
        period: form.period || null,
        time: form.time || null,
        end_time: form.endTime || null,
        notes: form.notes || '',
        person_id: form.personId || null,
        section: form.section,
        status: form.status,
        affaire_num: form.affaireNum || null,
        location_address: form.locationAddress || null,
      });
      toast.success('Tâche mise à jour');
      onSave?.();
      onClose();
    } catch (err) {
      console.error('Erreur mise à jour tâche:', err);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const _personName = task.personFirstName
    ? `${task.personFirstName} ${task.personLastName || ''}`
    : null;

  return (
    <ModalLayout
      open
      onClose={safeClose}
      size="lg"
      title="Modifier la tâche"
      icon={<FileText size={18} />}
      className="tem-modal no-drag-resize"
      footer={
        <>
          <Button variant="ghost" className="tem-btn secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="ghost"
            className="tem-btn primary"
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
          >
            {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
            Enregistrer
          </Button>
        </>
      }
    >
      {/* Badges info */}
      <div className="tem-badges">
        {sourceType === 'google_event' && <span className="tem-badge google">G</span>}
        <span className="tem-badge section">{SECTIONS[form.section] || form.section}</span>
      </div>

      {/* Form */}
      <div className="tem-form">
        {/* Titre */}
        <div className="tem-field full">
          <label>
            <FileText size={13} /> Titre
          </label>
          <Input
            ref={titleInputRef}
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            onFocus={(e) => {
              if (titleAutoSelectDoneRef.current) return;
              e.target.select();
              titleAutoSelectDoneRef.current = true;
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) update('title', v.charAt(0).toUpperCase() + v.slice(1));
            }}
            placeholder="Titre de la tâche..."
            spellCheck
            lang="fr"
            autoComplete="off"
          />
        </div>

        {/* Date + Période */}
        <div className="tem-row">
          <div className="tem-field">
            <label>
              <Calendar size={13} /> Date
            </label>
            <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
          </div>
          <div className="tem-field">
            <label>Période</label>
            <Select value={form.period} onChange={(e) => update('period', e.target.value)}>
              <option value="AM">Matin (AM)</option>
              <option value="PM">Après-midi (PM)</option>
            </Select>
          </div>
        </div>

        {/* Heure début / fin */}
        <div className="tem-row">
          <div className="tem-field">
            <label>
              <Clock size={13} /> Heure début
            </label>
            <input type="time" value={form.time} onChange={(e) => update('time', e.target.value)} />
          </div>
          <div className="tem-field">
            <label>
              <Clock size={13} /> Heure fin
            </label>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => update('endTime', e.target.value)}
            />
          </div>
        </div>

        {/* Personnel */}
        <div className="tem-field full">
          <label>
            <User size={13} /> Personnel assigné
          </label>
          <EntityCombobox
            value={form.personId}
            onChange={(val) => update('personId', val)}
            options={sortedPersons.map((p) => ({
              id: p.id,
              name: `${isFavorite(p.id) ? '★ ' : ''}${p.firstName} ${p.lastName}`,
            }))}
            placeholder="— Aucun —"
          />
        </div>

        {/* Affaire liée */}
        <div className="tem-field full" ref={affaireRef}>
          <label>
            <Link2 size={13} /> Affaire
          </label>
          {form.affaireNum ? (
            <div className="tem-affaire-selected">
              <AffaireBadge numero={form.affaireNum} type={selectedAffaire?.type} />
              <span className="tem-affaire-client">{selectedAffaire?.client || ''}</span>
              <Button
                variant="ghost"
                type="button"
                className="tem-affaire-clear"
                onClick={() => update('affaireNum', '')}
                title="Retirer l'affaire"
              >
                <Unlink size={12} />
              </Button>
            </div>
          ) : (
            <div className="tem-affaire-picker">
              <div className="tem-affaire-search-wrap">
                <Search size={13} className="tem-affaire-search-icon" />
                <Input
                  type="text"
                  value={affaireSearch}
                  onChange={(e) => {
                    setAffaireSearch(e.target.value);
                    setAffaireDropdownOpen(true);
                  }}
                  onFocus={() => setAffaireDropdownOpen(true)}
                  placeholder="Rechercher une affaire…"
                  className="tem-affaire-search"
                />
              </div>
              {affaireDropdownOpen && (
                <div className="tem-affaire-dropdown">
                  {filteredAffaires.length === 0 ? (
                    <div className="tem-affaire-empty">Aucune affaire trouvée</div>
                  ) : (
                    filteredAffaires.map((a) => (
                      <Button
                        variant="ghost"
                        key={a.numeroAffaire}
                        type="button"
                        className="tem-affaire-option"
                        onClick={() => {
                          update('affaireNum', a.numeroAffaire);
                          setAffaireSearch('');
                          setAffaireDropdownOpen(false);
                        }}
                      >
                        <span className="tem-affaire-opt-num">{a.numeroAffaire}</span>
                        <span className="tem-affaire-opt-client">{a.client || a.nom || ''}</span>
                        {a.titre && <span className="tem-affaire-opt-titre">{a.titre}</span>}
                      </Button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Type de tâche */}
        <div className="tem-field full">
          <label>
            <Briefcase size={13} /> Type
          </label>
          <Select value={form.section} onChange={(e) => update('section', e.target.value)}>
            {Object.entries(SECTIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {/* Lieu / Adresse (affiché pour les sections courses) */}
        {COURSE_SECTIONS.has(form.section) && (
          <div className="tem-field full">
            <label>
              <MapPin size={13} /> Lieu
            </label>
            <div className="tem-location-row">
              <AddressAutocomplete
                value={form.locationAddress}
                onChange={(value) => update('locationAddress', value)}
                placeholder="Adresse ou lieu de la course…"
                className="tem-location-input"
              />
              {form.locationAddress.trim() && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.locationAddress.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tem-maps-link"
                  title="Ouvrir dans Google Maps"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Statut */}
        <div className="tem-field full">
          <label>Statut</label>
          <Select value={form.status} onChange={(e) => update('status', e.target.value)}>
            <option value="pending">En attente</option>
            <option value="in_progress">En cours</option>
            <option value="done">Terminé</option>
            <option value="cancelled">Annulé</option>
          </Select>
        </div>

        {/* Notes */}
        <div className="tem-field full">
          <label>Notes</label>
          <Textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Notes..."
            rows={3}
          />
        </div>
        {/* ── Fusion de tâches ── */}
        <div className="tem-field full">
          <div className="tem-merge-header">
            <Button
              variant="ghost"
              type="button"
              className="tem-merge-toggle"
              onClick={mergeOpen ? () => setMergeOpen(false) : openMerge}
            >
              <GitMerge size={13} />
              {mergeOpen ? 'Annuler la fusion' : 'Fusionner avec une autre tâche…'}
            </Button>
          </div>
          {mergeOpen && (
            <div className="tem-merge-panel">
              <Input
                type="text"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder="Filtrer par titre ou affaire…"
                className="tem-merge-search"
              />
              {mergeLoadingState ? (
                <div className="tem-merge-loading">
                  <Loader size={14} className="spin" /> Chargement…
                </div>
              ) : (
                <div className="tem-merge-list">
                  {mergeCandidates
                    .filter((c) => {
                      if (!mergeSearch.trim()) return true;
                      const q = mergeSearch.toLowerCase();
                      return (
                        (c.title || '').toLowerCase().includes(q) ||
                        (c.affaireNum || c.affaire_num || '').toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 20)
                    .map((c) => (
                      <div key={c.id} className="tem-merge-item">
                        <span className="tem-merge-item-title">
                          {c.affaireNum || c.affaire_num ? (
                            <strong>{c.affaireNum || c.affaire_num} — </strong>
                          ) : null}
                          {initTitle(c)}
                        </span>
                        <span className="tem-merge-item-meta">
                          {c.personFirstName || ''} {c.personLastName || ''} · {c.section || ''}
                        </span>
                        <Button
                          variant="ghost"
                          type="button"
                          className="tem-merge-btn"
                          onClick={() => handleMerge(c.id)}
                          disabled={merging}
                        >
                          {merging ? <Loader size={12} className="spin" /> : <GitMerge size={12} />}
                          Fusionner
                        </Button>
                      </div>
                    ))}
                  {mergeCandidates.length === 0 && !mergeLoadingState && (
                    <div className="tem-merge-empty">Aucune autre tâche pour cette date</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalLayout>
  );
}

export default TaskEditModal;
