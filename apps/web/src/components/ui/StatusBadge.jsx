import './StatusBadge.css';

/**
 * StatusBadge — Colored badge for dynamic status display.
 * Accepts an arbitrary hex color and auto-generates background (12% opacity), text color, and border.
 *
 * @param {string} color - Hex color string (e.g. '#4caf50')
 * @param {'sm'|'md'} [size='md'] - Badge size
 * @param {React.ReactNode} [icon] - Optional icon before label
 * @param {string} [className] - Additional CSS classes
 * @param {React.ReactNode} children - Badge label
 */
export default function StatusBadge({ color, size = 'md', icon, className, children, ...rest }) {
  const style = color ? {
    backgroundColor: color + '20',
    color: color,
    borderColor: color,
  } : undefined;

  return (
    <span
      className={`ui-status-badge${size === 'sm' ? ' ui-status-badge--sm' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      {...rest}
    >
      {icon && <span className="ui-status-badge__icon">{icon}</span>}
      {children}
    </span>
  );
}
