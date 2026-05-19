import './EquipmentPanel.css';

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Hash,
  Image as ImageIcon,
  Map,
  MapPin,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Star,
  Tag,
  Upload,
  Wrench,
  Zap,
} from 'lucide-react';
import React, { lazy, Suspense } from 'react';

import {
  Button,
  Checkbox,
  Modal,
  ModalBody,
  ModalHeader,
  ModalLayout,
  SearchBar,
  Select,
  Spinner,
  Tooltip,
} from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import SavImportModal from '../sav/SAVManagerModal';
import DepotMap from '../vehicles/DepotMap';
import DepotMapFocused from '../vehicles/DepotMapFocused';
import MaintenanceReportModal from '../vehicles/MaintenanceReportModal';
import CategoryCascadeFilter from './CategoryCascadeFilter';
import EquipmentBatchLabels from './EquipmentBatchLabels';
import EquipmentCategoriesTree from './EquipmentCategoriesTree';
import { SAV_STATUS } from './equipmentConstants';
import { EquipmentDetailDialog, EquipmentSlidePanel } from './EquipmentDetail';
import EquipmentFormModal from './EquipmentFormModal';
import EquipmentGrid from './EquipmentGrid';
import EquipmentImportModal from './EquipmentImportModal';
import LabelsPrintPanel from './LabelsPrintPanel';
const LocmatImportModal = lazy(() => import('./import/LocmatImportModal.jsx'));
import EquipmentLabelPrint from './EquipmentLabelPrint';
import EquipmentMediaManager from './EquipmentMediaManager';
import {
  MobileSavRequestForm,
  SavDetailDialog,
  SavSlidePanel,
  SavTicketFormModal,
  SavTicketsList,
} from './EquipmentSAV';
import { printEquipmentSheet } from './EquipmentSheetPrint';
import { useEquipment } from './useEquipment';

