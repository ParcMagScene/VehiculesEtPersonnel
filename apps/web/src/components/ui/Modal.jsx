import './Modal.css';

import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getModalRoot, pop, push, zIndexFor } from '../../utils/modalManager';

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
  isOpen, // alias rétro-compatible (cf. audit 2026-05-18). Préférer `open`.
  onClose,
  size = 'md',
  className = '',
  overlayClassName = '',
  disableBackdropBlur = false,
  closeOnBackdrop = false,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  children,
}) {
  // Filet de sécurité : si un caller passe `isOpen` au lieu de `open` (bug
  // historique "modal transparent"), on accepte les deux. En développement,
  // on émet un avertissement pour guider la migration vers `open`.
  if (open === undefined && isOpen !== undefined) {
    open = isOpen;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[Modal] La prop `isOpen` est dépréciée, utilisez `open`. ' +
          'Voir docs/04-Operations/AUDIT-UPDATES-MODALS-2026-05-18.md',
      );
    }
  }

  const overlayRef = useRef(null);
  const previousFocus = useRef(null);
  const generatedTitleId = useId();
  const titleId = ariaLabelledBy || generatedTitleId;

  // Token attribué par le ModalManager (un par instance ouverte). null tant
  // que le modal n'est pas encore monté/ouvert. Stocké dans un state local
  // pour forcer un re-render et obtenir le z-index calculé après push.
  const [stackToken, setStackToken] = useState(null);

  /* ── Inscription dans le ModalManager (pile, scroll lock, z-index) ── */
  useEffect(() => {
    if (!open) return undefined;
    const token = push();
    setStackToken(token);
    return () => {
      pop(token);
      setStackToken(null);
    };
  }, [open]);

  /* ── Restore focus à la fermeture ── */
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    return () => {
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
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="menuitem"], [contenteditable]:not([contenteditable="false"])',
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
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="menuitem"], [contenteditable]:not([contenteditable="false"])',
    );
    firstFocusable?.focus();
  }, [open]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (!closeOnBackdrop) return;
      if (e.target === overlayRef.current) onClose?.();
    },
    [onClose, closeOnBackdrop],
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

  // Z-index pilotés par le ModalManager : backdrop 9000+i*10, dialog 10000+i*10.
  // Inline = priorité absolue sur la CSS (plus de conflits possibles).
  const z = stackToken ? zIndexFor(stackToken) : { overlay: 9000, dialog: 10000 };

  // Portail unique #emag-modal-root (créé à la volée si absent par getModalRoot).
  const portalTarget = getModalRoot();
  if (!portalTarget) return null;

  return createPortal(
    <div
      className={overlayCls}
      ref={overlayRef}
      onMouseDown={handleOverlayClick}
      onClick={handleOverlayClick}
      style={{ zIndex: z.overlay }}
    >
      <div
        className={cls}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || undefined}
        aria-labelledby={!ariaLabel ? titleId : undefined}
        aria-describedby={ariaDescribedBy || undefined}
        style={{ zIndex: z.dialog, position: 'relative' }}
      >
        <ModalTitleIdContext.Provider value={titleId}>{children}</ModalTitleIdContext.Provider>
      </div>
    </div>,
    portalTarget,
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
