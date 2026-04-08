import { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { getTypeInfo } from '../utils/affaireConstants';
import { useNavigation } from '../contexts/NavigationContext';
import api from '../utils/api';
import './AffaireBadge.css';

// ── Cache global partagé entre toutes les instances ──
const _typeCache = new Map();
let _fetchPromise = null;

function ensureTypeCache() {
  if (!_fetchPromise) {
    _fetchPromise = api.getAffaires()
      .then(data => {
        const affaires = data.affaires || data || [];
        for (const a of affaires) {
          const num = a.numeroAffaire || a.numero_affaire;
          if (num && a.type) _typeCache.set(num, a.type);
        }
      })
      .catch(() => { _fetchPromise = null; }); // retry on error
  }
  return _fetchPromise;
}

/**
 * Badge unifié pour les numéros d'affaire.
 * - Couleur automatique selon le type d'affaire
 * - Auto-résolution du type si non fourni (cache global)
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
const AffaireBadge = ({ numero, type: typeProp, onNavigate, size = 'md', showIcon = false, className = '' }) => {
  const navigationContext = useNavigation();
  const [, forceUpdate] = useState(0);

  // Auto-résolution du type si non fourni en prop
  useEffect(() => {
    if (typeProp || !numero || _typeCache.has(numero)) return;
    ensureTypeCache().then(() => forceUpdate(v => v + 1));
  }, [numero, typeProp]);

  if (!numero) return null;

  const type = typeProp || _typeCache.get(numero);
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
