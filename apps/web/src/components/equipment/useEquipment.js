import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { findZone } from './equipmentUtils';
import { STATUS } from '../../constants';

export const useEquipment = ({ currentUser, initialTab }) => {
  const toast = useToast();
  const [subTab, setSubTab] = useState(initialTab || 'inventory');
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [savTickets, setSavTickets] = useState([]);
  const [persons, setPersons] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCatTree, setFilterCatTree] = useState('');
  const [savFilterStatus, setSavFilterStatus] = useState('_active');
  const [savSearch, setSavSearch] = useState('');

  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [showSavModal, setShowSavModal] = useState(false);
  const [editingSavTicket, setEditingSavTicket] = useState(null);
  const [savTicketEquipment, setSavTicketEquipment] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [dialogEquipment, setDialogEquipment] = useState(null);
  const clickTimerRef = useRef(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showSavImportModal, setShowSavImportModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [exportingSavPdf, setExportingSavPdf] = useState(false);
  const [showMobileSavRequest, setShowMobileSavRequest] = useState(false);
  const [labelPrintEquipment, setLabelPrintEquipment] = useState(null);
  const [mgmtTab, setMgmtTab] = useState('imports');

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [dialogTicket, setDialogTicket] = useState(null);
  const ticketClickTimerRef = useRef(null);

  const [photosList, setPhotosList] = useState([]);
  const [logosList, setLogosList] = useState([]);
  const [equipmentLists, setEquipmentLists] = useState([]);
  const [listFilter, setListFilter] = useState('');
  const [depotZones, setDepotZones] = useState(null);
  const [allDepotZones, setAllDepotZones] = useState(null);
  const [locationStats, setLocationStats] = useState(null);
  const [filterZone, setFilterZone] = useState('');
  const [filterSerialized, setFilterSerialized] = useState(false);
  const [showDepotMap, setShowDepotMap] = useState(false);
  const [depotMapModalZone, setDepotMapModalZone] = useState(null);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();

  const modalDepotData = useMemo(() => {
    const zoneId = depotMapModalZone?.zoneId;
    if (!zoneId) return null;
    if (allDepotZones?.depots) {
      for (const depot of allDepotZones.depots) {
        if (findZone(depot.zones, zoneId)) return depot;
      }
    }
    if (findZone(depotZones?.zones, zoneId)) return depotZones;
    return depotZones || allDepotZones?.depots?.[0] || null;
  }, [depotMapModalZone, depotZones, allDepotZones]);

  const isAdmin = currentUser?.isAdmin === true;
  const canManageEquipmentMaintenance =
    isAdmin || currentUser?.permissions?.canManageEquipmentMaintenance === true;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        eqData,
        catData,
        ticketData,
        persData,
        photosData,
        listsData,
        zonesData,
        locStatsData,
        allZonesData,
        brandsData,
      ] = await Promise.all([
        api.getEquipment(),
        api.getEquipmentCategories(),
        api.getSavTickets(),
        api.getPersons().catch(() => []),
        api.getEquipmentPhotos().catch(() => ({ photos: [], logos: [] })),
        api.getEquipmentLists().catch(() => []),
        api.getEquipmentDepotZones().catch(() => null),
        api.getEquipmentLocationStats().catch(() => null),
        api.getAllDepotZones().catch(() => null),
        api.getBrands().catch(() => []),
      ]);
      setEquipment(eqData);
      setCategories(catData);
      setSavTickets(ticketData);
      setPersons(persData);
      setPhotosList(photosData.photos || []);
      setLogosList(photosData.logos || []);
      setEquipmentLists(listsData);
      setDepotZones(zonesData);
      setLocationStats(locStatsData);
      setAllDepotZones(allZonesData);
      setBrandsList(brandsData || []);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement matériel:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const families = useMemo(() => categories.filter((c) => c.level === 'family'), [categories]);
  const subfamilies = useMemo(
    () => categories.filter((c) => c.level === 'subfamily'),
    [categories],
  );
  const leafCategories = useMemo(
    () => categories.filter((c) => c.level === 'category'),
    [categories],
  );

  const parsedCatFilter = useMemo(() => {
    if (!filterCatTree) return { type: null, id: null };
    const [type, idStr] = filterCatTree.split(':');
    return { type, id: parseInt(idStr) };
  }, [filterCatTree]);

  const favoriteIds = useMemo(
    () =>
      new Set(equipmentLists.filter((l) => l.list_type === 'favorite').map((l) => l.equipment_id)),
    [equipmentLists],
  );
  const watchIds = useMemo(
    () => new Set(equipmentLists.filter((l) => l.list_type === 'watch').map((l) => l.equipment_id)),
    [equipmentLists],
  );

  const filteredEquipment = useMemo(() => {
    return equipment.filter((eq) => {
      if (filterStatus && eq.status !== filterStatus) return false;
      if (filterSerialized && !(eq.serialNumber || eq.serial_number)) return false;
      if (filterZone) {
        if (filterZone === '_none') {
          if (eq.location_zone || eq.locationZone) return false;
        } else {
          if ((eq.location_zone || eq.locationZone) !== filterZone) return false;
        }
      }
      if (listFilter === 'favorite' && !favoriteIds.has(eq.id)) return false;
      if (listFilter === 'watch' && !watchIds.has(eq.id)) return false;
      const eqCatId = eq.categoryId || eq.category_id;
      if (parsedCatFilter.type === 'family') {
        const familyId = parsedCatFilter.id;
        const sfIds = subfamilies
          .filter((sf) => sf.parentId === familyId || sf.parent_id === familyId)
          .map((sf) => sf.id);
        const catIds = leafCategories
          .filter((c) => sfIds.includes(c.parentId || c.parent_id))
          .map((c) => c.id);
        const allValidIds = [familyId, ...sfIds, ...catIds];
        if (!allValidIds.includes(eqCatId)) return false;
      }
      if (parsedCatFilter.type === 'subfamily') {
        const sfId = parsedCatFilter.id;
        const catIds = leafCategories
          .filter((c) => (c.parentId || c.parent_id) === sfId)
          .map((c) => c.id);
        const allValidIds = [sfId, ...catIds];
        if (!allValidIds.includes(eqCatId)) return false;
      }
      if (parsedCatFilter.type === 'category' && eqCatId !== parsedCatFilter.id) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !eq.name?.toLowerCase().includes(s) &&
          !eq.reference?.toLowerCase().includes(s) &&
          !(eq.serialNumber || eq.serial_number || '').toLowerCase().includes(s) &&
          !eq.location?.toLowerCase().includes(s) &&
          !eq.brand?.toLowerCase().includes(s) &&
          !(eq.uid || '').toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [
    equipment,
    filterStatus,
    filterSerialized,
    filterZone,
    parsedCatFilter,
    search,
    subfamilies,
    leafCategories,
    listFilter,
    favoriteIds,
    watchIds,
  ]);

  const filteredTickets = useMemo(() => {
    return savTickets.filter((t) => {
      if (savFilterStatus === '_active' && (t.status === 'resolved' || t.status === 'closed'))
        return false;
      if (savFilterStatus && savFilterStatus !== '_active' && t.status !== savFilterStatus)
        return false;
      if (savSearch) {
        const s = savSearch.toLowerCase();
        const fields = [
          t.title,
          t.equipmentName,
          t.importName,
          t.equipmentReference,
          t.importCode,
          t.equipmentSerialNumber,
          t.importSerial,
          t.equipmentUid,
          t.description,
        ];
        if (!fields.some((f) => f && String(f).toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [savTickets, savFilterStatus, savSearch]);

  const stats = useMemo(
    () => ({
      total: equipment.length,
      available: equipment.filter((e) => e.status === 'available').length,
      in_use: equipment.filter((e) => e.status === 'in_use').length,
      maintenance: equipment.filter((e) => e.status === STATUS.MAINTENANCE).length,
      openTickets: savTickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed')
        .length,
    }),
    [equipment, savTickets],
  );

  const handleSaveEquipment = async (data) => {
    try {
      if (editingEquipment) {
        await api.updateEquipment(editingEquipment.id, data);
      } else {
        await api.createEquipment(data);
      }
      setShowEquipmentModal(false);
      setEditingEquipment(null);
      loadData();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleDeleteEquipment = (id) => {
    confirm({
      title: 'Supprimer l\u2019équipement',
      message: 'Supprimer cet équipement et tout son historique ?',
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        try {
          await api.deleteEquipment(id);
          setSelectedEquipment(null);
          setDialogEquipment(null);
          loadData();
        } catch (err) {
          toast.error('Erreur: ' + err.message);
        }
      },
    });
  };

  const handleSerializeEquipment = (eq) => {
    const qty = eq.stockQuantity || eq.stock_quantity || 1;
    if (eq.uid && qty <= 1) return toast.warning('Cet équipement possède déjà un UID.');
    const msg =
      qty > 1
        ? `Sérialiser "${eq.name}" en ${qty} entités individuelles ?\n\nChaque exemplaire recevra son propre UID (EMAG-XXXXX).\nL'article original sera remplacé par ${qty} fiches individuelles.`
        : `Attribuer un UID unique (EMAG-XXXXX) à "${eq.name}" ?`;
    confirm({
      title: 'Sérialisation',
      message: msg,
      confirmLabel: 'Sérialiser',
      onConfirm: async () => {
        try {
          const result = await api.serializeEquipment(eq.id);
          toast.success(`${result.message} — UID : ${result.created.map((c) => c.uid).join(', ')}`);
          setSelectedEquipment(null);
          setDialogEquipment(null);
          loadData();
        } catch (err) {
          toast.error('Erreur sérialisation: ' + err.message);
        }
      },
    });
  };

  const handleSaveSavTicket = async (data) => {
    try {
      if (editingSavTicket) {
        await api.updateSavTicket(editingSavTicket.id, data);
      } else {
        await api.createSavTicket(data);
      }
      setShowSavModal(false);
      setEditingSavTicket(null);
      loadData();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const toggleList = async (equipmentId, listType) => {
    try {
      const set = listType === 'favorite' ? favoriteIds : watchIds;
      if (set.has(equipmentId)) {
        await api.removeFromEquipmentList(equipmentId, listType);
      } else {
        await api.addToEquipmentList(equipmentId, listType);
      }
      const listsData = await api.getEquipmentLists().catch(() => []);
      setEquipmentLists(listsData);
    } catch (err) {
      console.error('Erreur toggle liste:', err);
    }
  };

  const handleExportSavPdf = async () => {
    setExportingSavPdf(true);
    try {
      const blob = await api.exportSavActivePdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `materiel-en-sav-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export PDF SAV:', err);
    } finally {
      setExportingSavPdf(false);
    }
  };

  return {
    // Data
    equipment,
    categories,
    savTickets,
    persons,
    brandsList,
    loading,
    photosList,
    logosList,
    equipmentLists,
    depotZones,
    allDepotZones,
    locationStats,
    // Category hierarchy
    families,
    subfamilies,
    leafCategories,
    // Filtered
    filteredEquipment,
    filteredTickets,
    stats,
    favoriteIds,
    watchIds,
    // Tabs
    subTab,
    setSubTab,
    // Filters
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterCatTree,
    setFilterCatTree,
    savFilterStatus,
    setSavFilterStatus,
    savSearch,
    setSavSearch,
    filterZone,
    setFilterZone,
    filterSerialized,
    setFilterSerialized,
    listFilter,
    setListFilter,
    // Equipment modals
    showEquipmentModal,
    setShowEquipmentModal,
    editingEquipment,
    setEditingEquipment,
    selectedEquipment,
    setSelectedEquipment,
    dialogEquipment,
    setDialogEquipment,
    clickTimerRef,
    // SAV modals
    showSavModal,
    setShowSavModal,
    editingSavTicket,
    setEditingSavTicket,
    savTicketEquipment,
    setSavTicketEquipment,
    selectedTicket,
    setSelectedTicket,
    dialogTicket,
    setDialogTicket,
    ticketClickTimerRef,
    // Other modals
    showImportModal,
    setShowImportModal,
    showSavImportModal,
    setShowSavImportModal,
    showReportModal,
    setShowReportModal,
    exportingSavPdf,
    showMobileSavRequest,
    setShowMobileSavRequest,
    labelPrintEquipment,
    setLabelPrintEquipment,
    mgmtTab,
    setMgmtTab,
    // Depot map
    showDepotMap,
    setShowDepotMap,
    depotMapModalZone,
    setDepotMapModalZone,
    modalDepotData,
    // Permissions
    isAdmin,
    canManageEquipmentMaintenance,
    // Handlers
    loadData,
    handleSaveEquipment,
    handleDeleteEquipment,
    handleSerializeEquipment,
    handleSaveSavTicket,
    toggleList,
    handleExportSavPdf,
    // Confirm dialog
    confirm,
    ConfirmDialogRenderer,
  };
};