// ═══ COMPOSANT PRINCIPAL ═══
const EquipmentPanel = ({
  currentUser,
  showManagement,
  onOpenManagement,
  onCloseManagement,
  initialTab,
  isMobile,
}) => {
  const toast = useToast();
  const [exportFamilyId, setExportFamilyId] = React.useState('');
  const [showLocmatImport, setShowLocmatImport] = React.useState(false);
  const [backfillingRefs, setBackfillingRefs] = React.useState(false);
  const {
    // Data
    equipment,
    categories,
    savTickets: _savTickets,
    persons,
    brandsList,
    loading,
    photosList,
    logosList,
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
    exportingEquipmentInventoryPdf,
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
    handleExportEquipmentInventoryPdf,
    // Confirm dialog
    confirm,
    ConfirmDialogRenderer,
  } = useEquipment({ currentUser, initialTab });

  // ═══ RENDU ═══
  if (loading && equipment.length === 0) {
    return (
      <div className="eq-loading">
        <Spinner size="lg" /> Chargement du parc matériel...
      </div>
    );
  }

  return (
    <div className="equipment-panel">
      {/* Toolbar unifiée : onglets + filtres + actions */}
      <div className="eq-toolbar">
        <div className="eq-toolbar-top">
          <div className="eq-tabs">
            <Button
              variant="ghost"
              className={`eq-tab ${subTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setSubTab('inventory')}
            >
              <Package size={14} /> Équipements
            </Button>
            <Button
              variant="ghost"
              className={`eq-tab ${subTab === 'sav' ? 'active' : ''}`}
              onClick={() => setSubTab('sav')}
            >
              <Wrench size={14} /> SAV
              {stats.openTickets > 0 && <span className="eq-tab-badge">{stats.openTickets}</span>}
            </Button>
          </div>
          {onOpenManagement && (
            <Button
              variant="ghost"
              className="eq-management-btn"
              onClick={onOpenManagement}
              aria-label="Ouvrir la gestion du matériel"
            >
              <Package size={16} /> Gestion
            </Button>
          )}
        </div>

        <div className="eq-toolbar-actions">
          {subTab === 'inventory' && (
            <div className="eq-toolbar-primary-actions">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Rechercher..."
                size="sm"
              />
              <CategoryCascadeFilter
                families={families}
                subfamilies={subfamilies}
                leafCategories={leafCategories}
                value={filterCatTree}
                onChange={setFilterCatTree}
                isMobile={isMobile}
              />
              <Tooltip content="Afficher uniquement les matériels sérialisés" position="bottom">
                <label className="eq-filter-check">
                  <Checkbox
                    checked={filterSerialized}
                    onChange={(e) => setFilterSerialized(e.target.checked)}
                  />
                  <span>Sérialisés</span>
                </label>
              </Tooltip>
              {depotZones && (
                <Select
                  className="eq-filter eq-zone-filter"
                  value={filterZone}
                  onChange={(e) => setFilterZone(e.target.value)}
                  title="Filtrer par zone dépôt"
                >
                  <option value="">Toutes zones</option>
                  <option value="_none">📍 Sans zone</option>
                  {allDepotZones?.depots
                    ? allDepotZones.depots.map((d) => (
                        <optgroup key={d.id} label={d.name || `Dépôt ${d.id}`}>
                          {d.zones.map((z) => (
                            <option key={`${d.id}-${z.id}`} value={z.id}>
                              📍 {z.label}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    : depotZones.zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          📍 {z.label}
                        </option>
                      ))}
                </Select>
              )}
              {depotZones && (
                <Tooltip content="Plan du dépôt" position="bottom">
                  <Button
                    variant="secondary"
                    className={showDepotMap ? 'active' : ''}
                    onClick={() => setShowDepotMap(!showDepotMap)}
                  >
                    <Map size={14} />
                  </Button>
                </Tooltip>
              )}
              <Button
                variant="primary"
                onClick={() => {
                  setEditingEquipment(null);
                  setShowEquipmentModal(true);
                }}
              >
                <Plus size={14} /> Équipement
              </Button>
            </div>
          )}
          {subTab === 'sav' && (
            <div className="eq-toolbar-primary-actions">
              <SearchBar
                value={savSearch}
                onChange={setSavSearch}
                placeholder="Rechercher ticket, matériel..."
                size="sm"
              />
              {isAdmin && (
                <Tooltip content="Importer interventions SAV" position="bottom">
                  <Button variant="secondary" onClick={() => setShowSavImportModal(true)}>
                    <Upload size={14} /> Import SAV
                  </Button>
                </Tooltip>
              )}
              {canManageEquipmentMaintenance && (
                <Tooltip content="Rapport maintenance matériel" position="bottom">
                  <Button variant="secondary" onClick={() => setShowReportModal(true)}>
                    <FileText size={14} /> Rapport
                  </Button>
                </Tooltip>
              )}
              {canManageEquipmentMaintenance && (
                <Tooltip content="Exporter PDF du matériel en SAV" position="bottom">
                  <Button
                    variant="secondary"
                    onClick={handleExportSavPdf}
                    disabled={exportingSavPdf}
                  >
                    <Download size={14} /> {exportingSavPdf ? 'Export...' : 'PDF SAV'}
                  </Button>
                </Tooltip>
              )}
              <Select
                className="eq-filter"
                value={savFilterStatus}
                onChange={(e) => setSavFilterStatus(e.target.value)}
              >
                <option value="_active">En cours (actifs)</option>
                <option value="">Tous statuts</option>
                {Object.entries(SAV_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
              {canManageEquipmentMaintenance && !isMobile && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setSavTicketEquipment(null);
                    setEditingSavTicket(null);
                    setShowSavModal(true);
                  }}
                >
                  <Plus size={14} /> Ticket SAV
                </Button>
              )}
              {isMobile && canManageEquipmentMaintenance && (
                <Button
                  variant="primary"
                  className="eq-mobile-sav-request"
                  onClick={() => {
                    setSavTicketEquipment(null);
                    setEditingSavTicket(null);
                    setShowSavModal(true);
                  }}
                >
                  <Plus size={14} /> Ticket SAV
                </Button>
              )}
              {isMobile && !canManageEquipmentMaintenance && (
                <Button
                  variant="primary"
                  className="eq-mobile-sav-request"
                  onClick={() => setShowMobileSavRequest(true)}
                >
                  <Plus size={14} /> Demande SAV
                </Button>
              )}
            </div>
          )}
          <div className="eq-stats-row">
            <Tooltip content="Tous" position="bottom">
              <Button
                variant="ghost"
                className={`eq-stat-btn ${filterStatus === '' && subTab === 'inventory' && listFilter === '' ? 'active' : ''}`}
                onClick={() => {
                  setFilterStatus('');
                  setListFilter('');
                  setSubTab('inventory');
                }}
              >
                <Package size={13} />
                <span className="eq-stat-value">{stats.total}</span>
              </Button>
            </Tooltip>
            <Tooltip content="Disponibles" position="bottom">
              <Button
                variant="ghost"
                className={`eq-stat-btn eq-stat-available ${filterStatus === 'available' ? 'active' : ''}`}
                onClick={() => {
                  setFilterStatus('available');
                  setListFilter('');
                  setSubTab('inventory');
                }}
              >
                <CheckCircle size={13} />
                <span className="eq-stat-value">{stats.available}</span>
              </Button>
            </Tooltip>
            <Tooltip content="En service" position="bottom">
              <Button
                variant="ghost"
                className={`eq-stat-btn eq-stat-inuse ${filterStatus === 'in_use' ? 'active' : ''}`}
                onClick={() => {
                  setFilterStatus('in_use');
                  setListFilter('');
                  setSubTab('inventory');
                }}
              >
                <Clock size={13} />
                <span className="eq-stat-value">{stats.in_use}</span>
              </Button>
            </Tooltip>
            <Tooltip content="Maintenance" position="bottom">
              <Button
                variant="ghost"
                className={`eq-stat-btn eq-stat-maint ${filterStatus === STATUS.MAINTENANCE ? 'active' : ''}`}
                onClick={() => {
                  setFilterStatus('maintenance');
                  setListFilter('');
                  setSubTab('inventory');
                }}
              >
                <Wrench size={13} />
                <span className="eq-stat-value">{stats.maintenance}</span>
              </Button>
            </Tooltip>
            {stats.openTickets > 0 && (
              <Tooltip content="Tickets SAV" position="bottom">
                <Button
                  variant="ghost"
                  className={`eq-stat-btn eq-stat-tickets ${subTab === 'sav' ? 'active' : ''}`}
                  onClick={() => {
                    setSavFilterStatus('_active');
                    setSubTab('sav');
                  }}
                >
                  <AlertTriangle size={13} />
                  <span className="eq-stat-value">{stats.openTickets}</span>
                </Button>
              </Tooltip>
            )}
            {favoriteIds.size > 0 && (
              <Tooltip content="Favoris" position="bottom">
                <Button
                  variant="ghost"
                  className={`eq-stat-btn eq-stat-fav ${listFilter === 'favorite' ? 'active' : ''}`}
                  onClick={() => {
                    setListFilter(listFilter === 'favorite' ? '' : 'favorite');
                    setSubTab('inventory');
                  }}
                >
                  <Star size={13} />
                  <span className="eq-stat-value">{favoriteIds.size}</span>
                </Button>
              </Tooltip>
            )}
            {watchIds.size > 0 && (
              <Tooltip content="Surveillance" position="bottom">
                <Button
                  variant="ghost"
                  className={`eq-stat-btn eq-stat-watch ${listFilter === 'watch' ? 'active' : ''}`}
                  onClick={() => {
                    setListFilter(listFilter === 'watch' ? '' : 'watch');
                    setSubTab('inventory');
                  }}
                >
                  <Eye size={13} />
                  <span className="eq-stat-value">{watchIds.size}</span>
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="eq-content-wrapper">
        <div className="eq-content-inner">
          {/* Plan du dépôt */}
          {showDepotMap && depotZones && subTab === 'inventory' && (
            <div className="eq-depot-map-wrapper">
              <DepotMap
                zones={depotZones}
                stats={locationStats}
                selectedZone={filterZone && filterZone !== '_none' ? filterZone : null}
                onZoneSelect={(zoneId) => setFilterZone(filterZone === zoneId ? '' : zoneId)}
                onZoneFilter={(zoneId) => setFilterZone(zoneId || '')}
                onZonesUpdated={loadData}
              />
            </div>
          )}
          <div className="eq-content">
            {subTab === 'inventory' && (
              <EquipmentGrid
                equipment={filteredEquipment}
                depotZones={depotZones}
                allDepotZones={allDepotZones}
                selectedId={selectedEquipment?.id}
                photosList={photosList}
                logosList={logosList}
                favoriteIds={favoriteIds}
                watchIds={watchIds}
                onToggleList={toggleList}
                categories={categories}
                onOpenDepotMap={(zoneId, eqName) =>
                  setDepotMapModalZone({ zoneId, equipmentName: eqName })
                }
                onSelect={(eq) => {
                  clearTimeout(clickTimerRef.current);
                  if (isMobile) {
                    setDialogEquipment(eq);
                    api
                      .getEquipmentById(eq.id)
                      .then((detail) => setDialogEquipment(detail))
                      .catch(() => {});
                  } else {
                    clickTimerRef.current = setTimeout(() => {
                      if (selectedEquipment?.id === eq.id) {
                        setSelectedEquipment(null);
                      } else {
                        setSelectedEquipment(eq);
                        api
                          .getEquipmentById(eq.id)
                          .then((detail) => setSelectedEquipment(detail))
                          .catch(() => {});
                      }
                    }, 200);
                  }
                }}
                onDoubleClick={(eq) => {
                  clearTimeout(clickTimerRef.current);
                  setSelectedEquipment(null);
                  setDialogEquipment(eq);
                  api
                    .getEquipmentById(eq.id)
                    .then((detail) => setDialogEquipment(detail))
                    .catch(() => {});
                }}
              />
            )}

            {subTab === 'sav' && (
              <SavTicketsList
                tickets={filteredTickets}
                equipment={equipment}
                persons={persons}
                selectedId={selectedTicket?.id}
                onSelect={(t) => {
                  clearTimeout(ticketClickTimerRef.current);
                  if (isMobile) {
                    setDialogTicket(t);
                  } else {
                    ticketClickTimerRef.current = setTimeout(() => {
                      setSelectedTicket(selectedTicket?.id === t.id ? null : t);
                    }, 200);
                  }
                }}
                onDoubleClick={(t) => {
                  clearTimeout(ticketClickTimerRef.current);
                  setSelectedTicket(null);
                  setDialogTicket(t);
                }}
                onEdit={(t) => {
                  setEditingSavTicket(t);
                  setShowSavModal(true);
                }}
                onDelete={(id) => {
                  confirm({
                    title: 'Supprimer le ticket',
                    message: 'Supprimer ce ticket ?',
                    variant: 'danger',
                    confirmLabel: 'Supprimer',
                    onConfirm: async () => {
                      try {
                        await api.deleteSavTicket(id);
                        refreshBus.publish('sav');
                        loadData();
                      } catch (err) {
                        toast.error('Erreur: ' + err.message);
                      }
                    },
                  });
                }}
              />
            )}
          </div>
        </div>

        {/* Volet de détail rapide – Matériel (clic simple) */}
        {subTab === 'inventory' && !dialogEquipment && (
          <EquipmentSlidePanel
            equipment={selectedEquipment}
            categories={categories}
            persons={persons}
            photosList={photosList}
            logosList={logosList}
            favoriteIds={favoriteIds}
            watchIds={watchIds}
            onToggleList={toggleList}
            onClose={() => setSelectedEquipment(null)}
            onOpenDialog={(eq) => {
              setSelectedEquipment(null);
              setDialogEquipment(eq);
            }}
            onEdit={(eq) => {
              setEditingEquipment(eq);
              setShowEquipmentModal(true);
            }}
            onPrintLabel={(eq) => setLabelPrintEquipment(eq)}
            onPrintSheet={(eq) => printEquipmentSheet(eq, photosList, logosList)}
            isAdmin={isAdmin}
            onOpenDepotMap={(zoneId, eqName) =>
              setDepotMapModalZone({ zoneId, equipmentName: eqName })
            }
          />
        )}

        {/* Volet de détail rapide – SAV (clic simple) */}
        {subTab === 'sav' && !dialogTicket && !dialogEquipment && (
          <SavSlidePanel
            ticket={selectedTicket}
            equipment={equipment}
            persons={persons}
            onClose={() => setSelectedTicket(null)}
            onEdit={(t) => {
              setEditingSavTicket(t);
              setShowSavModal(true);
            }}
            onDelete={(id) => {
              confirm({
                title: 'Supprimer le ticket',
                message: 'Supprimer ce ticket ?',
                variant: 'danger',
                confirmLabel: 'Supprimer',
                onConfirm: async () => {
                  try {
                    await api.deleteSavTicket(id);
                    setSelectedTicket(null);
                    refreshBus.publish('sav');
                    loadData();
                  } catch (err) {
                    toast.error('Erreur: ' + err.message);
                  }
                },
              });
            }}
            onOpenDialog={(t) => {
              setSelectedTicket(null);
              setDialogTicket(t);
            }}
            onOpenEquipmentDialog={(eq) => {
              setSelectedTicket(null);
              setDialogEquipment(eq);
            }}
          />
        )}
      </div>

      {/* Dialog détail complet (double-clic) */}
      <EquipmentDetailDialog
        equipment={dialogEquipment}
        categories={categories}
        persons={persons}
        photosList={photosList}
        logosList={logosList}
        favoriteIds={favoriteIds}
        watchIds={watchIds}
        onToggleList={toggleList}
        isAdmin={isAdmin}
        onClose={() => setDialogEquipment(null)}
        onEdit={(eq) => {
          setEditingEquipment(eq);
          setShowEquipmentModal(true);
        }}
        onDelete={handleDeleteEquipment}
        onCreateTicket={(eq) => {
          setSavTicketEquipment(eq);
          setEditingSavTicket(null);
          setShowSavModal(true);
        }}
        onRefresh={loadData}
        onOpenTicketDialog={(t) => {
          setDialogEquipment(null);
          setDialogTicket(t);
        }}
        onPrintLabel={isMobile ? undefined : (eq) => setLabelPrintEquipment(eq)}
        onPrintSheet={isMobile ? undefined : (eq) => printEquipmentSheet(eq, photosList, logosList)}
        onSerialize={handleSerializeEquipment}
        onOpenDepotMap={(zoneId, eqName) => setDepotMapModalZone({ zoneId, equipmentName: eqName })}
      />

      {/* Dialog SAV (double-clic) */}
      <SavDetailDialog
        ticket={dialogTicket}
        equipment={equipment}
        persons={persons}
        isAdmin={isAdmin}
        onClose={() => setDialogTicket(null)}
        onEdit={(t) => {
          setEditingSavTicket(t);
          setShowSavModal(true);
        }}
        onDelete={(id) => {
          confirm({
            title: 'Supprimer le ticket',
            message: 'Supprimer ce ticket ?',
            variant: 'danger',
            confirmLabel: 'Supprimer',
            onConfirm: async () => {
              try {
                await api.deleteSavTicket(id);
                setDialogTicket(null);
                refreshBus.publish('sav');
                loadData();
              } catch (err) {
                toast.error('Erreur: ' + err.message);
              }
            },
          });
        }}
        onOpenEquipmentDialog={(eq) => {
          setDialogTicket(null);
          setDialogEquipment(eq);
        }}
      />

      {/* Modals */}
      {showEquipmentModal && (
        <EquipmentFormModal
          equipment={editingEquipment}
          categories={categories}
          brandsList={brandsList}
          depotZones={depotZones}
          allDepotZones={allDepotZones}
          photosList={photosList}
          onSave={handleSaveEquipment}
          onClose={() => {
            setShowEquipmentModal(false);
            setEditingEquipment(null);
          }}
        />
      )}

      {showSavModal && (
        <SavTicketFormModal
          ticket={editingSavTicket}
          equipment={equipment}
          categories={categories}
          persons={persons}
          preselectedEquipment={savTicketEquipment || selectedEquipment}
          onSave={handleSaveSavTicket}
          onClose={() => {
            setShowSavModal(false);
            setEditingSavTicket(null);
            setSavTicketEquipment(null);
          }}
        />
      )}

      {showMobileSavRequest && (
        <MobileSavRequestForm
          equipment={equipment}
          onSubmit={async (data) => {
            if (canManageEquipmentMaintenance) {
              await api.createSavTicket(data);
            } else {
              await api.createSavRequest(data);
            }
            refreshBus.publish('sav');
            setShowMobileSavRequest(false);
            loadData();
          }}
          onClose={() => setShowMobileSavRequest(false)}
        />
      )}

      {showImportModal && (
        <EquipmentImportModal onClose={() => setShowImportModal(false)} onImportDone={loadData} />
      )}

      {showLocmatImport && (
        <Suspense fallback={null}>
          <LocmatImportModal
            onClose={() => setShowLocmatImport(false)}
            onDone={() => {
              setShowLocmatImport(false);
              loadData();
            }}
          />
        </Suspense>
      )}

      {showSavImportModal && (
        <SavImportModal onClose={() => setShowSavImportModal(false)} onImportDone={loadData} />
      )}

      {labelPrintEquipment && (
        <EquipmentLabelPrint
          equipment={labelPrintEquipment}
          onClose={() => setLabelPrintEquipment(null)}
        />
      )}

      <MaintenanceReportModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} />

      {/* ═══ PANNEAU DE GESTION MATÉRIEL ═══ */}
      {showManagement && (
        <Modal
          open={showManagement}
          onClose={onCloseManagement}
          size="xl"
          className="eq-management-panel"
        >
          <ModalHeader icon={<Package size={22} />} onClose={onCloseManagement}>
            Gestion du Matériel
          </ModalHeader>
          <ModalBody>
            {/* Onglets de gestion */}
            <div className="eq-mgmt-tabs">
              {[
                { id: 'imports', label: 'Imports', icon: Upload, color: STATUS_COLORS.info },
                {
                  id: 'categories',
                  label: 'Familles et catégories',
                  icon: Tag,
                  color: ACCENT_COLORS.violet,
                },
                { id: 'labels', label: 'Étiquettes', icon: Printer, color: ACCENT_COLORS.orange },
                {
                  id: 'laser',
                  label: 'Étiquettes laser',
                  icon: Zap,
                  color: ACCENT_COLORS.orange,
                },
                { id: 'stats', label: 'Statistiques', icon: Hash, color: STATUS_COLORS.success },
                { id: 'media', label: 'Médias', icon: ImageIcon, color: ACCENT_COLORS.pink },
              ].map((tab) => (
                <Button
                  variant="ghost"
                  key={tab.id}
                  className={`eq-mgmt-tab ${mgmtTab === tab.id ? 'active' : ''}`}
                  onClick={() => setMgmtTab(tab.id)}
                  style={{ '--tab-color': tab.color }}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </Button>
              ))}
            </div>

            <div
              className={`eq-management-content ${mgmtTab === 'labels' ? 'eq-mgmt-content-labels' : ''}`}
            >
              {/* Onglet Imports */}
              {mgmtTab === 'imports' && (
                <>
                  <div className="eq-management-section">
                    <h3>
                      <Upload size={18} /> Import CSV Inventaire
                    </h3>
                    <p>
                      Importez votre inventaire depuis un fichier CSV (format Locmat ou équivalent).
                      Les familles, catégories et types seront automatiquement créés.
                    </p>
                    <Button
                      variant="primary"
                      className="eq-mgmt-import-btn"
                      onClick={() => {
                        onCloseManagement();
                        setShowImportModal(true);
                      }}
                    >
                      <Upload size={16} /> Importer un fichier CSV
                    </Button>
                    <div className="u-mt-2">
                      <Button
                        variant="primary"
                        className="eq-mgmt-import-btn"
                        onClick={() => {
                          onCloseManagement();
                          setShowLocmatImport(true);
                        }}
                        title="Import intelligent Locmat (Locations.csv + Serialise.csv) avec aperçu, UID + QR Code par référence et soft-removal des numéros de série"
                      >
                        <Upload size={16} /> Import intelligent Locmat
                      </Button>
                    </div>
                    <div className="u-mt-2">
                      <Button
                        variant="secondary"
                        className="eq-mgmt-import-btn"
                        disabled={backfillingRefs}
                        onClick={() => {
                          confirm({
                            title: 'Mettre à jour les références',
                            message:
                              'Mettre à jour catégorie, marque, modèle, photo et localisation ' +
                              'pour toutes les unités vides en se basant sur les unités déjà ' +
                              'renseignées de la même référence ?\n\nLes valeurs déjà définies ne seront PAS écrasées.',
                            confirmLabel: 'Mettre à jour',
                            onConfirm: async () => {
                              setBackfillingRefs(true);
                              try {
                                const r = await api.backfillLocmatReferences();
                                toast.success(
                                  `Mise à jour : ${r.updatedRows} ligne(s) complétée(s) sur ${r.processedRefs} référence(s)` +
                                    (r.normalizedSerials
                                      ? `, ${r.normalizedSerials} sérialisé(s) ramené(s) à qté=1.`
                                      : '.'),
                                );
                                await loadData?.();
                              } catch (e) {
                                toast.error(
                                  `Échec mise à jour : ${e?.message || 'erreur inconnue'}`,
                                );
                              } finally {
                                setBackfillingRefs(false);
                              }
                            },
                          });
                        }}
                        title="Re-propage catégorie, marque, modèle, photo et localisation depuis l'unité la mieux renseignée de chaque référence vers les autres unités vides. Idempotent : les valeurs déjà définies sont conservées."
                      >
                        <RefreshCw size={16} />{' '}
                        {backfillingRefs
                          ? 'Mise à jour en cours…'
                          : 'Mettre à jour catégories / marques / localisations'}
                      </Button>
                    </div>
                    <div className="u-mt-2">
                      <Select
                        className="eq-filter"
                        value={exportFamilyId}
                        onChange={(e) => setExportFamilyId(e.target.value)}
                        title="Famille à exporter"
                      >
                        <option value="">Toutes les familles</option>
                        {families.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.icon || '📁'} {f.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="u-mt-2">
                      <Button
                        variant="secondary"
                        className="eq-mgmt-import-btn"
                        onClick={() => handleExportEquipmentInventoryPdf(exportFamilyId || null)}
                        disabled={exportingEquipmentInventoryPdf}
                      >
                        <Download size={16} />{' '}
                        {exportingEquipmentInventoryPdf
                          ? 'Export PDF en cours...'
                          : 'Exporter PDF inventaire équipements'}
                      </Button>
                    </div>
                  </div>
                  <div className="eq-management-section">
                    <h3>
                      <Wrench size={18} /> Import Interventions SAV
                    </h3>
                    <p>
                      Importez les interventions SAV depuis un fichier CSV Locmat. Les interventions
                      seront automatiquement liées aux équipements via leur numéro de série.
                    </p>
                    <Button
                      variant="primary"
                      className="eq-mgmt-import-btn"
                      onClick={() => {
                        onCloseManagement();
                        setShowSavImportModal(true);
                      }}
                    >
                      <Upload size={16} /> Importer les interventions
                    </Button>
                  </div>
                </>
              )}

              {/* Onglet Catégories */}
              {mgmtTab === 'categories' && (
                <div className="eq-management-section">
                  <h3>
                    <Tag size={18} /> Familles et catégories ({categories.length})
                  </h3>
                  <EquipmentCategoriesTree
                    families={families}
                    subfamilies={subfamilies}
                    leafCategories={leafCategories}
                    categories={categories}
                    equipment={equipment}
                    onRefresh={loadData}
                  />
                </div>
              )}

              {/* Onglet Étiquettes */}
              {mgmtTab === 'labels' && (
                <div className="eq-management-section eq-mgmt-labels-section">
                  <EquipmentBatchLabels
                    equipment={equipment}
                    onPrintSingle={(eq) => setLabelPrintEquipment(eq)}
                  />
                </div>
              )}

              {/* Onglet Étiquettes laser (LightBurn) */}
              {mgmtTab === 'laser' && (
                <div className="eq-management-section">
                  <LabelsPrintPanel />
                </div>
              )}

              {/* Onglet Statistiques */}
              {mgmtTab === 'stats' && (
                <div className="eq-management-section">
                  <h3>📊 Statistiques</h3>
                  <div className="eq-management-stats">
                    <div className="eq-mgmt-stat">
                      <strong>{equipment.length}</strong>
                      <span>Équipements</span>
                    </div>
                    <div className="eq-mgmt-stat">
                      <strong>{families.length}</strong>
                      <span>Familles</span>
                    </div>
                    <div className="eq-mgmt-stat">
                      <strong>{subfamilies.length}</strong>
                      <span>Catégories</span>
                    </div>
                    <div className="eq-mgmt-stat">
                      <strong>{leafCategories.length}</strong>
                      <span>Types</span>
                    </div>
                    <div className="eq-mgmt-stat">
                      <strong>{equipment.filter((e) => e.status === 'available').length}</strong>
                      <span>Disponibles</span>
                    </div>
                    <div className="eq-mgmt-stat">
                      <strong>
                        {equipment.filter((e) => e.status === STATUS.MAINTENANCE).length}
                      </strong>
                      <span>En maintenance</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Onglet Médias */}
              {mgmtTab === 'media' && (
                <EquipmentMediaManager
                  photosList={photosList}
                  logosList={logosList}
                  equipment={equipment}
                  onRefresh={loadData}
                />
              )}
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Modal Plan dépôt (ouvert depuis un clic sur une zone) */}
      {depotMapModalZone && modalDepotData && (
        <ModalLayout
          open
          onClose={() => setDepotMapModalZone(null)}
          title={
            <>
              <MapPin size={18} /> Plan {modalDepotData.name || 'du dépôt'} — Zone{' '}
              {depotMapModalZone.zoneId}
              {depotMapModalZone.equipmentName ? ` · ${depotMapModalZone.equipmentName}` : ''}
            </>
          }
          size="xl"
          className="eq-depot-map-modal"
        >
          <div className="eq-depot-map-modal-body">
            <DepotMapFocused
              zones={modalDepotData}
              focusZoneId={depotMapModalZone.zoneId}
              focusEquipmentName={depotMapModalZone.equipmentName}
            />
          </div>
        </ModalLayout>
      )}

      {ConfirmDialogRenderer}
    </div>
  );
};

export default React.memo(EquipmentPanel);
