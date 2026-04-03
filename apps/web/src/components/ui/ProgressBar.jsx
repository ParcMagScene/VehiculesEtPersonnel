/**
 * ProgressBar — Composant atomique Design System
 *
 * Modes :
 *   - Déterminé  : value + max → affiche la progression
 *   - Indéterminé : indeterminate → animation pulsante
 *
 * Tailles : sm (4px) | md (6px, défaut) | lg (8px)
 * Couleurs : primary (défaut) | success | warning | danger
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  indeterminate = false,
  size = 'md',
  color = 'primary',
  label,
  className = '',
  ...props
}) {
  const pct = indeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  const classes = [
    'ui-progress',
    `ui-progress--${size}`,
    `ui-progress--${color}`,
    indeterminate && 'ui-progress--indeterminate',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-valuemin={0} aria-valuemax={100} {...props}>
      <div className="ui-progress__track">
        <div className="ui-progress__fill" style={indeterminate ? undefined : { width: `${pct}%` }} />
      </div>
      {label && <span className="ui-progress__label">{label}</span>}
    </div>
  );
}
