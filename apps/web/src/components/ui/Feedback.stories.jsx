import { Spinner, LoadingOverlay } from '../components/ui/Loader';
import ProgressBar from '../components/ui/ProgressBar';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import InlineAlert from '../components/ui/InlineAlert';

export default { title: 'Atomes/Feedback' };

/* ── Spinner ── */
export const SpinnerSizes = () => (
  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
    {['sm', 'md', 'lg', 'xl'].map(s => <Spinner key={s} size={s} />)}
  </div>
);

/* ── LoadingOverlay ── */
export const LoadingOverlayDefault = () => (
  <div style={{ position: 'relative', height: 120, border: '1px solid var(--theme-border)' }}>
    <p style={{ padding: 16 }}>Contenu masqué</p>
    <LoadingOverlay label="Chargement…" visible />
  </div>
);

/* ── ProgressBar ── */
export const ProgressBarVariants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
    <ProgressBar value={30} label="30%" />
    <ProgressBar value={60} color="success" label="60%" />
    <ProgressBar value={85} color="warning" label="85%" />
    <ProgressBar value={95} color="danger" label="95%" />
    <ProgressBar indeterminate label="Indéterminé" />
  </div>
);

/* ── Skeleton ── */
export const SkeletonVariants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 300 }}>
    <Skeleton variant="circle" size="lg" />
    <Skeleton variant="text" count={3} />
    <Skeleton variant="rect" width="100%" height={80} />
  </div>
);

/* ── EmptyState ── */
export const EmptyStateDefault = () => (
  <EmptyState
    title="Aucun résultat"
    description="Essayez de modifier vos filtres de recherche."
  />
);

/* ── InlineAlert ── */
export const InlineAlertVariants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500 }}>
    {['info', 'success', 'warning', 'error'].map(v => (
      <InlineAlert key={v} variant={v}>Message de type {v}</InlineAlert>
    ))}
  </div>
);

export const InlineAlertDismissible = () => (
  <InlineAlert variant="warning" dismissible>
    Ce message peut être fermé.
  </InlineAlert>
);
