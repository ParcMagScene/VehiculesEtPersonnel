import React from 'react';
import './ConfirmDialog.css';

/**
 * Dialogue de confirmation pour modifications non sauvegardées.
 * Affiche 3 options : Annuler (rester), Ne pas enregistrer, Enregistrer.
 */
const UnsavedChangesDialog = ({ onCancel, onDiscard, onSave }) => {
  return (
    <div className="confirm-dialog-overlay" onClick={onCancel} style={{ zIndex: 11000 }}>
      <div className="confirm-dialog unsaved-changes-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="unsaved-icon">⚠️</div>
        <p className="confirm-dialog-message">
          Vous avez des modifications non enregistrées.{'\n'}Que souhaitez-vous faire ?
        </p>
        <div className="confirm-dialog-actions unsaved-actions">
          <button className="confirm-dialog-btn confirm-no" onClick={onCancel}>
            Continuer l'édition
          </button>
          <button className="confirm-dialog-btn confirm-discard" onClick={onDiscard}>
            Ne pas enregistrer
          </button>
          {onSave && (
            <button className="confirm-dialog-btn confirm-yes" onClick={onSave}>
              Enregistrer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesDialog;
