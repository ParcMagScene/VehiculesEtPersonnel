import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import { playNotificationSound, requestNotificationPermission, showBrowserNotification } from '../utils/notificationSound';

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

  const handleUnreadUpdate = useCallback((newCount) => {
    const prevCount = prevUnreadRef.current;
    if (newCount > prevCount && prevCount !== -1) {
      const prefs = userPrefsRef.current;
      const diff = newCount - prevCount;

      if (prefs.notificationsEnabled !== false && !showMessagingRef.current) {
        toast.info(`💬 ${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''}`, {
          sound: prefs.soundEnabled !== false,
        });
      } else if (prefs.soundEnabled) {
        playNotificationSound();
      }

      if (prefs.notificationsEnabled && !showMessagingRef.current) {
        showBrowserNotification(
          `${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''}`,
          { body: 'Cliquez pour ouvrir la messagerie eM@g' }
        );
      }
    }
    prevUnreadRef.current = newCount;
    setUnreadMsgCount(newCount);
  }, [userPrefsRef, showMessagingRef, toast]);

  const startPolling = useCallback(() => {
    if (fallbackIntervalRef.current) return;
    const poll = async () => {
      try {
        const data = await api.getUnreadCount();
        handleUnreadUpdate(data.unread || 0);
      } catch { /* silencieux */ }
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
        } catch { /* parse error */ }
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
          setTimeout(connectSSE, retriesRef.current * 2000);
        } else {
          startPolling();
        }
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
    };
  }, [currentUser, handleUnreadUpdate, startPolling, stopPolling]);

  return { unreadMsgCount };
}
