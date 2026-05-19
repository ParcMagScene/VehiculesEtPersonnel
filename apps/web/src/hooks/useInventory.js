import { useCallback, useEffect, useState } from 'react';

import api from '../utils/api';
import { loadFromIndexedDB, saveToIndexedDB, STORES } from '../utils/indexedDB';
import { refreshBus } from '../utils/refresh-bus';
import { useRefreshSubscription } from './useRefreshSubscription';

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

  // Auto-refresh quand le stock change ailleurs (impacte alertes/stats)
  useRefreshSubscription('stock', loadInventoryData);
  useRefreshSubscription('inventory', loadInventoryData);

  // ── Emplacements CRUD ──
  const createLocation = useCallback(
    async (data) => {
      const loc = await api.createInventoryLocation(data);
      setLocations((prev) => [...prev, loc]);
      refreshBus.publish('inventory');
      toast?.success('Emplacement créé');
      return loc;
    },
    [toast],
  );

  const updateLocation = useCallback(
    async (id, data) => {
      const loc = await api.updateInventoryLocation(id, data);
      setLocations((prev) => prev.map((l) => (l.id === id ? loc : l)));
      refreshBus.publish('inventory');
      toast?.success('Emplacement modifié');
      return loc;
    },
    [toast],
  );

  const deleteLocation = useCallback(
    async (id) => {
      await api.deleteInventoryLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
      refreshBus.publish('inventory');
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

  const exportPDF = useCallback(async () => {
    const [items, categories] = await Promise.all([
      api.getStockItems({ active_only: 'true' }),
      api.getStockCategories(),
    ]);

    const categoryById = new Map(categories.map((c) => [Number(c.id), c]));

    const resolveFamilyCategory = (item) => {
      const catId = Number(item.category_id);
      const cat = categoryById.get(catId);
      if (!cat) return { family: 'Non classé', category: 'Non classé' };

      if (cat.parent_id) {
        const parent = categoryById.get(Number(cat.parent_id));
        return {
          family: parent?.name || cat.parent_name || 'Non classé',
          category: cat.name || 'Non classé',
        };
      }

      return { family: cat.name || 'Non classé', category: 'Non classé' };
    };

    const typeLabels = {
      vente: 'Vente',
      sav: 'SAV',
      location: 'Location',
      prestation: 'Prestation',
      installation: 'Installation',
    };

    const groupedByReference = new Map();
    for (const item of items) {
      const reference = String(item.reference || '').trim();
      const key = reference || `__no_ref__${item.id}`;
      const { family, category } = resolveFamilyCategory(item);
      const type = typeLabels[item.stock_type] || item.stock_type || 'Non défini';
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      const row = groupedByReference.get(key);

      if (!row) {
        groupedByReference.set(key, {
          reference: reference || 'Sans référence',
          name: item.name || '',
          family,
          category,
          type,
          unit: item.unit || 'u',
          quantity,
          stockValue: quantity * unitPrice,
        });
        continue;
      }

      row.quantity += quantity;
      row.stockValue += quantity * unitPrice;
      if (!row.name && item.name) row.name = item.name;
      if (row.family !== family) row.family = 'Mixte';
      if (row.category !== category) row.category = 'Mixte';
      if (row.type !== type) row.type = 'Mixte';
      if (row.unit !== (item.unit || 'u')) row.unit = 'mixte';
    }

    const rows = Array.from(groupedByReference.values()).sort((a, b) => {
      const familyCmp = a.family.localeCompare(b.family, 'fr', { sensitivity: 'base' });
      if (familyCmp !== 0) return familyCmp;
      const categoryCmp = a.category.localeCompare(b.category, 'fr', { sensitivity: 'base' });
      if (categoryCmp !== 0) return categoryCmp;
      const typeCmp = a.type.localeCompare(b.type, 'fr', { sensitivity: 'base' });
      if (typeCmp !== 0) return typeCmp;
      return a.reference.localeCompare(b.reference, 'fr', { sensitivity: 'base' });
    });

    const [{ jsPDF }, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const autoTable = autoTableModule.default;

    const formatNumber = (value) =>
      Number(value || 0).toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });

    const formatCurrency = (value) =>
      Number(value || 0).toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
      });

    const today = new Date();
    const stamp = today.toISOString().slice(0, 10);
    const humanDate = today.toLocaleDateString('fr-FR');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text('Inventaire matériel — 1 ligne par référence', 14, 12);
    doc.setFontSize(9);
    doc.text(`Tri: Famille > Catégorie > Type | Généré le ${humanDate}`, 14, 18);

    autoTable(doc, {
      startY: 22,
      head: [
        [
          'Famille',
          'Catégorie',
          'Type',
          'Référence',
          'Désignation',
          'Qté',
          'Unité',
          'Valeur stock',
        ],
      ],
      body: rows.map((r) => [
        r.family,
        r.category,
        r.type,
        r.reference,
        r.name,
        formatNumber(r.quantity),
        r.unit,
        formatCurrency(r.stockValue),
      ]),
      styles: { fontSize: 8, cellPadding: 1.6, valign: 'middle' },
      headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 38 },
        2: { cellWidth: 24 },
        3: { cellWidth: 34 },
        4: { cellWidth: 72 },
        5: { halign: 'right', cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { halign: 'right', cellWidth: 30 },
      },
      didDrawPage: (data) => {
        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        const pageHeight = pageSize.getHeight();
        doc.setFontSize(8);
        doc.text(`Total références: ${rows.length}`, 14, pageHeight - 6);
        doc.text(`Page ${data.pageNumber}`, pageWidth - 24, pageHeight - 6);
      },
    });

    doc.save(`inventaire_${stamp}.pdf`);
    toast?.success('Export PDF inventaire téléchargé');
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
    exportPDF,
    exportJSON,
  };
}
