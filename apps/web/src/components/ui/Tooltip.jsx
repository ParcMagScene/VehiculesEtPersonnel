import { useState, useRef, useCallback } from 'react';

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
  const timerRef = useRef(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  if (!content) return children;

  return (
    <span
      className={`ui-tooltip-trigger ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      {...props}
    >
      {children}
      {visible && (
        <span className={`ui-tooltip ui-tooltip--${position}`} role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
