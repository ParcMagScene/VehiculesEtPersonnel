import './GoogleCalendarConfig.css';

import { AlertCircle, Calendar, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, FormField, InlineAlert, Input } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { loadFromIndexedDB, saveToIndexedDB } from '../../utils/indexedDB';

const GoogleCalendarConfig = () => {
  const toast = useToast();
  const [calendarId, setCalendarId] = useState('');
  const [mapsApiKey, setMapsApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const [calendarIdData, mapsApiKeyData, statusData] = await Promise.all([
        api.getGoogleCalendarId(),
        api.getGoogleMapsApiKey(),
        api.getCalendarServiceStatus(),
      ]);
      setCalendarId(calendarIdData.value || '');
      setMapsApiKey(mapsApiKeyData.value || '');
      setServiceStatus(statusData || null);
    } catch (error) {
      console.error('Erreur chargement config:', error);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!calendarId) {
      toast.warning("Veuillez renseigner l'ID du calendrier");
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        api.saveGoogleCalendarId(calendarId),
        mapsApiKey ? api.saveGoogleMapsApiKey(mapsApiKey) : Promise.resolve(),
      ]);

      // Sauvegarder aussi dans IndexedDB pour l'accès sans token
      const config = await loadFromIndexedDB('calendarConfig', {});
      config.googleMapsApiKey = mapsApiKey;
      await saveToIndexedDB('calendarConfig', config);

      toast.success('Configuration enregistrée avec succès');
      await loadConfig();
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
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
        <h3>
          <Calendar size={20} /> Configuration Google Calendar
        </h3>
        <p className="config-description">
          Intégration Service Account: configuration globale administrateur, sans connexion Google
          utilisateur.
        </p>
      </div>

      <div className="environment-info">
        <h4>📍 Environnement détecté</h4>
        <div className="env-details">
          <div className="env-item">
            <strong>URL actuelle (origin):</strong>
            <code>{window.location.origin}</code>
          </div>
          <div className="env-item">
            <strong>Hostname:</strong>
            <code>{window.location.hostname}</code>
          </div>
          <div className="env-item">
            <strong>Port:</strong>
            <code>{window.location.port}</code>
          </div>
          {serviceStatus && (
            <InlineAlert variant={serviceStatus.configured ? 'success' : 'warning'}>
              <strong>Statut Service Account:</strong>{' '}
              {serviceStatus.configured
                ? `configuré (${serviceStatus.serviceAccountEmail || 'email inconnu'})`
                : 'non configuré'}
            </InlineAlert>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="config-form">
        <FormField className="form-group" label="ID du calendrier" htmlFor="calendarId" required>
          <Input
            id="calendarId"
            type="text"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            placeholder="calendrier@group.calendar.google.com"
            required
          />
          <p className="field-hint">
            <AlertCircle size={14} />
            Partagez ce calendrier avec le Service Account en lecture
          </p>
        </FormField>

        <div className="form-group">
          <label htmlFor="mapsApiKey">
            Clé API Google Maps
            <span className="optional"> (optionnel)</span>
          </label>
          <Input
            id="mapsApiKey"
            type="text"
            value={mapsApiKey}
            onChange={(e) => setMapsApiKey(e.target.value)}
            placeholder="AIzaSy..."
          />
          <p className="field-hint">
            <AlertCircle size={14} />
            Nécessaire pour la carte des lieux et le calcul de distances
          </p>
        </div>

        <div className="form-actions">
          <Button variant="primary" type="submit" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </form>

      <div className="config-info">
        <h4>📝 Instructions</h4>
        <ol>
          <li>
            Créez un projet dans{' '}
            <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
              Google Cloud Console
            </a>
          </li>
          <li>
            Activez les API : Google Calendar, Maps JavaScript API, Places API, Distance Matrix API
          </li>
          <li>Créez un Service Account et générez une clé JSON</li>
          <li>Créez une clé API pour Google Maps</li>
          <li>Configurez GOOGLE_SERVICE_ACCOUNT_JSON côté serveur (jamais côté frontend)</li>
          <li>Partagez le calendrier avec le Service Account (lecture)</li>
          <li>Récupérez l'ID de votre calendrier dans Google Calendar (Paramètres → Calendrier)</li>
        </ol>
      </div>
    </div>
  );
};

export default GoogleCalendarConfig;
