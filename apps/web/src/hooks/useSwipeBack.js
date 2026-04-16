import { useCallback, useRef, useState } from 'react';

/**
 * Hook swipe-back : détecte un geste swipe depuis le bord gauche de l'écran.
 * Appelle onBack() quand le swipe dépasse le seuil.
 *
 * @param {Function} onBack - Callback de navigation retour
 * @param {Object}   opts
 * @param {number}   opts.edgeWidth  - Zone de départ depuis le bord gauche (px, défaut 30)
 * @param {number}   opts.threshold  - Distance min pour valider le swipe (px, défaut 100)
 * @param {boolean}  opts.disabled   - Désactiver
 */
export default function useSwipeBack(
  onBack,
  { edgeWidth = 30, threshold = 100, disabled = false } = {},
) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const swipingRef = useRef(false);
  const [swipeProgress, setSwipeProgress] = useState(0);

  const onTouchStart = useCallback(
    (e) => {
      if (disabled) return;
      const touch = e.touches[0];
      // Seulement si le touch démarre depuis le bord gauche
      if (touch.clientX > edgeWidth) return;
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      swipingRef.current = true;
    },
    [disabled, edgeWidth],
  );

  const onTouchMove = useCallback(
    (e) => {
      if (disabled || !swipingRef.current) return;
      const dx = e.touches[0].clientX - startXRef.current;
      const dy = Math.abs(e.touches[0].clientY - startYRef.current);

      // Si mouvement vertical > horizontal, annuler
      if (dy > dx) {
        swipingRef.current = false;
        setSwipeProgress(0);
        return;
      }

      if (dx > 0) {
        setSwipeProgress(Math.min(dx / threshold, 1));
      }
    },
    [disabled, threshold],
  );

  const onTouchEnd = useCallback(() => {
    if (disabled || !swipingRef.current) return;
    swipingRef.current = false;
    if (swipeProgress >= 1 && onBack) {
      onBack();
    }
    setSwipeProgress(0);
  }, [disabled, swipeProgress, onBack]);

  const swipeBackProps = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };

  return { swipeBackProps, swipeProgress };
}
