import './OverdueInterventionModal.css';

import { Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Button, ModalLayout, Textarea } from '@/design-system';

import { STATUS } from '../../constants';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { formatDateSimple } from '../../utils/formatUtils';

const OverdueInterventionModal = ({
  intervention,
  vehicle,
  onClose,
  onMarkCompleted,
  onMarkNotCompleted,
  onMarkPending,
  onReschedule,
}) => {
  const toast = useToast();
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [action, setAction] = useState(null); // 'completed', 'cancelled', 'pending', 'reschedule'

  const handleAction = async (actionType) => {
    setAction(actionType);
    if (actionType === STATUS.CANCELLED || actionType === STATUS.PENDING) {
      setShowReasonInput(true);
    } else if (actionType === STATUS.COMPLETED) {
      confirm({
        message: "Confirmer que l'intervention a été réalisée ?",
        onConfirm: async () => {
          await onMarkCompleted(intervention);
          onClose();
        },
      });
    } else if (actionType === 'reschedule') {
      await onReschedule(intervention);
      onClose();
    }
  };

  const handleSubmitWithReason = async () => {
    if (reason.trim()) {
      if (action === STATUS.CANCELLED) {
        await onMarkNotCompleted(intervention, reason);
      } else if (action === STATUS.PENDING) {
        await onMarkPending(intervention, reason);
      }
      onClose();
    } else {
      toast.warning('Veuillez indiquer un motif');
    }
  };

  return (
    <>
      <ModalLayout
        open
        onClose={onClose}
        title="Intervention en retard"
        size="md"
        className="overdue-intervention-modal no-drag-resize"
        footer={
          !showReasonInput ? (
            <div className="action-buttons">
              <Button
                variant="ghost"
                className="action-button completed"
                onClick={() => handleAction('completed')}
              >
                <CheckCircle size={20} /> Effectuée
              </Button>
              <Button
                variant="ghost"
                className="action-button pending"
                onClick={() => handleAction('pending')}
              >
                <Clock size={20} /> Mettre en attente
              </Button>
              <Button
                variant="ghost"
                className="action-button not-completed"
                onClick={() => handleAction('cancelled')}
              >
                <XCircle size={20} /> Annuler l'intervention
              </Button>
              <Button
                variant="ghost"
                className="action-button reschedule"
                onClick={() => handleAction('reschedule')}
              >
                <Calendar size={20} /> Reporter
              </Button>
            </div>
          ) : (
            <div className="reason-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowReasonInput(false);
                  setReason('');
                  setAction(null);
                }}
              >
                Retour
              </Button>
              <Button variant="primary" onClick={handleSubmitWithReason}>
                Confirmer
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
            <label htmlFor="reason">
              {action === STATUS.CANCELLED ? "Motif d'annulation :" : 'Motif de mise en attente :'}
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                action === STATUS.CANCELLED
                  ? 'Pourquoi annuler cette intervention ?'
                  : 'Pourquoi mettre en attente ?'
              }
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
