import { useCallback, useEffect, useRef, useState } from 'react';

import api from '../utils/api';
import {
  playNotificationVariant,
  requestNotificationPermission,
  showBrowserNotification,
} from '../utils/notificationSound';

/**
 * Hook SSE pour les messages non lus + notifications sonores/navigateur.
 * Remplace le polling 10s par SSE (fallback polling auto si SSE échoue).
 * Interface conservée pour rétrocompatibilité avec App.jsx.
 */
export function useMessagingPolling({ currentUser, userPrefsRef, showMessagingRef, toast }) {
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const prevUnreadRef = useRef(-1);
  const eventSourceRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const retriesRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const handleUnreadUpdate = useCallback(
    (newCount) => {
      const prevCount = prevUnreadRef.current;
      if (newCount > prevCount && prevCount !== -1) {
        const prefs = userPrefsRef.current;
        const diff = newCount - prevCount;
        const label = `${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''}`;

        // Son selon la variante choisie par l'utilisateur
        if (prefs.soundEnabled !== false) {
          playNotificationVariant(prefs.notificationSoundVariant);
        }

        // Toast in-app (sauf si la messagerie est deja ouverte)
        if (prefs.notificationsEnabled !== false && !showMessagingRef.current) {
          toast.info(`💬 ${label}`);
        }

        // Notification navigateur (idem)
        if (prefs.notificationsEnabled && !showMessagingRef.current) {
          showBrowserNotification(label, {
            body: 'Cliquez pour ouvrir la messagerie eM@g',
          });
        }
      }
      prevUnreadRef.current = newCount;
      if (isMountedRef.current) setUnreadMsgCount(newCount);
    },
    [userPrefsRef, showMessagingRef, toast],
  );

  const startPolling = useCallback(() => {
    if (fallbackIntervalRef.current) return;
    const poll = async () => {
      try {
        const data = await api.getUnreadCount();
        handleUnreadUpdate(data.unread || 0);
      } catch {
        /* silencieux */
      }
    };
    poll();
    fallbackIntervalRef.current = setInterval(poll, 10000);
  }, [handleUnreadUpdate]);

  const stopPolling = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    requestNotificationPermission();
    let cancelled = false;

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const es = new EventSource('/api/messaging/sse', { withCredentials: true });
      eventSourceRef.current = es;

      es.addEventListener('unread_update', (e) => {
        try {
          const data = JSON.parse(e.data);
          handleUnreadUpdate(data.unread || 0);
        } catch {
          /* parse error */
        }
      });

      es.onopen = () => {
        retriesRef.current = 0;
        stopPolling();
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        retriesRef.current++;
        if (retriesRef.current <= 3) {
          reconnectTimeoutRef.current = setTimeout(connectSSE, retriesRef.current * 2000);
        } else {
          startPolling();
        }
      };
    };

    connectSSE();

    const bootstrap = async () => {
      try {
        const data = await api.getUnreadCount();
        if (cancelled) return;
        handleUnreadUpdate(data.unread || 0);
      } catch {
        if (!cancelled) {
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          startPolling();
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      stopPolling();
    };
  }, [currentUser, handleUnreadUpdate, startPolling, stopPolling]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    },
    [],
  );

  return { unreadMsgCount };
}
