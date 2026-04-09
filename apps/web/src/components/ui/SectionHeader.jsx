import './ui.css';

/**
 * SectionHeader — En-tête de section standardisé
 *
 * @param {string}   title    Texte du titre
 * @param {number}   count    Badge de comptage (optionnel)
 * @param {string}   as       Tag HTML ('h3' | 'h4'), défaut 'h3'
 * @param {React.ReactNode} icon   Icône avant le titre
 * @param {React.ReactNode} actions Boutons/actions à droite
 * @param {string}   className Classes additionnelles
 */
function SectionHeader({ title, count, as: Tag = 'h3', icon, actions, className = '', ...rest }) {
  const cls = ['ui-section-header', className].filter(Boolean).join(' ');

  return (
    <div className={cls} {...rest}>
      {icon && <span>{icon}</span>}
      <Tag>{title}</Tag>
      {count != null && <span className="ui-section-badge">{count}</span>}
      {actions && <div className="ui-section-actions">{actions}</div>}
    </div>
  );
}

export default SectionHeader;
