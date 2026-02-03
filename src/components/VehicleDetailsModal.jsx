import React, { useState } from 'react';
import { X, Wrench, AlertTriangle, Calendar, FileText } from 'lucide-react';
import './VehicleDetailsModal.css';

const VehicleDetailsModal = ({ 
  vehicle, 
  maintenances = [], 
  onClose, 
  onRequestMaintenance,
  onReportBreakdown,
  onScheduleMaintenance
}) => {
  if (!vehicle) return null;

  // Filtrer les maintenances de ce véhicule
  const vehicleMaintenances = maintenances
    .filter(m => m.vehicleId === vehicle.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'planned': { label: 'Planifiée', className: 'status-planned' },
      'scheduled': { label: 'Programmée', className: 'status-planned' },
      'in-progress': { label: 'En cours', className: 'status-in-progress' },
      'in_progress': { label: 'En cours', className: 'status-in-progress' },
      'IN_PROGRESS': { label: 'En cours', className: 'status-in-progress' },
      'completed': { label: 'Terminée', className: 'status-completed' },
      'COMPLETED': { label: 'Terminée', className: 'status-completed' },
      'cancelled': { label: 'Annulée', className: 'status-cancelled' },
      'pending': { label: 'En attente', className: 'status-in-progress' },
      'PENDING': { label: 'En attente', className: 'status-in-progress' },
      'reported': { label: 'Signalée', className: 'status-cancelled' }
    };
    
    const config = statusConfig[status] || { label: status, className: '' };
    return <span className={`status-badge ${config.className}`}>{config.label}</span>;
  };

  const getTypeLabel = (type) => {
    const types = {
      'maintenance': 'Maintenance',
      'repair': 'Réparation',
      'inspection': 'Contrôle technique',
      'technical_inspection': 'Contrôle technique',
      'breakdown': 'Panne',
      'revision': 'Révision',
      'internal': 'Intervention interne',
      'external': 'Intervention externe',
      'other': 'Panne'
    };
    return types[type] || type;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="vehicle-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="modal-header">
          <div className="header-content">
            <div 
              className="vehicle-color-indicator"
              style={{ backgroundColor: vehicle.displayColor || vehicle.color || '#3b82f6' }}
            />
            <div className="header-info">
              <h2>{vehicle.name}</h2>
              {vehicle.type && <span className="vehicle-type-badge">{vehicle.type}</span>}
            </div>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Corps du modal */}
        <div className="modal-body">
          {/* Section Informations */}
          <div className="info-section">
            <h3><FileText size={18} /> Informations du véhicule</h3>
            <div className="info-container">
              {vehicle.photo && (
                <div className="vehicle-photo-container">
                  <img src={`/Photos/${vehicle.photo}`} alt={vehicle.name} />
                </div>
              )}
              <div className="info-grid">
                {(vehicle.immatriculation || vehicle.registration) && (
                  <div className="info-item">
                    <span className="info-label">Immatriculation :</span>
                    <span className="info-value">{vehicle.immatriculation || vehicle.registration}</span>
                  </div>
                )}
                {(vehicle.marque || vehicle.brand) && (
                  <div className="info-item">
                    <span className="info-label">Marque :</span>
                    <span className="info-value">{vehicle.marque || vehicle.brand}</span>
                  </div>
                )}
                {vehicle.model && (
                  <div className="info-item">
                    <span className="info-label">Modèle :</span>
                    <span className="info-value">{vehicle.model}</span>
                  </div>
                )}
                {(vehicle.couleurVehicule || vehicle.color) && (
                  <div className="info-item">
                    <span className="info-label">Couleur :</span>
                    <span className="info-value">{vehicle.couleurVehicule || vehicle.color}</span>
                  </div>
                )}
                {vehicle.owner && (
                  <div className="info-item">
                    <span className="info-label">Propriétaire :</span>
                    <span className="info-value">{vehicle.owner}</span>
                  </div>
                )}
                {vehicle.comment && (
                  <div className="info-item full-width">
                    <span className="info-label">Commentaire :</span>
                    <span className="info-value">{vehicle.comment}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="action-buttons">
            <button 
              className="action-btn schedule-btn"
              onClick={() => {
                onScheduleMaintenance(vehicle);
                onClose();
              }}
            >
              <Calendar size={20} />
              Programmer une intervention
            </button>
            <button 
              className="action-btn maintenance-btn"
              onClick={() => {
                onRequestMaintenance(vehicle);
                onClose();
              }}
            >
              <Wrench size={20} />
              Demander une intervention
            </button>
            <button 
              className="action-btn breakdown-btn"
              onClick={() => {
                onReportBreakdown(vehicle);
                onClose();
              }}
            >
              <AlertTriangle size={20} />
              Signaler une panne
            </button>
          </div>

          {/* Section Historique */}
          <div className="history-section">
            <h3><Calendar size={18} /> Historique des interventions</h3>
            {vehicleMaintenances.length > 0 ? (
              <div className="maintenance-list">
                {vehicleMaintenances.map((maintenance) => (
                  <div key={maintenance.id} className="maintenance-item">
                    <div className="maintenance-header">
                      <div className="maintenance-title">
                        <span className="maintenance-type">{getTypeLabel(maintenance.type)}</span>
                        {getStatusBadge(maintenance.status)}
                      </div>
                      <span className="maintenance-date">{formatDate(maintenance.date)}</span>
                    </div>
                    {maintenance.description && (
                      <div className="maintenance-description">{maintenance.description}</div>
                    )}
                    {maintenance.garage && (
                      <div className="maintenance-garage">
                        📍 {maintenance.garage}
                      </div>
                    )}
                    {maintenance.cost && (
                      <div className="maintenance-cost">
                        💰 {maintenance.cost} €
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-history">
                <p>Aucune intervention enregistrée pour ce véhicule</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleDetailsModal;
