import React from 'react';
import { Briefcase } from 'lucide-react';
import { getTypeInfo } from '../utils/affaireConstants';
import './AffaireBadge.css';

/**
 * Badge unifié pour les numéros d'affaire.
 * - Couleur automatique selon le type d'affaire
 * - Cliquable → navigue vers le module Affaires et ouvre l'affaire
 *
 * @param {string} numero - Numéro d'affaire (ex: "AF32744")
 * @param {string} [type] - Type d'affaire (Location, Prestation, Vente, Installation, Tournée)
 * @param {function} [onNavigate] - Callback de navigation: (numeroAffaire) => void
 * @param {string} [size] - "sm" | "md" (défaut) | "lg"
 * @param {boolean} [showIcon] - Afficher l'icône Briefcase (défaut: false)
 * @param {string} [className] - Classes CSS additionnelles
 */
const AffaireBadge = ({ numero, type, onNavigate, size = 'md', showIcon = false, className = '' }) => {
  if (!numero) return null;

  const typeInfo = getTypeInfo(type);
  const color = typeInfo.color;

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onNavigate) {
      onNavigate(numero);
    }
  };

  return (
    <span
      className={`affaire-badge-unified ${size} ${onNavigate ? 'clickable' : ''} ${className}`}
      style={{
        '--badge-color': color,
        '--badge-bg': `${color}18`,
        '--badge-border': `${color}40`,
      }}
      onClick={onNavigate ? handleClick : undefined}
      title={`Affaire ${numero}${type ? ` (${typeInfo.label})` : ''} — ${onNavigate ? 'Cliquer pour ouvrir' : ''}`}
    >
      {showIcon && <Briefcase size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} />}
      {numero}
    </span>
  );
};

export default AffaireBadge;
