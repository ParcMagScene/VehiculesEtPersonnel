import React from 'react';
import { getApiUrl } from '../utils/api';

// Générer les initiales à partir du nom
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Générer une couleur unique basée sur le nom
const getColorFromName = (name) => {
  if (!name) return 'var(--theme-text-gray)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#6366f1', '#f97316',
    '#14b8a6', '#a855f7', '#ef4444', '#84cc16'
  ];
  return colors[Math.abs(hash) % colors.length];
};

const adjustColor = (color, percent) => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
};

/**
 * Composant avatar utilisateur réutilisable
 * @param {Object} props
 * @param {string} props.name - Nom de l'utilisateur
 * @param {string} [props.avatar] - URL de l'avatar (ex: /avatars/avatar-1.jpg)
 * @param {number} [props.size=40] - Taille en pixels
 * @param {boolean} [props.gradient=true] - Utiliser un dégradé pour le fallback
 * @param {Object} [props.style] - Styles additionnels
 */
const UserAvatar = ({ name, avatar, size = 40, gradient = true, style = {} }) => {
  const baseUrl = getApiUrl().replace('/api', '');
  const hasPhoto = avatar && avatar.startsWith('/');

  if (hasPhoto) {
    return (
      <img
        src={`${baseUrl}${avatar}`}
        alt={name || 'Avatar'}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          ...style
        }}
        onError={(e) => {
          // Fallback vers initiales si l'image ne charge pas
          e.target.style.display = 'none';
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  }

  const color = getColorFromName(name);
  const bgStyle = gradient
    ? { background: `linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%)` }
    : { background: color };

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        borderRadius: '50%',
        ...bgStyle,
        color: 'var(--theme-text-inverse)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.max(size * 0.38, 11)}px`,
        fontWeight: 600,
        flexShrink: 0,
        userSelect: 'none',
        ...style
      }}
    >
      {getInitials(name)}
    </div>
  );
};

export { getInitials, getColorFromName, adjustColor };
export default UserAvatar;
