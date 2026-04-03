import React from 'react';
import { AlertTriangle, Info, CheckCircle, HelpCircle } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from './Modal';
import Button from './Button';
import './Dialog.css';

const VARIANT_CONFIG = {
  confirm:  { icon: HelpCircle,    color: 'var(--theme-primary)' },
  danger:   { icon: AlertTriangle,  color: 'var(--theme-danger)' },
  info:     { icon: Info,           color: 'var(--theme-info, var(--theme-primary))' },
  success:  { icon: CheckCircle,    color: 'var(--theme-success)' },
  warning:  { icon: AlertTriangle,  color: 'var(--theme-warning)' },
};

/**
 * Dialog — Dialogue de confirmation / alerte.
 * Utilise Modal en interne, en simplifiant l'API.
 */
function Dialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  variant = 'confirm',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  confirmVariant,
  loading = false,
  hideCancel = false,
  extraAction,
}) {
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.confirm;
  const Icon = cfg.icon;
  const btnVariant = confirmVariant || (variant === 'danger' ? 'danger' : 'primary');

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalBody>
        <div className="ui-dialog-content">
          <div className="ui-dialog-icon" style={{ color: cfg.color }}>
            <Icon size={28} />
          </div>
          <div className="ui-dialog-text">
            {title && <h4 className="ui-dialog-title">{title}</h4>}
            <div className="ui-dialog-message">{children}</div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter align="end">
        {!hideCancel && (
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
        )}
        <Button variant={btnVariant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
        {extraAction && (
          <Button variant={extraAction.variant || 'primary'} onClick={extraAction.onClick} disabled={loading}>
            {extraAction.label}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

export default Dialog;
