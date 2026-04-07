import './Page.css';

/**
 * Page — Wrapper obligatoire pour toute page / module.
 * Fournit le padding, la largeur max, et la structure standard.
 *
 * Usage :
 *   <Page title="Véhicules" icon={<Car />} badge={count} actions={<Button>Ajouter</Button>}>
 *     <Page.Section title="Parc actif">
 *       ...contenu...
 *     </Page.Section>
 *   </Page>
 */
function Page({ title, icon, subtitle, badge, actions, breadcrumb, className = '', children }) {
  const cls = ['ui-page', className].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {title && (
        <header className="ui-page-header-bar">
          {breadcrumb && <nav className="ui-page-breadcrumb" aria-label="Fil d'Ariane">{breadcrumb}</nav>}
          <div className="ui-page-header-row">
            <div className="ui-page-title-group">
              {icon && <span className="ui-page-icon">{icon}</span>}
              <div>
                <h1 className="ui-page-title">
                  {title}
                  {badge != null && <span className="ui-page-badge">{badge}</span>}
                </h1>
                {subtitle && <p className="ui-page-subtitle">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="ui-page-actions">{actions}</div>}
          </div>
        </header>
      )}
      <div className="ui-page-content">
        {children}
      </div>
    </div>
  );
}

/**
 * Page.Section — Sous-section avec titre optionnel.
 */
function PageSection({ title, icon, actions, className = '', children }) {
  const cls = ['ui-page-section', className].filter(Boolean).join(' ');

  return (
    <section className={cls}>
      {title && (
        <div className="ui-page-section-header">
          <div className="ui-page-section-title-group">
            {icon && <span className="ui-page-section-icon">{icon}</span>}
            <h2 className="ui-page-section-title">{title}</h2>
          </div>
          {actions && <div className="ui-page-section-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

Page.Section = PageSection;

export default Page;
