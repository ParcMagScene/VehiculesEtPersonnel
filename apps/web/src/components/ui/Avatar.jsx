/**
 * Avatar — Composant atomique Design System
 *
 * Wrapper de UserAvatar avec API standardisée.
 * Tailles prédéfinies : xs (24) | sm (32) | md (40) | lg (56) | xl (80)
 */
import UserAvatar from '../UserAvatar';

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export default function Avatar({
  name,
  avatar,
  size = 'md',
  gradient = true,
  className = '',
  style,
  ...props
}) {
  const px = typeof size === 'number' ? size : SIZE_MAP[size] || 40;

  return (
    <span className={`ui-avatar ${className}`} {...props}>
      <UserAvatar name={name} avatar={avatar} size={px} gradient={gradient} style={style} />
    </span>
  );
}
