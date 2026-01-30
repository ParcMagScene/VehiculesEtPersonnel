import React, { useState, useEffect } from 'react';
import { Calendar, Save, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import './GoogleCalendarConfig.css';

const GoogleCalendarConfig = () => {
  const [clientId, setClientId] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const [clientIdData, calendarIdData] = await Promise.all([
        api.getGoogleClientId(),
        api.getGoogleCalendarId()
      ]);
      setClientId(clientIdData.value || '');
      setCalendarId(calendarIdData.value || '');
    } catch (error) {
      console.error('Erreur chargement config:', error);
      alert('Erreur lors du chargement de la configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!clientId || !calendarId) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        api.saveGoogleClientId(clientId),
        api.saveGoogleCalendarId(calendarId)
      ]);
      alert('Configuration enregistrée avec succès');
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="google-calendar-config-loading">Chargement...</div>;
  }

  return (
    <div className="google-calendar-config">
      <div className="config-header">
        <h3><Calendar size={20} /> Configuration Google Calendar</h3>
        <p className="config-description">
          Ces paramètres sont partagés pour tous les utilisateurs. 
          Chaque utilisateur devra cependant autoriser l'accès avec son compte Google.
        </p>
      </div>

      <form onSubmit={handleSave} className="config-form">
        <div className="form-group">
          <label htmlFor="clientId">
            Client ID OAuth 2.0
            <span className="required">*</span>
          </label>
          <input
            id="clientId"
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="123456789-abc123def456.apps.googleusercontent.com"
            required
          />
          <p className="field-hint">
            <AlertCircle size={14} />
            Obtenu depuis la Google Cloud Console
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="calendarId">
            ID du calendrier
            <span className="required">*</span>
          </label>
          <input
            id="calendarId"
            type="text"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            placeholder="calendrier@group.calendar.google.com"
            required
          />
          <p className="field-hint">
            <AlertCircle size={14} />
            Trouvé dans les paramètres du calendrier Google
          </p>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn-save"
            disabled={isSaving}
          >
            <Save size={18} />
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>

      <div className="config-info">
        <h4>📝 Instructions</h4>
        <ol>
          <li>Créez un projet dans <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
          <li>Activez l'API Google Calendar</li>
          <li>Créez des identifiants OAuth 2.0 (Client ID)</li>
          <li>Ajoutez l'origine autorisée : <code>http://192.168.205.75:4173</code></li>
          <li>Copiez le Client ID ici</li>
          <li>Récupérez l'ID de votre calendrier dans Google Calendar (Paramètres → Calendrier)</li>
        </ol>
      </div>
    </div>
  );
};

export default GoogleCalendarConfig;
