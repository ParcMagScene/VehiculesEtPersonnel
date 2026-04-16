import { Tag, Badge } from '../components/ui/Tag';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Tooltip from '../components/ui/Tooltip';

export default { title: 'Atomes/Indicateurs' };

/* ── Tag ── */
export const TagColors = () => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {['primary', 'success', 'danger', 'warning', 'info', 'cyan', 'amber', 'neutral'].map((c) => (
      <Tag key={c} color={c}>
        {c}
      </Tag>
    ))}
  </div>
);

export const TagCloseable = () => (
  <Tag color="primary" closeable onClose={() => alert('Fermé !')}>
    Closeable
  </Tag>
);

/* ── Badge ── */
export const BadgeCount = () => (
  <div style={{ display: 'flex', gap: 16 }}>
    <Badge count={5}>📧</Badge>
    <Badge count={150} max={99}>
      🔔
    </Badge>
    <Badge dot>💬</Badge>
  </div>
);

/* ── StatusBadge ── */
export const StatusBadgeExamples = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <StatusBadge color="#22c55e">Actif</StatusBadge>
    <StatusBadge color="#ef4444">Erreur</StatusBadge>
    <StatusBadge color="#f59e0b">En attente</StatusBadge>
    <StatusBadge color="#3b82f6">Info</StatusBadge>
  </div>
);

/* ── Avatar ── */
export const AvatarSizes = () => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    {['xs', 'sm', 'md', 'lg', 'xl'].map((s) => (
      <Avatar key={s} name="Jean Dupont" size={s} />
    ))}
  </div>
);

/* ── Tooltip ── */
export const TooltipPositions = () => (
  <div style={{ display: 'flex', gap: 32, padding: 48, justifyContent: 'center' }}>
    {['top', 'bottom', 'left', 'right'].map((p) => (
      <Tooltip key={p} content={`Position ${p}`} position={p}>
        <span style={{ cursor: 'help', textDecoration: 'underline' }}>{p}</span>
      </Tooltip>
    ))}
  </div>
);
