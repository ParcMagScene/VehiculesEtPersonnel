import './PageHeader.css';

/**
 * PageHeader — En-tête de page / module avec titre, icône, badge,
 * barre d'actions (boutons, recherche, filtres) et breadcrumb optionnel.
 */
function PageHeader({
  icon,
  title,
  subtitle,
  badge,
  actions,
  breadcrumb,
  className = '',
  children,
}) {
  const cls = ['ui-page-header', className].filter(Boolean).join(' ');

  return (
    <header className={cls}>
      {breadcrumb && (
        <nav className="ui-page-header-breadcrumb" aria-label="Breadcrumb">
          {breadcrumb}
        </nav>
      )}
      <div className="ui-page-header-row">
        <div className="ui-page-header-title-group">
          {icon && <span className="ui-page-header-icon">{icon}</span>}
          <div>
            <h2 className="ui-page-header-title">
              {title}
              {badge != null && <span className="ui-page-header-badge">{badge}</span>}
            </h2>
            {subtitle && <p className="ui-page-header-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="ui-page-header-actions">{actions}</div>}
      </div>
      {children && <div className="ui-page-header-toolbar">{children}</div>}
    </header>
  );
}

export default PageHeader;
