import './InterventionModal.css';

import { AlertTriangle, CheckCircle, Clock, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button, Dialog, FormField, Input, ModalLayout, Select, Textarea } from '@/design-system';

import { STATUS } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useToast } from '../../hooks/useToast';
import { formatDateSimple } from '../../utils/formatUtils';

const InterventionModal = ({ intervention, vehicle, onClose, onSave, onDelete, currentUser }) => {
  const isAdmin = currentUser?.isAdmin === true;
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [formData, setFormData] = useState({
    date: intervention?.date || '',
    type: intervention?.type || '',
    status: intervention?.status || '',
    description: intervention?.description || '',
    garage: intervention?.garage || '',
    cost: intervention?.cost || '',
    technicalControlType: intervention?.technicalControlType || null,
  });

  const { isDirty } = useDirtyForm(formData);

  const handleSafeClose = () => {
    if (isDirty) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  };

  const dateInputRef = useRef(null);

  const [deadlineWarning, setDeadlineWarning] = useState(null);

  useEffect(() => {
    if (intervention) {
      setFormData({
        date: intervention.date || '',
        type: intervention.type || '',
        status: intervention.status || '',
        description: intervention.description || '',
        garage: intervention.garage || '',
        cost: intervention.cost || '',
        technicalControlType: intervention.technicalControlType || null,
      });
    }
  }, [intervention]);

  // Vérifier la deadline quand la date ou le type change
  useEffect(() => {
    checkDeadline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.date, formData.technicalControlType]);

  const checkDeadline = () => {
    if (!formData.technicalControlType || !formData.date || !vehicle?.controlesTechniques) {
      setDeadlineWarning(null);
      return;
    }

    try {
      const controles =
        typeof vehicle.controlesTechniques === 'string'
          ? JSON.parse(vehicle.controlesTechniques)
          : vehicle.controlesTechniques;

      const controle = controles.find((c) => c.type === formData.technicalControlType);

      if (controle && controle.deadline) {
        const interventionDate = new Date(formData.date);
        const deadlineDate = new Date(controle.deadline);

        if (interventionDate > deadlineDate) {
          const diffTime = interventionDate - deadlineDate;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          setDeadlineWarning({
            type: 'error',
            message: `⚠️ Cette intervention est programmée ${diffDays} jour(s) après la deadline du contrôle technique ${formData.technicalControlType} (${formatDateSimple(controle.deadline)})`,
            controleType: formData.technicalControlType,
          });
        } else {
          setDeadlineWarning(null);
        }
      }
    } catch (error) {
      console.error('Erreur vérification deadline:', error);
    }
  };

  const _getTypeLabel = (type) => {
    const types = {
      maintenance: 'Maintenance',
      repair: 'Réparation',
      inspection: 'Contrôle technique',
      technical_inspection: 'Contrôle technique',
      breakdown: 'Panne',
      revision: 'Révision',
      internal: 'Intervention interne',
      external: 'Intervention externe',
      other: 'Autre',
    };
    return types[type] || type;
  };

  const _getStatusLabel = (status) => {
    const statuses = {
      planned: 'Planifiée',
      scheduled: 'Programmée',
      'in-progress': 'En cours',
      in_progress: 'En cours',
      IN_PROGRESS: 'En cours',
      completed: 'Terminée',
      COMPLETED: 'Terminée',
      cancelled: 'Annulée',
      pending: 'En attente',
      PENDING: 'En attente',
      reported: 'Signalée',
      rescheduled: 'Reportée',
    };
    return statuses[status] || status;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (deadlineWarning && deadlineWarning.type === 'error') {
      confirm({
        message: `⚠️ ATTENTION : Cette intervention dépasse la deadline du contrôle technique.\n\n${deadlineWarning.message}\n\nVoulez-vous continuer quand même ?`,
        onConfirm: () => {
          onSave({
            ...intervention,
            ...formData,
            cost: formData.cost ? parseFloat(formData.cost) : null,
          });
        },
      });
      return;
    }

    onSave({
      ...intervention,
      ...formData,
      cost: formData.cost ? parseFloat(formData.cost) : null,
    });
  };

  const handleDelete = () => {
    confirm({
      message: 'Êtes-vous sûr de vouloir supprimer cette intervention ?',
      onConfirm: () => {
        onDelete(intervention.id);
      },
    });
  };

  const handleMarkCompleted = async () => {
    confirm({
      message: 'Marquer cette intervention comme effectuée ?',
      onConfirm: async () => {
        try {
          await onSave({
            ...intervention,
            ...formData,
            status: STATUS.COMPLETED,
            cost: formData.cost ? parseFloat(formData.cost) : null,
            updatedAt: new Date().toISOString(),
          });
          onClose();
        } catch (error) {
          console.error('❌ Erreur lors de la validation:', error);
          if (!error.message?.includes('Session expirée')) {
            toast.error(`Erreur: ${error.message}`);
          }
        }
      },
    });
  };

  const handleReschedule = () => {
    // Focus sur le champ date pour permettre la modification
    if (dateInputRef.current) {
      dateInputRef.current.focus();
      dateInputRef.current.showPicker?.(); // Ouvre le date picker si disponible
    }
  };

  const interventionTypes = [
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'repair', label: 'Réparation' },
    { value: 'inspection', label: 'Contrôle technique' },
    { value: 'breakdown', label: 'Panne' },
    { value: 'revision', label: 'Révision' },
    { value: 'internal', label: 'Intervention interne' },
    { value: 'external', label: 'Intervention externe' },
    { value: 'other', label: 'Autre' },
  ];

  const statusOptions = [
    { value: 'planned', label: 'Planifiée' },
    { value: 'scheduled', label: 'Programmée' },
    { value: 'in-progress', label: 'En cours' },
    { value: 'completed', label: 'Terminée' },
    { value: 'cancelled', label: 'Annulée' },
    { value: 'pending', label: 'En attente' },
    { value: 'reported', label: 'Signalée' },
  ];

  // Types de contrôle technique disponibles
  const technicalControlTypes = [
    {
      value: 'VL',
      label: 'VL (Véhicule Léger)',
      periodicity: '4 ans après 1ère mise en circulation, puis tous les 2 ans',
    },
    {
      value: 'PL',
      label: 'PL (Poids Lourd)',
      periodicity: 'Tous les ans (1ère visite dans les 6 mois suivant la mise en circulation)',
    },
    { value: 'SEMI', label: 'Semi-remorque', periodicity: 'Tous les ans' },
    { value: 'SCENE', label: 'Scène mobile', periodicity: 'Tous les ans (remorque > 500 kg PTAC)' },
    {
      value: 'POLLUTION',
      label: 'Pollution',
      periodicity: 'Tous les ans (inclus dans le CT pour les VL, séparé pour les PL)',
    },
    {
      value: 'HAYON',
      label: 'Hayon',
      periodicity: 'Tous les 6 mois (Vérification Générale Périodique)',
    },
  ];

  const isTechnicalControl =
    formData.type === 'inspection' || formData.type === 'technical_inspection';

  return (
    <>
      <ModalLayout
        open
        onClose={handleSafeClose}
        title={
          <div>
            Éditer l'intervention
            {vehicle && (
              <span className="modal-header-subtitle">
                {vehicle.name}
                {vehicle.kilometrage
                  ? ` — ${Number(vehicle.kilometrage).toLocaleString('fr-FR')} km`
                  : ''}
              </span>
            )}
          </div>
        }
        size="lg"
        className="intervention-modal"
        footer={
          <>
            {isAdmin && (
              <Button variant="danger" onClick={handleDelete}>
                Supprimer
              </Button>
            )}
            <div className="right-actions">
              <Button variant="secondary" onClick={handleReschedule}>
                <Clock size={18} />
                Reporter
              </Button>
              <Button variant="success" onClick={handleMarkCompleted}>
                <CheckCircle size={18} />
                Effectuée
              </Button>
              <Button variant="primary" type="submit" form="intervention-form">
                <Save size={18} />
                Enregistrer
              </Button>
            </div>
          </>
        }
      >
        <form id="intervention-form" className="intervention-form" onSubmit={handleSubmit}>
          {deadlineWarning && (
            <div className={`deadline-alert ${deadlineWarning.type}`}>
              <AlertTriangle size={20} />
              <span>{deadlineWarning.message}</span>
            </div>
          )}

          <FormField className="form-group" label="Date de l'intervention" required>
            <input
              ref={dateInputRef}
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </FormField>

          <FormField className="form-group" label="Type d'intervention" required>
            <Select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            >
              <option value="">Sélectionner...</option>
              {interventionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </FormField>

          {isTechnicalControl && (
            <FormField className="form-group" label="Type de contrôle technique">
              <Select
                value={formData.technicalControlType || ''}
                onChange={(e) =>
                  setFormData({ ...formData, technicalControlType: e.target.value || null })
                }
              >
                <option value="">Aucun (intervention générale)</option>
                {technicalControlTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
              <small className="form-hint">
                Sélectionnez le type de CT pour vérifier la deadline
              </small>
              {formData.technicalControlType &&
                (() => {
                  const selectedCT = technicalControlTypes.find(
                    (ct) => ct.value === formData.technicalControlType,
                  );
                  return selectedCT?.periodicity ? (
                    <div className="ct-periodicity-info">
                      <span className="ct-periodicity-icon">🔄</span>
                      <span className="ct-periodicity-text">
                        <strong>Périodicité :</strong> {selectedCT.periodicity}
                      </span>
                    </div>
                  ) : null;
                })()}
            </FormField>
          )}

          <FormField className="form-group" label="Statut" required>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
            >
              <option value="">Sélectionner...</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField className="form-group" label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              placeholder="Détails de l'intervention..."
              maxLength={1000}
            />
          </FormField>

          <FormField className="form-group" label="Garage / Prestataire">
            <Input
              type="text"
              value={formData.garage}
              onChange={(e) => setFormData({ ...formData, garage: e.target.value })}
              placeholder="Nom du garage ou prestataire"
              maxLength={200}
            />
          </FormField>

          <FormField className="form-group" label="Coût (€)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              placeholder="0.00"
            />
          </FormField>
        </form>
      </ModalLayout>
      {ConfirmDialogRenderer}
      <Dialog
        open={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={() => {
          setShowUnsavedWarning(false);
          onClose();
        }}
        title="Modifications non enregistrées"
        variant="warning"
        confirmLabel="Ne pas enregistrer"
        cancelLabel="Continuer l'édition"
        confirmVariant="danger"
      >
        Vous avez des modifications non enregistrées. Que souhaitez-vous faire ?
      </Dialog>
    </>
  );
};

export default InterventionModal;
