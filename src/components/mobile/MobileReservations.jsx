import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Car, Calendar, Users, MapPin, Plus } from 'lucide-react';
import api from '../../utils/api';
import './MobileReservations.css';

// Fonction pour formater une date en toute sécurité
const safeFormatDate = (dateValue, formatStr = 'dd MMM yyyy') => {
  try {
    if (!dateValue) return 'Date invalide';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Date invalide';
    return format(date, formatStr, { locale: fr });
  } catch (error) {
    console.error('Erreur formatage date:', dateValue, error);
    return 'Date invalide';
  }
};

const MobileReservations = forwardRef(({ vehicles, reservations, clients, drivers, currentUser, onReservationCreated, onBack }, ref) => {
  const [showForm, setShowForm] = useState(false);
  const [openedDirectly, setOpenedDirectly] = useState(false);
  
  // Exposer la méthode openForm au parent
  useImperativeHandle(ref, () => ({
    openForm: () => {
      setShowForm(true);
      setOpenedDirectly(true);
    }
  }));
  const [formData, setFormData] = useState({
    vehicleId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    clientId: '',
    driverId: '',
    locationId: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.vehicleId) {
      setError('Veuillez sélectionner un véhicule');
      return;
    }

    setIsSubmitting(true);

    try {
      if (currentUser?.isAdmin) {
        // Admin : créer la réservation directement
        const newReservation = await api.createReservation({
          ...formData,
          createdBy: currentUser.id
        });
        onReservationCreated(newReservation);
      } else {
        // Non-admin : créer une demande de réservation
        await api.createReservationRequest({
          id: `${Date.now()}.${Math.random()}`,
          vehicleId: formData.vehicleId,
          startDate: formData.startDate,
          startPeriod: 'AM',
          endDate: formData.endDate,
          endPeriod: 'PM',
          clientName: formData.clientId || '',
          driverName: formData.driverId || '',
          locationName: formData.locationId || '',
          notes: formData.notes || ''
        });
        alert('✅ Demande de réservation envoyée !\n\nVotre demande a été transmise aux administrateurs pour validation.');
      }
      setShowForm(false);
      setFormData({
        vehicleId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        clientId: '',
        driverId: '',
        locationId: '',
        notes: ''
      });
    } catch (err) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myReservations = (reservations || [])
    .filter(r => r && r.startDate && r.endDate) // Filtrer les réservations avec dates valides
    .sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
      return dateB - dateA;
    });

  const availableVehicles = vehicles.filter(v => {
    if (!formData.startDate || !formData.endDate) return true;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    
    const hasConflict = reservations.some(r => 
      r.vehicleId === v.id &&
      ((new Date(r.startDate) <= end && new Date(r.endDate) >= start))
    );
    
    return !hasConflict;
  });

  if (showForm) {
    return (
      <div className="mobile-reservations">
        <div className="screen-header">
          <button className="back-button" onClick={() => {
            setShowForm(false);
            // Si ouvert directement via action rapide, retourner à l'accueil
            if (openedDirectly) {
              setOpenedDirectly(false);
              onBack();
            }
          }}>
            <ArrowLeft size={24} />
          </button>
          <h2>{currentUser?.isAdmin ? 'Nouvelle réservation' : 'Nouvelle demande'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="reservation-form">
          <div className="form-group">
            <label>
              <Car size={18} />
              Véhicule
            </label>
            <select
              value={formData.vehicleId}
              onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
              required
            >
              <option value="">Sélectionner un véhicule</option>
              {availableVehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} - {vehicle.registration || vehicle.immatriculation}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <Calendar size={18} />
                Début
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>
                <Calendar size={18} />
                Fin
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              <Users size={18} />
              Client
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            >
              <option value="">Sélectionner un client (optionnel)</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              <Users size={18} />
              Conducteur
            </label>
            <select
              value={formData.driverId}
              onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
            >
              <option value="">Sélectionner un conducteur (optionnel)</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>{driver.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Notes (optionnel)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Informations complémentaires..."
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={() => setShowForm(false)} className="btn-cancel">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-submit">
              {isSubmitting ? 'Envoi...' : (currentUser?.isAdmin ? 'Créer' : 'Demander')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mobile-reservations">
      <div className="screen-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        <h2>Réservations</h2>
        <button className="add-button" onClick={() => setShowForm(true)}>
          <Plus size={24} />
        </button>
      </div>

      <div className="reservations-list">
        {(!myReservations || myReservations.length === 0) ? (
          <div className="empty-state">
            <Car size={48} />
            <p>Aucune réservation</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              {currentUser?.isAdmin ? 'Créer une réservation' : 'Faire une demande'}
            </button>
          </div>
        ) : (
          myReservations.map(reservation => {
            const vehicle = vehicles.find(v => v.id === reservation.vehicleId);
            
            return (
              <div key={reservation.id} className="reservation-card">
                <div className="reservation-header">
                  <div className="vehicle-name">{vehicle?.name || 'Véhicule'}</div>
                  <div className="vehicle-plate">{vehicle?.immatriculation}</div>
                </div>
                
                <div className="reservation-dates">
                  <Calendar size={16} />
                  {safeFormatDate(reservation.startDate)} 
                  {' → '}
                  {safeFormatDate(reservation.endDate)}
                </div>

                <div className="reservation-details">
                  {(reservation.clientName || reservation.prestationName) && (
                    <div className="detail-item">
                      <Users size={16} />
                      <span>{reservation.clientName || reservation.prestationName}</span>
                    </div>
                  )}
                  {reservation.driverName && (
                    <div className="detail-item">
                      <Users size={16} />
                      <span>{reservation.driverName}</span>
                    </div>
                  )}
                </div>

                {reservation.notes && (
                  <div className="reservation-notes">{reservation.notes}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default MobileReservations;
