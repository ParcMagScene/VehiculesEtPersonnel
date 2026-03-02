import React, { useState, useEffect, useRef } from 'react';
import { X, Save, AlertTriangle, Calendar, CheckCircle, Clock } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import './InterventionModal.css';
import { useToast } from '../hooks/useToast';

const InterventionModal = ({ 
  intervention, 
  vehicle,
  onClose, 
  onSave,
  onDelete,
  currentUser
}) => {
  const isAdmin = currentUser?.isAdmin === true;
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [formData, setFormData] = useState({
    date: intervention?.date || '',
    type: intervention?.type || '',
    status: intervention?.status || '',
    description: intervention?.description || '',
    garage: intervention?.garage || '',
    cost: intervention?.cost || '',
    technicalControlType: intervention?.technicalControlType || null
  });

  const initialFormDataRef = useRef(JSON.stringify({
    date: intervention?.date || '',
    type: intervention?.type || '',
    status: intervention?.status || '',
    description: intervention?.description || '',
    garage: intervention?.garage || '',
    cost: intervention?.cost || '',
    technicalControlType: intervention?.technicalControlType || null
  }));

  const handleSafeClose = () => {
    if (JSON.stringify(formData) !== initialFormDataRef.current) {
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
        technicalControlType: intervention.technicalControlType || null
      });
    }
  }, [intervention]);

  // Vérifier la deadline quand la date ou le type change
  useEffect(() => {
    checkDeadline();
  }, [formData.date, formData.technicalControlType]);

  const checkDeadline = () => {
    if (!formData.technicalControlType || !formData.date || !vehicle?.controlesTechniques) {
      setDeadlineWarning(null);
      return;
    }

    try {
      const controles = typeof vehicle.controlesTechniques === 'string' 
        ? JSON.parse(vehicle.controlesTechniques) 
        : vehicle.controlesTechniques;

      const controle = controles.find(c => c.type === formData.technicalControlType);
      
      if (controle && controle.deadline) {
        const interventionDate = new Date(formData.date);
        const deadlineDate = new Date(controle.deadline);
        
        if (interventionDate > deadlineDate) {
          const diffTime = interventionDate - deadlineDate;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          setDeadlineWarning({
            type: 'error',
            message: `⚠️ Cette intervention est programmée ${diffDays} jour(s) après la deadline du contrôle technique ${formData.technicalControlType} (${new Date(controle.deadline).toLocaleDateString('fr-FR')})`,
            controleType: formData.technicalControlType
          });
        } else {
          setDeadlineWarning(null);
        }
      }
    } catch (error) {
      console.error('Erreur vérification deadline:', error);
    }
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
      'other': 'Autre'
    };
    return types[type] || type;
  };

  const getStatusLabel = (status) => {
    const statuses = {
      'planned': 'Planifiée',
      'scheduled': 'Programmée',
      'in-progress': 'En cours',
      'in_progress': 'En cours',
      'IN_PROGRESS': 'En cours',
      'completed': 'Terminée',
      'COMPLETED': 'Terminée',
      'cancelled': 'Annulée',
      'pending': 'En attente',
      'PENDING': 'En attente',
      'reported': 'Signalée',
      'rescheduled': 'Reportée'
    };
    return statuses[status] || status;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (deadlineWarning && deadlineWarning.type === 'error') {
      setConfirmDialog({
        message: `⚠️ ATTENTION : Cette intervention dépasse la deadline du contrôle technique.\n\n${deadlineWarning.message}\n\nVoulez-vous continuer quand même ?`,
        onConfirm: () => {
          setConfirmDialog(null);
          onSave({
            ...intervention,
            ...formData,
            cost: formData.cost ? parseFloat(formData.cost) : null
          });
        }
      });
      return;
    }
    
    onSave({
      ...intervention,
      ...formData,
      cost: formData.cost ? parseFloat(formData.cost) : null
    });
  };

  const handleDelete = () => {
    setConfirmDialog({
      message: 'Êtes-vous sûr de vouloir supprimer cette intervention ?',
      onConfirm: () => {
        setConfirmDialog(null);
        onDelete(intervention.id);
      }
    });
  };

  const handleMarkCompleted = async () => {
    setConfirmDialog({
      message: 'Marquer cette intervention comme effectuée ?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await onSave({
            ...intervention,
            ...formData,
            status: 'completed',
            cost: formData.cost ? parseFloat(formData.cost) : null,
            updatedAt: new Date().toISOString()
          });
          onClose();
        } catch (error) {
          console.error('❌ Erreur lors de la validation:', error);
          if (!error.message?.includes('Session expirée')) {
            toast.error(`Erreur: ${error.message}`);
          }
        }
      }
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
    { value: 'other', label: 'Autre' }
  ];

  const statusOptions = [
    { value: 'planned', label: 'Planifiée' },
    { value: 'scheduled', label: 'Programmée' },
    { value: 'in-progress', label: 'En cours' },
    { value: 'completed', label: 'Terminée' },
    { value: 'cancelled', label: 'Annulée' },
    { value: 'pending', label: 'En attente' },
    { value: 'reported', label: 'Signalée' }
  ];

  // Types de contrôle technique disponibles
  const technicalControlTypes = [
    { value: 'VL', label: 'VL (Véhicule Léger)', periodicity: '4 ans après 1ère mise en circulation, puis tous les 2 ans' },
    { value: 'PL', label: 'PL (Poids Lourd)', periodicity: 'Tous les ans (1ère visite dans les 6 mois suivant la mise en circulation)' },
    { value: 'SEMI', label: 'Semi-remorque', periodicity: 'Tous les ans' },
    { value: 'SCENE', label: 'Scène mobile', periodicity: 'Tous les ans (remorque > 500 kg PTAC)' },
    { value: 'POLLUTION', label: 'Pollution', periodicity: 'Tous les ans (inclus dans le CT pour les VL, séparé pour les PL)' },
    { value: 'HAYON', label: 'Hayon', periodicity: 'Tous les 6 mois (Vérification Générale Périodique)' }
  ];

  const isTechnicalControl = formData.type === 'inspection' || formData.type === 'technical_inspection';

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && handleSafeClose()}>
      <div className="intervention-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Éditer l'intervention</h2>
            {vehicle && (
              <span className="modal-header-subtitle">
                {vehicle.name}{vehicle.kilometrage ? ` — ${Number(vehicle.kilometrage).toLocaleString('fr-FR')} km` : ''}
              </span>
            )}
          </div>
          <button className="close-button" onClick={handleSafeClose}>
            <X size={24} />
          </button>
        </div>

        <form id="intervention-form" className="intervention-form" onSubmit={handleSubmit}>
          {deadlineWarning && (
            <div className={`deadline-alert ${deadlineWarning.type}`}>
              <AlertTriangle size={20} />
              <span>{deadlineWarning.message}</span>
            </div>
          )}

          <div className="form-group">
            <label>Date de l'intervention *</label>
            <input
              ref={dateInputRef}
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Type d'intervention *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            >
              <option value="">Sélectionner...</option>
              {interventionTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {isTechnicalControl && (
            <div className="form-group">
              <label>Type de contrôle technique</label>
              <select
                value={formData.technicalControlType || ''}
                onChange={(e) => setFormData({ ...formData, technicalControlType: e.target.value || null })}
              >
                <option value="">Aucun (intervention générale)</option>
                {technicalControlTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Sélectionnez le type de CT pour vérifier la deadline
              </small>
              {formData.technicalControlType && (() => {
                const selectedCT = technicalControlTypes.find(ct => ct.value === formData.technicalControlType);
                return selectedCT?.periodicity ? (
                  <div className="ct-periodicity-info">
                    <span className="ct-periodicity-icon">🔄</span>
                    <span className="ct-periodicity-text">
                      <strong>Périodicité :</strong> {selectedCT.periodicity}
                    </span>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <div className="form-group">
            <label>Statut *</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
            >
              <option value="">Sélectionner...</option>
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              placeholder="Détails de l'intervention..."
            />
          </div>

          <div className="form-group">
            <label>Garage / Prestataire</label>
            <input
              type="text"
              value={formData.garage}
              onChange={(e) => setFormData({ ...formData, garage: e.target.value })}
              placeholder="Nom du garage ou prestataire"
            />
          </div>

          <div className="form-group">
            <label>Coût (€)</label>
            <input
              type="number"
              step="0.01"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              placeholder="0.00"
            />
          </div>

        </form>

        <div className="form-actions">
          {isAdmin && (
            <button type="button" className="delete-button" onClick={handleDelete}>
              Supprimer
            </button>
          )}
          <div className="right-actions">
            <button type="button" className="reschedule-button" onClick={handleReschedule}>
              <Clock size={18} />
              Reporter
            </button>
            <button type="button" className="completed-button" onClick={handleMarkCompleted}>
              <CheckCircle size={18} />
              Effectuée
            </button>
            <button type="submit" form="intervention-form" className="save-button">
              <Save size={18} />
              Enregistrer
            </button>
          </div>
        </div>
      </div>
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      {showUnsavedWarning && (
        <UnsavedChangesDialog
          onCancel={() => setShowUnsavedWarning(false)}
          onDiscard={onClose}
        />
      )}
    </div>
  );
};

export default InterventionModal;
