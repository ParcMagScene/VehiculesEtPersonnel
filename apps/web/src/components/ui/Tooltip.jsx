import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip — Composant atomique Design System
 *
 * Utilise le système CSS existant `data-emag-tooltip`.
 * Ce composant React gère le positionnement et l'affichage.
 *
 * Props : content (texte), position (top | bottom | left | right), delay (ms)
 */
export default function Tooltip({
  content,
  position = 'top',
  delay = 200,
  children,
  className = '',
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState(null);
  const timerRef = useRef(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const gap = 8;
    const viewportPadding = 8;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;

    if (position === 'bottom') {
      top = triggerRect.bottom + gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    } else if (position === 'left') {
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.left - tooltipRect.width - gap;
    } else if (position === 'right') {
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.right + gap;
    } else {
      top = triggerRect.top - tooltipRect.height - gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    }

    const maxLeft = window.innerWidth - tooltipRect.width - viewportPadding;
    const maxTop = window.innerHeight - tooltipRect.height - viewportPadding;

    setCoords({
      top: Math.max(viewportPadding, Math.min(top, maxTop)),
      left: Math.max(viewportPadding, Math.min(left, maxLeft)),
    });
  }, [position]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!visible) {
      setCoords(null);
      return;
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, updatePosition]);

  if (!content) return children;

  return (
    <span
      ref={triggerRef}
      className={`ui-tooltip-trigger ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      {...props}
    >
      {children}
      {visible &&
        createPortal(
          <span
            ref={tooltipRef}
            className={`ui-tooltip ui-tooltip--${position}`}
            role="tooltip"
            style={coords || { top: -9999, left: -9999 }}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
