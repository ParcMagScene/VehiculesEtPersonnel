import './Modal.css';

import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Contexte interne — partage l'id du titre généré par <Modal> avec
 * <ModalHeader> pour que `aria-labelledby` du dialog pointe vers le <h3>.
 */
const ModalTitleIdContext = createContext(null);

/**
 * Modal — Wrapper réutilisable pour tous les modaux de l'application.
 * Gère : portail, overlay, tailles, fermeture Escape / backdrop, focus trap, scroll lock.
 *
 * Accessibilité :
 * - role="dialog" + aria-modal="true"
 * - aria-labelledby auto-câblé via <ModalHeader> (recommandé)
 * - sinon, passer `ariaLabel` ou `ariaLabelledBy` en prop
 */
function Modal({
  open,
  onClose,
  size = 'md',
  className = '',
  overlayClassName = '',
  disableBackdropBlur = false,
  ariaLabel,
  ariaLabelledBy,
  children,
}) {
  const overlayRef = useRef(null);
  const previousFocus = useRef(null);
  const generatedTitleId = useId();
  const titleId = ariaLabelledBy || generatedTitleId;

  /* ── Lock body scroll + restore focus ── */
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Debug overlay multiples
    setTimeout(() => {
      const overlays = document.querySelectorAll('.ui-modal-overlay');
      if (overlays.length > 1) {
        console.warn('[Modal] Plusieurs overlays détectés:', overlays.length, overlays);
        overlays.forEach((el) => {
          el.setAttribute('data-multi-overlay', 'true');
        });
      }
    }, 100);

    return () => {
      document.body.style.overflow = orig;
      previousFocus.current?.focus?.();
      // Nettoie l'attribut warning
      const overlays = document.querySelectorAll('.ui-modal-overlay[data-multi-overlay]');
      overlays.forEach((el) => el.removeAttribute('data-multi-overlay'));
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
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* ── Auto-focus first element on open (once) ── */
  useEffect(() => {
    if (!open) return;
    const modal = overlayRef.current?.querySelector('[role="dialog"]');
    const firstFocusable = modal?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, [open]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === overlayRef.current) onClose?.();
    },
    [onClose],
  );

  if (!open) return null;

  const cls = ['ui-modal', `ui-modal--${size}`, className].filter(Boolean).join(' ');

  const overlayCls = [
    'ui-modal-overlay',
    disableBackdropBlur && 'ui-modal-overlay--no-blur',
    overlayClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      className={overlayCls}
      ref={overlayRef}
      onMouseDown={handleOverlayClick}
      onClick={handleOverlayClick}
      data-multi-overlay={undefined}
    >
      {/* Warning visuel si plusieurs overlays */}
      {typeof window !== 'undefined' && overlayRef.current && overlayRef.current.getAttribute('data-multi-overlay') === 'true' && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 9999,
          background: '#f43f5e',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: 6,
          fontWeight: 700,
          fontSize: 14,
          boxShadow: '0 2px 8px #0003',
        }}>
          ⚠️ Plusieurs overlays modaux actifs !
        </div>
      )}
      <div
        className={cls}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || undefined}
        aria-labelledby={!ariaLabel ? titleId : undefined}
      >
        <ModalTitleIdContext.Provider value={titleId}>{children}</ModalTitleIdContext.Provider>
      </div>
    </div>,
    document.body,
  );
}

/* ── Sub-components ── */

function ModalHeader({ icon, children, onClose, className = '', style, rightContent = null }) {
  const cls = ['ui-modal-header', className].filter(Boolean).join(' ');
  const titleId = useContext(ModalTitleIdContext);
  return (
    <div className={cls} style={style}>
      <div className="ui-modal-title">
        {icon && <span className="ui-modal-icon">{icon}</span>}
        <h3 id={titleId || undefined}>{children}</h3>
      </div>
      <div className="ui-modal-header-actions">
        {rightContent}
        {onClose && (
          <button className="ui-modal-close" onClick={onClose} aria-label="Fermer" type="button">
            <X size={18} />
          </button>
        )}
      </div>
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
