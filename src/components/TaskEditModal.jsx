import React, { useState, useEffect } from 'react';
import {
  X, Clock, User, FileText, Calendar, Check, Loader, Save, Briefcase
} from 'lucide-react';
import api from '../utils/api';
import AffaireBadge from './AffaireBadge';
import { useToast } from '../hooks/useToast';
import './TaskEditModal.css';

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
  });

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
    });
  }, [task]);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateTask(task.id, {
        title: form.title,
        date: form.date,
        period: form.period || null,
        time: form.time || null,
        end_time: form.endTime || null,
        notes: form.notes || '',
        person_id: form.personId || null,
        section: form.section,
        status: form.status,
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

  const personName = task.personFirstName
    ? `${task.personFirstName} ${task.personLastName || ''}`
    : null;

  return (
    <div className="tem-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tem-modal">
        {/* Header */}
        <div className="tem-header">
          <h3><FileText size={18} /> Modifier la tâche</h3>
          <button className="tem-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Badges info */}
        <div className="tem-badges">
          {task.affaireNum && (
            <AffaireBadge numero={task.affaireNum} type={task.affaireType} />
          )}
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
            <input
              type="text"
              value={form.title}
              onChange={e => update('title', e.target.value)}
              placeholder="Titre de la tâche..."
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
              <select value={form.period} onChange={e => update('period', e.target.value)}>
                <option value="AM">Matin (AM)</option>
                <option value="PM">Après-midi (PM)</option>
              </select>
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
            <select value={form.personId} onChange={e => update('personId', e.target.value)}>
              <option value="">— Aucun —</option>
              {persons.map(p => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Type de tâche */}
          <div className="tem-field full">
            <label><Briefcase size={13} /> Type</label>
            <select value={form.section} onChange={e => update('section', e.target.value)}>
              {Object.entries(SECTIONS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Statut */}
          <div className="tem-field full">
            <label>Statut</label>
            <select value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="pending">En attente</option>
              <option value="in_progress">En cours</option>
              <option value="done">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>

          {/* Notes */}
          <div className="tem-field full">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="Notes..."
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="tem-footer">
          <button className="tem-btn secondary" onClick={onClose}>Annuler</button>
          <button className="tem-btn primary" onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskEditModal;
