import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { playNotificationSound, requestNotificationPermission, showBrowserNotification } from '../utils/notificationSound';

/**
 * Hook gérant le polling des messages non lus + notifications sonores/navigateur.
 * Extrait d'App.jsx.
 */
export function useMessagingPolling({ currentUser, userPrefsRef, showMessagingRef, toast }) {
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const prevUnreadRef = useRef(0);

  useEffect(() => {
    if (!currentUser) return;

    requestNotificationPermission();

    const fetchUnread = async () => {
      try {
        const data = await api.getUnreadCount();
        const newCount = data.unread || 0;
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
      } catch (e) { /* silencieux */ }
    };

    prevUnreadRef.current = -1;
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, [currentUser, userPrefsRef, showMessagingRef, toast]);

  return { unreadMsgCount };
}
