/**
 * useDraftStorage
 * ---------------
 * Hook spécialisé pour les **brouillons de formulaire mobiles**.
 *
 * Construit au-dessus de `useStoredListState` (backend sessionStorage par défaut),
 * il ajoute :
 *   - un TTL optionnel (défaut 24 h) pour éviter les drafts fantômes
 *   - une API `clear()` / `commit()` sémantique pour la soumission
 *   - un drapeau `isDirty` (le draft diffère de l'initial)
 *
 * Pourquoi sessionStorage ? Les brouillons NE DOIVENT PAS survivre à un
 * changement d'utilisateur sur le même appareil (cf. AUDIT-MOBILE-PERSISTENCE
 * §7) — sessionStorage = onglet uniquement, purgé au logout via softReload.
 *
 * Convention de clé : `mobile:<screen>:draft` ou `mobile:<screen>:<sub>:draft`.
 *
 * Usage :
 *   const [form, setForm, draft] = useDraftStorage(
 *     'mobile:reservations:draft',
 *     { vehicleId: null, start: '', end: '' }
 *   );
 *   // ... onSubmit success :
 *   draft.commit();
 *
 * Notes :
 * - Si la clé est `null` / vide, le hook se comporte comme un useState classique
 *   sans persistance (utile pour les écrans où la clé dépend d'un ID encore null).
 * - Mode privé / quota plein : fallback silencieux (try/catch interne).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readDraft(storage, key, initial, ttlMs) {
  if (!storage || !key) return initial;
  try {
    const raw = storage.getItem(key);
    if (raw == null) return initial;
    const parsed = JSON.parse(raw);
    // Compat ancienne forme (valeur brute sans wrapper) → traiter comme initial
    if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) {
      return initial;
    }
    if (ttlMs && parsed.savedAt && Date.now() - parsed.savedAt > ttlMs) {
      // Draft expiré → nettoyer et revenir à l'initial
      try {
        storage.removeItem(key);
      } catch {
        /* ignore */
      }
      return initial;
    }
    return parsed.value;
  } catch {
    return initial;
  }
}

function writeDraft(storage, key, value) {
  if (!storage || !key) return;
  try {
    storage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    /* quota / privé : ignoré */
  }
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/**
 * @template T
 * @param {string | null} key - Clé sessionStorage (`null` → désactive la persistance).
 * @param {T} initial - Valeur initiale du brouillon.
 * @param {object} [options]
 * @param {number} [options.ttlMs] - Durée de vie du draft en ms (défaut 24 h).
 * @returns {[T, (next: T | ((prev: T) => T)) => void, {
 *   clear: () => void,
 *   commit: () => void,
 *   isDirty: boolean,
 * }]}
 */
export function useDraftStorage(key, initial, options = {}) {
  const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : DEFAULT_TTL_MS;
  const storageRef = useRef(getStorage());
  const initialRef = useRef(initial);

  const [value, setValueState] = useState(() =>
    readDraft(storageRef.current, key, initialRef.current, ttlMs),
  );

  // Si la clé change (ex: brouillon par UID / par conversation), on relit le
  // storage pour la nouvelle clé. Compatible avec les usages à clé statique :
  // l'effect ne déclenche qu'un re-set idempotent au premier mount.
  const lastKeyRef = useRef(key);
  useEffect(() => {
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setValueState(readDraft(storageRef.current, key, initialRef.current, ttlMs));
  }, [key, ttlMs]);

  const setValue = useCallback(
    (next) => {
      setValueState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        writeDraft(storageRef.current, key, resolved);
        return resolved;
      });
    },
    [key],
  );

  const clear = useCallback(() => {
    if (storageRef.current && key) {
      try {
        storageRef.current.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    setValueState(initialRef.current);
  }, [key]);

  // commit = alias sémantique de clear (à appeler après submit OK)
  const commit = clear;

  const isDirty = useMemo(() => !shallowEqual(value, initialRef.current), [value]);

  const controls = useMemo(
    () => ({ clear, commit, isDirty }),
    [clear, commit, isDirty],
  );

  return [value, setValue, controls];
}

export default useDraftStorage;
