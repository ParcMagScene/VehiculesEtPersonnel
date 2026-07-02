// ═══════════════════════════════════════════════════════════════
// useGoogleSync.js — Synchronisation intelligente Google Calendar
// Timer polling, BroadcastChannel multi-tab, IndexedDB cache, diff
// Phase D du refactoring Google OAuth2
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';

import api from '../utils/api';

const CHANNEL_NAME = 'emag-google-sync';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 min entre chaque sync
const LEADER_HEARTBEAT_MS = 15 * 1000; // 15s heartbeat leader
const LEADER_TIMEOUT_MS = 30 * 1000; // 30s sans heartbeat → leader mort
const IDB_STORE = 'googleEventsCache';
const IDB_DB_NAME = 'emagGoogleSync';
const IDB_VERSION = 1;

// ── IndexedDB helpers (store dédié, indépendant de l'IDB principal) ──

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function idbGet(key) {
  try {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* silencieux */
  }
}

// ── Diff engine ──

/**
 * Compare deux listes d'événements et retourne les changements.
 * @returns {{ added: Event[], removed: Event[], updated: Event[], unchanged: number }}
 */
function diffEvents(oldEvents, newEvents) {
  const oldMap = new Map(oldEvents.map((e) => [e.id, e]));
  const newMap = new Map(newEvents.map((e) => [e.id, e]));
  const added = [];
  const removed = [];
  const updated = [];
  let unchanged = 0;

  for (const [id, ev] of newMap) {
    const old = oldMap.get(id);
    if (!old) {
      added.push(ev);
    } else if (
      old.updated !== ev.updated ||
      old.summary !== ev.summary ||
      old.start?.dateTime !== ev.start?.dateTime ||
      old.end?.dateTime !== ev.end?.dateTime ||
      old.start?.date !== ev.start?.date ||
      old.end?.date !== ev.end?.date
    ) {
      updated.push(ev);
    } else {
      unchanged++;
    }
  }

  for (const id of oldMap.keys()) {
    if (!newMap.has(id)) {
      removed.push(oldMap.get(id));
    }
  }

  return { added, removed, updated, unchanged };
}

// ── Cache key builder ──

function buildCacheKey(view, dateStr, calendarId) {
  return `${calendarId || 'primary'}:${view}:${dateStr}`;
}

// ── Hook principal ──

/**
 * useGoogleSync — gère la synchronisation Google Calendar
 * - Leader election multi-tab via BroadcastChannel
 * - Cache IndexedDB (survit aux reloads)
 * - Diff silencieux (pas de flash si pas de changement)
 * - Timer polling configurable
 *
 * @param {{ isSignedIn: boolean, view: string, currentDate: Date, calendarId: string }} opts
 * @returns {{ events: Event[], loading: boolean, fetchNow: () => void, lastSync: number|null, isLeader: boolean }}
 */
