import './Drawer.css';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getModalRoot, pop, push, zIndexFor } from '../../utils/modalManager';

/**
 * Drawer — Panneau latéral glissant (slide-panel).
 * Centralise le pattern instancié dans PersonnelSlidePanel, VehicleDetailPanel,
 * AffaireDetailPanel, StockSlidePanel, OrderSlidePanel, etc.
 *
 * Modes :
 *  - Modal (défaut) : portail #emag-modal-root, position: fixed plein écran,
 *    backdrop, intégré au ModalManager (z-index dynamique, scroll-lock).
 *  - Docked (`inline=true`) : rendu en place dans le parent flex (à côté de
 *    la liste/tableau), prend la hauteur du conteneur, pas de backdrop,
 *    n'occulte pas les toolbars/banners/header de l'app. Le conteneur parent
 *    doit être `display: flex` et la liste adjacente `flex: 1; min-width: 0`
 *    pour que sa largeur s'adapte à l'ouverture du volet.
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
  inline = false,
  closeOnBackdrop = false,
  className = '',
  children,
}) {
  // En mode docked, on désactive systématiquement l'overlay et le portail :
  // le volet vit dans le flux flex du parent.
  const useOverlay = overlay && !inline;
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [stackToken, setStackToken] = useState(null);
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

  /* ── Inscription ModalManager (pile + scroll-lock unifiés) ──
   * Quand `useOverlay=false` (mode docked ou non-bloquant) : on ne pousse pas
   * sur la pile (pas de scroll-lock global, pas de backdrop). */
  useEffect(() => {
    if (!open || !useOverlay) return undefined;
    const token = push();
    setStackToken(token);
    return () => {
      pop(token);
      setStackToken(null);
    };
  }, [open, useOverlay]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (!closeOnBackdrop) return;
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose, closeOnBackdrop],
  );

  if (!visible) return null;

  const cls = [
    'ui-drawer',
    `ui-drawer--${side}`,
    animating && 'ui-drawer--open',
    inline && 'ui-drawer--inline',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = { width: typeof width === 'number' ? `${width}px` : width };

  // Z-index pilotés par le ModalManager (overlay 9000+i*10, dialog 10000+i*10).
  // Mode docked ou overlay=false → fallback aux valeurs CSS d'origine.
  const z = stackToken ? zIndexFor(stackToken) : null;

  const panel = (
    <aside className={cls} ref={panelRef} style={z ? { ...style, zIndex: z.dialog } : style}>
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
  );

  // Mode docked : rendu en place, pas de portail, pas de backdrop. Le parent
  // doit être un flex container ; le panel devient un flex item à droite.
  if (inline) {
    return panel;
  }

  const content = (
    <div
      className={`ui-drawer-backdrop ${animating ? 'ui-drawer-backdrop--visible' : ''}`}
      onMouseDown={useOverlay ? handleOverlayClick : undefined}
      style={z ? { zIndex: z.overlay } : undefined}
    >
      {panel}
    </div>
  );

  // Portail unique #emag-modal-root via ModalManager (cf. modalManager.js).
  const portalTarget = getModalRoot();
  if (!portalTarget) return null;
  return createPortal(content, portalTarget);
}

export default Drawer;
