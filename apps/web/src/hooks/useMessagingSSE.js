import { useCallback, useEffect, useRef, useState } from 'react';

import api from '../utils/api';
import {
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
} from '../utils/notificationSound';

/**
 * Hook SSE pour la messagerie temps réel — remplace le polling 10s.
 * Fallback automatique sur polling si SSE échoue (ex: navigateur ancien).
 */
export function useMessagingSSE({ currentUser, onNewMessage, isMessagingOpen }) {
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const prevUnreadRef = useRef(-1);
  const eventSourceRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const retriesRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const retryFromPollingTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const handleUnreadUpdate = useCallback(
    (newCount) => {
      const prevCount = prevUnreadRef.current;
      if (newCount > prevCount && prevCount !== -1) {
        const diff = newCount - prevCount;

        playNotificationSound();

        if (!isMessagingOpen) {
          showBrowserNotification(
            `${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''}`,
            { body: 'Cliquez pour ouvrir la messagerie eM@g' },
          );
        }
      }
      prevUnreadRef.current = newCount;
      if (isMountedRef.current) setUnreadMsgCount(newCount);
    },
    [isMessagingOpen],
  );

  // Fallback polling
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

    const connectSSE = () => {
      // Fermer une éventuelle connexion précédente
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

      es.addEventListener('new_message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onNewMessage) onNewMessage(data);
        } catch {
          /* parse error */
        }
      });

      es.onopen = () => {
        retriesRef.current = 0;
        stopPolling(); // SSE OK → arrêter le polling de secours
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        retriesRef.current++;

        if (retriesRef.current <= 8) {
          // Reconnexion avec backoff exponentiel plafonné à 30s
          const delay = Math.min(retriesRef.current * 2000, 30000);
          reconnectTimeoutRef.current = setTimeout(connectSSE, delay);
        } else {
          // SSE en échec → fallback polling, retenter SSE après 2 min
          startPolling();
          retryFromPollingTimeoutRef.current = setTimeout(() => {
            retriesRef.current = 0;
            stopPolling();
            connectSSE();
          }, 120000);
        }
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (retryFromPollingTimeoutRef.current) {
        clearTimeout(retryFromPollingTimeoutRef.current);
        retryFromPollingTimeoutRef.current = null;
      }
      stopPolling();
    };
  }, [currentUser, handleUnreadUpdate, onNewMessage, startPolling, stopPolling]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (retryFromPollingTimeoutRef.current) {
        clearTimeout(retryFromPollingTimeoutRef.current);
        retryFromPollingTimeoutRef.current = null;
      }
    },
    [],
  );

  return { unreadMsgCount };
}
