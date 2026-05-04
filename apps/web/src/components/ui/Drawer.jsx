import './Drawer.css';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Drawer — Panneau latéral glissant (slide-panel).
 * Centralise le pattern instancié dans PersonnelSlidePanel, VehicleDetailPanel,
 * AffaireDetailPanel, StockSlidePanel, OrderSlidePanel, etc.
 */
function Drawer({
  open,
  onClose,
  side = 'right',
  width = 420,
  title,
  icon,
  headerActions,
  footer,
  overlay = true,
  className = '',
  children,
}) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const panelRef = useRef(null);

  /* ── Open animation ── */
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      // rAF to let the DOM paint before triggering CSS transition
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 320);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Close on Escape ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* ── Lock body scroll ── */
  useEffect(() => {
    if (!open || !overlay) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, [open, overlay]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose],
  );

  if (!visible) return null;

  const cls = ['ui-drawer', `ui-drawer--${side}`, animating && 'ui-drawer--open', className]
    .filter(Boolean)
    .join(' ');

  const style = { width: typeof width === 'number' ? `${width}px` : width };

  const content = (
    <div
      className={`ui-drawer-backdrop ${animating ? 'ui-drawer-backdrop--visible' : ''}`}
      onMouseDown={overlay ? handleOverlayClick : undefined}
    >
      <aside className={cls} ref={panelRef} style={style}>
        {title && (
          <div className="ui-drawer-header">
            <div className="ui-drawer-title">
              {icon && <span className="ui-drawer-icon">{icon}</span>}
              <h3>{title}</h3>
            </div>
            <div className="ui-drawer-header-actions">
              {headerActions}
              {onClose && (
                <button
                  className="ui-drawer-close"
                  onClick={onClose}
                  aria-label="Fermer"
                  type="button"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="ui-drawer-body">{children}</div>
        {footer && <div className="ui-drawer-footer">{footer}</div>}
      </aside>
    </div>
  );

  return createPortal(content, document.body);
}

export default Drawer;
