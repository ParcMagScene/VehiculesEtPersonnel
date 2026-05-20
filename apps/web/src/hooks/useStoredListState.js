/**
 * useStoredListState
 * ------------------
 * Hook style `useState` qui persiste sa valeur dans sessionStorage (par défaut)
 * ou localStorage. Conçu pour mémoriser filtres / tri / pagination des listes
 * principales entre les recharges d'onglet sans polluer l'URL.
 *
 * Usage typique :
 *
 *   const [filters, setFilters] = useStoredListState('affaires:filters', {
 *     search: '', type: 'all', dateStart: null, dateEnd: null,
 *   });
 *
 * Conventions de clé : `<module>:<topic>` (ex: 'equipment:sort', 'annuaire:page').
 *
 * Notes :
 * - L'écriture est synchrone (pas de debounce) : à utiliser pour des objets compacts.
 * - Storage corrompu (JSON invalide) → retour silencieux à `defaultValue`.
 * - Mode privé / quota plein → setItem ignoré (try/catch silencieux).
 * - Pas de synchronisation entre onglets (pas d'écoute `storage` event) : on veut
 *   que chaque onglet ait ses propres filtres.
 */

import { useCallback, useRef, useState } from 'react';

const SUPPORTED_BACKENDS = ['session', 'local'];

function pickStorage(backend) {
  if (typeof window === 'undefined') return null;
  try {
    return backend === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readInitial(storage, key, defaultValue) {
  if (!storage) return defaultValue;
  try {
    const raw = storage.getItem(key);
    if (raw == null) return defaultValue;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return defaultValue;
  }
}

/**
 * @template T
 * @param {string} key - Clé de stockage (convention `module:topic`).
 * @param {T} defaultValue - Valeur initiale si rien en storage.
 * @param {object} [options]
 * @param {'session' | 'local'} [options.backend='session'] - Storage cible.
 * @returns {[T, (next: T | ((prev: T) => T)) => void, () => void]}
 *   [value, setValue, reset]
 */
export function useStoredListState(key, defaultValue, options = {}) {
  const backend = SUPPORTED_BACKENDS.includes(options.backend) ? options.backend : 'session';
  const storageRef = useRef(pickStorage(backend));
  const defaultRef = useRef(defaultValue);

  const [value, setValue] = useState(() =>
    readInitial(storageRef.current, key, defaultRef.current),
  );

  const persist = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (storageRef.current) {
          try {
            storageRef.current.setItem(key, JSON.stringify(resolved));
          } catch {
            /* quota / private mode : ignoré */
          }
        }
        return resolved;
      });
    },
    [key],
  );

  const reset = useCallback(() => {
    if (storageRef.current) {
      try {
        storageRef.current.removeItem(key);
      } catch {
        /* ignoré */
      }
    }
    setValue(defaultRef.current);
  }, [key]);

  return [value, persist, reset];
}

export default useStoredListState;
