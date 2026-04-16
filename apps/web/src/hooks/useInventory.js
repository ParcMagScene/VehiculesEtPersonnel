import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { saveToIndexedDB, loadFromIndexedDB, STORES } from '../utils/indexedDB';

/**
 * Hook centralisant les données du module Inventaire :
 * emplacements, alertes, anomalies, stats globales, classification ABC.
 */
export function useInventory({ isAuthenticated, toast }) {
  const [locations, setLocations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Chargement initial ──
  const loadInventoryData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const [loc, al, an, st] = await Promise.all([
        api.getInventoryLocations(),
        api.getInventoryAlerts(),
        api.getInventoryAnomalies({ status: 'open' }),
        api.getInventoryStats(),
      ]);
      setLocations(loc);
      setAlerts(al);
      setAnomalies(an);
      setStats(st);
      // Persist offline
      saveToIndexedDB(STORES.inventoryLocations, loc).catch(() => {});
      saveToIndexedDB(STORES.inventoryAlerts, al).catch(() => {});
      saveToIndexedDB(STORES.inventoryAnomalies, an).catch(() => {});
    } catch (err) {
      console.error('useInventory load error:', err);
      // Fallback offline
      try {
        const [loc, al, an] = await Promise.all([
          loadFromIndexedDB(STORES.inventoryLocations, []),
          loadFromIndexedDB(STORES.inventoryAlerts, []),
          loadFromIndexedDB(STORES.inventoryAnomalies, []),
        ]);
        setLocations(loc);
        setAlerts(al);
        setAnomalies(an);
      } catch {
        /* ignore */
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  // ── Emplacements CRUD ──
  const createLocation = useCallback(
    async (data) => {
      const loc = await api.createInventoryLocation(data);
      setLocations((prev) => [...prev, loc]);
      toast?.success('Emplacement créé');
      return loc;
    },
    [toast],
  );

  const updateLocation = useCallback(
    async (id, data) => {
      const loc = await api.updateInventoryLocation(id, data);
      setLocations((prev) => prev.map((l) => (l.id === id ? loc : l)));
      toast?.success('Emplacement modifié');
      return loc;
    },
    [toast],
  );

  const deleteLocation = useCallback(
    async (id) => {
      await api.deleteInventoryLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
      toast?.success('Emplacement supprimé');
    },
    [toast],
  );

  // ── Prix ──
  const getPriceHistory = useCallback(async (itemId) => {
    return api.getItemPriceHistory(itemId);
  }, []);

  const addPrice = useCallback(async (data) => {
    return api.addItemPrice(data);
  }, []);

  const getPriceAnalysis = useCallback(async (itemId) => {
    return api.getPriceAnalysis(itemId);
  }, []);

  const fusionPrices = useCallback(async (itemId, prices) => {
    return api.fusionPrices(itemId, prices);
  }, []);

  // ── Anomalies ──
  const detectAnomalies = useCallback(async () => {
    const result = await api.detectAnomalies();
    // Recharger la liste
    const an = await api.getInventoryAnomalies({ status: 'open' });
    setAnomalies(an);
    toast?.info(`${result.detected_count} anomalie(s) détectée(s)`);
    return result;
  }, [toast]);

  const resolveAnomaly = useCallback(
    async (id, status) => {
      await api.updateAnomaly(id, { status });
      setAnomalies((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      toast?.success('Anomalie mise à jour');
    },
    [toast],
  );

  // ── Comptage inventaire ──
  const submitCount = useCallback(
    async (items) => {
      const result = await api.submitInventoryCount(items);
      // Recharger alertes & stats après comptage
      const [al, st] = await Promise.all([api.getInventoryAlerts(), api.getInventoryStats()]);
      setAlerts(al);
      setStats(st);
      toast?.success(`${result.counted} article(s) comptés, ${result.adjustments} ajustement(s)`);
      return result;
    },
    [toast],
  );

  // ── Classification ABC ──
  const runAbcClassification = useCallback(async () => {
    const result = await api.runAbcClassification();
    toast?.success(
      `Classification ABC: A=${result.distribution.A}, B=${result.distribution.B}, C=${result.distribution.C}`,
    );
    return result;
  }, [toast]);

  // ── Stats refresh ──
  const refreshStats = useCallback(async () => {
    await api.refreshInventoryStats();
    const st = await api.getInventoryStats();
    setStats(st);
  }, []);

  // ── Exports ──
  const exportCSV = useCallback(async () => {
    const blob = await api.exportInventoryCSV();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaire_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast?.success('Export CSV téléchargé');
  }, [toast]);

  const exportJSON = useCallback(async () => {
    const data = await api.exportInventoryJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaire_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast?.success('Export JSON téléchargé');
  }, [toast]);

  return {
    // State
    locations,
    alerts,
    anomalies,
    stats,
    isLoading,
    // Actions
    reload: loadInventoryData,
    createLocation,
    updateLocation,
    deleteLocation,
    getPriceHistory,
    addPrice,
    getPriceAnalysis,
    fusionPrices,
    detectAnomalies,
    resolveAnomaly,
    submitCount,
    runAbcClassification,
    refreshStats,
    exportCSV,
    exportJSON,
  };
}
