import './Divider.css';

/**
 * Divider — Séparateur visuel horizontal ou vertical.
 *
 * @param {'horizontal'|'vertical'} orientation - Direction (défaut: horizontal)
 * @param {string} label - Texte optionnel affiché entre deux lignes (horizontal only)
 * @param {string} className
 */
export default function Divider({ orientation = 'horizontal', label, className, ...rest }) {
  const cls = ['ui-divider', `ui-divider--${orientation}`, label && 'ui-divider--label', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="separator" aria-orientation={orientation} {...rest}>
      {label && <span className="ui-divider__label">{label}</span>}
    </div>
  );
}
