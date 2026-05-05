import { Skeleton } from '@/design-system';

/**
 * Skeleton de chargement mobile — placeholder pour les listes/fiches.
 * Utilisé dans les écrans mobiles en remplacement du Spinner + texte "Chargement...".
 *
 * @param {number} rows - Nombre de lignes skeleton (défaut: 5)
 * @param {'list'|'cards'|'detail'} variant - Layout du skeleton
 */
export default function MobileListSkeleton({ rows = 5, variant = 'list' }) {
  if (variant === 'detail') {
    return (
      <div className="mobile-skeleton" aria-label="Chargement en cours">
        <Skeleton width="60%" height={24} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={120} style={{ borderRadius: 12, marginBottom: 12 }} />
        <Skeleton count={4} width="100%" height={18} gap={10} />
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="mobile-skeleton" aria-label="Chargement en cours">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="mobile-skeleton-card">
            <Skeleton width="100%" height={80} style={{ borderRadius: 12 }} />
          </div>
        ))}
      </div>
    );
  }

  // variant === 'list'
  return (
    <div className="mobile-skeleton" aria-label="Chargement en cours">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mobile-skeleton-row">
          <Skeleton variant="circle" width={40} height={40} />
          <div style={{ flex: 1 }}>
            <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="45%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}
