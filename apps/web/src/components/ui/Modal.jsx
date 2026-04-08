import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

/**
 * Modal — Wrapper réutilisable pour tous les modaux de l'application.
 * Gère : portail, overlay, tailles, fermeture Escape / backdrop, focus trap, scroll lock.
 */
function Modal({ open, onClose, size = 'md', className = '', children }) {
  const overlayRef = useRef(null);
  const previousFocus = useRef(null);

  /* ── Lock body scroll + restore focus ── */
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
      previousFocus.current?.focus?.();
    };
  }, [open]);

  /* ── Close on Escape ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === overlayRef.current) onClose?.();
    },
    [onClose],
  );

  if (!open) return null;

  const cls = ['ui-modal', `ui-modal--${size}`, className].filter(Boolean).join(' ');

  return createPortal(
    <div className="ui-modal-overlay" ref={overlayRef} onMouseDown={handleOverlayClick}>
      <div className={cls} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ── Sub-components ── */

function ModalHeader({ icon, children, onClose }) {
  return (
    <div className="ui-modal-header">
      <div className="ui-modal-title">
        {icon && <span className="ui-modal-icon">{icon}</span>}
        <h3>{children}</h3>
      </div>
      {onClose && (
        <button className="ui-modal-close" onClick={onClose} aria-label="Fermer" type="button">
          <X size={18} />
        </button>
      )}
    </div>
  );
}

function ModalBody({ className = '', children }) {
  return <div className={`ui-modal-body ${className}`.trim()}>{children}</div>;
}

function ModalFooter({ align = 'end', className = '', children }) {
  const cls = [`ui-modal-footer`, `ui-modal-footer--${align}`, className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

export { Modal, ModalHeader, ModalBody, ModalFooter };
