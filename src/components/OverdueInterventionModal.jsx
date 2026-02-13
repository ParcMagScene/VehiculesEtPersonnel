import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Calendar, Clock } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import './OverdueInterventionModal.css';

const OverdueInterventionModal = ({ 
  intervention, 
  vehicle,
  onClose, 
  onMarkCompleted, 
  onMarkNotCompleted,
  onMarkPending,
  onReschedule 
}) => {
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [action, setAction] = useState(null); // 'completed', 'cancelled', 'pending', 'reschedule'
  const [confirmDialog, setConfirmDialog] = useState(null);

  const handleAction = async (actionType) => {
    setAction(actionType);
    if (actionType === 'cancelled' || actionType === 'pending') {
      setShowReasonInput(true);
    } else if (actionType === 'completed') {
      setConfirmDialog({
        message: 'Confirmer que l\'intervention a été réalisée ?',
        onConfirm: async () => {
          setConfirmDialog(null);
          await onMarkCompleted(intervention);
          onClose();
        }
      });
    } else if (actionType === 'reschedule') {
      await onReschedule(intervention);
      onClose();
    }
  };

  const handleSubmitWithReason = async () => {
    if (reason.trim()) {
      if (action === 'cancelled') {
        await onMarkNotCompleted(intervention, reason);
      } else if (action === 'pending') {
        await onMarkPending(intervention, reason);
      }
      onClose();
    } else {
      alert('Veuillez indiquer un motif');
    }
  };

  return (
    <div className="overdue-intervention-modal-overlay" onClick={onClose}>
      <div className="overdue-intervention-modal" onClick={(e) => e.stopPropagation()}>
        <div className="overdue-intervention-modal-header">
          <h2>Intervention en retard</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="overdue-intervention-modal-content">
          <div className="intervention-info">
            <h3>{vehicle?.name || 'Véhicule inconnu'}{vehicle?.kilometrage ? ` — ${Number(vehicle.kilometrage).toLocaleString('fr-FR')} km` : ''}</h3>
            <p className="intervention-description">{intervention.description}</p>
            <p className="intervention-dates">
              Prévu du {new Date(intervention.startDate).toLocaleDateString('fr-FR')} au{' '}
              {new Date(intervention.endDate).toLocaleDateString('fr-FR')}
            </p>
          </div>

          {showReasonInput && (
            <div className="reason-input-container">
              <label htmlFor="reason">
                {action === 'cancelled' ? 'Motif d\'annulation :' : 'Motif de mise en attente :'}
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={action === 'cancelled' ? 'Pourquoi annuler cette intervention ?' : 'Pourquoi mettre en attente ?'}
                rows={4}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer boutons - fixé en bas */}
        {!showReasonInput ? (
          <div className="action-buttons">
            <button 
              className="action-button completed"
              onClick={() => handleAction('completed')}
            >
              <CheckCircle size={20} />
              Effectuée
            </button>

            <button 
              className="action-button pending"
              onClick={() => handleAction('pending')}
            >
              <Clock size={20} />
              Mettre en attente
            </button>

            <button 
              className="action-button not-completed"
              onClick={() => handleAction('cancelled')}
            >
              <XCircle size={20} />
              Annuler l'intervention
            </button>

            <button 
              className="action-button reschedule"
              onClick={() => handleAction('reschedule')}
            >
              <Calendar size={20} />
              Reporter
            </button>
          </div>
        ) : (
          <div className="reason-actions">
            <button 
              className="cancel-button"
              onClick={() => {
                setShowReasonInput(false);
                setReason('');
                setAction(null);
              }}
            >
              Retour
            </button>
            <button 
              className="confirm-button"
              onClick={handleSubmitWithReason}
            >
              Confirmer
            </button>
          </div>
        )}
      </div>
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default OverdueInterventionModal;
