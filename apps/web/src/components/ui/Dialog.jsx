import './Dialog.css';

import { AlertTriangle, CheckCircle, HelpCircle, Info } from 'lucide-react';

import Button from './Button';
import { Modal, ModalBody, ModalFooter } from './Modal';

const VARIANT_CONFIG = {
  confirm: { icon: HelpCircle, color: 'var(--theme-primary)' },
  danger: { icon: AlertTriangle, color: 'var(--theme-danger)' },
  info: { icon: Info, color: 'var(--theme-info, var(--theme-primary))' },
  success: { icon: CheckCircle, color: 'var(--theme-success)' },
  warning: { icon: AlertTriangle, color: 'var(--theme-warning)' },
};

/**
 * Dialog — Dialogue de confirmation / alerte.
 * Utilise Modal en interne, en simplifiant l'API.
 *
 * Prop `destructive` (opt-in) : inverse l'ordre des boutons pour les cas
 * où `onConfirm` est destructive (perte de données). Le bouton destructif
 * `confirmLabel` passe à gauche en ghost danger, et `cancelLabel` (safe)
 * devient le primary à droite avec le focus default — un appui Enter
 * réflexe ne déclenche plus l'action destructive.
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
  destructive = false,
}) {
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.confirm;
  const Icon = cfg.icon;
  const btnVariant = confirmVariant || (variant === 'danger' ? 'danger' : 'primary');

  const destructiveBtn = (
    <Button variant={btnVariant} onClick={onConfirm} loading={loading}>
      {confirmLabel}
    </Button>
  );
  const safeBtn = !hideCancel && (
    <Button variant={destructive ? 'primary' : 'secondary'} onClick={onClose} disabled={loading}>
      {cancelLabel}
    </Button>
  );

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
      <ModalFooter align={destructive ? 'between' : 'end'}>
        {destructive ? (
          <>
            {destructiveBtn}
            {safeBtn}
          </>
        ) : (
          <>
            {safeBtn}
            {destructiveBtn}
          </>
        )}
        {extraAction && (
          <Button
            variant={extraAction.variant || 'primary'}
            onClick={extraAction.onClick}
            disabled={loading}
          >
            {extraAction.label}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

export default Dialog;
