// ═══════════════════════════════════════════════════════════════
// WelcomeMessagesTab — Gestion des messages d'accueil par jour/créneau
// + Message furtif temporaire
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, memo } from 'react';
import { MessageCircle, Zap, Save, Trash2, Clock } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const DAY_LABELS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven' };

const SLOTS = [
  { id: 'matin', label: 'Matin (06h-09h30)' },
  { id: 'matinee', label: 'Matinée (09h30-12h)' },
  { id: 'midi', label: 'Midi (12h-13h)' },
  { id: 'apres_midi', label: 'Après-midi (13h-18h)' },
  { id: 'soir', label: 'Soir (18h-06h)' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 heure' },
  { value: '240', label: '4 heures' },
  { value: 'endOfDay', label: "Jusqu'à la fin de la journée" },
  { value: 'endOfWeek', label: "Jusqu'à la fin de la semaine" },
];

function WelcomeMessagesTab({ currentUser, refreshKey, onPreviewChange }) {
  const toast = useToast();
  const [activeDay, setActiveDay] = useState('lundi');
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Message furtif
  const [sneakyText, setSneakyText] = useState('');
  const [sneakyDuration, setSneakyDuration] = useState('60');
  const [sneakyStatus, setSneakyStatus] = useState({ active: false });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [msgData, sneakyData] = await Promise.all([
        api.getDisplayWelcomeMessages(),
        api.getDisplaySneakyMessageStatus(),
      ]);
      setMessages(msgData.welcomeMessages || {});
      setSneakyStatus(sneakyData);
    } catch {
      toast.error('Erreur chargement messages');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const handleMessageChange = (day, slot, value) => {
    setMessages(prev => {
      const next = {
        ...prev,
        [day]: { ...(prev[day] || {}), [slot]: value },
      };
      // Afficher le message en cours d'édition dans l'aperçu
      if (onPreviewChange) {
        onPreviewChange({ welcomeMessage: value || undefined });
      }
      return next;
    });
  };

  const handleSaveMessages = useCallback(async () => {
    try {
      setSaving(true);
      await api.saveDisplayWelcomeMessages({ welcomeMessages: messages });
      toast.success('Messages enregistrés');
    } catch {
      toast.error('Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [messages, toast]);

  const handleActivateSneaky = useCallback(async () => {
    if (!sneakyText.trim()) { toast.error('Veuillez entrer un message'); return; }
    try {
      await api.activateDisplaySneakyMessage(sneakyText.trim(), sneakyDuration);
      toast.success('Message furtif activé');
      setSneakyText('');
      const status = await api.getDisplaySneakyMessageStatus();
      setSneakyStatus(status);
    } catch {
      toast.error('Erreur activation');
    }
  }, [sneakyText, sneakyDuration, toast]);

  const handleDisableSneaky = useCallback(async () => {
    try {
      await api.deleteDisplaySneakyMessage();
      toast.success('Message furtif désactivé');
      setSneakyStatus({ active: false });
    } catch {
      toast.error('Erreur désactivation');
    }
  }, [toast]);

  if (loading) return <div className="display-loading">Chargement des messages…</div>;

  return (
    <div className="dtv-welcome-messages">
      {/* Message furtif */}
      <div className="dtv-section dtv-sneaky-section">
        <h3 className="dtv-section-title">
          <Zap size={16} /> Message d'accueil furtif
        </h3>
        <p className="dtv-hint">Active un message temporaire qui remplace le message d'accueil configuré.</p>

        <div className="dtv-form-group">
          <label>Message à afficher</label>
          <textarea value={sneakyText} onChange={e => setSneakyText(e.target.value)}
            placeholder="Entrez votre message furtif..." rows={2} />
        </div>
        <div className="dtv-form-row">
          <div className="dtv-form-group" style={{ flex: 1 }}>
            <label>Durée d'affichage</label>
            <select value={sneakyDuration} onChange={e => setSneakyDuration(e.target.value)}>
              {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <button className="btn-primary-sm" onClick={handleActivateSneaky} style={{ alignSelf: 'flex-end' }}>
            <Zap size={14} /> Activer
          </button>
        </div>

        {sneakyStatus.active && (
          <div className="dtv-sneaky-status">
            <div className="dtv-sneaky-active">
              <span className="dtv-badge-active">✅ Actif</span>
              <span className="dtv-sneaky-expires">
                <Clock size={12} /> Expire: {new Date(sneakyStatus.expiresAt).toLocaleString('fr-FR')}
              </span>
            </div>
            <div className="dtv-sneaky-preview">« {sneakyStatus.message} »</div>
            <button className="btn-danger-sm" onClick={handleDisableSneaky}>
              <Trash2 size={14} /> Désactiver
            </button>
          </div>
        )}
      </div>

      {/* Messages par jour/créneau */}
      <div className="dtv-section">
        <h3 className="dtv-section-title">
          <MessageCircle size={16} /> Messages d'accueil dynamiques
        </h3>
        <p className="dtv-hint">Configurez les messages affichés selon le jour et le créneau horaire.</p>

        {/* Onglets jours */}
        <div className="dtv-day-tabs">
          {DAYS.map(day => (
            <button key={day}
              className={`dtv-day-tab ${activeDay === day ? 'active' : ''}`}
              onClick={() => setActiveDay(day)}>
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>

        {/* Créneaux du jour actif */}
        <div className="dtv-slots">
          {SLOTS.map(slot => (
            <div key={slot.id} className="dtv-form-group">
              <label>{slot.label}</label>
              <textarea
                value={messages[activeDay]?.[slot.id] || ''}
                onChange={e => handleMessageChange(activeDay, slot.id, e.target.value)}
                placeholder={`Message pour ${slot.label.toLowerCase()}...`}
                rows={2}
              />
            </div>
          ))}
        </div>

        <div className="dtv-actions">
          <button className="btn-primary-sm" onClick={handleSaveMessages} disabled={saving}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer les messages'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(WelcomeMessagesTab);
