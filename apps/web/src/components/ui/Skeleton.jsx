/**
 * Skeleton — Composant atomique Design System
 *
 * Placeholder animé pour les états de chargement.
 * Remplace les flash blancs par un shimmer gris pulsant.
 *
 * Props :
 *   width    — largeur CSS (string | number)       ex: '100%', 200
 *   height   — hauteur CSS (string | number)       ex: 20, '1.2em'
 *   size     — preset de hauteur: 'sm' | 'md' | 'lg' | 'xl'
 *   variant  — 'rect' (défaut) | 'circle' | 'text'
 *   count    — nombre de lignes skeleton à rendre   (défaut: 1)
 *   gap      — espacement entre lignes              (défaut: 8)
 *   className — classes additionnelles
 *   style    — style inline additionnel
 */
import './Skeleton.css';

export default function Skeleton({
  width,
  height,
  size,
  variant = 'rect',
  count = 1,
  gap = 8,
  className = '',
  style,
  ...props
}) {
  const cls = [
    'ui-skeleton',
    variant !== 'rect' && `ui-skeleton--${variant}`,
    size && `ui-skeleton--${size}`,
    className,
  ].filter(Boolean).join(' ');

  const baseStyle = {
    ...(width != null && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height != null && { height: typeof height === 'number' ? `${height}px` : height }),
    ...style,
  };

  if (count <= 1) {
    return <div className={cls} style={baseStyle} aria-hidden="true" {...props} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cls} style={baseStyle} {...props} />
      ))}
    </div>
  );
}
