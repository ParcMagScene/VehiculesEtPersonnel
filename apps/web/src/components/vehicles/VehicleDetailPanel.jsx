import './VehicleDetailPanel.css';

import { AlertTriangle, Calendar, ExternalLink, Gauge, User, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Drawer, Tag } from '@/design-system';

import { STATUS_COLORS } from '../../constants/colors';
import api from '../../utils/api';
import { formatDateSimple } from '../../utils/formatUtils';
import { getVehicleAvatar } from '../../utils/vehicleAvatars';
import PvDocumentsSection from '../pv-import/PvDocumentsSection';

/* ═══════════════════════════════════════════════
   Contenu partagé : infos véhicule
   ═══════════════════════════════════════════════ */
const VehicleDetailContent = ({ vehicle, maintenances = [], currentUser, onAction }) => {
  const [mileageHistory, setMileageHistory] = useState([]);
  const [periodicControls, setPeriodicControls] = useState([]);
  const isAdmin = currentUser?.isAdmin === true;

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

  // L3 — Charger les contrôles périodiques du nouveau système (equipment_controls)
  // (le slide panel n'affichait auparavant que le JSON legacy `controles_techniques`,
  // d'où l'invisibilité des contrôles créés via /api/controls).
  useEffect(() => {
    if (vehicle?.id && typeof api.getControlsForEntity === 'function') {
      api
        .getControlsForEntity('vehicle', vehicle.id)
        .then((res) => {
          const list = res?.data || res || [];
          setPeriodicControls(Array.isArray(list) ? list : []);
        })
        .catch(() => setPeriodicControls([]));
    } else {
      setPeriodicControls([]);
    }
  }, [vehicle?.id]);

  const vehicleMaintenances = maintenances
    .filter((m) => m.vehicleId === vehicle.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const controlesTechniques = vehicle.controlesTechniques
    ? typeof vehicle.controlesTechniques === 'string'
      ? JSON.parse(vehicle.controlesTechniques)
      : vehicle.controlesTechniques
    : [];

  const getDeadlineStatus = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0)
      return {
        status: 'expired',
        label: `Expiré depuis ${Math.abs(diffDays)}j`,
        className: 'deadline-expired',
      };
    if (diffDays <= 30)
      return { status: 'warning', label: `Dans ${diffDays}j`, className: 'deadline-warning' };
    return { status: 'ok', label: `Dans ${diffDays}j`, className: 'deadline-ok' };
  };

  const getControleTypeLabel = (type) => {
    const types = {
      VL: 'CT VL',
      PL: 'CT PL',
      SEMI: 'CT Semi',
      SCENE: 'CT Scène',
      POLLUTION: 'Pollution',
      HAYON: 'Hayon (VGP)',
    };
    return types[type] || type;
  };

  const getStatusBadge = (status) => {
    const cfg = {
      planned: { label: 'Planifiée', cls: 'status-planned' },
      scheduled: { label: 'Programmée', cls: 'status-planned' },
      'in-progress': { label: 'En cours', cls: 'status-in-progress' },
      in_progress: { label: 'En cours', cls: 'status-in-progress' },
      IN_PROGRESS: { label: 'En cours', cls: 'status-in-progress' },
      completed: { label: 'Terminée', cls: 'status-completed' },
      COMPLETED: { label: 'Terminée', cls: 'status-completed' },
      cancelled: { label: 'Annulée', cls: 'status-cancelled' },
      pending: { label: 'En attente', cls: 'status-pending' },
      PENDING: { label: 'En attente', cls: 'status-pending' },
      reported: { label: 'Signalée', cls: 'status-reported' },
      rescheduled: { label: 'Reportée', cls: 'status-rescheduled' },
    };
    const c = cfg[status] || { label: status, cls: '' };
    return <span className={`vdp-status-badge ${c.cls}`}>{c.label}</span>;
  };

  const getTypeLabel = (type) => {
    const types = {
      maintenance: 'Maintenance',
      repair: 'Réparation',
      inspection: 'CT',
      technical_inspection: 'CT',
      breakdown: 'Panne',
      revision: 'Révision',
      internal: 'Interne',
      external: 'Externe',
      other: 'Panne',
    };
    return types[type] || type;
  };

  const lastMaintenanceWithKm = vehicleMaintenances.find(
    (m) => m.mileage && parseInt(m.mileage) > 0,
  );
  const vehicleKm = vehicle.kilometrage || 0;
  const maintenanceKm = lastMaintenanceWithKm ? parseInt(lastMaintenanceWithKm.mileage) : 0;
  const lastKm = Math.max(vehicleKm, maintenanceKm);
  const lastMileageEntry = mileageHistory.length > 0 ? mileageHistory[0] : null;

  return (
    <>
      {/* Photo + Infos */}
      <section className="vdp-section">
        <div className="vdp-photo-block">
          {vehicle.photo ? (
            <img
              src={`/Photos/${vehicle.photo}`}
              alt={vehicle.name}
              loading="lazy"
              className="vdp-photo"
            />
          ) : (
            <img
              src={getVehicleAvatar(vehicle.type)}
              alt={vehicle.name}
              loading="lazy"
              className="vdp-photo vdp-avatar"
            />
          )}
        </div>
        <div className="vdp-info-grid">
          {(vehicle.immatriculation || vehicle.registration) && (
            <div className="vdp-info-item">
              <span className="vdp-info-label">Immatriculation</span>
              <span className="vdp-info-value">
                {vehicle.immatriculation || vehicle.registration}
              </span>
            </div>
          )}
          {(vehicle.marque || vehicle.brand) && (
            <div className="vdp-info-item">
              <span className="vdp-info-label">Marque</span>
              <span className="vdp-info-value">{vehicle.marque || vehicle.brand}</span>
            </div>
          )}
          {vehicle.model && (
            <div className="vdp-info-item">
              <span className="vdp-info-label">Modèle</span>
              <span className="vdp-info-value">{vehicle.model}</span>
            </div>
          )}
          {(() => {
            const realColor = vehicle.couleurVehicule || vehicle.color;
            return realColor && !realColor.startsWith('#') ? (
              <div className="vdp-info-item">
                <span className="vdp-info-label">Couleur</span>
                <span className="vdp-info-value">{realColor}</span>
              </div>
            ) : null;
          })()}
          {vehicle.owner && (
            <div className="vdp-info-item">
              <span className="vdp-info-label">Propriétaire</span>
              <span className="vdp-info-value">{vehicle.owner}</span>
            </div>
          )}
          {vehicle.comment && (
            <div className="vdp-info-item vdp-full-width">
              <span className="vdp-info-label">Commentaire</span>
              <span className="vdp-info-value">{vehicle.comment}</span>
            </div>
          )}
        </div>
        {lastKm > 0 && (
          <div className="vdp-km-card">
            <div className="vdp-km-label">
              <Gauge size={13} /> Kilométrage
            </div>
            <div className="vdp-km-value">{lastKm.toLocaleString('fr-FR')} km</div>
            <div className="vdp-km-meta">
              {lastMileageEntry?.timestamp && (
                <span>
                  <Calendar size={11} /> {formatDateSimple(lastMileageEntry.timestamp)}
                </span>
              )}
              {(lastMileageEntry?.userName || lastMileageEntry?.user_name) && (
                <span>
                  <User size={11} /> {lastMileageEntry.userName || lastMileageEntry.user_name}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Boutons d'action rapide */}
      <section className="vdp-section">
        <div className="vdp-actions">
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                className="vdp-action-btn vdp-schedule"
                onClick={() => onAction?.('schedule')}
              >
                <Calendar size={14} /> Programmer
              </Button>
              <Button
                variant="ghost"
                className="vdp-action-btn vdp-request"
                onClick={() => onAction?.('request')}
              >
                <Wrench size={14} /> Demander
              </Button>
              <Button
                variant="ghost"
                className="vdp-action-btn vdp-km-ctrl"
                onClick={() => onAction?.('km')}
              >
                <Gauge size={14} /> KM & CT
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            className="vdp-action-btn vdp-breakdown"
            onClick={() => onAction?.('breakdown')}
          >
            <AlertTriangle size={14} /> Panne
          </Button>
        </div>
      </section>

      {/* Contrôles techniques */}
      {controlesTechniques.length > 0 && (
        <section className="vdp-section">
          <h4 className="vdp-section-title">
            <Calendar size={14} /> Contrôles techniques
          </h4>
          <div className="vdp-ct-list">
            {controlesTechniques.map((ct, i) => {
              const deadline = getDeadlineStatus(ct.deadline);
              return (
                <div key={i} className="vdp-ct-item">
                  <div className="vdp-ct-header">
                    <span className="vdp-ct-type">{getControleTypeLabel(ct.type)}</span>
                    {deadline && (
                      <span className={`vdp-ct-badge ${deadline.className}`}>{deadline.label}</span>
                    )}
                  </div>
                  <div className="vdp-ct-dates">
                    <span>Dernier : {formatDateSimple(ct.date)}</span>
                    {ct.deadline && <span>Échéance : {formatDateSimple(ct.deadline)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* L3 — Contrôles périodiques suivis (nouveau système equipment_controls) */}
      {periodicControls.length > 0 && (
        <section className="vdp-section">
          <h4 className="vdp-section-title">
            <Calendar size={14} /> Contrôles périodiques suivis ({periodicControls.length})
          </h4>
          <div className="vdp-ct-list">
            {periodicControls.map((c) => {
              const deadline = getDeadlineStatus(c.next_due_date);
              const label = c.type_name || c.type_code || 'Contrôle';
              return (
                <div key={c.id} className="vdp-ct-item">
                  <div className="vdp-ct-header">
                    <span className="vdp-ct-type">{label}</span>
                    {deadline && (
                      <span className={`vdp-ct-badge ${deadline.className}`}>{deadline.label}</span>
                    )}
                  </div>
                  <div className="vdp-ct-dates">
                    {c.last_done_date && (
                      <span>Dernier : {formatDateSimple(c.last_done_date)}</span>
                    )}
                    {c.next_due_date && <span>Échéance : {formatDateSimple(c.next_due_date)}</span>}
                    {c.status && <span>Statut : {c.status}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* PV de contrôle importés (rapports DEKRA / Apave / Socotec…) */}
      <PvDocumentsSection entityType="vehicle" entityId={vehicle?.id} />

      {/* Historique des interventions */}
      <section className="vdp-section">
        <h4 className="vdp-section-title">
          <Wrench size={14} /> Interventions ({vehicleMaintenances.length})
        </h4>
        {vehicleMaintenances.length === 0 ? (
          <p className="vdp-empty">Aucune intervention enregistrée</p>
        ) : (
          <div className="vdp-intervention-list">
            {vehicleMaintenances.map((m) => (
              <div key={m.id} className={`vdp-intervention-item status-${m.status}`}>
                <div className="vdp-intervention-header">
                  <span className="vdp-intervention-type">{getTypeLabel(m.type)}</span>
                  {getStatusBadge(m.status)}
                </div>
                <div className="vdp-intervention-date">{formatDateSimple(m.date)}</div>
                {m.description && <div className="vdp-intervention-desc">{m.description}</div>}
                <div className="vdp-intervention-tags">
                  {m.mileage && parseInt(m.mileage) > 0 && (
                    <Tag color="info" size="sm">
                      <Gauge size={11} /> {parseInt(m.mileage).toLocaleString('fr-FR')} km
                    </Tag>
                  )}
                  {m.cost && (
                    <Tag color="amber" size="sm">
                      💰 {parseFloat(m.cost).toFixed(0)} €
                    </Tag>
                  )}
                  {m.garage && (
                    <Tag color="neutral" size="sm">
                      📍 {m.garage}
                    </Tag>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

/* ═══════════════════════════════════════════════
   Volet glissant (slide panel) véhicule
   ═══════════════════════════════════════════════ */
const VehicleSlidePanel = ({
  vehicle,
  maintenances,
  currentUser,
  onClose,
  onOpenDialog,
  onAction,
}) => {
  if (!vehicle) return null;

  const currentVehicle = vehicle;

  return (
    <Drawer
      open={!!vehicle}
      onClose={onClose}
      side="right"
      width={420}
      inline
      overlay={false}
      className="vehicle-slide-panel"
      icon={
        <span
          className="vdp-slide-color"
          style={{
            backgroundColor:
              currentVehicle.displayColor || currentVehicle.color || STATUS_COLORS.info,
          }}
        />
      }
      title={
        <span className="vdp-slide-title-info">
          <span className="vdp-slide-name">{currentVehicle.name}</span>
          <span className="vdp-slide-badges">
            {currentVehicle.type && <span className="vdp-slide-badge">{currentVehicle.type}</span>}
            {(currentVehicle.immatriculation || currentVehicle.registration) && (
              <span className="vdp-slide-badge vdp-slide-reg">
                {currentVehicle.immatriculation || currentVehicle.registration}
              </span>
            )}
          </span>
        </span>
      }
      footer={
        <Button
          variant="ghost"
          className="vdp-slide-open-btn"
          onClick={() => onOpenDialog?.(currentVehicle)}
        >
          <ExternalLink size={14} /> Ouvrir la fiche complète
        </Button>
      }
    >
      <VehicleDetailContent
        vehicle={currentVehicle}
        maintenances={maintenances}
        currentUser={currentUser}
        onAction={onAction}
      />
    </Drawer>
  );
};

/* ═══════════════════════════════════════════════
   Dialog plein écran (fiche complète)
   Conserve le modal existant VehicleDetailsModal
   ═══════════════════════════════════════════════ */

export { VehicleSlidePanel };
export default VehicleSlidePanel;
