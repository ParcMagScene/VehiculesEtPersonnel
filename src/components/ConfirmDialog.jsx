import React from 'react';
import './ConfirmDialog.css';

const ConfirmDialog = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="confirm-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-btn confirm-no" onClick={onCancel}>
            Non
          </button>
          <button className="confirm-dialog-btn confirm-yes" onClick={onConfirm}>
            Oui
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
