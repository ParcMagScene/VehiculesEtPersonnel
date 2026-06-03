import { useEffect, useRef } from 'react';

import { setFaviconBadge } from '../utils/faviconBadge';

/**
 * Met à jour le titre de l'onglet et le favicon en fonction du compteur de
 * messages non lus. Visible même quand l'onglet est en arrière-plan, ce
 * qui complète les notifications sonores et navigateur.
 *
 *   "(3) eM@g — …"   quand unread > 0
 *   "eM@g — …"        quand unread === 0
 */
export function useDocumentBadge(unreadCount) {
  const originalTitleRef = useRef(null);

  useEffect(() => {
    if (originalTitleRef.current === null) {
      // Snapshot du titre initial sans préfixe (au cas où on rentre déjà
      // avec un titre badgé suite à un HMR).
      originalTitleRef.current = (document.title || 'eM@g').replace(/^\(\d+\+?\)\s*/, '');
    }
    const base = originalTitleRef.current;
    if (unreadCount > 0) {
      const label = unreadCount > 99 ? '99+' : String(unreadCount);
      document.title = `(${label}) ${base}`;
    } else {
      document.title = base;
    }
    setFaviconBadge(unreadCount);
  }, [unreadCount]);

  // Restaurer à l'unmount
  useEffect(() => {
    return () => {
      if (originalTitleRef.current) document.title = originalTitleRef.current;
      setFaviconBadge(0);
    };
  }, []);
}
