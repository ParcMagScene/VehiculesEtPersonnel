import React from 'react';
import './ui.css';

/**
 * Panel — Conteneur structuré avec header/body/footer
 * Utilisable pour modals, panneaux latéraux, sections
 *
 * @param {string}   title      Titre dans le header
 * @param {React.ReactNode} icon Icône avant le titre
 * @param {function} onClose    Callback fermeture (affiche le bouton ✕)
 * @param {React.ReactNode} footer  Contenu du footer
 * @param {React.ReactNode} headerActions  Actions supplémentaires dans le header
 * @param {string}   className  Classes additionnelles
 */
const Panel = React.forwardRef(function Panel(
  { title, icon, onClose, footer, headerActions, className = '', children, style, ...rest },
  ref
) {
  const cls = ['ui-panel', className].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={cls} style={style} {...rest}>
      {title && (
        <div className="ui-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {icon && <span className="ui-panel-icon">{icon}</span>}
            <h3>{title}</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {headerActions}
            {onClose && (
              <button className="ui-panel-close" onClick={onClose} aria-label="Fermer" type="button">
                ✕
              </button>
            )}
          </div>
        </div>
      )}
      <div className="ui-panel-body">{children}</div>
      {footer && <div className="ui-panel-footer">{footer}</div>}
    </div>
  );
});

export default Panel;
