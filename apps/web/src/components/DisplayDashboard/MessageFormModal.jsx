// MessageFormModal — Création / édition d'un message d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { MessageSquare, Save } from 'lucide-react';
import { Button, FormField, ModalLayout, Input, Textarea, Select } from '@/design-system';
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
    <ModalLayout
      open
      onClose={onClose}
      title={message ? 'Modifier le message' : 'Nouveau message'}
      icon={<MessageSquare size={18} />}
      size="md"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </>}
    >
          <FormField className="form-group" label="Titre" required>
            <Input
              type="text"
              value={form.title}
              onChange={e => handleChange('title', e.target.value)}
              placeholder="Ex: Bienvenue au spectacle"
              autoFocus
            />
          </FormField>
          <FormField className="form-group" label="Contenu">
            <Textarea
              value={form.body}
              onChange={e => handleChange('body', e.target.value)}
              rows={4}
              placeholder="Texte du message…"
            />
          </FormField>
          <div className="form-row">
            <FormField className="form-group" label="Priorité">
              <Select value={form.priority} onChange={e => handleChange('priority', e.target.value)}>
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </Select>
            </FormField>
            <FormField className="form-group" label="Template">
              <Select value={form.templateId} onChange={e => handleChange('templateId', e.target.value)}>
                <option value="">— Par défaut —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="form-row">
            <FormField className="form-group" label="Date début">
              <input
                type="date"
                value={form.dateStart}
                onChange={e => handleChange('dateStart', e.target.value)}
              />
            </FormField>
            <FormField className="form-group" label="Date fin">
              <input
                type="date"
                value={form.dateEnd}
                onChange={e => handleChange('dateEnd', e.target.value)}
              />
            </FormField>
          </div>
    </ModalLayout>
  );
}

export default memo(MessageFormModal);
