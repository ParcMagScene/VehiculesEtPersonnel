// ═══════════════════════════════════════════════════════════════
// TaskAlertBanner — Bandeau global d'alertes taches (Phase 3)
// Poll /api/display/alerts/pending toutes les 10s, joue le son et
// vibre au declenchement, permet d'acquitter chaque alerte.
// Monte dans AppChrome (desktop) et MobileApp (mobile).
// ═══════════════════════════════════════════════════════════════

import './TaskAlertBanner.css';

import { Bell, X } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';

const POLL_INTERVAL_MS = 10000;

function TaskAlertBanner() {
  const [alerts, setAlerts] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const seenIdsRef = useRef(new Set());
  const audioUnlockedRef = useRef(false);
  const audioElRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getDisplayPendingAlerts();
      const next = Array.isArray(data?.activeAlerts) ? data.activeAlerts : [];

      // Detection des nouvelles alertes -> son + vibration
      const newAlerts = next.filter((a) => !seenIdsRef.current.has(a.taskId));
      if (newAlerts.length > 0) {
        // Vibration mobile (si supportee et alertes non deja vues)
        try {
          if (typeof navigator.vibrate === 'function') {
            navigator.vibrate([200, 100, 200, 100, 400]);
          }
        } catch {
          /* ignore */
        }

        // Son de la premiere alerte nouvelle (autoplay OK apres unlock)
        if (audioUnlockedRef.current && newAlerts[0].soundPath) {
          try {
            if (!audioElRef.current) audioElRef.current = new Audio();
            audioElRef.current.src = newAlerts[0].soundPath;
            audioElRef.current.currentTime = 0;
            audioElRef.current.play().catch(() => {
              /* autoplay bloque */
            });
          } catch {
            /* ignore */
          }
        }

        newAlerts.forEach((a) => seenIdsRef.current.add(a.taskId));
        // Toute nouvelle alerte re-deploie le bandeau si l'utilisateur l'avait masque.
        setCollapsed(false);
      }

      // Nettoie les IDs disparus (evite fuite memoire si beaucoup de taches)
      const currentIds = new Set(next.map((a) => a.taskId));
      for (const id of Array.from(seenIdsRef.current)) {
        if (!currentIds.has(id)) seenIdsRef.current.delete(id);
      }

      setAlerts(next);
    } catch {
      // Silencieux : erreur reseau ponctuelle, retry au prochain tick.
    }
  }, []);

  // Poll toutes les 10s
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Refresh quand une autre partie de l'app publie 'display' ou 'planning'
  useEffect(() => {
    const unsub1 = refreshBus.subscribe('display', load);
    const unsub2 = refreshBus.subscribe('planning', load);
    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, [load]);

  // Debloque l'audio a la premiere interaction utilisateur (autoplay policy).
  useEffect(() => {
    const unlock = () => {
      audioUnlockedRef.current = true;
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleAck = useCallback(
    async (taskId) => {
      // Retire l'alerte cote UI immediatement (le poll suivant confirmera).
      setAlerts((prev) => prev.filter((a) => a.taskId !== taskId));
      try {
        await api.ackDisplayAlert(taskId);
        refreshBus.publish('display');
      } catch {
        // En cas d'echec, restauration au prochain poll (l'API renverra encore).
        load();
      }
    },
    [load],
  );

  if (!alerts || alerts.length === 0) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        className="task-alert-banner-collapsed"
        onClick={() => setCollapsed(false)}
        aria-label={`${alerts.length} alerte(s) actives — cliquer pour afficher`}
      >
        <Bell size={18} />
        <span className="task-alert-banner-count">{alerts.length}</span>
      </button>
    );
  }

  return (
    <div className="task-alert-banner" role="alert" aria-live="assertive">
      <div className="task-alert-banner-header">
        <Bell size={18} className="task-alert-banner-icon" />
        <strong className="task-alert-banner-title">
          {alerts.length === 1 ? '1 tâche en alerte' : `${alerts.length} tâches en alerte`}
        </strong>
        <button
          type="button"
          className="task-alert-banner-collapse"
          onClick={() => setCollapsed(true)}
          aria-label="Masquer"
        >
          <X size={16} />
        </button>
      </div>
      <ul className="task-alert-banner-list">
        {alerts.map((a) => (
          <li key={a.taskId} className="task-alert-banner-item">
            <span className="task-alert-banner-time">{a.time || '—'}</span>
            <span className="task-alert-banner-section">{a.sectionLabel}</span>
            <span className="task-alert-banner-task-title">{a.title || 'Sans titre'}</span>
            <button
              type="button"
              className="task-alert-banner-ack"
              onClick={() => handleAck(a.taskId)}
            >
              Acquitter
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default memo(TaskAlertBanner);
