/**
 * EmptyState — Composant atomique Design System
 *
 * Affiche un état vide centré avec icône, titre, description et action optionnels.
 *
 * Props :
 *   - icon      : ReactNode (icône Lucide, ex: <Package size={48} />)
 *   - title     : string (message principal, requis)
 *   - description : string | ReactNode (texte secondaire)
 *   - action    : ReactNode (bouton ou lien d'action)
 *   - size      : 'sm' | 'md' | 'lg' — contrôle le padding et la taille de l'icône
 *   - className : string supplémentaire
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
  ...props
}) {
  const classes = ['ui-empty-state', `ui-empty-state--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {icon && <div className="ui-empty-state__icon">{icon}</div>}
      {title && <p className="ui-empty-state__title">{title}</p>}
      {description && <p className="ui-empty-state__description">{description}</p>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  );
}
