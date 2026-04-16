import './MobileParcDashboard.css';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Car,
  CheckCircle,
  ChevronRight,
  LayoutGrid,
  Settings,
} from 'lucide-react';

import { Button } from '@/design-system';

import { STATUS } from '../../constants';

function MobileParcDashboard({
  vehicles,
  reservations,
  maintenances,
  onNavigate,
  onBack,
  onCreateReservation,
  onCreateMaintenance,
}) {
  const ownVehicles = vehicles.filter((v) => v.type !== 'location');
  const now = new Date();

  const availableVehicles = ownVehicles.filter((v) => {
    const hasReservation = reservations.some(
      (r) => r.vehicleId === v.id && new Date(r.endDate) >= now && new Date(r.date) <= now,
    );
    const hasMaintenance = maintenances.some(
      (m) =>
        m.vehicleId === v.id &&
        m.status !== STATUS.COMPLETED &&
        m.startDate &&
        new Date(m.endDate || m.startDate) >= now,
    );
    return !hasReservation && !hasMaintenance;
  }).length;

  const activeReservations = reservations.filter((r) => new Date(r.endDate) >= now).length;
  const pendingMaintenances = maintenances.filter((m) => m.status === STATUS.PENDING).length;
  const inProgressMaintenances = maintenances.filter((m) => m.status === 'in_progress').length;

  return (
    <div className="mobile-parc-dashboard">
      <div className="mparc-header">
        <Button variant="ghost" className="mparc-back" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>Parc véhicules</h2>
      </div>

      {/* Statistiques */}
      <div className="mparc-stats">
        <div
          className="mparc-stat green"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('availability')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('availability');
            }
          }}
        >
          <Car size={24} />
          <span className="mparc-stat-val">{availableVehicles}</span>
          <span className="mparc-stat-label">Disponibles</span>
        </div>
        <div
          className="mparc-stat blue"
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('planning')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('planning');
            }
          }}
        >
          <Calendar size={24} />
          <span className="mparc-stat-val">{activeReservations}</span>
          <span className="mparc-stat-label">Réservations</span>
        </div>
        <div className="mparc-stat amber">
          <AlertCircle size={24} />
          <span className="mparc-stat-val">{pendingMaintenances}</span>
          <span className="mparc-stat-label">En attente</span>
        </div>
        <div className="mparc-stat purple">
          <Settings size={24} />
          <span className="mparc-stat-val">{inProgressMaintenances}</span>
          <span className="mparc-stat-label">En cours</span>
        </div>
      </div>

      {/* Navigation rapide */}
      <div className="mparc-nav-section">
        <h3>Accès rapide</h3>

        <Button variant="ghost" className="mparc-nav-card" onClick={() => onNavigate('planning')}>
          <div className="mparc-nav-icon blue">
            <LayoutGrid size={22} />
          </div>
          <div className="mparc-nav-info">
            <span className="mparc-nav-title">Planning</span>
            <span className="mparc-nav-desc">Vue mensuelle du planning</span>
          </div>
          <ChevronRight size={18} className="mparc-nav-chevron" />
        </Button>

        <Button
          variant="ghost"
          className="mparc-nav-card"
          onClick={() => onNavigate('availability')}
        >
          <div className="mparc-nav-icon green">
            <CheckCircle size={22} />
          </div>
          <div className="mparc-nav-info">
            <span className="mparc-nav-title">Disponibilité</span>
            <span className="mparc-nav-desc">Véhicules disponibles par jour</span>
          </div>
          <ChevronRight size={18} className="mparc-nav-chevron" />
        </Button>

        <Button
          variant="ghost"
          className="mparc-nav-card"
          onClick={() => {
            onNavigate('reservations');
            setTimeout(() => onCreateReservation?.(), 100);
          }}
        >
          <div className="mparc-nav-icon indigo">
            <Car size={22} />
          </div>
          <div className="mparc-nav-info">
            <span className="mparc-nav-title">Réservations</span>
            <span className="mparc-nav-desc">Créer ou consulter une réservation</span>
          </div>
          <ChevronRight size={18} className="mparc-nav-chevron" />
        </Button>

        <Button
          variant="ghost"
          className="mparc-nav-card"
          onClick={() => {
            onNavigate('maintenances');
            setTimeout(() => onCreateMaintenance?.(), 100);
          }}
        >
          <div className="mparc-nav-icon amber">
            <Settings size={22} />
          </div>
          <div className="mparc-nav-info">
            <span className="mparc-nav-title">Interventions</span>
            <span className="mparc-nav-desc">Signaler un problème ou programmer</span>
          </div>
          <ChevronRight size={18} className="mparc-nav-chevron" />
        </Button>
      </div>

      {/* Prochaines réservations */}
      {activeReservations > 0 && (
        <div className="mparc-upcoming">
          <h3>Prochaines réservations</h3>
          <div className="mparc-upcoming-list">
            {reservations
              .filter((r) => new Date(r.endDate) >= now)
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
              .slice(0, 5)
              .map((r) => {
                const vehicle = vehicles.find((v) => v.id === r.vehicleId);
                return (
                  <div key={r.id} className="mparc-upcoming-item">
                    <div className="mparc-upcoming-icon">
                      <Car size={18} />
                    </div>
                    <div className="mparc-upcoming-info">
                      <span className="mparc-upcoming-name">{vehicle?.name || 'Véhicule'}</span>
                      <span className="mparc-upcoming-date">
                        {format(new Date(r.startDate), 'dd MMM', { locale: fr })} —{' '}
                        {format(new Date(r.endDate), 'dd MMM', { locale: fr })}
                      </span>
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

export default MobileParcDashboard;
