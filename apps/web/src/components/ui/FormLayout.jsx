import './FormLayout.css';

/**
 * FormLayout — Conteneur structuré pour formulaires.
 * Gère les sections, rangées multi-colonnes et zone d'actions.
 */
function FormLayout({ className = '', children, onSubmit }) {
  const cls = ['ui-form-layout', className].filter(Boolean).join(' ');
  const handleSubmit = onSubmit
    ? (e) => {
        e.preventDefault();
        onSubmit(e);
      }
    : undefined;
  const Tag = onSubmit ? 'form' : 'div';
  return (
    <Tag className={cls} onSubmit={handleSubmit}>
      {children}
    </Tag>
  );
}

/**
 * FormSection — Regroupe des champs liés sous un titre optionnel.
 */
function FormSection({ title, description, className = '', children }) {
  const cls = ['ui-form-section', className].filter(Boolean).join(' ');
  return (
    <fieldset className={cls}>
      {title && (
        <legend className="ui-form-section-legend">
          <span className="ui-form-section-title">{title}</span>
          {description && <span className="ui-form-section-desc">{description}</span>}
        </legend>
      )}
      {children}
    </fieldset>
  );
}

/**
 * FormRow — Rangée horizontale (1-4 colonnes avec grille automatique).
 */
function FormRow({ columns, gap, className = '', children }) {
  const cls = ['ui-form-row', className].filter(Boolean).join(' ');
  const style = {};
  if (columns)
    style.gridTemplateColumns = typeof columns === 'number' ? `repeat(${columns}, 1fr)` : columns;
  if (gap) style.gap = gap;
  return (
    <div className={cls} style={Object.keys(style).length ? style : undefined}>
      {children}
    </div>
  );
}

/**
 * FormActions — Zone de boutons (submit, cancel, etc.).
 */
function FormActions({ align = 'end', className = '', children }) {
  const cls = ['ui-form-actions', `ui-form-actions--${align}`, className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}

export { FormLayout, FormSection, FormRow, FormActions };
