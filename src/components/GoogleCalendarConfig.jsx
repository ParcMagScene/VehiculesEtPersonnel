import React, { useState, useEffect } from 'react';
import { Calendar, Save, AlertCircle, LogOut, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import { saveToIndexedDB, loadFromIndexedDB } from '../utils/indexedDB';
import './GoogleCalendarConfig.css';
import { useToast } from '../hooks/useToast';

const GoogleCalendarConfig = () => {
  const toast = useToast();
  const [clientId, setClientId] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [mapsApiKey, setMapsApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const [clientIdData, calendarIdData, mapsApiKeyData] = await Promise.all([
        api.getGoogleClientId(),
        api.getGoogleCalendarId(),
        api.getGoogleMapsApiKey()
      ]);
      setClientId(clientIdData.value || '');
      setCalendarId(calendarIdData.value || '');
      setMapsApiKey(mapsApiKeyData.value || '');
    } catch (error) {
      console.error('Erreur chargement config:', error);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!clientId || !calendarId) {
      toast.warning('Veuillez remplir au moins le Client ID et l\'ID du calendrier');
      return;
    }

    try {
      setIsSaving(true);
      await Promise.all([
        api.saveGoogleClientId(clientId),
        api.saveGoogleCalendarId(calendarId),
        mapsApiKey ? api.saveGoogleMapsApiKey(mapsApiKey) : Promise.resolve()
      ]);
      
      // Sauvegarder aussi dans IndexedDB pour l'accès sans token
      const config = await loadFromIndexedDB('calendarConfig', {});
      config.googleMapsApiKey = mapsApiKey;
      await saveToIndexedDB('calendarConfig', config);
      
      toast.success('Configuration enregistrée avec succès Si vous avez changé le Client ID, cliquez sur "Déconnecter OAuth" puis reconnectez-vous.');
    } catch (error) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeOAuth = () => {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir déconnecter Google Calendar ?\n\nVous devrez autoriser à nouveau l\'accès après cette action.')) {
      return;
    }

    // Supprimer les données du localStorage
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
    localStorage.removeItem('google_token_client');
    
    // Révoquer l'accès sur le compte Google
    toast.success('Déconnexion effectuée Veuillez : 1. Recharger la page (F5)\n2. Aller sur https://myaccount.google.com/permissions\n3. Révoquer l\'accès à cette application\n4. Revenir et vous reconnecter avec le nouveau Client ID');
    
    // Recharger après 2 secondes
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handleOpenGooglePermissions = () => {
    window.open('https://myaccount.google.com/permissions', '_blank');
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
          <div className="env-item">
            <strong>Recommandation:</strong>
            {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? (
              <span className="env-local">
                🔧 Utilisez le Client ID de <strong>Véhicules Local Dev</strong>
              </span>
            ) : (
              <span className="env-prod">
                🌐 Utilisez le Client ID de <strong>ParcMagScene</strong>
              </span>
            )}
          </div>
          <div className="env-item env-warning">
            <strong>⚠️ URI à configurer dans Google Cloud Console :</strong>
            <div className="uri-list">
              <div className="uri-item">
                <strong>Origines JavaScript autorisées :</strong>
                <code className="selectable">{window.location.origin}</code>
                <button 
                  type="button"
                  className="btn-copy-small"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin);
                    toast.success('URL copiée dans le presse-papiers');
                  }}
                >
                  📋 Copier
                </button>
              </div>
              <div className="uri-item">
                <strong>URI de redirection autorisés :</strong>
                <code className="selectable">{window.location.origin}</code>
                <button 
                  type="button"
                  className="btn-copy-small"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin);
                    toast.success('URL copiée dans le presse-papiers');
                  }}
                >
                  📋 Copier
                </button>
              </div>
            </div>
            <small>
              👆 Ajoutez cette URL exactement dans les deux sections de votre OAuth Client ID
            </small>
          </div>
        </div>
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
            Choisissez le bon Client ID selon votre environnement (voir ci-dessus)
          </p>
          <details className="client-id-help">
            <summary>📝 J'ai deux Client IDs - Lequel utiliser ?</summary>
            <div className="help-content">
              <p><strong>Véhicules Local Dev</strong> (localhost)</p>
              <ul>
                <li>Pour développement local : http://localhost:4173</li>
                <li>Origines autorisées : localhost uniquement</li>
              </ul>
              <p><strong>ParcMagScene</strong> (production)</p>
              <ul>
                <li>Pour accès réseau/internet : http://magsav.duckdns.org:4173</li>
                <li>Origines autorisées : votre domaine ou IP publique</li>
              </ul>
              <p className="warning-note">
                ⚠️ Si vous changez de Client ID, utilisez le bouton "Déconnecter OAuth" ci-dessous puis reconnectez-vous.
              </p>
            </div>
          </details>
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

        <div className="form-group">
          <label htmlFor="mapsApiKey">
            Clé API Google Maps
            <span className="optional"> (optionnel)</span>
          </label>
          <input
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

      <div className="oauth-actions">
        <h4>🔐 Gestion OAuth</h4>
        <div className="oauth-buttons">
          <button 
            type="button"
            className="btn-revoke"
            onClick={handleRevokeOAuth}
          >
            <LogOut size={18} />
            Déconnecter OAuth
          </button>
          <button 
            type="button"
            className="btn-secondary"
            onClick={handleOpenGooglePermissions}
          >
            <RefreshCw size={18} />
            Gérer les autorisations
          </button>
        </div>
        <p className="oauth-hint">
          <AlertCircle size={14} />
          Utilisez ces boutons si vous avez changé de Client ID ou en cas d'erreur 401
        </p>
      </div>

      <div className="config-info">
        <h4>📝 Instructions</h4>
        <ol>
          <li>Créez un projet dans <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
          <li>Activez les API : Google Calendar, Maps JavaScript API, Places API, Distance Matrix API</li>
          <li>Créez des identifiants OAuth 2.0 (Client ID)</li>
          <li>Créez une clé API pour Google Maps</li>
          <li>Ajoutez l'origine autorisée : <code>http://192.168.205.75:4173</code></li>
          <li>Copiez le Client ID et la clé API ici</li>
          <li>Récupérez l'ID de votre calendrier dans Google Calendar (Paramètres → Calendrier)</li>
        </ol>
      </div>
    </div>
  );
};

export default GoogleCalendarConfig;
