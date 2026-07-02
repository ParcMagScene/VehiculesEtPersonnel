import { lazy, Suspense } from 'react';

import { Button } from '@/design-system';

import { LoadingOverlay } from '../../design-system';
import ErrorBoundary from '../ErrorBoundary';
import { PlanningModalProvider } from '../planning/PlanningModalContext';

const VehicleSlidePanel = lazy(() =>
  import('../vehicles/VehicleDetailPanel').then((m) => ({
    default: m.VehicleSlidePanel,
  })),
);
const PlanningView = lazy(() => import('../vehicles/PlanningView'));
const Calendar = lazy(() => import('../vehicles/Calendar'));
const AffairesPanel = lazy(() => import('../affaires/AffairesPanel'));
const EquipmentPanel = lazy(() => import('../equipment/EquipmentPanel'));
const OrdersPanel = lazy(() =>
  import('../orders/OrdersPanel').then((m) => ({
    default: m.default || m.OrdersPanel,
  })),
);
const StockPanel = lazy(() => import('../orders/StockPanel'));
const InventoryPanel = lazy(() => import('../inventory/InventoryPanel'));
const PlanningPanel = lazy(() => import('../planning/PlanningPanel'));
const AnnuairePanel = lazy(() => import('../annuaire/AnnuairePanel'));
const VideoPanel = lazy(() => import('../video/VideoPanel'));
const SonosPanel = lazy(() => import('../sonos/SonosPanel'));
const ControlsDashboard = lazy(() => import('../controles/ControlsDashboard'));

