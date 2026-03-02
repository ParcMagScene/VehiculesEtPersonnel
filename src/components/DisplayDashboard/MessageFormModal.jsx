// MessageFormModal — Création / édition d'un message d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { X, MessageSquare, Save } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function MessageFormModal({ message, onSave, onClose }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({
    title: '',
    body: '',
    priority: 'normal',
    templateId: '',
    dateStart: '',
    dateEnd: '',
  });

  useEffect(() => {
    if (message) {
      setForm({
        title: message.title || '',
        body: message.body || '',
        priority: message.priority || 'normal',
        templateId: message.template_id || '',
        dateStart: message.date_start || '',
        dateEnd: message.date_end || '',
      });
    }
    api.getDisplayTemplates().then(data => {
      setTemplates(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [message]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      toast.warning('Le titre est requis');
      return;
    }
    try {
      setSaving(true);
      const data = {
        title: form.title.trim(),
        body: form.body.trim() || null,
        priority: form.priority,
        templateId: form.templateId ? parseInt(form.templateId) : null,
        dateStart: form.dateStart || null,
        dateEnd: form.dateEnd || null,
      };
      if (message) {
        await api.updateDisplayMessage(message.id, data);
      } else {
        await api.createDisplayMessage(data);
      }
      onSave();
    } catch (err) {
      toast.error(err.message || 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  }, [form, message, toast, onSave]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><MessageSquare size={18} /> {message ? 'Modifier le message' : 'Nouveau message'}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => handleChange('title', e.target.value)}
              placeholder="Ex: Bienvenue au spectacle"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Contenu</label>
            <textarea
              value={form.body}
              onChange={e => handleChange('body', e.target.value)}
              rows={4}
              placeholder="Texte du message…"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Priorité</label>
              <select value={form.priority} onChange={e => handleChange('priority', e.target.value)}>
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div className="form-group">
              <label>Template</label>
              <select value={form.templateId} onChange={e => handleChange('templateId', e.target.value)}>
                <option value="">— Par défaut —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Date début</label>
              <input
                type="date"
                value={form.dateStart}
                onChange={e => handleChange('dateStart', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Date fin</label>
              <input
                type="date"
                value={form.dateEnd}
                onChange={e => handleChange('dateEnd', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(MessageFormModal);
