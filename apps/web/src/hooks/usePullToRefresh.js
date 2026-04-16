import { useState, useRef, useCallback } from 'react';

/**
 * Hook pull-to-refresh pour les écrans mobile.
 * Retourne { containerProps, indicatorNode, isRefreshing }
 *
 * @param {Function} onRefresh - Async function appelée lors du refresh
 * @param {Object}   opts
 * @param {number}   opts.threshold   - Distance en px pour déclencher (défaut 80)
 * @param {number}   opts.maxPull     - Distance max en px (défaut 120)
 * @param {boolean}  opts.disabled    - Désactiver le pull-to-refresh
 */
export default function usePullToRefresh(
  onRefresh,
  { threshold = 80, maxPull = 120, disabled = false } = {},
) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const containerRef = useRef(null);

  const onTouchStart = useCallback(
    (e) => {
      if (disabled || isRefreshing) return;
      // Seulement si le scroll est en haut
      const el = containerRef.current;
      if (el && el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
    },
    [disabled, isRefreshing],
  );

  const onTouchMove = useCallback(
    (e) => {
      if (disabled || isRefreshing) return;
      const el = containerRef.current;
      if (el && el.scrollTop > 0) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 10) {
        pullingRef.current = true;
        // Résistance : diminue progressivement
        const distance = Math.min(diff * 0.5, maxPull);
        setPullDistance(distance);
      }
    },
    [disabled, isRefreshing, maxPull],
  );

  const onTouchEnd = useCallback(async () => {
    if (disabled || !pullingRef.current) return;
    pullingRef.current = false;

    if (pullDistance >= threshold && onRefresh) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.5); // Position pendant le refresh
      try {
        await onRefresh();
      } catch (e) {
        console.error('Pull-to-refresh error:', e);
      }
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [disabled, pullDistance, threshold, onRefresh]);

  // Quand disabled, forcer la distance à 0 sans effet
  const effectivePull = disabled ? 0 : pullDistance;

  const progress = Math.min(effectivePull / threshold, 1);
  const triggered = effectivePull >= threshold;

  const containerProps = {
    ref: containerRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };

  // Nœud indicateur à placer en haut du container
  const showIndicator = effectivePull > 0 || isRefreshing;
  const indicatorNode = showIndicator
    ? {
        style: {
          height: isRefreshing ? 40 : effectivePull,
          opacity: isRefreshing ? 1 : progress,
        },
        className: `ptr-indicator${isRefreshing ? ' ptr-refreshing' : ''}${triggered ? ' ptr-triggered' : ''}`,
        isRefreshing,
        progress,
        triggered,
      }
    : null;

  return { containerProps, indicatorNode, isRefreshing };
}
