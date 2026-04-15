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
import { useEffect, useRef, useCallback } from 'react';
import './BottomSheet.css';

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  className = '',
}) {
  const panelRef = useRef(null);

  // Fermer avec Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <>
      <div
        className={`ui-bottomsheet-backdrop ${open ? 'ui-bottomsheet-backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`ui-bottomsheet ${open ? 'ui-bottomsheet--open' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Bottom sheet'}
      >
        <div className="ui-bottomsheet-handle" />
        {title && (
          <div className="ui-bottomsheet-header">
            <h3 className="ui-bottomsheet-title">{title}</h3>
          </div>
        )}
        <div className="ui-bottomsheet-body">
          {children}
        </div>
      </div>
    </>
  );
}
