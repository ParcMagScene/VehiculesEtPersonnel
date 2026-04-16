import './ToastContainer.css';

import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { Button } from '@/design-system';

import { playSound, vibrate } from '../utils/notificationSound';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const DURATIONS = {
  success: 3500,
  error: 6000,
  warning: 5000,
  info: 4000,
};

let toastId = 0;

/**
 * Composant global de toasts.
 * Utiliser via ref : toastRef.current.show({ type, message })
 */
const ToastContainer = forwardRef(function ToastContainer(_, ref) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  // Nettoyer les timers au démontage
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    // Retirer après l'animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const show = useCallback(
    ({ type = 'info', message, duration, sound = true, haptic = false }) => {
      const id = ++toastId;
      const dur = duration || DURATIONS[type] || 4000;

      setToasts((prev) => [...prev.slice(-4), { id, type, message, leaving: false }]); // max 5

      timersRef.current[id] = setTimeout(() => dismiss(id), dur);

      if (sound) {
        const soundType = type === 'info' ? 'notification' : type;
        playSound(soundType);
      }
      if (haptic) vibrate(type === 'info' ? 'notification' : type);

      return id;
    },
    [dismiss],
  );

  useImperativeHandle(ref, () => ({ show, dismiss }), [show, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || ICONS.info;
        return (
          <div
            key={t.id}
            className={`toast-item toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`}
            role="alert"
          >
            <Icon size={18} className="toast-icon" />
            <span className="toast-msg">{t.message}</span>
            <Button
              variant="ghost"
              className="toast-dismiss"
              onClick={() => dismiss(t.id)}
              aria-label="Fermer"
            >
              <X size={14} />
            </Button>
          </div>
        );
      })}
    </div>
  );
});

export default ToastContainer;
