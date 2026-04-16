import { useCallback, useRef, useState } from 'react';

/**
 * Hook de swipe-to-action sur un élément de liste (style iOS).
 * Révèle des boutons d'action en dessous lors du glissement.
 *
 * @param {Object} options
 * @param {number} [options.threshold=70] - Distance en px pour révéler l'action
 * @param {boolean} [options.disabled=false]
 * @returns {{ getSwipeProps: (id) => touchProps, swipeState: { id, direction, offset }, resetSwipe: () => void }}
 */
export default function useSwipeAction({ threshold = 70, disabled = false } = {}) {
  const [swipeState, setSwipeState] = useState({ id: null, direction: null, offset: 0 });
  const touchRef = useRef({ startX: 0, startY: 0, id: null, locked: false });

  const resetSwipe = useCallback(() => {
    setSwipeState({ id: null, direction: null, offset: 0 });
  }, []);

  const getSwipeProps = useCallback(
    (itemId) => {
      if (disabled) return {};

      return {
        onTouchStart: (e) => {
          // Fermer le swipe précédent si on touche un autre item
          if (swipeState.id && swipeState.id !== itemId) {
            resetSwipe();
          }
          const touch = e.touches[0];
          touchRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            id: itemId,
            locked: false,
          };
        },
        onTouchMove: (e) => {
          const ref = touchRef.current;
          if (ref.id !== itemId) return;

          const touch = e.touches[0];
          const dx = touch.clientX - ref.startX;
          const dy = touch.clientY - ref.startY;

          // Première décision : horizontal vs vertical
          if (!ref.locked) {
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
              ref.id = null; // scroll vertical → abandonner
              return;
            }
            if (Math.abs(dx) > 10) {
              ref.locked = true;
            } else {
              return;
            }
          }

          e.preventDefault(); // Empêcher le scroll pendant le swipe
          const direction = dx > 0 ? 'right' : 'left';
          const offset = Math.min(Math.abs(dx), threshold + 20);
          setSwipeState({ id: itemId, direction, offset });
        },
        onTouchEnd: () => {
          const ref = touchRef.current;
          if (ref.id !== itemId || !ref.locked) return;

          // Si on a dépassé le seuil, rester ouvert
          if (swipeState.offset >= threshold) {
            setSwipeState((prev) => ({ ...prev, offset: threshold }));
          } else {
            resetSwipe();
          }
          touchRef.current = { startX: 0, startY: 0, id: null, locked: false };
        },
      };
    },
    [disabled, swipeState, threshold, resetSwipe],
  );

  return { getSwipeProps, swipeState, resetSwipe };
}
