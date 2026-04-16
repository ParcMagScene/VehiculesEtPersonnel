import React from 'react';
import './ui.css';

/**
 * Card — Conteneur générique avec fond, bordure, ombre
 *
 * @param {string}  className  Classes additionnelles
 * @param {boolean} flat       Sans ombre
 * @param {boolean} compact    Padding réduit
 * @param {function} onClick   Handler de clic (rend le card cliquable)
 * @param {React.Ref} ref      Forwarded ref
 */
const Card = React.forwardRef(function Card(
  { className = '', flat = false, compact = false, onClick, style, children, ...rest },
  ref,
) {
  const cls = [
    'ui-card',
    flat && 'ui-card--flat',
    compact && 'ui-card--compact',
    onClick && 'ui-card--clickable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={cls}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
