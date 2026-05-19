import { useCallback, useEffect, useRef, useState } from 'react';

import { refreshBus } from '../utils/refresh-bus';

/**
 * useListResource
 * ---------------
 * Hook générique qui combine les 3 patterns récurrents d'une liste pilotée
 * par le `refreshBus` :
 *
 *  1. État `data / loading / error` standardisé.
 *  2. Chargement initial (et reload manuel via la fonction retournée).
 *  3. Abonnement automatique à une ou plusieurs clés du bus.
 *
 * Le `fetcher` doit être mémoïsé par l'appelant (`useCallback`) ; le hook
 * relance le chargement uniquement quand sa référence change. Les erreurs
 * (rejet ou retour `{success:false}` à charge de l'appelant) sont capturées
 * dans `error` ; `data` n'est pas réinitialisé pour permettre l'affichage
 * du contenu précédent en cas d'erreur réseau ponctuelle.
 *
 * @template T
 * @param {string|string[]}    keys              Clé(s) bus à écouter.
 * @param {() => Promise<T>}   fetcher           Fonction de chargement.
 * @param {Object}             [options]
 * @param {T}                  [options.initialData=null]  Donnée initiale.
 * @param {boolean}            [options.autoLoad=true]     Charge au montage.
 * @param {boolean}            [options.enabled=true]      Skippe load et bus si false.
 * @returns {{ data: T, loading: boolean, error: Error|null, reload: () => Promise<void> }}
 */
export function useListResource(keys, fetcher, options = {}) {
  const { initialData = null, autoLoad = true, enabled = true } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled && autoLoad);
  const [error, setError] = useState(null);

  // Garde anti-race : ignore une réponse périmée si un reload plus récent est parti.
  const reqIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const result = await fetcher();
      if (reqId !== reqIdRef.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [enabled, fetcher]);

  useEffect(() => {
    if (enabled && autoLoad) void reload();
  }, [enabled, autoLoad, reload]);

  useEffect(() => {
    if (!enabled) return undefined;
    const list = Array.isArray(keys) ? keys : [keys];
    const unsubs = list.filter(Boolean).map((k) => refreshBus.subscribe(k, reload));
    return () => unsubs.forEach((u) => u());
  }, [enabled, keys, reload]);

  return { data, loading, error, reload };
}

export default useListResource;
