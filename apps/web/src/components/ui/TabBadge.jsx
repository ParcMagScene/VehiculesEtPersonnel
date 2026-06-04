/**
 * TabBadge — Pastille compteur pour onglets/tabs
 *
 * Props :
 *   - variant : 'info' | 'late' | 'soon' (défaut 'info')
 *   - count   : number — affichage `count > max ? max+ : count`
 *   - max     : number — borne max d'affichage (défaut 9)
 *   - label   : string — aria-label / title
 *   - children: alternative à `count` pour contenu libre
 */
import './TabBadge.css';

export default function TabBadge({
  variant = 'info',
  count,
  max = 9,
  label,
  children,
  className = '',
  ...props
}) {
  const display =
    children ?? (typeof count === 'number' ? (count > max ? `${max}+` : count) : null);
  if (display === null || display === '' || display === 0) return null;

  const cls = ['ui-tab-badge', `ui-tab-badge--${variant}`, className].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-label={label} title={label} {...props}>
      {display}
    </span>
  );
}
