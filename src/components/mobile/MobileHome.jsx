import React, { useState, useEffect } from 'react';
import { Truck, Users, MessageSquare, ChevronRight, Car, Settings, AlertCircle, Calendar, Package, ShoppingCart } from 'lucide-react';
import api from '../../utils/api';
import './MobileHome.css';

function MobileHome({ vehicles, reservations, maintenances, onNavigate, currentUser }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [personsCount, setPersonsCount] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [unreadData, persons] = await Promise.all([
          api.getUnreadCount().catch(() => ({ unread: 0 })),
          api.getPersons().catch(() => [])
        ]);
        setUnreadCount(unreadData.unread || 0);
        setPersonsCount(persons.filter(p => p.status === 'active').length);
      } catch (e) { /* silencieux */ }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, []);

  // Stats parc
  const ownVehicles = vehicles.filter(v => v.type !== 'location');
  const availableVehicles = ownVehicles.filter(v => {
    const now = new Date();
    const hasReservation = reservations.some(r => 
      r.vehicleId === v.id && new Date(r.endDate) >= now && new Date(r.date) <= now
    );
    const hasMaintenance = maintenances.some(m =>
      m.vehicleId === v.id && m.status !== 'completed' && m.startDate && new Date(m.endDate || m.startDate) >= now
    );
    return !hasReservation && !hasMaintenance;
  }).length;

  const activeReservations = reservations.filter(r => new Date(r.endDate) >= new Date()).length;
  const pendingMaintenances = maintenances.filter(m => m.status === 'pending').length;

  return (
    <div className="mobile-home">
      {/* Salutation */}
      <div className="home-greeting">
        <h2>Bonjour{currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''} 👋</h2>
        <p>Que souhaitez-vous faire ?</p>
      </div>

      {/* 3 Modules principaux */}
      <div className="home-modules">
        <div className="module-card parc" onClick={() => onNavigate('parc-dashboard')}>
          <div className="module-icon">
            <Truck size={32} />
          </div>
          <div className="module-info">
            <h3>Parc</h3>
            <p>Véhicules, réservations et interventions</p>
          </div>
          <div className="module-stats">
            <span className="module-stat-item">
              <Car size={14} /> {availableVehicles} dispo
            </span>
            {activeReservations > 0 && (
              <span className="module-stat-item">
                <Calendar size={14} /> {activeReservations} rés.
              </span>
            )}
            {pendingMaintenances > 0 && (
              <span className="module-stat-item warning">
                <AlertCircle size={14} /> {pendingMaintenances} en attente
              </span>
            )}
          </div>
          <ChevronRight size={20} className="module-chevron" />
        </div>

        <div className="module-card personnel" onClick={() => onNavigate('personnel')}>
          <div className="module-icon">
            <Users size={32} />
          </div>
          <div className="module-info">
            <h3>Personnel</h3>
            <p>Équipe, compétences et coordonnées</p>
          </div>
          <div className="module-stats">
            <span className="module-stat-item">
              <Users size={14} /> {personsCount} actif{personsCount > 1 ? 's' : ''}
            </span>
          </div>
          <ChevronRight size={20} className="module-chevron" />
        </div>

        <div className="module-card messaging" onClick={() => onNavigate('messaging')}>
          <div className="module-icon">
            <MessageSquare size={32} />
            {unreadCount > 0 && (
              <span className="module-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </div>
          <div className="module-info">
            <h3>Messagerie</h3>
            <p>Conversations et messages</p>
          </div>
          {unreadCount > 0 && (
            <div className="module-stats">
              <span className="module-stat-item highlight">
                {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <ChevronRight size={20} className="module-chevron" />
        </div>

        <div className="module-card equipment" onClick={() => onNavigate('equipment')}>
          <div className="module-icon">
            <Package size={32} />
          </div>
          <div className="module-info">
            <h3>Matériel</h3>
            <p>Équipements, affectations et SAV</p>
          </div>
          <ChevronRight size={20} className="module-chevron" />
        </div>

        <div className="module-card orders" onClick={() => onNavigate('orders')}>
          <div className="module-icon">
            <ShoppingCart size={32} />
          </div>
          <div className="module-info">
            <h3>Commandes</h3>
            <p>Bons de commande et devis</p>
          </div>
          <ChevronRight size={20} className="module-chevron" />
        </div>
      </div>
    </div>
  );
}

export default MobileHome;
