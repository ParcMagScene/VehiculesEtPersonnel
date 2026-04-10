import { RefreshCw } from 'lucide-react';

/**
 * Indicateur visuel pull-to-refresh.
 * Utiliser avec usePullToRefresh().indicatorNode
 */
export default function PullToRefreshIndicator({ indicator }) {
  if (!indicator) return null;

  return (
    <div className={indicator.className} style={indicator.style}>
      <RefreshCw
        size={20}
        className={`ptr-icon${indicator.isRefreshing ? ' ptr-spin' : ''}`}
        style={{
          transform: `rotate(${indicator.progress * 360}deg)`,
          transition: indicator.isRefreshing ? 'none' : 'transform 0.1s',
        }}
      />
    </div>
  );
}
