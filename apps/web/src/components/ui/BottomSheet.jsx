/**
 * BottomSheet — Composant Design System (Organism)
 *
 * Panneau qui glisse du bas de l'écran, pensé pour mobile.
 * Inclut un handle de drag visuel et un backdrop cliquable.
 *
 * Props :
 *   open      — boolean, contrôle l'ouverture
 *   onClose   — callback appelé pour fermer
 *   title     — titre optionnel affiché dans le header
 *   children  — contenu du bottom sheet
 *   className — classes additionnelles sur le panel
 */
import './BottomSheet.css';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getModalRoot, pop, push, zIndexFor } from '../../utils/modalManager';

/**
 * BottomSheet — Panneau mobile glissant depuis le bas.
 *
 * Intégré au ModalManager (#emag-modal-root, pile + scroll-lock centralisés,
 * z-index dynamique) afin de partager le même socle que <Modal> et <Drawer>.
 * Migration audit modals/overlays 2026-05-19 : supprime le scroll-lock manuel
 * et les z-index CSS qui pouvaient inverser backdrop/panel.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  children,
  className = '',
}) {
  const panelRef = useRef(null);
  const [stackToken, setStackToken] = useState(null);
  const previousFocusRef = useRef(null);
  const generatedTitleId = useId();
  const titleId = ariaLabelledBy || generatedTitleId;

  // Fermer avec Escape
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="menuitem"], [contenteditable]:not([contenteditable="false"])';

    const focusFirst = () => {
      const focusable = panelRef.current?.querySelectorAll(focusableSelector);
      if (focusable?.length) {
        focusable[0].focus();
        return;
      }
      panelRef.current?.focus();
    };

    const timer = requestAnimationFrame(() => requestAnimationFrame(focusFirst));

    const handleTrap = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll(focusableSelector);
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        return;
      }
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTrap);
    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener('keydown', handleTrap);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  // Inscription dans le ModalManager : pile partagée avec <Modal>/<Drawer>,
  // scroll-lock unique libéré seulement quand toutes les couches sont fermées.
  useEffect(() => {
    if (!open) return undefined;
    const token = push();
    setStackToken(token);
    return () => {
      pop(token);
      setStackToken(null);
    };
  }, [open]);

  if (!open) return null;

  // Z-index pilotés par le ModalManager (overlay 9000+i*10, dialog 10000+i*10).
  const z = stackToken ? zIndexFor(stackToken) : { overlay: 9000, dialog: 10000 };

  const portalTarget = getModalRoot();
  if (!portalTarget) return null;

  return createPortal(
    <>
      <div
        className={`ui-bottomsheet-backdrop ${open ? 'ui-bottomsheet-backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
        style={{ zIndex: z.overlay }}
      />
      <div
        ref={panelRef}
        className={`ui-bottomsheet ${open ? 'ui-bottomsheet--open' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (!title ? 'Bottom sheet' : undefined)}
        aria-labelledby={!ariaLabel && title ? titleId : undefined}
        aria-describedby={ariaDescribedBy || undefined}
        tabIndex={-1}
        style={{ zIndex: z.dialog }}
      >
        <div className="ui-bottomsheet-handle" />
        {title && (
          <div className="ui-bottomsheet-header">
            <h3 className="ui-bottomsheet-title" id={titleId}>
              {title}
            </h3>
          </div>
        )}
        <div className="ui-bottomsheet-body">{children}</div>
      </div>
    </>,
    portalTarget,
  );
}
