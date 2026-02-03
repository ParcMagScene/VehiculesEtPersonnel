import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Trash2 } from 'lucide-react';
import { useAutocomplete } from '../hooks/useAutocomplete';
import './ReservationModal.css';

const ReservationModal = ({
  slot,
  reservation,
  vehicles,
  clients,
  drivers,
  locations,
  onSave,
  onDelete,
  onClose,
  googleEvent, // Événement Google pour mode multi-véhicules
  googleEvents = [], // Liste de tous les événements Google disponibles
}) => {
  const isEdit = !!reservation;
  const isMultiVehicle = !!googleEvent && !isEdit; // Mode multi-véhicules seulement en création
  
  // Helper pour formater une date en YYYY-MM-DD sans décalage de fuseau horaire
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Initialiser les affaires en tant que tableau (compatibilité avec l'ancien format)
  const initAffaires = () => {
    if (reservation?.affaires && Array.isArray(reservation.affaires)) {
      return reservation.affaires;
    } else if (reservation?.affaire) {
      return [reservation.affaire];
    } else if (googleEvent?.affaire) {
      return [googleEvent.affaire];
    }
    return [];
  };

  // Initialiser les événements liés
  const initLinkedEvents = () => {
    if (reservation?.linkedEventIds && Array.isArray(reservation.linkedEventIds)) {
      return reservation.linkedEventIds;
    } else if (reservation?.googleEventId) {
      return [reservation.googleEventId];
    } else if (googleEvent?.id) {
      return [googleEvent.id];
    }
    return [];
  };

  const [formData, setFormData] = useState({
    vehicleId: reservation?.vehicleId || slot?.vehicle?.id || '',
    date: reservation?.date || formatDateForInput(slot?.startDate || slot?.date) || '',
    period: reservation?.period || slot?.startPeriod || slot?.period || 'AM',
    endDate: reservation?.endDate || formatDateForInput(slot?.endDate || slot?.date) || '',
    endPeriod: reservation?.endPeriod || slot?.endPeriod || slot?.period || 'AM',
    clientName: reservation?.clientName || googleEvent?.detectedClient || '',
    driverName: reservation?.driverName || '',
    locationName: reservation?.locationName || googleEvent?.detectedLocation || googleEvent?.location || '',
    prestationName: reservation?.prestationName || googleEvent?.summary || '',
    notes: reservation?.notes || '',
    googleEventId: reservation?.googleEventId || googleEvent?.id || '', // Pour compatibilité
    linkedEventIds: initLinkedEvents(), // Nouveau tableau pour les événements multiples
    affaires: initAffaires(),
    isTournee: reservation?.isTournee || false, // Nouvelle option Tournée
  });

  const [initialFormData, setInitialFormData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [newAffaire, setNewAffaire] = useState('');

  // Hooks pour l'autocomplétion
  const { suggestions: clientSuggestions, addToHistory: addClient } = useAutocomplete('clients');
  const { suggestions: driverSuggestions, addToHistory: addDriver } = useAutocomplete('drivers');
  const { suggestions: locationSuggestions, addToHistory: addLocation } = useAutocomplete('locations');
  const { suggestions: prestationSuggestions, addToHistory: addPrestation } = useAutocomplete('prestations');
  const { suggestions: affaireSuggestions, addToHistory: addAffaire } = useAutocomplete('affaires');

  // État pour la sélection multiple de véhicules
  const [selectedVehicleIds, setSelectedVehicleIds] = useState(
    isMultiVehicle ? [] : []
  );

  // État pour le dropdown personnalisé des événements Google
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);

  // Initialiser initialFormData au montage pour la réservation en édition
  useEffect(() => {
    if (isEdit && reservation && !initialFormData) {
      setInitialFormData({...formData});
    }
  }, [isEdit, reservation]);

  // Détecter les changements
  useEffect(() => {
    if (isEdit && initialFormData) {
      const changed = JSON.stringify(formData) !== JSON.stringify(initialFormData);
      setHasChanges(changed);
    }
  }, [formData, initialFormData, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGoogleEventSelect = (e) => {
    const eventId = e.target.value;
    if (eventId) {
      const selectedEvent = googleEvents.find(ev => ev.id === eventId);
      if (selectedEvent) {
        setFormData((prev) => {
          const newAffaires = [...prev.affaires];
          if (selectedEvent.affaire && !newAffaires.includes(selectedEvent.affaire)) {
            newAffaires.push(selectedEvent.affaire);
          }
          return {
            ...prev,
            googleEventId: selectedEvent.id,
            googleEventTitle: selectedEvent.summary || '(Sans titre)',
            locationName: selectedEvent.detectedLocation || selectedEvent.location || prev.locationName,
            prestationName: selectedEvent.summary || prev.prestationName,
            clientName: selectedEvent.detectedClient || prev.clientName,
            affaires: newAffaires,
          };
        });
      }
    } else {
      // Désélectionner l'événement
      setFormData((prev) => ({
        ...prev,
        googleEventId: '',
        googleEventTitle: '',
      }));
    }
    setIsEventDropdownOpen(false);
  };

  const selectGoogleEvent = (event) => {
    if (event) {
      setFormData((prev) => {
        if (prev.isTournee) {
          // Mode tournée : ajouter/retirer l'événement de la liste
          const newLinkedEventIds = [...prev.linkedEventIds];
          const eventIndex = newLinkedEventIds.indexOf(event.id);
          
          if (eventIndex > -1) {
            // L'événement est déjà sélectionné, le retirer
            newLinkedEventIds.splice(eventIndex, 1);
          } else {
            // Ajouter l'événement
            newLinkedEventIds.push(event.id);
          }
          
          // Mettre à jour les affaires
          const newAffaires = [];
          newLinkedEventIds.forEach(eventId => {
            const e = googleEvents.find(ev => ev.id === eventId);
            if (e?.affaire && !newAffaires.includes(e.affaire)) {
              newAffaires.push(e.affaire);
            }
          });
          
          return {
            ...prev,
            linkedEventIds: newLinkedEventIds,
            googleEventId: newLinkedEventIds[0] || '',
            affaires: newAffaires,
          };
        } else {
          // Mode normal : un seul événement
          const newAffaires = [...prev.affaires];
          if (event.affaire && !newAffaires.includes(event.affaire)) {
            newAffaires.push(event.affaire);
          }
          
          setIsEventDropdownOpen(false);
          
          return {
            ...prev,
            linkedEventIds: [event.id],
            googleEventId: event.id,
            locationName: event.detectedLocation || event.location || prev.locationName,
            prestationName: prev.prestationName || event.summary,
            clientName: prev.clientName || event.detectedClient,
            affaires: newAffaires,
          };
        }
      });
      // Ne fermer le dropdown qu'en mode normal
    } else {
      // Désélectionner tous les événements
      setFormData((prev) => ({
        ...prev,
        googleEventId: '',
        linkedEventIds: [],
      }));
      setIsEventDropdownOpen(false);
    }
  };

  const handleVehicleToggle = (vehicleId) => {
    setSelectedVehicleIds(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Ajouter les valeurs à l'historique d'autocomplétion
    if (formData.clientName) addClient(formData.clientName);
    if (formData.driverName) addDriver(formData.driverName);
    if (formData.locationName) addLocation(formData.locationName);
    if (formData.prestationName) addPrestation(formData.prestationName);
    formData.affaires.forEach(affaire => addAffaire(affaire));
    
    if (isMultiVehicle) {
      // Mode multi-véhicules : créer une réservation par véhicule sélectionné
      if (selectedVehicleIds.length === 0) {
        alert('Veuillez sélectionner au moins un véhicule');
        return;
      }
      
      const reservations = selectedVehicleIds.map(vehicleId => ({
        ...formData,
        vehicleId,
      }));
      
      onSave(reservations);
    } else {
      // Mode normal : une seule réservation
      onSave(formData);
    }
  };

  // Filtrer les événements Google qui couvrent la période de réservation
  const getFilteredGoogleEvents = () => {
    if (!formData.date || !formData.endDate) return googleEvents;
    
    const reservationStart = new Date(formData.date);
    const reservationEnd = new Date(formData.endDate);
    
    // Ajouter un jour après la fin de réservation pour inclure les événements adjacents
    const extendedEnd = new Date(reservationEnd);
    extendedEnd.setDate(extendedEnd.getDate() + 1);
    
    return googleEvents.filter(event => {
      const eventStart = event.start?.dateTime 
        ? new Date(event.start.dateTime) 
        : event.start?.date 
          ? new Date(event.start.date) 
          : null;
      
      const eventEnd = event.end?.dateTime 
        ? new Date(event.end.dateTime) 
        : event.end?.date 
          ? new Date(event.end.date) 
          : null;
      
      if (!eventStart || !eventEnd) return false;
      
      // Vérifier si les périodes se chevauchent ou si l'événement est le lendemain
      return eventStart <= extendedEnd && eventEnd >= reservationStart;
    });
  };

  const formatEventOption = (event) => {
    const startDate = event.start?.dateTime 
      ? new Date(event.start.dateTime) 
      : event.start?.date 
        ? new Date(event.start.date) 
        : null;
    
    const endDate = event.end?.dateTime 
      ? new Date(event.end.dateTime) 
      : event.end?.date 
        ? new Date(event.end.date) 
        : null;
    
    const dateRange = startDate && endDate
      ? `${format(startDate, 'dd/MM', { locale: fr })} → ${format(endDate, 'dd/MM', { locale: fr })}`
      : '';
    
    const title = event.summary || '(Sans titre)';
    const affaire = event.affaire ? ` [${event.affaire}]` : '';
    const client = event.detectedClient ? ` • ${event.detectedClient}` : '';
    const location = event.detectedLocation ? ` • ${event.detectedLocation}` : '';
    
    return `${dateRange} | ${title}${affaire}${client}${location}`;
  };

  // Obtenir la couleur de l'événement
  const getEventColor = (event) => {
    const googleColorMap = {
      '1': '#a4bdfc',
      '2': '#7ae7bf',
      '3': '#dbadff',
      '4': '#ff887c',
      '5': '#fbd75b',
      '6': '#ffb878',
      '7': '#46d6db',
      '8': '#e1e1e1',
      '9': '#5484ed',
      '10': '#51b749',
      '11': '#dc2127',
    };
    
    return event.colorId && googleColorMap[event.colorId] 
      ? googleColorMap[event.colorId]
      : '#3b82f6';
  };

  const selectedVehicle = vehicles.find(v => v.id === parseInt(formData.vehicleId));
  const displayDate = formData.date 
    ? format(new Date(formData.date), "EEEE d MMMM yyyy", { locale: fr })
    : '';

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title">{isEdit ? 'Modifier la réservation' : 'Nouvelle réservation'}</h2>
          <button className="close-button" onClick={onClose} aria-label="Fermer la fenêtre">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {googleEvent && (
            <div className="google-event-badge">
              📅 Lié à : <strong>{googleEvent.summary}</strong>
              {googleEvent.location && <span> - {googleEvent.location}</span>}
            </div>
          )}

          {isMultiVehicle ? (
            <div className="form-group">
              <label>Véhicules * (Sélectionnez un ou plusieurs véhicules)</label>
              <div className="vehicle-checkboxes">
                {vehicles.map((vehicle) => (
                  <label key={vehicle.id} className="vehicle-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedVehicleIds.includes(vehicle.id)}
                      onChange={() => handleVehicleToggle(vehicle.id)}
                    />
                    <div
                      className="vehicle-color-indicator"
                      style={{ backgroundColor: vehicle.displayColor || vehicle.color }}
                    />
                    <span>{vehicle.name} - {vehicle.type}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="vehicleId">Véhicule *</label>
                <select
                  id="vehicleId"
                  name="vehicleId"
                  value={formData.vehicleId}
                  onChange={handleChange}
                  required
                  aria-required="true"
                >
                  <option value="">Sélectionner un véhicule</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} - {vehicle.type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!isMultiVehicle && googleEvents.length > 0 && (
            <div className="form-group">
              <label htmlFor="googleEventSelect">Lier à un événement Google (optionnel)</label>
              <div className="custom-dropdown">
                <div 
                  className="custom-dropdown-trigger"
                  onClick={() => setIsEventDropdownOpen(!isEventDropdownOpen)}
                >
                  {formData.isTournee ? (
                    // Mode tournée : afficher tous les événements liés
                    formData.linkedEventIds.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                        {formData.linkedEventIds.map(eventId => {
                          const event = googleEvents.find(e => e.id === eventId);
                          if (!event) return null;
                          
                          const startDate = event.start?.dateTime 
                            ? new Date(event.start.dateTime) 
                            : event.start?.date 
                              ? new Date(event.start.date) 
                              : null;
                          
                          const dateRange = startDate ? format(startDate, 'dd/MM', { locale: fr }) : '';
                          
                          return (
                            <div key={eventId} className="selected-event-display" style={{ backgroundColor: getEventColor(event) + '20', padding: '0.25rem 0.5rem' }}>
                              <span className="event-dates" style={{ fontSize: '0.7rem' }}>{dateRange}</span>
                              {event.affaire && <span className="event-affaire" style={{ fontSize: '0.7rem' }}>{event.affaire}</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="placeholder">Aucun événement sélectionné</span>
                    )
                  ) : (
                    // Mode normal : un seul événement
                    formData.googleEventId ? (
                      (() => {
                        const event = googleEvents.find(e => e.id === formData.googleEventId);
                        if (!event) return <span className="placeholder">Aucun événement</span>;
                        
                        const startDate = event.start?.dateTime 
                          ? new Date(event.start.dateTime) 
                          : event.start?.date 
                            ? new Date(event.start.date) 
                            : null;
                        
                        const endDate = event.end?.dateTime 
                          ? new Date(event.end.dateTime) 
                          : event.end?.date 
                            ? new Date(event.end.date) 
                            : null;
                        
                        const dateRange = startDate && endDate
                          ? `${format(startDate, 'dd/MM', { locale: fr })} → ${format(endDate, 'dd/MM', { locale: fr })}`
                          : '';
                        
                        let cleanTitle = event.summary || '(Sans titre)';
                        if (event.affaire) {
                          cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
                          cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                        }
                        if (!cleanTitle) cleanTitle = '(Sans titre)';
                        
                        return (
                          <div className="selected-event-display" style={{ backgroundColor: getEventColor(event) + '20' }}>
                            <span className="event-dates">{dateRange}</span>
                            <span className="event-title">{cleanTitle}</span>
                            {event.affaire && <span className="event-affaire">{event.affaire}</span>}
                          </div>
                        );
                      })()
                    ) : (
                      <span className="placeholder">Aucun événement</span>
                    )
                  )}
                  <span className="dropdown-arrow">▼</span>
                </div>
                
                {isEventDropdownOpen && (
                  <div className="custom-dropdown-menu">
                    <div 
                      className="custom-dropdown-item"
                      onClick={() => selectGoogleEvent(null)}
                    >
                      <span className="event-dates">—</span>
                      <span className="event-title">Aucun événement</span>
                    </div>
                    
                    <div className="dropdown-header">
                      <span className="header-dates">Dates</span>
                      <span className="header-title">Titre</span>
                      <span className="header-affaire">Affaire</span>
                    </div>
                    
                    {getFilteredGoogleEvents().map((event) => {
                      const startDate = event.start?.dateTime 
                        ? new Date(event.start.dateTime) 
                        : event.start?.date 
                          ? new Date(event.start.date) 
                          : null;
                      
                      const endDate = event.end?.dateTime 
                        ? new Date(event.end.dateTime) 
                        : event.end?.date 
                          ? new Date(event.end.date) 
                          : null;
                      
                      const dateRange = startDate && endDate
                        ? `${format(startDate, 'dd/MM', { locale: fr })} → ${format(endDate, 'dd/MM', { locale: fr })}`
                        : '';
                      
                      // Nettoyer le titre en retirant le numéro d'affaire
                      let cleanTitle = event.summary || '(Sans titre)';
                      if (event.affaire) {
                        // Retirer toutes les occurrences du pattern "af XXXXX" ou "af XXXXX" (case insensitive)
                        cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
                        // Nettoyer les espaces multiples et les tirets orphelins
                        cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                      }
                      if (!cleanTitle) cleanTitle = '(Sans titre)';
                      
                      const isEventLinked = formData.linkedEventIds.includes(event.id);
                      
                      return (
                        <div 
                          key={event.id}
                          className={`custom-dropdown-item ${isEventLinked ? 'affaire-added' : ''}`}
                          onClick={() => selectGoogleEvent(event)}
                          style={{ backgroundColor: getEventColor(event) + '20' }}
                        >
                          <span className="event-dates">{dateRange}</span>
                          <span className="event-title">
                            {isEventLinked && '✓ '}
                            {cleanTitle}
                          </span>
                          <span className="event-affaire">{event.affaire || '—'}</span>
                        </div>
                      );
                    })}
                    
                    <div className="dropdown-footer">
                      <button 
                        type="button"
                        className="dropdown-close-button"
                        onClick={() => setIsEventDropdownOpen(false)}
                      >
                        Terminé
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {formData.isTournee && formData.linkedEventIds.length > 0 && (
            <div className="linked-events-display" style={{ 
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ 
                fontWeight: '600',
                fontSize: '0.875rem',
                color: '#374151',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>🗓️ Événements liés à cette tournée</span>
                <span style={{ 
                  fontWeight: 'normal',
                  color: '#6b7280',
                  fontSize: '0.8rem'
                }}>({formData.linkedEventIds.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {formData.linkedEventIds
                  .map(eventId => {
                    const event = googleEvents.find(e => e.id === eventId);
                    if (!event) return null;
                    
                    const startDate = event.start?.dateTime 
                      ? new Date(event.start.dateTime) 
                      : event.start?.date 
                        ? new Date(event.start.date) 
                        : null;
                    
                    const endDate = event.end?.dateTime 
                      ? new Date(event.end.dateTime) 
                      : event.end?.date 
                        ? new Date(event.end.date) 
                        : null;
                    
                    const dateRange = startDate && endDate
                      ? `${format(startDate, 'dd/MM/yy', { locale: fr })} → ${format(endDate, 'dd/MM/yy', { locale: fr })}`
                      : startDate
                        ? format(startDate, 'dd/MM/yy', { locale: fr })
                        : '';
                    
                    let cleanTitle = event.summary || '(Sans titre)';
                    if (event.affaire) {
                      cleanTitle = cleanTitle.replace(/\baf\s*\d+\b/gi, '').trim();
                      cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
                    }
                    if (!cleanTitle) cleanTitle = '(Sans titre)';
                    
                    return {
                      eventId,
                      event,
                      startDate,
                      dateRange,
                      cleanTitle
                    };
                  })
                  .filter(item => item !== null)
                  .sort((a, b) => {
                    if (!a.startDate) return 1;
                    if (!b.startDate) return -1;
                    return a.startDate - b.startDate;
                  })
                  .map(({ eventId, event, dateRange, cleanTitle }) => (
                    <div 
                      key={eventId}
                      style={{ 
                        backgroundColor: getEventColor(event) + '20',
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid ' + getEventColor(event) + '40',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.375rem'
                      }}
                    >
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}>
                        <span style={{ 
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          📅 {dateRange}
                        </span>
                        {event.affaire && (
                          <span style={{ 
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#6366f1',
                            backgroundColor: '#eef2ff',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '0.25rem'
                          }}>
                            {event.affaire}
                          </span>
                        )}
                      </div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: '#111827',
                        fontWeight: '500'
                      }}>
                        {cleanTitle}
                      </div>
                      {event.location && (
                        <div style={{ 
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          📍 {event.location}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Date de début *</label>
              <input
                id="date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                aria-required="true"
              />
              {displayDate && (
                <div className="date-display">{displayDate}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="period">Période de début *</label>
              <select
                id="period"
                name="period"
                value={formData.period}
                onChange={handleChange}
                required
                aria-required="true"
              >
                <option value="AM">🌅 AM</option>
                <option value="PM">🌆 PM</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="endDate">Date de fin *</label>
              <input
                id="endDate"
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
                aria-required="true"
                min={formData.date}
              />
            </div>

            <div className="form-group">
              <label htmlFor="endPeriod">Période de fin *</label>
              <select
                id="endPeriod"
                name="endPeriod"
                value={formData.endPeriod}
                onChange={handleChange}
                required
                aria-required="true"
              >
                <option value="AM">🌅 AM</option>
                <option value="PM">🌆 PM</option>
              </select>
            </div>
          </div>

          {selectedVehicle && !isMultiVehicle && (
            <div className="vehicle-preview">
              <div
                className="vehicle-color-preview"
                style={{ backgroundColor: selectedVehicle.color }}
              />
              <span>{selectedVehicle.name}</span>
            </div>
          )}

          {isMultiVehicle && selectedVehicleIds.length > 0 && (
            <div className="multi-vehicle-preview">
              <strong>{selectedVehicleIds.length}</strong> véhicule(s) sélectionné(s)
            </div>
          )}

          <div className="form-divider" />

          <div className="form-group">
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isTournee}
                onChange={(e) => setFormData(prev => ({ ...prev, isTournee: e.target.checked }))}
              />
              <span style={{ fontWeight: '500' }}>🚐 Tournée (réservation longue durée avec plusieurs affaires)</span>
            </label>
            {formData.isTournee && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem', marginBottom: 0 }}>
                Vous pouvez lier plusieurs événements Google Calendar à cette réservation. Chaque numéro d'affaire s'affichera à la position correspondante dans le planning.
              </p>
            )}
          </div>

          <div className="form-divider" />

          <div className="form-group">
            <label htmlFor="clientName">Client / Prestation</label>
            <input
              id="clientName"
              type="text"
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              placeholder="Nom du client ou de la prestation"
              list="clients-autocomplete"
            />
            <datalist id="clients-autocomplete">
              {clientSuggestions.map((suggestion, idx) => (
                <option key={idx} value={suggestion} />
              ))}
              {clients.map((client) => (
                <option key={client.id} value={client.name} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="prestationName">Nom de prestation</label>
            <input
              id="prestationName"
              type="text"
              name="prestationName"
              value={formData.prestationName}
              onChange={handleChange}
              placeholder="Nom de la prestation"
              list="prestations-autocomplete"
            />
            <datalist id="prestations-autocomplete">
              {prestationSuggestions.map((suggestion, idx) => (
                <option key={idx} value={suggestion} />
              ))}
            </datalist>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="driverName">Conducteur</label>
              <input
                id="driverName"
                type="text"
                name="driverName"
                value={formData.driverName}
                onChange={handleChange}
                placeholder="Nom du conducteur"
                list="drivers-autocomplete"
              />
              <datalist id="drivers-autocomplete">
                {driverSuggestions.map((suggestion, idx) => (
                  <option key={idx} value={suggestion} />
                ))}
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.name} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label htmlFor="locationName">Lieu</label>
              <input
                id="locationName"
                type="text"
                name="locationName"
                value={formData.locationName}
                onChange={handleChange}
                placeholder="Lieu de la prestation"
                list="locations-autocomplete"
              />
              <datalist id="locations-autocomplete">
                {locationSuggestions.map((suggestion, idx) => (
                  <option key={idx} value={suggestion} />
                ))}
                {locations.map((location) => (
                  <option key={location.id} value={location.name} />
                ))}
              </datalist>
              {formData.locationName && (() => {
                const location = locations.find(l => l.name === formData.locationName);
                if (location && location.lat && location.lng) {
                  return (
                    <div className="location-map-preview">
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="map-preview-link"
                      >
                        🗺️ Voir sur Google Maps
                      </a>
                      {location.address && (
                        <span className="location-address">📍 {location.address}</span>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="affaire">Numéros d'affaire</label>
            <div className="affaires-manager">
              <div className="affaires-list">
                {formData.affaires.length === 0 && (
                  <div className="no-affaires">Aucune affaire associée</div>
                )}
                {formData.affaires.map((affaire, index) => (
                  <div key={index} className="affaire-tag">
                    <span>{affaire}</span>
                    <button
                      type="button"
                      className="remove-affaire"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          affaires: prev.affaires.filter((_, i) => i !== index)
                        }));
                      }}
                      title="Supprimer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="add-affaire-form">
                <input
                  type="text"
                  value={newAffaire}
                  onChange={(e) => setNewAffaire(e.target.value)}
                  placeholder="Ex: AF32744"
                  list="affaires-suggestions"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newAffaire.trim() && !formData.affaires.includes(newAffaire.trim())) {
                        setFormData(prev => ({
                          ...prev,
                          affaires: [...prev.affaires, newAffaire.trim()]
                        }));
                        setNewAffaire('');
                      }
                    }
                  }}
                />
                <datalist id="affaires-suggestions">
                  {affaireSuggestions.map((suggestion, idx) => (
                    <option key={`history-${idx}`} value={suggestion} />
                  ))}
                  {googleEvents
                    .filter(event => event.affaire && !formData.affaires.includes(event.affaire))
                    .map((event, index) => (
                      <option key={index} value={event.affaire}>
                        {event.summary} - {event.affaire}
                      </option>
                    ))
                  }
                </datalist>
                <button
                  type="button"
                  className="add-affaire-button"
                  onClick={() => {
                    if (newAffaire.trim() && !formData.affaires.includes(newAffaire.trim())) {
                      setFormData(prev => ({
                        ...prev,
                        affaires: [...prev.affaires, newAffaire.trim()]
                      }));
                      setNewAffaire('');
                    }
                  }}
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Notes supplémentaires..."
              rows="3"
            />
          </div>

          <div className="modal-actions">
            {isEdit && (
              <button
                type="button"
                className="delete-button"
                onClick={onDelete}
              >
                <Trash2 size={18} />
                Supprimer
              </button>
            )}
            <button type="button" className="cancel-button" onClick={onClose}>
              Annuler
            </button>
            {!isEdit && (
              <button type="submit" className="submit-button">
                Créer
              </button>
            )}
            {isEdit && hasChanges && (
              <button type="submit" className="submit-button">
                Valider les modifications
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReservationModal;
