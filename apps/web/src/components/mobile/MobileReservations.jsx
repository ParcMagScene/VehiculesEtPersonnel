import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Car, Calendar, Users, MapPin, Plus, ChevronRight, Check } from 'lucide-react';
import { getVehicleAvatar } from '../../utils/vehicleAvatars';
import api from '../../utils/api';
import { Button, Select, Textarea, InlineAlert, FormField } from '@/design-system';
import './MobileReservations.css';
import { useToast } from '../../hooks/useToast';

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
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [openedDirectly, setOpenedDirectly] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  
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
        toast.success('Demande de réservation envoyée ! Votre demande a été transmise aux administrateurs pour validation.');
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
          <Button variant="ghost" className="back-button" onClick={() => {
            setShowForm(false);
            // Si ouvert directement via action rapide, retourner à l'accueil
            if (openedDirectly) {
              setOpenedDirectly(false);
              onBack();
            }
          }}>
            <ArrowLeft size={24} />
          </Button>
          <h2>{currentUser?.isAdmin ? 'Nouvelle réservation' : 'Nouvelle demande'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="reservation-form">
          <FormField className="form-group" label={<><Car size={18} /> Véhicule</>}>
            {/* Custom vehicle picker with photos */}
            <Button variant="ghost"               type="button"
              className={`vehicle-picker-btn ${formData.vehicleId ? 'selected' : ''}`}
              onClick={() => setShowVehiclePicker(true)}
            >
              {formData.vehicleId ? (() => {
                const v = availableVehicles.find(veh => String(veh.id) === String(formData.vehicleId));
                if (!v) return <span className="vehicle-picker-placeholder">Sélectionner un véhicule</span>;
                return (
                  <>
                    <div className="vehicle-picker-thumb">
                      <img
                        src={v.photo ? `/Photos/${v.photo}` : getVehicleAvatar(v.type)}
                        alt={v.name}
                        onError={(e) => { e.target.src = getVehicleAvatar(v.type); }}
                      />
                    </div>
                    <div className="vehicle-picker-info">
                      <span className="vehicle-picker-name">{v.name}</span>
                      <span className="vehicle-picker-reg">{v.registration || v.immatriculation}</span>
                    </div>
                    <ChevronRight size={18} className="vehicle-picker-chevron" />
                  </>
                );
              })() : (
                <>
                  <span className="vehicle-picker-placeholder">Sélectionner un véhicule</span>
                  <ChevronRight size={18} className="vehicle-picker-chevron" />
                </>
              )}
            </Button>

            {/* Vehicle picker modal */}
            {showVehiclePicker && (
              <div className="vehicle-picker-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowVehiclePicker(false)}>
                <div className="vehicle-picker-modal" onClick={e => e.stopPropagation()}>
                  <div className="vehicle-picker-modal-header">
                    <h3>Choisir un véhicule</h3>
                    <Button variant="ghost" type="button" onClick={() => setShowVehiclePicker(false)}>✕</Button>
                  </div>
                  <div className="vehicle-picker-list">
                    {availableVehicles.map(vehicle => (
                      <Button variant="ghost"                         key={vehicle.id}
                        type="button"
                        className={`vehicle-picker-item ${String(formData.vehicleId) === String(vehicle.id) ? 'active' : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, vehicleId: vehicle.id });
                          setShowVehiclePicker(false);
                        }}
                      >
                        <div className="vehicle-picker-item-photo">
                          <img
                            src={vehicle.photo ? `/Photos/${vehicle.photo}` : getVehicleAvatar(vehicle.type)}
                            alt={vehicle.name}
                            onError={(e) => { e.target.src = getVehicleAvatar(vehicle.type); }}
                          />
                        </div>
                        <div className="vehicle-picker-item-info">
                          <span className="vehicle-picker-item-name">{vehicle.name}</span>
                          <span className="vehicle-picker-item-meta">
                            {vehicle.brand && <span className="vp-brand">{vehicle.brand}</span>}
                            <span className="vp-type">{vehicle.type}</span>
                          </span>
                          <span className="vehicle-picker-item-reg">{vehicle.registration || vehicle.immatriculation}</span>
                        </div>
                        {String(formData.vehicleId) === String(vehicle.id) && (
                          <Check size={20} className="vehicle-picker-check" />
                        )}
                      </Button>
                    ))}
                    {availableVehicles.length === 0 && (
                      <div className="vehicle-picker-empty">
                        <Car size={32} />
                        <p>Aucun véhicule disponible pour ces dates</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </FormField>

          <div className="form-row">
            <FormField className="form-group" label={<><Calendar size={18} /> Début</>}>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </FormField>

            <FormField className="form-group" label={<><Calendar size={18} /> Fin</>}>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate}
                required
              />
            </FormField>
          </div>

          <FormField className="form-group" label={<><Users size={18} /> Client</>}>
            <Select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            >
              <option value="">Sélectionner un client (optionnel)</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField className="form-group" label={<><Users size={18} /> Conducteur</>}>
            <Select
              value={formData.driverId}
              onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
            >
              <option value="">Sélectionner un conducteur (optionnel)</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>{driver.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField className="form-group" label="Notes (optionnel)">
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              placeholder="Informations complémentaires..."
            />
          </FormField>

          {error && <InlineAlert>{error}</InlineAlert>}

          <div className="form-actions">
            <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi...' : (currentUser?.isAdmin ? 'Créer' : 'Demander')}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mobile-reservations">
      <div className="screen-header">
        <Button variant="ghost" className="back-button" onClick={onBack}>
          <ArrowLeft size={24} />
        </Button>
        <h2>Réservations</h2>
        <Button variant="ghost" className="add-button" onClick={() => setShowForm(true)}>
          <Plus size={24} />
        </Button>
      </div>

      <div className="reservations-list">
        {(!myReservations || myReservations.length === 0) ? (
          <div className="empty-state">
            <Car size={48} />
            <p>Aucune réservation</p>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              {currentUser?.isAdmin ? 'Créer une réservation' : 'Faire une demande'}
            </Button>
          </div>
        ) : (
          myReservations.map(reservation => {
            const vehicle = vehicles.find(v => v.id === reservation.vehicleId);
            
            return (
              <div key={reservation.id} className="reservation-card">
                <div className="reservation-header">
                  <div className="reservation-vehicle-thumb">
                    <img
                      src={vehicle?.photo ? `/Photos/${vehicle.photo}` : getVehicleAvatar(vehicle?.type)}
                      alt={vehicle?.name || 'Véhicule'}
                      onError={(e) => { e.target.src = getVehicleAvatar(vehicle?.type); }}
                    />
                  </div>
                  <div className="reservation-vehicle-info">
                    <div className="vehicle-name">{vehicle?.name || 'Véhicule'}</div>
                    <div className="vehicle-plate">{vehicle?.immatriculation}</div>
                  </div>
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