function ModuleHost({
  activeModule,
  view,
  setView,
  currentDate,
  setCurrentDate,
  data,
  currentUser,
  showEquipmentManagement,
  setShowEquipmentManagement,
  stockSubTab,
  setStockSubTab,
  showStockManagement,
  setShowStockManagement,
  allGoogleEvents,
  handleNavigateToEntity,
  personnelRefreshKey,
  navigateToPersonId,
  setNavigateToPersonId,
  quickAssignmentSlot,
  setQuickAssignmentSlot,
  googleBannerSlot,
  handleCalendarScroll,
  googleEventForReservation,
  setGoogleEventForReservation,
  googleEvents,
  highlightedReservationIds,
  reservationToEdit,
  setReservationToEdit,
  setSelectedVehicleForDetails,
  setVehicleForDialog,
  setMaintenanceActionType,
  setSelectedVehicleForMaintenance,
  setMaintenanceToEdit,
  openEventDetailsModalRef,
  quickReservationSlot,
  setQuickReservationSlot,
  selectedVehicleForDetails,
  handleScheduleMaintenance,
  handleRequestMaintenance,
  setSelectedVehicleForKilometrageControl,
  handleReportBreakdown,
  setShowManagement,
  setVehicleForManagementEdit,
  toast,
}) {
  return (
    <>
      {activeModule === 'vehicles' && (
        <>
          {view === 'planning' ? (
            <Suspense fallback={<LoadingOverlay label="Chargement du planning..." />}>
              <PlanningView
                vehicles={data.vehicles}
                reservations={data.reservations}
                maintenances={data.maintenances}
                currentDate={currentDate}
                onVehicleClick={(v) => {
                  setSelectedVehicleForDetails(null);
                  setVehicleForDialog(null);
                  setVehicleForManagementEdit(v);
                  setShowManagement(true);
                }}
                onVehicleContextMenu={(v) => {
                  setSelectedVehicleForDetails(null);
                  setVehicleForDialog(null);
                  setVehicleForManagementEdit(v);
                  setShowManagement(true);
                  toast?.info('Fiche véhicule ouverte en modification', {
                    duration: 1800,
                  });
                }}
                onOpenReservation={(reservation) => {
                  const vehicle = data.vehicles.find((v) => v.id === reservation.vehicleId);
                  if (vehicle) {
                    // Open reservation (legacy handler preserved)
                  }
                }}
                onOpenMaintenance={setSelectedVehicleForMaintenance}
                clients={data.clients}
                drivers={[]}
                persons={data.persons}
              />
            </Suspense>
          ) : (
            <div className="calendar-with-vehicle-panel">
              <ErrorBoundary moduleName="Calendrier">
                <Suspense fallback={<LoadingOverlay label="Chargement du calendrier..." />}>
                  <Calendar
                    view={view}
                    setView={setView}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    onOpenManagement={() => setShowManagement(true)}
                    vehicles={data.vehicles}
                    reservations={data.reservations}
                    maintenances={data.maintenances}
                    onAddReservation={data.addReservation}
                    onUpdateReservation={data.updateReservation}
                    onUpdateMaintenance={data.updateMaintenanceFromResize}
                    onScroll={handleCalendarScroll}
                    onDeleteReservation={data.deleteReservation}
                    clients={data.clients}
                    drivers={[]}
                    persons={data.persons}
                    locations={data.locations}
                    users={data.users}
                    googleEvent={googleEventForReservation}
                    onCloseGoogleEvent={() => setGoogleEventForReservation(null)}
                    googleEvents={googleEvents}
                    highlightedReservationIds={highlightedReservationIds}
                    reservationToEdit={reservationToEdit}
                    onReservationEditComplete={() => setReservationToEdit(null)}
                    onVehicleClick={setSelectedVehicleForDetails}
                    onVehicleDoubleClick={(v) => {
                      setSelectedVehicleForDetails(null);
                      setVehicleForDialog(v);
                    }}
                    onVehicleContextMenu={(v) => {
                      setSelectedVehicleForDetails(null);
                      setVehicleForDialog(null);
                      setVehicleForManagementEdit(v);
                      setShowManagement(true);
                    }}
                    onMaintenanceClick={(vehicle, maintenanceId) => {
                      setMaintenanceActionType(null);
                      setSelectedVehicleForMaintenance(vehicle);
                      setMaintenanceToEdit(maintenanceId);
                    }}
                    onRequestViewEvent={(event) => openEventDetailsModalRef.current?.(event)}
                    currentUser={currentUser}
                    quickReservationSlot={quickReservationSlot}
                    onQuickReservationHandled={() => setQuickReservationSlot(null)}
                  />
                </Suspense>
              </ErrorBoundary>
              <Suspense fallback={null}>
                <VehicleSlidePanel
                  vehicle={selectedVehicleForDetails}
                  maintenances={data.maintenances}
                  currentUser={currentUser}
                  onClose={() => setSelectedVehicleForDetails(null)}
                  onOpenDialog={(v) => {
                    setSelectedVehicleForDetails(null);
                    setVehicleForDialog(v);
                  }}
                  onAction={(action) => {
                    const v = selectedVehicleForDetails;
                    if (!v) return;
                    if (action === 'schedule') {
                      handleScheduleMaintenance(v);
                      setSelectedVehicleForDetails(null);
                    } else if (action === 'request') {
                      handleRequestMaintenance(v);
                      setSelectedVehicleForDetails(null);
                    } else if (action === 'km') {
                      setSelectedVehicleForKilometrageControl(v);
                      setSelectedVehicleForDetails(null);
                    } else if (action === 'breakdown') {
                      handleReportBreakdown(v);
                      setSelectedVehicleForDetails(null);
                    }
                  }}
                />
              </Suspense>
            </div>
          )}
        </>
      )}

      {activeModule === 'affaires' && (
        <ErrorBoundary moduleName="Affaires">
          <Suspense fallback={<LoadingOverlay label="Chargement du module affaires..." />}>
            <AffairesPanel
              reservations={data.reservations}
              onNavigateToEntity={handleNavigateToEntity}
              currentUser={currentUser}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'equipment' && (
        <ErrorBoundary moduleName="Équipement">
          <Suspense fallback={<LoadingOverlay label="Chargement du parc matériel..." />}>
            <EquipmentPanel
              currentUser={currentUser}
              showManagement={showEquipmentManagement}
              onOpenManagement={() => setShowEquipmentManagement(true)}
              onCloseManagement={() => setShowEquipmentManagement(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'orders' && (
        <ErrorBoundary moduleName="Commandes">
          <Suspense fallback={<LoadingOverlay label="Chargement des commandes..." />}>
            <OrdersPanel currentUser={currentUser} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'stock' && (
        <ErrorBoundary moduleName="Stocks">
          <div className="stocks-container">
            <div className="sub-tabs">
              <Button
                variant="ghost"
                className={`sub-tab ${stockSubTab === 'vente' ? 'active' : ''}`}
                onClick={() => setStockSubTab('vente')}
              >
                📦 Stock Vente
              </Button>
              <Button
                variant="ghost"
                className={`sub-tab ${stockSubTab === 'sav' ? 'active' : ''}`}
                onClick={() => setStockSubTab('sav')}
              >
                🔧 SAV (Pièces)
              </Button>
              <Button
                variant="ghost"
                className={`sub-tab ${stockSubTab === 'inventory' ? 'active' : ''}`}
                onClick={() => setStockSubTab('inventory')}
              >
                📋 Inventaire
              </Button>
            </div>
            {(stockSubTab === 'vente' || stockSubTab === 'sav') && (
              <Suspense fallback={<LoadingOverlay label="Chargement du stock..." />}>
                <StockPanel
                  currentUser={currentUser}
                  stockType={stockSubTab}
                  showManagement={showStockManagement}
                  onOpenManagement={() => setShowStockManagement(true)}
                  onCloseManagement={() => setShowStockManagement(false)}
                />
              </Suspense>
            )}
            {stockSubTab === 'inventory' && (
              <Suspense fallback={<LoadingOverlay label="Chargement de l'inventaire..." />}>
                <InventoryPanel currentUser={currentUser} />
              </Suspense>
            )}
          </div>
        </ErrorBoundary>
      )}

      {activeModule === 'planning' && (
        <ErrorBoundary moduleName="Planning">
          <PlanningModalProvider>
            <Suspense fallback={<LoadingOverlay label="Chargement du module Planning..." />}>
              <PlanningPanel
                currentUser={currentUser}
                googleEvents={allGoogleEvents}
                onNavigateToEntity={handleNavigateToEntity}
                personnelRefreshKey={personnelRefreshKey}
                view={view}
                setView={setView}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                navigateToPersonId={navigateToPersonId}
                onNavigateToPersonHandled={() => setNavigateToPersonId(null)}
                quickAssignmentSlot={quickAssignmentSlot}
                onQuickAssignmentHandled={() => setQuickAssignmentSlot(null)}
                googleBanner={googleBannerSlot}
              />
            </Suspense>
          </PlanningModalProvider>
        </ErrorBoundary>
      )}

      {activeModule === 'annuaire' && (
        <ErrorBoundary moduleName="Annuaire">
          <Suspense fallback={<LoadingOverlay label="Chargement de l'Annuaire..." />}>
            <AnnuairePanel currentUser={currentUser} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'video' && (
        <ErrorBoundary moduleName="Vidéo">
          <Suspense fallback={<LoadingOverlay label="Chargement de la surveillance vidéo..." />}>
            <VideoPanel currentUser={currentUser} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'sonos' && (
        <ErrorBoundary moduleName="Sonos">
          <Suspense fallback={<LoadingOverlay label="Chargement du module Sonos..." />}>
            <SonosPanel currentUser={currentUser} />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeModule === 'controles' && (
        <ErrorBoundary moduleName="Contrôles">
          <Suspense fallback={<LoadingOverlay label="Chargement des contrôles périodiques..." />}>
            <ControlsDashboard user={currentUser} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}

export default ModuleHost;
