import { X } from 'lucide-react';

/**
 * Tag — Composant atomique Design System
 *
 * Couleurs : primary | success | danger | warning | info | cyan | amber | neutral
 * Tailles  : sm | md
 * Props    : closeable (affiche un bouton X), onClose
 */
export function Tag({
  color = 'primary',
  size = 'md',
  closeable = false,
  onClose,
  children,
  className = '',
  ...props
}) {
  return (
    <span className={`ui-tag ui-tag--${color} ui-tag--${size} ${className}`} {...props}>
      <span className="ui-tag__text">{children}</span>
      {closeable && (
        <button
          type="button"
          className="ui-tag__close"
          onClick={onClose}
          aria-label="Supprimer"
        >
          <X size={size === 'sm' ? 10 : 12} />
        </button>
      )}
    </span>
  );
}

/**
 * Badge — Composant atomique Design System (compteur)
 *
 * Couleurs : primary | danger | success | warning | neutral
 * Props    : count (nombre), dot (point sans nombre), max (99 par défaut)
 */
export function Badge({
  color = 'danger',
  count,
  dot = false,
  max = 99,
  children,
  className = '',
  ...props
}) {
  if (dot) {
    return (
      <span className={`ui-badge-wrapper ${className}`} {...props}>
        {children}
        <span className={`ui-badge ui-badge--dot ui-badge--${color}`} />
      </span>
    );
  }

  const display = count != null && count > max ? `${max}+` : count;

  return (
    <span className={`ui-badge-wrapper ${className}`} {...props}>
      {children}
      {count != null && count > 0 && (
        <span className={`ui-badge ui-badge--count ui-badge--${color}`}>
          {display}
        </span>
      )}
    </span>
  );
}
