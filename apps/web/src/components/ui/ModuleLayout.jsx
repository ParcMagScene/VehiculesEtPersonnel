import './ModuleLayout.css';

/**
 * ModuleLayout — Template de page module.
 * Structure : header → toolbar → content → footer optionnel.
 * Couvre les layouts de modules, panneaux latéraux et modaux complexes.
 */
function ModuleLayout({ className = '', children }) {
  const cls = ['ui-module-layout', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

/**
 * ModuleToolbar — Barre d'outils (recherche, filtres, vue toggle…).
 */
function ModuleToolbar({ className = '', children }) {
  const cls = ['ui-module-toolbar', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

/**
 * ModuleContent — Zone de contenu scrollable.
 */
function ModuleContent({ className = '', children, noPadding = false }) {
  const cls = ['ui-module-content', noPadding && 'ui-module-content--no-padding', className]
    .filter(Boolean)
    .join(' ');
  return <div className={cls}>{children}</div>;
}

/**
 * ModuleFooter — Pied de module (pagination, résumés, actions).
 */
function ModuleFooter({ className = '', children }) {
  const cls = ['ui-module-footer', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

/**
 * SplitLayout — Division horizontale résizable (sidebar + contenu).
 */
function SplitLayout({ sidebar, sidebarWidth = 280, side = 'left', className = '', children }) {
  const cls = ['ui-split-layout', `ui-split-layout--${side}`, className].filter(Boolean).join(' ');
  const sideStyle = {
    width: typeof sidebarWidth === 'number' ? `${sidebarWidth}px` : sidebarWidth,
    flexShrink: 0,
  };

  return (
    <div className={cls}>
      {side === 'left' && (
        <aside className="ui-split-sidebar" style={sideStyle}>
          {sidebar}
        </aside>
      )}
      <div className="ui-split-main">{children}</div>
      {side === 'right' && (
        <aside className="ui-split-sidebar" style={sideStyle}>
          {sidebar}
        </aside>
      )}
    </div>
  );
}

export { ModuleContent, ModuleFooter, ModuleLayout, ModuleToolbar, SplitLayout };
