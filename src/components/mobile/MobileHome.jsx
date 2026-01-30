import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Car, Settings, AlertCircle, Calendar, ChevronRight } from 'lucide-react';
import './MobileHome.css';

function MobileHome({ vehicles, reservations, maintenances, onNavigate, onCreateReservation, onCreateMaintenance }) {
  // Filtrer les véhicules propres (pas de location)
  const ownVehicles = vehicles.filter(v => v.type !== 'location');

  // Statistiques rapides
  const availableVehicles = ownVehicles.filter(v => {
    const hasActiveReservation = reservations.some(r => 
      r.vehicleId === v.id && 
      new Date(r.endDate) >= new Date() && 
      new Date(r.date) <= new Date()
    );
    const hasActiveMaintenance = maintenances.some(m =>
      m.vehicleId === v.id && 
      m.status !== 'completed' &&
      m.startDate &&
      new Date(m.endDate || m.startDate) >= new Date()
    );
    return !hasActiveReservation && !hasActiveMaintenance;
  }).length;

  const myReservations = reservations.filter(r => 
    new Date(r.endDate) >= new Date()
  ).length;

  const pendingMaintenances = maintenances.filter(m => 
    m.status === 'pending'
  ).length;

  const inProgressMaintenances = maintenances.filter(m =>
    m.status === 'in_progress'
  ).length;

  return (
    <div className="mobile-home">
      <h2 className="home-title">Tableau de bord</h2>

      {/* Statistiques */}
      <div className="stats-grid">
        <div className="stat-card available" onClick={() => onNavigate('availability')}>
          <Car size={32} />
          <div className="stat-value">{availableVehicles}</div>
          <div className="stat-label">Véhicules disponibles</div>
          <ChevronRight size={18} className="stat-chevron" />
        </div>

        <div className="stat-card reservations" onClick={() => onNavigate('planning')}>
          <Calendar size={32} />
          <div className="stat-value">{myReservations}</div>
          <div className="stat-label">Réservations actives</div>
          <ChevronRight size={18} className="stat-chevron" />
        </div>

        <div className="stat-card pending">
          <AlertCircle size={32} />
          <div className="stat-value">{pendingMaintenances}</div>
          <div className="stat-label">Demandes en attente</div>
        </div>

        <div className="stat-card in-progress">
          <Settings size={32} />
          <div className="stat-value">{inProgressMaintenances}</div>
          <div className="stat-label">Interventions en cours</div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="quick-actions">
        <h3>Actions rapides</h3>
        
        <button className="action-card" onClick={() => {
          onNavigate('reservations');
          // Signal pour ouvrir directement le formulaire
          setTimeout(() => onCreateReservation?.(), 100);
        }}>
          <div className="action-icon">
            <Car size={24} />
          </div>
          <div className="action-content">
            <div className="action-title">Réserver un véhicule</div>
            <div className="action-description">Créer une nouvelle réservation</div>
          </div>
          <ChevronRight size={20} className="action-chevron" />
        </button>

        <button className="action-card" onClick={() => {
          onNavigate('maintenances');
          // Ouvrir le menu de sélection du type d'intervention
          setTimeout(() => onCreateMaintenance?.(), 100);
        }}>
          <div className="action-icon maintenance">
            <Settings size={24} />
          </div>
          <div className="action-content">
            <div className="action-title">Demander une intervention</div>
            <div className="action-description">Signaler un problème ou programmer</div>
          </div>
          <ChevronRight size={20} className="action-chevron" />
        </button>
      </div>

      {/* Prochaines réservations */}
      {myReservations > 0 && (
        <div className="upcoming-section">
          <h3>Prochaines réservations</h3>
          <div className="upcoming-list">
            {reservations
              .filter(r => new Date(r.endDate) >= new Date())
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
              .slice(0, 3)
              .map(reservation => {
                const vehicle = vehicles.find(v => v.id === reservation.vehicleId);
                return (
                  <div key={reservation.id} className="upcoming-item">
                    <div className="upcoming-icon">
                      <Car size={20} />
                    </div>
                    <div className="upcoming-content">
                      <div className="upcoming-title">{vehicle?.name || 'Véhicule'}</div>
                      <div className="upcoming-date">
                        {format(new Date(reservation.startDate), 'dd MMM', { locale: fr })} - {format(new Date(reservation.endDate), 'dd MMM', { locale: fr })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileHome;
