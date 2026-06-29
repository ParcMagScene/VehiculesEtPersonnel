import './VehicleDetailsModal.css';

import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Gauge,
  Loader,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Modal, ModalBody, ModalHeader } from '@/design-system';

import { STATUS_COLORS } from '../../constants/colors';
import api from '../../utils/api';
import { formatDateSimple } from '../../utils/formatUtils';
import { getVehicleAvatar } from '../../utils/vehicleAvatars';
import InterventionModal from '../planning/InterventionModal';
import PvDocumentsSection from '../pv-import/PvDocumentsSection';

const VehicleDetailsModal = ({
  vehicle,
  maintenances = [],
  onClose,
  onRequestMaintenance,
  onReportBreakdown,
  onScheduleMaintenance,
  onOpenMaintenance,
  onUpdateIntervention,
  onDeleteIntervention,
  currentUser,
}) => {
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [mileageHistory, setMileageHistory] = useState([]);
  const [periodicControls, setPeriodicControls] = useState([]);

  // Charger l'historique des relevés kilométriques
  useEffect(() => {
    if (vehicle?.id) {
      api
        .getHistory('vehicle', vehicle.id)
        .then((history) => {
          const kmEntries = (history || [])
            .filter((h) => h.action === 'mileage_update')
            .map((h) => {
              let parsed = {};
              try {
                parsed = typeof h.changes === 'string' ? JSON.parse(h.changes) : h.changes || {};
              } catch {
                /* JSON malformé : fallback {} (ignoré volontairement) */
              }
              return { ...h, parsed };
            });
          setMileageHistory(kmEntries);
        })
        .catch(() => {});
    }
  }, [vehicle?.id]);

  // Charger les contrôles périodiques (nouveau système equipment_controls)
  useEffect(() => {
    if (vehicle?.id && typeof api.getControlsForEntity === 'function') {
      api
        .getControlsForEntity('vehicle', vehicle.id)
        .then((res) => {
          const list = res?.data || res || [];
          setPeriodicControls(Array.isArray(list) ? list : []);
        })
        .catch(() => setPeriodicControls([]));
    }
  }, [vehicle?.id]);

  if (!vehicle) return null;

  // Vérifier les droits d'administration
  const isAdmin = currentUser?.isAdmin === true;

  // Filtrer les maintenances de ce véhicule
  const vehicleMaintenances = maintenances
    .filter((m) => m.vehicleId === vehicle.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Parser les contrôles techniques
  const controlesTechniques = vehicle.controlesTechniques
    ? typeof vehicle.controlesTechniques === 'string'
      ? JSON.parse(vehicle.controlesTechniques)
      : vehicle.controlesTechniques
    : [];

  const getDeadlineStatus = (deadline) => {
    if (!deadline) return null;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: 'expired',
        label: `Expiré depuis ${Math.abs(diffDays)} jour(s)`,
        className: 'deadline-expired',
      };
    } else if (diffDays <= 30) {
      return {
        status: 'warning',
        label: `Dans ${diffDays} jour(s)`,
        className: 'deadline-warning',
      };
    } else {
      return { status: 'ok', label: `Dans ${diffDays} jour(s)`, className: 'deadline-ok' };
    }
  };

  const getControleTypeLabel = (type) => {
    const types = {
      VL: 'Contrôle technique VL',
      PL: 'Contrôle technique PL',
      SEMI: 'Contrôle technique Semi-remorque',
      SCENE: 'Contrôle technique Scène mobile',
      POLLUTION: 'Contrôle pollution',
      HAYON: 'Contrôle hayon (VGP)',
      TACHYGRAPHE: '📡 Tachygraphe',
      LIMITEUR: '🚧 Limiteur de vitesse',
    };
    return types[type] || type;
  };

  const getControleTypePeriodicity = (type) => {
    const periodicities = {
      VL: '4 ans après 1ère mise en circulation, puis tous les 2 ans',
      PL: 'Tous les ans (1ère visite dans les 6 mois suivant la mise en circulation)',
      SEMI: 'Tous les ans',
      SCENE: 'Tous les ans (remorque > 500 kg PTAC)',
      POLLUTION: 'Tous les ans (inclus dans le CT pour les VL, séparé pour les PL)',
      HAYON: 'Tous les 6 mois (Vérification Générale Périodique)',
      TACHYGRAPHE: 'Tous les 2 ans — vérification, étalonnage, scellés (~1h30, ~200 €)',
      LIMITEUR: 'Tous les ans — contrôle en centre agréé (~15 min, ~70 €)',
    };
    return periodicities[type] || null;
  };

  const handleInterventionClick = (intervention) => {
    setSelectedIntervention(intervention);
  };

  const handleSaveIntervention = async (updatedIntervention) => {
    if (onUpdateIntervention) {
      const success = await onUpdateIntervention(updatedIntervention);
      if (success === false) return false;
    }
    setSelectedIntervention(null);
    return true;
  };

  const handleDeleteIntervention = async (interventionId) => {
    if (onDeleteIntervention) {
      const success = await onDeleteIntervention(interventionId);
      if (success === false) return false;
    }
    setSelectedIntervention(null);
    return true;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      planned: { label: 'Planifiée', className: 'status-planned', icon: <Clock size={14} /> },
      scheduled: { label: 'Programmée', className: 'status-planned', icon: <Clock size={14} /> },
      'in-progress': {
        label: 'En cours',
        className: 'status-in-progress',
        icon: <Loader size={14} />,
      },
      in_progress: {
        label: 'En cours',
        className: 'status-in-progress',
        icon: <Loader size={14} />,
      },
      IN_PROGRESS: {
        label: 'En cours',
        className: 'status-in-progress',
        icon: <Loader size={14} />,
      },
      completed: {
        label: 'Terminée',
        className: 'status-completed',
        icon: <CheckCircle size={14} />,
      },
      COMPLETED: {
        label: 'Terminée',
        className: 'status-completed',
        icon: <CheckCircle size={14} />,
      },
      cancelled: { label: 'Annulée', className: 'status-cancelled', icon: <X size={14} /> },
      pending: { label: 'En attente', className: 'status-pending', icon: <FileText size={14} /> },
      PENDING: { label: 'En attente', className: 'status-pending', icon: <FileText size={14} /> },
      reported: {
        label: 'Signalée',
        className: 'status-reported',
        icon: <AlertTriangle size={14} />,
      },
      rescheduled: {
        label: 'Reportée',
        className: 'status-rescheduled',
        icon: <Clock size={14} />,
      },
    };

    const config = statusConfig[status] || { label: status, className: '', icon: null };
    return (
      <span className={`status-badge ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const getTypeLabel = (type) => {
    const types = {
      maintenance: 'Maintenance',
      repair: 'Réparation',
      inspection: 'Contrôle technique',
      technical_inspection: 'Contrôle technique',
      breakdown: 'Panne',
      revision: 'Révision',
      internal: 'Intervention interne',
      external: 'Intervention externe',
      other: 'Panne',
    };
    return types[type] || type;
  };

  return (
    <Modal open onClose={onClose} size="lg" className="vehicle-details-modal">
      <ModalHeader onClose={onClose}>
        <div className="header-content">
          <div
            className="vehicle-color-indicator"
            style={{
              backgroundColor: vehicle.displayColor || vehicle.color || STATUS_COLORS.info,
            }}
          />
          <div className="header-info">
            <span>{vehicle.name}</span>
            <div className="header-badges">
              {vehicle.type && <span className="vehicle-type-badge">{vehicle.type}</span>}
              {(vehicle.immatriculation || vehicle.registration) && (
                <span className="vehicle-registration-badge">
                  {vehicle.immatriculation || vehicle.registration}
                </span>
              )}
            </div>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="modal-body">
        {/* Section Informations */}
        <div className="info-section">
          <h3>
            <FileText size={18} /> Informations du véhicule
          </h3>
          <div className="info-container">
            {vehicle.photo ? (
              <div className="vehicle-photo-container">
                <img src={`/Photos/${vehicle.photo}`} alt={vehicle.name} loading="lazy" />
              </div>
            ) : (
              <div className="vehicle-photo-container">
                <img
                  src={getVehicleAvatar(vehicle.type)}
                  alt={vehicle.name}
                  loading="lazy"
                  className="vehicle-avatar"
                />
              </div>
            )}
            <div className="info-grid">
              {(vehicle.immatriculation || vehicle.registration) && (
                <div className="info-item">
                  <span className="info-label">Immatriculation :</span>
                  <span className="info-value">
                    {vehicle.immatriculation || vehicle.registration}
                  </span>
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
              {(() => {
                const realColor = vehicle.couleurVehicule || vehicle.color;
                return realColor && !realColor.startsWith('#') ? (
                  <div className="info-item">
                    <span className="info-label">Couleur :</span>
                    <span className="info-value">{realColor}</span>
                  </div>
                ) : null;
              })()}
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
              {/* Kilométrage intégré dans la grille */}
              {(() => {
                const lastMaintenanceWithKm = vehicleMaintenances.find(
                  (m) => m.mileage && parseInt(m.mileage) > 0,
                );
                const vehicleKm = vehicle.kilometrage || 0;
                const maintenanceKm = lastMaintenanceWithKm
                  ? parseInt(lastMaintenanceWithKm.mileage)
                  : 0;
                const lastKm = Math.max(vehicleKm, maintenanceKm);
                const lastMileageEntry = mileageHistory.length > 0 ? mileageHistory[0] : null;
                const kmDate = lastMileageEntry?.timestamp || lastMileageEntry?.parsed?.date;
                const kmUser = lastMileageEntry?.userName || lastMileageEntry?.user_name;

                return lastKm > 0 ? (
                  <div className="info-item info-item-km full-width">
                    <span className="info-label">
                      <Gauge size={14} /> Kilométrage
                    </span>
                    <span className="info-value info-value-km">
                      {lastKm.toLocaleString('fr-FR')} km
                    </span>
                    {(kmDate || kmUser) && (
                      <span className="info-km-meta">
                        {kmDate && (
                          <span className="km-meta-item">
                            <Calendar size={12} /> {formatDateSimple(kmDate, 'Non renseigné')}
                          </span>
                        )}
                        {kmUser && (
                          <span className="km-meta-item">
                            <User size={12} /> {kmUser}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="action-buttons">
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                className="action-btn schedule-btn"
                onClick={() => {
                  onScheduleMaintenance(vehicle);
                  onClose();
                }}
              >
                <Calendar size={20} />
                Programmer une intervention
              </Button>
              <Button
                variant="ghost"
                className="action-btn maintenance-btn"
                onClick={() => {
                  onRequestMaintenance(vehicle);
                  onClose();
                }}
              >
                <Wrench size={20} />
                Demander une intervention
              </Button>

              {/* Bouton Kilométrage accessible uniquement aux admins */}
              <Button
                variant="ghost"
                className="action-btn kilometrage-btn"
                onClick={() => {
                  onOpenMaintenance(vehicle);
                }}
              >
                <Gauge size={20} />
                Kilométrage & Contrôles techniques
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            className="action-btn breakdown-btn"
            onClick={() => {
              onReportBreakdown(vehicle);
              onClose();
            }}
          >
            <AlertTriangle size={20} />
            Signaler une panne
          </Button>
          {!isAdmin && (
            <p className="info-message">
              ℹ️ Vous ne pouvez que signaler des pannes. Pour programmer une intervention ou gérer
              le kilométrage/contrôles techniques, contactez un administrateur.
            </p>
          )}
        </div>

        {/* Section Deadlines */}
        <div className="deadlines-section">
          <h3>
            <Calendar size={18} /> Échéances des contrôles techniques
          </h3>
          {controlesTechniques.length > 0 ? (
            <div className="deadlines-list">
              {controlesTechniques.map((controle, index) => {
                const deadlineInfo = getDeadlineStatus(controle.deadline);
                return (
                  <div key={index} className="deadline-item">
                    <div className="deadline-header">
                      <span className="deadline-type">{getControleTypeLabel(controle.type)}</span>
                      {controle.deadline ? (
                        deadlineInfo && (
                          <span className={`deadline-badge ${deadlineInfo.className}`}>
                            {deadlineInfo.label}
                          </span>
                        )
                      ) : (
                        <span className="deadline-badge deadline-pending">À programmer</span>
                      )}
                    </div>
                    <div className="deadline-dates">
                      <div className="deadline-date-item">
                        <span className="deadline-date-label">Dernier contrôle :</span>
                        <span className="deadline-date-value">
                          {formatDateSimple(controle.date, 'Non renseigné')}
                        </span>
                      </div>
                      {controle.deadline && (
                        <div className="deadline-date-item">
                          <span className="deadline-date-label">Échéance :</span>
                          <span className="deadline-date-value">
                            {formatDateSimple(controle.deadline, 'Non renseigné')}
                          </span>
                        </div>
                      )}
                    </div>
                    {getControleTypePeriodicity(controle.type) && (
                      <div className="ct-periodicity-info">
                        <span className="ct-periodicity-icon">🔄</span>
                        <span className="ct-periodicity-text">
                          <strong>Périodicité :</strong> {getControleTypePeriodicity(controle.type)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-deadlines">
              <p>Aucun contrôle technique enregistré</p>
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="add-control-button"
                  onClick={() => onOpenMaintenance(vehicle)}
                >
                  <Calendar size={16} />
                  Ajouter des contrôles techniques
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Section Contrôles périodiques (nouveau système — équipement_controls) */}
        {periodicControls.length > 0 && (
          <div className="deadlines-section">
            <h3>
              <CheckCircle size={18} /> Contrôles périodiques suivis
            </h3>
            <div className="deadlines-list">
              {periodicControls.map((c) => {
                const deadlineInfo = getDeadlineStatus(c.next_due_date);
                const labelType = c.type_name || c.type_code || 'Contrôle';
                const isMigrated =
                  typeof c.notes === 'string' && c.notes.startsWith('[migrated:v1]');
                return (
                  <div key={c.id} className="deadline-item">
                    <div className="deadline-header">
                      <span className="deadline-type">
                        {labelType}
                        {isMigrated && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: '0.75em',
                              color: '#888',
                              fontWeight: 'normal',
                            }}
                            title="Importé depuis l'ancien système"
                          >
                            (importé)
                          </span>
                        )}
                      </span>
                      {deadlineInfo && (
                        <span className={`deadline-badge ${deadlineInfo.className}`}>
                          {deadlineInfo.label}
                        </span>
                      )}
                    </div>
                    <div className="deadline-dates">
                      <div className="deadline-date-item">
                        <span className="deadline-date-label">Dernier contrôle :</span>
                        <span className="deadline-date-value">
                          {formatDateSimple(c.last_done_date, 'Non renseigné')}
                        </span>
                      </div>
                      <div className="deadline-date-item">
                        <span className="deadline-date-label">Prochaine échéance :</span>
                        <span className="deadline-date-value">
                          {formatDateSimple(c.next_due_date, 'Non renseigné')}
                        </span>
                      </div>
                      <div className="deadline-date-item">
                        <span className="deadline-date-label">Statut :</span>
                        <span className="deadline-date-value">{c.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PV de contrôle importés (rapports DEKRA / Apave / Socotec…) */}
        <PvDocumentsSection entityType="vehicle" entityId={vehicle?.id} />

        {/* Section Historique */}
        <div className="history-section">
          <h3>
            <Calendar size={18} /> Historique des interventions
          </h3>
          {vehicleMaintenances.length > 0 ? (
            <div className="maintenance-list">
              {vehicleMaintenances.map((maintenance) => (
                <div
                  key={maintenance.id}
                  className={`maintenance-item status-${maintenance.status} clickable`}
                  onClick={() => handleInterventionClick(maintenance)}
                  title="Cliquer pour ouvrir l'intervention"
                >
                  <div className="maintenance-header">
                    <div className="maintenance-title">
                      <span className="maintenance-type">{getTypeLabel(maintenance.type)}</span>
                      {getStatusBadge(maintenance.status)}
                    </div>
                    <span className="maintenance-date">
                      {formatDateSimple(maintenance.date, 'Non renseigné')}
                    </span>
                  </div>
                  {maintenance.description && (
                    <div className="maintenance-description">{maintenance.description}</div>
                  )}
                  {maintenance.garage && (
                    <div className="maintenance-garage">📍 {maintenance.garage}</div>
                  )}
                  <div className="maintenance-tags">
                    {maintenance.mileage && parseInt(maintenance.mileage) > 0 && (
                      <span className="maintenance-tag tag-km">
                        <Gauge size={12} /> {parseInt(maintenance.mileage).toLocaleString('fr-FR')}{' '}
                        km
                      </span>
                    )}
                    {maintenance.cost && (
                      <span className="maintenance-tag tag-cost">
                        💰 {parseFloat(maintenance.cost).toFixed(2)} €
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-history">
              <p>Aucune intervention enregistrée pour ce véhicule</p>
            </div>
          )}
        </div>
      </ModalBody>

      {selectedIntervention && (
        <InterventionModal
          intervention={selectedIntervention}
          vehicle={vehicle}
          onClose={() => setSelectedIntervention(null)}
          onSave={handleSaveIntervention}
          onDelete={handleDeleteIntervention}
          currentUser={currentUser}
        />
      )}
    </Modal>
  );
};

export default VehicleDetailsModal;
