import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Clock, User, FileText, Calendar, Loader, Save, Briefcase, Search, Link2, Unlink, MapPin, ExternalLink
} from 'lucide-react';
import api from '../../utils/api';
import AffaireBadge from '../AffaireBadge';
import { useToast } from '../../hooks/useToast';
import './TaskEditModal.css';
import { Button, EntityCombobox, Input, Select, Textarea } from '@/design-system';

const SECTIONS = {
  rdv:                'Rendez-vous',
  taches_prioritaires:'Tâches Prioritaires',
  courses:            'Courses',
  prep_locations:     'Préparations Locations',
  prep_prestations:   'Préparations Prestations',
  prep_ventes:        'Préparations Ventes',
  prep_installations: 'Préparations Installations',
  chargement:         'Chargement',
  depart:             'Départ',
  enlevement:         'Enlèvement',
  retour:             'Retour',
  recuperation:       'Récupération',
  installation:       'Installation',
  montage:            'Montage',
  demontage:          'Démontage',
  prep_tournees:      'Préparations Tournées',
  evenements:         'Autres Événements',
  taches_secondaires: 'Tâches Secondaires',
  manual:             'Autres',
};

// Sections aliasées vers "courses"
const COURSE_SECTIONS = new Set(['courses', 'enlevement', 'retour', 'recuperation']);

// Nettoyer le titre d'une tâche courses : retirer emoji + préfixe type (Livraison, Récupération, etc.)
const cleanCourseTitle = (title, section) => {
  if (!title || !COURSE_SECTIONS.has(section)) return title || '';
  return title
    .replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u200d\ufe0f]+\s*/u, '')
    .replace(/^(Livraison|Récupération|Recuperation|Enlèvement|Enlevement|Retour)\s*—?\s*/i, '')
    .trim() || title;
};

function TaskEditModal({ task, persons = [], onSave, onClose }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [affaires, setAffaires] = useState([]);
  const [affaireSearch, setAffaireSearch] = useState('');
  const [affaireDropdownOpen, setAffaireDropdownOpen] = useState(false);
  const affaireRef = useRef(null);

  const [form, setForm] = useState({
    title: cleanCourseTitle(task.title, task.section) || '',
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
    api.getAffaires().then(data => {
      setAffaires(Array.isArray(data) ? data : []);
    }).catch(() => {});
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
    setForm({
      title: cleanCourseTitle(task.title, task.section) || '',
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

  // Filtrer les affaires selon la recherche
  const filteredAffaires = useMemo(() => {
    if (!affaireSearch.trim()) return affaires.slice(0, 30);
    const q = affaireSearch.toLowerCase();
    return affaires.filter(a =>
      (a.numeroAffaire || '').toLowerCase().includes(q) ||
      (a.client || '').toLowerCase().includes(q) ||
      (a.titre || a.nom || '').toLowerCase().includes(q)
    ).slice(0, 30);
  }, [affaires, affaireSearch]);

  const selectedAffaire = useMemo(() => {
    if (!form.affaireNum) return null;
    return affaires.find(a => a.numeroAffaire === form.affaireNum) || null;
  }, [affaires, form.affaireNum]);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Auto-capitaliser la première lettre du titre
      const capitalizedTitle = form.title.trim();
      const finalTitle = capitalizedTitle ? capitalizedTitle.charAt(0).toUpperCase() + capitalizedTitle.slice(1) : '';
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
    <div className="tem-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tem-modal">
        {/* Header */}
        <div className="tem-header">
          <h3><FileText size={18} /> Modifier la tâche</h3>
          <Button variant="ghost" className="tem-close" onClick={onClose} aria-label="Fermer"><X size={20} /></Button>
        </div>

        {/* Badges info */}
        <div className="tem-badges">
          {task.sourceType === 'google_event' && (
            <span className="tem-badge google">G</span>
          )}
          <span className="tem-badge section">{SECTIONS[form.section] || form.section}</span>
        </div>

        {/* Form */}
        <div className="tem-form">
          {/* Titre */}
          <div className="tem-field full">
            <label><FileText size={13} /> Titre</label>
            <Input
              type="text"
              value={form.title}
              onChange={e => update('title', e.target.value)}
              onBlur={e => {
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
              <label><Calendar size={13} /> Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => update('date', e.target.value)}
              />
            </div>
            <div className="tem-field">
              <label>Période</label>
              <Select value={form.period} onChange={e => update('period', e.target.value)}>
                <option value="AM">Matin (AM)</option>
                <option value="PM">Après-midi (PM)</option>
              </Select>
            </div>
          </div>

          {/* Heure début / fin */}
          <div className="tem-row">
            <div className="tem-field">
              <label><Clock size={13} /> Heure début</label>
              <input
                type="time"
                value={form.time}
                onChange={e => update('time', e.target.value)}
              />
            </div>
            <div className="tem-field">
              <label><Clock size={13} /> Heure fin</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => update('endTime', e.target.value)}
              />
            </div>
          </div>

          {/* Personnel */}
          <div className="tem-field full">
            <label><User size={13} /> Personnel assigné</label>
            <EntityCombobox
              value={form.personId}
              onChange={val => update('personId', val)}
              options={persons.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
              placeholder="— Aucun —"
            />
          </div>

          {/* Affaire liée */}
          <div className="tem-field full" ref={affaireRef}>
            <label><Link2 size={13} /> Affaire</label>
            {form.affaireNum ? (
              <div className="tem-affaire-selected">
                <AffaireBadge numero={form.affaireNum} type={selectedAffaire?.type} />
                <span className="tem-affaire-client">{selectedAffaire?.client || ''}</span>
                <Button variant="ghost"                   type="button"
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
                    onChange={e => { setAffaireSearch(e.target.value); setAffaireDropdownOpen(true); }}
                    onFocus={() => setAffaireDropdownOpen(true)}
                    placeholder="Rechercher une affaire…"
                    className="tem-affaire-search"
                  />
                </div>
                {affaireDropdownOpen && (
                  <div className="tem-affaire-dropdown">
                    {filteredAffaires.length === 0 ? (
                      <div className="tem-affaire-empty">Aucune affaire trouvée</div>
                    ) : filteredAffaires.map(a => (
                      <Button variant="ghost"                         key={a.numeroAffaire}
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
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type de tâche */}
          <div className="tem-field full">
            <label><Briefcase size={13} /> Type</label>
            <Select value={form.section} onChange={e => update('section', e.target.value)}>
              {Object.entries(SECTIONS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </div>

          {/* Lieu / Adresse (affiché pour les sections courses) */}
          {COURSE_SECTIONS.has(form.section) && (
            <div className="tem-field full">
              <label><MapPin size={13} /> Lieu</label>
              <div className="tem-location-row">
                <Input
                  type="text"
                  value={form.locationAddress}
                  onChange={e => update('locationAddress', e.target.value)}
                  placeholder="Adresse ou lieu de la course…"
                  autoComplete="off"
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
            <Select value={form.status} onChange={e => update('status', e.target.value)}>
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
              onChange={e => update('notes', e.target.value)}
              placeholder="Notes..."
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="tem-footer">
          <Button variant="ghost" className="tem-btn secondary" onClick={onClose}>Annuler</Button>
          <Button variant="ghost" className="tem-btn primary" onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TaskEditModal;
