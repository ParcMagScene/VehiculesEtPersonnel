import { Loader as LoaderIcon } from 'lucide-react';

/**
 * Spinner — Composant atomique Design System
 *
 * Tailles : sm (16) | md (24) | lg (32) | xl (48)
 * Mode    : inline (dans un bouton/texte) | overlay (plein écran/conteneur)
 */
export function Spinner({
  size = 'md',
  className = '',
  ...props
}) {
  const SIZE_MAP = { sm: 16, md: 24, lg: 32, xl: 48 };
  const px = typeof size === 'number' ? size : (SIZE_MAP[size] || 24);

  return (
    <LoaderIcon
      size={px}
      className={`ui-spinner ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * LoadingOverlay — Overlay de chargement sur un conteneur
 *
 * Props : label (texte optionnel), visible
 */
export function LoadingOverlay({
  label,
  visible = true,
  className = '',
  ...props
}) {
  if (!visible) return null;

  return (
    <div className={`ui-loading-overlay ${className}`} role="status" {...props}>
      <Spinner size="lg" />
      {label && <span className="ui-loading-overlay__label">{label}</span>}
      <span className="sr-only">{label || 'Chargement…'}</span>
    </div>
  );
}
