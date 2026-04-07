import { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, X, Save, Briefcase, MapPin, User, Clock, MessageSquare, Calendar, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';
import AddressAutocomplete from './AddressAutocomplete';
import './DynamicDisplayDialog.css';
import { Button, Input, Textarea, FormField } from '@/design-system';

// ═══ Constantes ═══
const EVENT_TYPES = {
  preparation:  { label: 'Préparation',  color: '#6366f1', emoji: '🔧' },
  enlevement:   { label: 'Enlèvement',   color: '#f59e0b', emoji: '📦' },
  livraison:    { label: 'Livraison',     color: '#10b981', emoji: '🚚' },
  depart:       { label: 'Départ',        color: '#3b82f6', emoji: '🚀' },
  retour:       { label: 'Retour',        color: '#8b5cf6', emoji: '↩️' },
  recuperation: { label: 'Récupération',  color: '#ef4444', emoji: '📥' },
};

const EVENT_CATEGORIES = {
  vente:        { label: 'Vente',        color: '#8b5cf6' },
  location:     { label: 'Location',     color: '#f59e0b' },
  prestation:   { label: 'Prestation',   color: '#3b82f6' },
  installation: { label: 'Installation', color: '#10b981' },
};

// ═══ Composant Principal ═══
function DynamicDisplayDialog({ event, defaultDate, defaultAffaireId, onSave, onClose }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [affaireSearch, setAffaireSearch] = useState(defaultAffaireId || '');
  const [affaireSuggestions, setAffaireSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggRef = useRef(null);

  const isEdit = !!event;

  // Form state
  const [form, setForm] = useState({
    affaireId: defaultAffaireId || '',
    type: 'preparation',
    category: 'prestation',
    date: defaultDate || new Date().toISOString().slice(0, 10),
    period: 'AM',
    time: '',
    comment: '',
    client: '',
    location: '',
  });
  const [locationCoords, setLocationCoords] = useState(null);

  // Init from existing event
  useEffect(() => {
    if (event) {
      setForm({
        affaireId: event.affaireId || '',
        type: event.type || 'preparation',
        category: event.category || 'prestation',
        date: event.date || defaultDate || new Date().toISOString().slice(0, 10),
        period: event.period || 'AM',
        time: event.time || '',
        comment: event.comment || '',
        client: event.client || '',
        location: event.location || '',
      });
      setAffaireSearch(event.affaireId || '');
    }
  }, [event, defaultDate]);

  // Click outside suggestions
  useEffect(() => {
    const handler = (e) => {
      if (suggRef.current && !suggRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load affaires for autocomplete
  const searchAffaires = useCallback(async (q) => {
    if (q.length < 2) {
      setAffaireSuggestions([]);
      return;
    }
    try {
      const data = await api.getAffaires({ search: q, limit: 8 });
      setAffaireSuggestions(Array.isArray(data) ? data : data.affaires || []);
      setShowSuggestions(true);
    } catch {
      setAffaireSuggestions([]);
    }
  }, []);

  const handleAffaireInput = (value) => {
    setAffaireSearch(value);
    setForm(f => ({ ...f, affaireId: value }));
    searchAffaires(value);
  };

  const handleSelectAffaire = (aff) => {
    const id = aff.affaireNumber || aff.id || '';
    setAffaireSearch(id);
    setForm(f => ({
      ...f,
      affaireId: id,
      client: aff.client || aff.clientName || f.client,
      location: aff.location || aff.lieu || f.location,
    }));
    setShowSuggestions(false);
  };

  const updateField = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    // Validation
    if (!form.type) {
      toast.warning('Veuillez sélectionner un type d\'événement');
      return;
    }
    if (!form.date) {
      toast.warning('Veuillez sélectionner une date');
      return;
    }

    setSaving(true);
    try {
      // Convertir camelCase vers snake_case pour l'API
      const payload = {
        affaire_id: form.affaireId || null,
        type: form.type,
        category: form.category || null,
        date: form.date,
        period: form.period || null,
        time: form.time || null,
        comment: form.comment || null,
        client: form.client || null,
        location: form.location || null,
      };

      if (isEdit) {
        await api.updateDisplayEvent(event.id, payload);
        toast.success('Événement modifié');
      } else {
        await api.createDisplayEvent(payload);
        toast.success('Événement créé');
      }
      onSave?.();
      onClose();
    } catch (err) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard: Escape ferme, Enter sauvegarde
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="display-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={handleKeyDown}>
      <div className="display-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <h3>
            <Monitor size={20} />
            {isEdit ? 'Modifier l\'événement' : 'Nouvel événement d\'affichage'}
          </h3>
          <Button variant="ghost" className="dialog-close" onClick={onClose} aria-label="Fermer"><X size={18} /></Button>
        </div>

        {/* Body */}
        <div className="dialog-body">
          {/* Type */}
          <FormField className="form-group" label="Type d'événement" required style={{ marginBottom: 16 }}>
            <div className="type-selector">
              {Object.entries(EVENT_TYPES).map(([key, info]) => (
                <span
                  key={key}
                  className={`type-chip ${form.type === key ? 'selected' : ''}`}
                  style={form.type === key ? { background: info.color, borderColor: info.color } : {}}
                  onClick={() => updateField('type', key)}
                >
                  {info.emoji} {info.label}
                </span>
              ))}
            </div>
          </FormField>

          {/* Catégorie */}
          <FormField className="form-group" label="Catégorie" style={{ marginBottom: 16 }}>
            <div className="category-selector">
              {Object.entries(EVENT_CATEGORIES).map(([key, info]) => (
                <span
                  key={key}
                  className={`cat-pill ${form.category === key ? 'selected' : ''}`}
                  style={form.category === key ? { background: info.color, borderColor: info.color } : {}}
                  onClick={() => updateField('category', key)}
                >
                  {info.label}
                </span>
              ))}
            </div>
          </FormField>

          {/* Affaire + Client */}
          <div className="form-row">
            <div ref={suggRef} className="form-group affaire-autocomplete">
            <FormField label={<><Briefcase size={12} /> Affaire</>}>
              <Input
                type="text"
                value={affaireSearch}
                onChange={e => handleAffaireInput(e.target.value)}
                placeholder="AF32844..."
                onFocus={() => affaireSuggestions.length > 0 && setShowSuggestions(true)}
              />
              {showSuggestions && affaireSuggestions.length > 0 && (
                <div className="affaire-suggestions">
                  {affaireSuggestions.map(aff => (
                    <div
                      key={aff.id || aff.affaireNumber}
                      className="affaire-suggestion"
                      onClick={() => handleSelectAffaire(aff)}
                    >
                      <span className="affaire-id">{aff.affaireNumber || aff.id}</span>
                      <span className="affaire-name">
                        {aff.client || aff.clientName || ''} {aff.lieu || aff.location ? `— ${aff.lieu || aff.location}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </FormField>
            </div>
            <FormField className="form-group" label={<><User size={12} /> Client</>}>
              <Input
                type="text"
                value={form.client}
                onChange={e => updateField('client', e.target.value)}
                placeholder="Nom du client"
              />
            </FormField>
          </div>

          {/* Date + Période */}
          <div className="form-row">
            <FormField className="form-group" label={<><Calendar size={12} /> Date</>} required>
              <input
                type="date"
                value={form.date}
                onChange={e => updateField('date', e.target.value)}
              />
            </FormField>
            <FormField className="form-group" label={<><Clock size={12} /> Heure (optionnel)</>}>
              <input
                type="time"
                value={form.time}
                onChange={e => updateField('time', e.target.value)}
              />
            </FormField>
          </div>

          {/* Période Matin/Après-midi */}
          <FormField className="form-group" label="Période" style={{ marginBottom: 16 }}>
            <div className="period-toggle">
              <Button variant="ghost"                 type="button"
                className={`period-btn ${form.period === 'AM' ? 'selected' : ''}`}
                onClick={() => updateField('period', 'AM')}
              >
                🌅 Matin
              </Button>
              <Button variant="ghost"                 type="button"
                className={`period-btn ${form.period === 'PM' ? 'selected' : ''}`}
                onClick={() => updateField('period', 'PM')}
              >
                ☀️ Après-midi
              </Button>
            </div>
          </FormField>

          {/* Lieu */}
          <FormField className="form-group" label={<><MapPin size={12} /> Lieu</>} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <AddressAutocomplete
                value={form.location}
                onChange={v => updateField('location', v)}
                placeholder="Dépôt Locmat, salle des fêtes..."
                onPlaceSelect={(place) => {
                  if (place?.geometry?.location) {
                    setLocationCoords({
                      lat: place.geometry.location.lat(),
                      lng: place.geometry.location.lng(),
                    });
                  }
                }}
              />
              {(locationCoords || form.location) && (
                <a
                  href={locationCoords
                    ? `https://www.google.com/maps/search/?api=1&query=${locationCoords.lat},${locationCoords.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.location)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ouvrir dans Google Maps"
                  style={{ color: 'var(--theme-primary)', flexShrink: 0 }}
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </FormField>

          {/* Commentaire */}
          <FormField className="form-group" label={<><MessageSquare size={12} /> Commentaire</>}>
            <Textarea
              value={form.comment}
              onChange={e => updateField('comment', e.target.value)}
              placeholder="Détails supplémentaires..."
              rows={3}
            />
          </FormField>
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save size={15} />
            {saving ? 'Enregistrement...' : (isEdit ? 'Modifier' : 'Créer')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DynamicDisplayDialog;
