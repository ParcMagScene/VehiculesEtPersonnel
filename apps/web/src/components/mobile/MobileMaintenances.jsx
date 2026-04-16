import { useState, useImperativeHandle, forwardRef } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Settings, AlertTriangle, Calendar, Plus, MapPin } from 'lucide-react';
import api from '../../utils/api';
import { Button, Select, Textarea, InlineAlert, FormField } from '@/design-system';
import { STATUS } from '../../constants';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from './PullToRefreshIndicator';

import './MobileMaintenances.css';

const MobileMaintenances = forwardRef(
  (
    { vehicles, maintenances, garages, currentUser, onMaintenanceCreated, onBack, onRefresh },
    ref,
  ) => {
    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState(''); // 'scheduled', 'request', 'breakdown'
    const [openedDirectly, setOpenedDirectly] = useState(false);
    const { containerProps: ptrProps, indicatorNode: ptrIndicator } = usePullToRefresh(onRefresh, {
      disabled: !onRefresh,
    });
    // Exposer la méthode openForm au parent
    useImperativeHandle(ref, () => ({
      openForm: () => {
        setFormType(''); // Ne pas définir de type pour afficher le menu de sélection
        setShowForm(true);
        setOpenedDirectly(true);
      },
    }));
    const [formData, setFormData] = useState({
      vehicleId: '',
      type: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      garageId: '',
      description: '',
      status: STATUS.PENDING,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleTypeSelect = (type) => {
      setFormType(type);
      setFormData({
        ...formData,
        type,
        status:
          type === 'breakdown' ? 'reported' : type === STATUS.SCHEDULED ? 'scheduled' : 'pending',
      });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);

      try {
        const newMaintenance = await api.createMaintenance({
          ...formData,
          createdBy: currentUser.id,
        });
        onMaintenanceCreated(newMaintenance);
        setShowForm(false);
        setFormType('');
        setFormData({
          vehicleId: '',
          type: '',
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: '',
          garageId: '',
          description: '',
          status: STATUS.PENDING,
        });
      } catch (err) {
        setError(err.message || 'Erreur lors de la création');
      } finally {
        setIsSubmitting(false);
      }
    };

    const myMaintenances = maintenances
      .filter(
        (m) => new Date(m.endDate || m.startDate) >= new Date() || m.status !== STATUS.COMPLETED,
      )
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    const getStatusBadge = (status) => {
      const badges = {
        pending: { label: 'En attente', class: 'pending' },
        PENDING: { label: 'En attente', class: 'pending' },
        scheduled: { label: 'Programmée', class: 'scheduled' },
        in_progress: { label: 'En cours', class: 'in-progress' },
        IN_PROGRESS: { label: 'En cours', class: 'in-progress' },
        completed: { label: 'Effectuée', class: 'completed' },
        COMPLETED: { label: 'Effectuée', class: 'completed' },
        reported: { label: 'Signalée', class: 'reported' },
        rescheduled: { label: 'Reportée', class: 'rescheduled' },
        cancelled: { label: 'Annulée', class: 'cancelled' },
      };
      return badges[status] || badges.pending;
    };

    if (showForm && !formType) {
      return (
        <div className="mobile-maintenances">
          <div className="screen-header">
            <Button
              variant="ghost"
              className="back-button"
              onClick={() => {
                setShowForm(false);
                // Si ouvert directement via action rapide, retourner à l'accueil
                if (openedDirectly) {
                  setOpenedDirectly(false);
                  onBack();
                }
              }}
              aria-label="Retour"
            >
              <ArrowLeft size={24} />
            </Button>
            <h2>Type d'intervention</h2>
          </div>

          <div className="type-selection">
            <Button
              variant="ghost"
              className="type-card"
              onClick={() => handleTypeSelect('scheduled')}
            >
              <div className="type-icon scheduled">
                <Calendar size={32} />
              </div>
              <div className="type-title">Intervention programmée</div>
              <div className="type-description">Planifier une intervention future</div>
            </Button>

            <Button
              variant="ghost"
              className="type-card"
              onClick={() => handleTypeSelect('request')}
            >
              <div className="type-icon request">
                <Settings size={32} />
              </div>
              <div className="type-title">Demande d'intervention</div>
              <div className="type-description">Soumettre une demande à valider</div>
            </Button>

            <Button
              variant="ghost"
              className="type-card"
              onClick={() => handleTypeSelect('breakdown')}
            >
              <div className="type-icon breakdown">
                <AlertTriangle size={32} />
              </div>
              <div className="type-title">Signaler une panne</div>
              <div className="type-description">Signaler un problème urgent</div>
            </Button>
          </div>
        </div>
      );
    }

    if (showForm && formType) {
      return (
        <div className="mobile-maintenances">
          <div className="screen-header">
            <Button
              variant="ghost"
              className="back-button"
              onClick={() => setFormType('')}
              aria-label="Retour"
            >
              <ArrowLeft size={24} />
            </Button>
            <h2>
              {formType === STATUS.SCHEDULED && 'Programmer'}
              {formType === 'request' && 'Demander'}
              {formType === 'breakdown' && 'Signaler'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="maintenance-form">
            <FormField
              className="form-group"
              label={
                <>
                  <Settings size={18} /> Véhicule
                </>
              }
            >
              <Select
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                required
              >
                <option value="">Sélectionner un véhicule</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} - {vehicle.registration || vehicle.immatriculation}
                  </option>
                ))}
              </Select>
            </FormField>

            {formType === STATUS.SCHEDULED && (
              <>
                <div className="form-row">
                  <FormField
                    className="form-group"
                    label={
                      <>
                        <Calendar size={18} /> Début
                      </>
                    }
                    htmlFor="maint-start-date"
                  >
                    <input
                      id="maint-start-date"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </FormField>

                  <FormField
                    className="form-group"
                    label={
                      <>
                        <Calendar size={18} /> Fin
                      </>
                    }
                    htmlFor="maint-end-date"
                  >
                    <input
                      id="maint-end-date"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      min={formData.startDate}
                    />
                  </FormField>
                </div>

                <FormField
                  className="form-group"
                  label={
                    <>
                      <MapPin size={18} /> Garage
                    </>
                  }
                >
                  <Select
                    value={formData.garageId}
                    onChange={(e) => setFormData({ ...formData, garageId: e.target.value })}
                  >
                    <option value="">Sélectionner un garage (optionnel)</option>
                    {garages.map((garage) => (
                      <option key={garage.id} value={garage.id}>
                        {garage.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </>
            )}

            <FormField className="form-group" label="Description">
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="4"
                placeholder="Décrivez l'intervention ou le problème..."
                required
              />
            </FormField>

            {error && <InlineAlert>{error}</InlineAlert>}

            <div className="form-actions">
              <Button variant="ghost" type="button" onClick={() => setFormType('')}>
                Retour
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Envoi...' : 'Envoyer'}
              </Button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="mobile-maintenances" {...ptrProps}>
        <PullToRefreshIndicator indicator={ptrIndicator} />
        <div className="screen-header">
          <Button variant="ghost" className="back-button" onClick={onBack} aria-label="Retour">
            <ArrowLeft size={24} />
          </Button>
          <h2>Interventions</h2>
          <Button
            variant="ghost"
            className="add-button"
            onClick={() => setShowForm(true)}
            aria-label="Nouvelle intervention"
          >
            <Plus size={24} />
          </Button>
        </div>

        <div className="maintenances-list">
          {myMaintenances.length === 0 ? (
            <div className="empty-state">
              <Settings size={48} />
              <p>Aucune intervention</p>
              <Button variant="primary" onClick={() => setShowForm(true)}>
                Créer une intervention
              </Button>
            </div>
          ) : (
            myMaintenances.map((maintenance) => {
              const vehicle = vehicles.find((v) => v.id === maintenance.vehicleId);
              const garage = garages.find((g) => g.id === maintenance.garageId);
              const statusBadge = getStatusBadge(maintenance.status);

              return (
                <div key={maintenance.id} className="maintenance-card">
                  <div className="maintenance-header">
                    <div className="vehicle-name">{vehicle?.name || 'Véhicule'}</div>
                    <div className={`status-badge ${statusBadge.class}`}>{statusBadge.label}</div>
                  </div>

                  <div className="maintenance-date">
                    <Calendar size={16} />
                    {format(new Date(maintenance.startDate), 'dd MMM yyyy', { locale: fr })}
                    {maintenance.endDate &&
                      ` - ${format(new Date(maintenance.endDate), 'dd MMM yyyy', { locale: fr })}`}
                  </div>

                  {garage && (
                    <div className="maintenance-garage">
                      <MapPin size={16} />
                      <span>{garage.name}</span>
                    </div>
                  )}

                  {maintenance.description && (
                    <div className="maintenance-description">{maintenance.description}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  },
);

export default MobileMaintenances;
