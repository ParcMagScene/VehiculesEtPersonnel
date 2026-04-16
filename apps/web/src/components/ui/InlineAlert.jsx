/**
 * InlineAlert — Composant atomique Design System
 *
 * Affiche un message inline (erreur, warning, succès, info).
 *
 * Props :
 *   - variant     : 'error' | 'warning' | 'success' | 'info' (défaut 'error')
 *   - icon        : ReactNode (auto-inféré depuis variant si omis)
 *   - dismissible : boolean — affiche le bouton ×
 *   - onDismiss   : () => void
 *   - action      : ReactNode (bouton d'action optionnel)
 *   - children    : contenu du message
 *   - className   : string supplémentaire
 */
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

const DEFAULT_ICONS = {
  error: <AlertTriangle size={14} />,
  warning: <AlertTriangle size={14} />,
  success: <CheckCircle size={14} />,
  info: <Info size={14} />,
};

export default function InlineAlert({
  variant = 'error',
  icon,
  dismissible = false,
  onDismiss,
  action,
  children,
  className = '',
  ...props
}) {
  const classes = ['ui-inline-alert', `ui-inline-alert--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="alert" {...props}>
      <span className="ui-inline-alert__icon">{icon || DEFAULT_ICONS[variant]}</span>
      <span className="ui-inline-alert__content">{children}</span>
      {action && <span className="ui-inline-alert__action">{action}</span>}
      {dismissible && onDismiss && (
        <button className="ui-inline-alert__dismiss" onClick={onDismiss} aria-label="Fermer">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
