import './OverdueInterventionModal.css';

import { Clock, Trash2, Wrench } from 'lucide-react';
import { useState } from 'react';

import { Button, ModalLayout, Textarea } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import { useToast } from '../../hooks/useToast';
import { formatDateSimple } from '../../utils/formatUtils';

const OverdueInterventionModal = ({
  intervention,
  vehicle,
  onClose,
  onPlanIntervention,
  onDeleteSignalement,
  onCloseSignalement,
}) => {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [closureDescription, setClosureDescription] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);

  const { resetDirty, guardClose } = useDirtyForm({ closureDescription }, { confirmer: confirm });
  const handleSafeClose = guardClose(onClose);

  const handleCloseSignalement = () => {
    setShowReasonInput(true);
  };

  const handleSubmitClosure = async () => {
    if (!closureDescription.trim()) {
      toast.warning("Veuillez saisir la description de l'intervention");
      return;
    }

    await onCloseSignalement(intervention, closureDescription.trim());
    resetDirty();
    onClose();
  };

  const handleDelete = () => {
    confirm({
      title: 'Supprimer le signalement',
      message: 'Supprimer ce signalement de panne ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        await onDeleteSignalement(intervention);
        resetDirty();
        onClose();
      },
    });
  };

  return (
    <>
      <ModalLayout
        open
        onClose={handleSafeClose}
        title="Signalement de panne"
        size="md"
        className="overdue-intervention-modal no-drag-resize"
        footer={
          !showReasonInput ? (
            <div className="action-buttons">
              <Button
                variant="ghost"
                className="action-button plan"
                onClick={() => {
                  onPlanIntervention(intervention, vehicle);
                  onClose();
                }}
              >
                <Wrench size={20} /> Planifier une intervention
              </Button>
              <Button
                variant="ghost"
                className="action-button close"
                onClick={handleCloseSignalement}
              >
                <Clock size={20} /> Clôturer le signalement
              </Button>
              <Button variant="ghost" className="action-button delete" onClick={handleDelete}>
                <Trash2 size={20} /> Supprimer
              </Button>
            </div>
          ) : (
            <div className="reason-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowReasonInput(false);
                  setClosureDescription('');
                }}
              >
                Retour
              </Button>
              <Button variant="primary" onClick={handleSubmitClosure}>
                Confirmer la clôture
              </Button>
            </div>
          )
        }
      >
        <div className="intervention-info">
          <h3>
            {vehicle?.name || 'Véhicule inconnu'}
            {vehicle?.kilometrage
              ? ` — ${Number(vehicle.kilometrage).toLocaleString('fr-FR')} km`
              : ''}
          </h3>
          <p className="intervention-description">{intervention.description}</p>
          <p className="intervention-dates">
            Prévu du {formatDateSimple(intervention.startDate)} au{' '}
            {formatDateSimple(intervention.endDate)}
          </p>
        </div>

        {showReasonInput && (
          <div className="reason-input-container">
            <label htmlFor="reason">Description de l'intervention :</label>
            <Textarea
              id="reason"
              value={closureDescription}
              onChange={(e) => setClosureDescription(e.target.value)}
              placeholder="Décrivez l'intervention réalisée..."
              rows={4}
              autoFocus
            />
          </div>
        )}
      </ModalLayout>
      {ConfirmDialogRenderer}
    </>
  );
};

export default OverdueInterventionModal;