export function useGoogleSync({ isSignedIn, view, currentDate, calendarId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [isLeader, setIsLeader] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const channelRef = useRef(null);
  const timerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const lastLeaderHeartbeatRef = useRef(Date.now());
  const tabIdRef = useRef(
    crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36),
  );
  const currentFetchRef = useRef(null); // guard against concurrent fetches
  const mountedRef = useRef(true);
  const eventsRef = useRef([]); // stable ref pour le diff (évite de recréer fetchEvents)
  const lastSyncRef = useRef(0);
  const cachedTimestampRef = useRef(0);

  // Cache key for the current view
  const dateStr = currentDate ? currentDate.toISOString().slice(0, 10) : '';
  const cacheKey = buildCacheKey(view, dateStr, calendarId);
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  // ── BroadcastChannel setup ──

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (e) => {
      const { type, tabId, payload } = e.data || {};

      switch (type) {
        case 'leader-heartbeat':
          if (tabId !== tabIdRef.current) {
            lastLeaderHeartbeatRef.current = Date.now();
            setIsLeader(false);
          }
          break;

        case 'events-updated':
          // Another tab fetched events — apply if same cache key
          if (
            tabId !== tabIdRef.current &&
            payload?.cacheKey === cacheKeyRef.current &&
            payload?.timestamp
          ) {
            // Ignore stale messages and avoid heavy payload cloning over BroadcastChannel.
            if (payload.timestamp <= lastSyncRef.current) break;
            lastSyncRef.current = payload.timestamp;

            (async () => {
              const cached = await idbGet(cacheKeyRef.current);
              if (!mountedRef.current || !cached?.events) return;
              setEvents(cached.events);
              eventsRef.current = cached.events;
              setLastSync(payload.timestamp);
            })();
          }
          break;

        case 'leader-claim':
          // Another tab claims leadership — yield if our ID is lower
          if (tabId !== tabIdRef.current && tabId > tabIdRef.current) {
            setIsLeader(false);
          }
          break;
      }
    };

    // Claim leadership
    channel.postMessage({ type: 'leader-claim', tabId: tabIdRef.current });
    setIsLeader(true);

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  // ── Leader heartbeat ──

  useEffect(() => {
    if (!isLeader) {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      return;
    }

    const sendHeartbeat = () => {
      channelRef.current?.postMessage({
        type: 'leader-heartbeat',
        tabId: tabIdRef.current,
      });
    };

    sendHeartbeat();
    heartbeatTimerRef.current = setInterval(sendHeartbeat, LEADER_HEARTBEAT_MS);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [isLeader]);

  // ── Leader takeover check ──

  useEffect(() => {
    if (isLeader) return;

    const checkLeaderAlive = setInterval(() => {
      if (Date.now() - lastLeaderHeartbeatRef.current > LEADER_TIMEOUT_MS) {
        // Leader is dead, take over
        setIsLeader(true);
        channelRef.current?.postMessage({
          type: 'leader-claim',
          tabId: tabIdRef.current,
        });
      }
    }, LEADER_HEARTBEAT_MS);

    return () => clearInterval(checkLeaderAlive);
  }, [isLeader]);

  // ── Core fetch function ──

  const fetchEvents = useCallback(
    async (silent = false) => {
      if (!isSignedIn || !view || !currentDate) return;
      if (currentFetchRef.current) return; // already fetching

      currentFetchRef.current = true;
      if (!silent) setLoading(true);

      try {
        const {
          startOfWeek: sow,
          endOfWeek: eow,
          startOfMonth: som,
          endOfMonth: eom,
          startOfYear: soy,
          endOfYear: eoy,
        } = await import('date-fns');

        let timeMin, timeMax;
        if (view === 'week') {
          timeMin = sow(currentDate, { weekStartsOn: 1 });
          timeMax = eow(currentDate, { weekStartsOn: 1 });
        } else if (view === 'month') {
          timeMin = som(currentDate);
          timeMax = eom(currentDate);
        } else if (view === 'year') {
          timeMin = soy(currentDate);
          timeMax = eoy(currentDate);
        } else {
          currentFetchRef.current = null;
          if (!silent) setLoading(false);
          return;
        }

        const data = await api.getGoogleEventsV2({
          calendarId: calendarId || 'primary',
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          maxResults: 2500,
          orderBy: 'startTime',
        });

        const freshEvents = data.items || [];

        if (!mountedRef.current) return;

        // Diff against current state (via ref pour stabilité)
        const diff = diffEvents(eventsRef.current, freshEvents);
        const hasChanges =
          diff.added.length > 0 || diff.removed.length > 0 || diff.updated.length > 0;

        if (hasChanges) {
          setEvents(freshEvents);
          eventsRef.current = freshEvents;

          // Persist to IndexedDB
          await idbSet(cacheKey, { events: freshEvents, timestamp: Date.now() });

          // Broadcast to other tabs
          channelRef.current?.postMessage({
            type: 'events-updated',
            tabId: tabIdRef.current,
            payload: { cacheKey, timestamp: Date.now() },
          });
        }

        const now = Date.now();
        setLastSync(now);
        lastSyncRef.current = now;
        setFetchError(null);
      } catch (err) {
        if (!silent) {
          setFetchError(err);
        }
      } finally {
        currentFetchRef.current = null;
        if (!silent) setLoading(false);
      }
    },
    [isSignedIn, view, currentDate, calendarId, cacheKey],
  );

  // ── Load from IndexedDB cache on mount / view change ──

  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;
    (async () => {
      const cached = await idbGet(cacheKey);
      if (cached?.events && !cancelled) {
        setEvents(cached.events);
        setLastSync(cached.timestamp || null);
        lastSyncRef.current = cached.timestamp || 0;
        cachedTimestampRef.current = cached.timestamp || 0;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, cacheKey]);

  // ── Cleanup quand déconnecté ──

  useEffect(() => {
    if (!isSignedIn) {
      setEvents([]);
      eventsRef.current = [];
      setLastSync(null);
      lastSyncRef.current = 0;
      setFetchError(null);
    }
  }, [isSignedIn]);

  // ── Initial fetch + polling timer (leader only) ──

  useEffect(() => {
    if (!isSignedIn || !view) return;

    // Skip the startup network hit when the IndexedDB cache is still fresh.
    const cachedTimestamp = cachedTimestampRef.current || 0;
    if (cachedTimestamp && Date.now() - cachedTimestamp < SYNC_INTERVAL_MS) {
      return;
    }

    // Otherwise do a fresh fetch on view/date change (leader or not for first load).
    const initialTimer = setTimeout(() => {
      fetchEvents(false);
    }, 300); // small debounce

    return () => clearTimeout(initialTimer);
  }, [isSignedIn, view, dateStr, calendarId, fetchEvents]);

  useEffect(() => {
    if (!isLeader || !isSignedIn) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Periodic sync — leader only
    timerRef.current = setInterval(() => {
      fetchEvents(true); // silent
    }, SYNC_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLeader, isSignedIn, fetchEvents]);

  // ── Cleanup ──

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Public API ──

  const fetchNow = useCallback(() => {
    fetchEvents(false);
  }, [fetchEvents]);

  return {
    events,
    loading,
    fetchNow,
    lastSync,
    isLeader,
    fetchError,
  };
}
