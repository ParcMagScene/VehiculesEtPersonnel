import './Modal.css';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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

  /* ── Close on Escape + Focus trap ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key === 'Tab') {
        const modal = overlayRef.current?.querySelector('[role="dialog"]');
        if (!modal) return;
        const focusable = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handler);
    // Auto-focus first focusable element
    const modal = overlayRef.current?.querySelector('[role="dialog"]');
    const firstFocusable = modal?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
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

function ModalHeader({ icon, children, onClose, className = '', style }) {
  const cls = ['ui-modal-header', className].filter(Boolean).join(' ');
  return (
    <div className={cls} style={style}>
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

export { Modal, ModalBody, ModalFooter, ModalHeader };
