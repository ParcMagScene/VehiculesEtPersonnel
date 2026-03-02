import React from 'react';
import { Briefcase } from 'lucide-react';
import { getTypeInfo } from '../utils/affaireConstants';
import { useNavigation } from '../contexts/NavigationContext';
import './AffaireBadge.css';

/**
 * Badge unifié pour les numéros d'affaire.
 * - Couleur automatique selon le type d'affaire
 * - Cliquable → ouvre le modal de détail de l'affaire (sans changement de page)
 * - Navigation via onNavigate (prop) ou NavigationContext (auto)
 *
 * @param {string} numero - Numéro d'affaire (ex: "AF32744")
 * @param {string} [type] - Type d'affaire (Location, Prestation, Vente, Installation, Tournée)
 * @param {function} [onNavigate] - Callback de navigation explicite: (numeroAffaire) => void
 * @param {string} [size] - "sm" | "md" (défaut) | "lg"
 * @param {boolean} [showIcon] - Afficher l'icône Briefcase (défaut: false)
 * @param {string} [className] - Classes CSS additionnelles
 */
const AffaireBadge = ({ numero, type, onNavigate, size = 'md', showIcon = false, className = '' }) => {
  const navigationContext = useNavigation();
  if (!numero) return null;

  const typeInfo = getTypeInfo(type);
  const color = typeInfo.color;

  // Résoudre le handler : prop explicite > context automatique
  const resolvedNavigate = onNavigate || (navigationContext
    ? (num) => navigationContext('affaire', { numero: num })
    : null);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (resolvedNavigate) {
      resolvedNavigate(numero);
    }
  };

  const isClickable = !!resolvedNavigate;

  return (
    <span
      className={`affaire-badge-unified ${size} ${isClickable ? 'clickable' : ''} ${className}`}
      style={{
        '--badge-color': color,
        '--badge-bg': `${color}18`,
        '--badge-border': `${color}40`,
      }}
      onClick={isClickable ? handleClick : undefined}
      title={`Affaire ${numero}${type ? ` (${typeInfo.label})` : ''}${isClickable ? ' — Cliquer pour ouvrir' : ''}`}
    >
      {showIcon && <Briefcase size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} />}
      {numero}
    </span>
  );
};

export default AffaireBadge;
