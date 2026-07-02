import { lazy, Suspense } from 'react';

import { LoadingOverlay } from '../../design-system';
import api from '../../utils/api';
import OverlayHost from './OverlayHost';

const ToastContainer = lazy(() => import('../ToastContainer'));
const ManagementPanel = lazy(() => import('../management/ManagementPanel'));
const MaintenanceDialog = lazy(() => import('../vehicles/MaintenanceDialog'));
const VehicleMaintenanceModal = lazy(() => import('../vehicles/VehicleMaintenanceModal'));
const VehicleDetailsModal = lazy(() => import('../vehicles/VehicleDetailsModal'));
const MessagingPanel = lazy(() => import('../messaging/MessagingPanel'));
const MailingPanel = lazy(() => import('../mailing/MailingPanel'));
const AffaireDetailModal = lazy(() =>
  import('../affaires/AffaireDetailPanel').then((m) => ({
    default: m.AffaireDetailModal,
  })),
);
const UserPreferencesModal = lazy(() => import('../auth/UserPreferencesModal'));
const HelpModal = lazy(() => import('../HelpModal'));

function GlobalOverlays({
  showManagement,
  setShowManagement,
  activeModule,
  setPersonnelRefreshKey,
  showSettings,
  setShowSettings,
  setActiveModule,
  selectedVehicleForMaintenance,
  setSelectedVehicleForMaintenance,
  maintenanceToEdit,
  setMaintenanceToEdit,
  maintenanceActionType,
  setMaintenanceActionType,
  vehicleForDialog,
  setVehicleForDialog,
  vehicleForManagementEdit,
  setVehicleForManagementEdit,
  selectedVehicleForKilometrageControl,
  setSelectedVehicleForKilometrageControl,
  showMessaging,
  setShowMessaging,
  showMailing,
  setShowMailing,
  showPreferences,
  setShowPreferences,
  palette,
  setPalette,
  isDark,
  toggleTheme,
  updatePreferences,
  showHelp,
  setShowHelp,
  globalAffaireDialog,
  setGlobalAffaireDialog,
  data,
  currentUser,
  handleRequestMaintenance,
  handleReportBreakdown,
  handleScheduleMaintenance,
  toast,
  handleNavigateToEntity,
  toastRef,
}) {
  return (
    <OverlayHost
      showManagement={showManagement}
      showSettings={showSettings}
      selectedVehicleForMaintenance={selectedVehicleForMaintenance}
      vehicleForDialog={vehicleForDialog}
      selectedVehicleForKilometrageControl={selectedVehicleForKilometrageControl}
      showPreferences={showPreferences}
      showHelp={showHelp}
      globalAffaireDialog={globalAffaireDialog}
      renderManagement={() => (
        <Suspense fallback={<LoadingOverlay label="Chargement du panneau de gestion..." />}>
          <ManagementPanel
            vehicles={data.vehicles}
            setVehicles={data.setVehicles}
            reservations={data.reservations}
            setReservations={data.setReservations}
            clients={data.clients}
            setClients={data.setClients}
            locations={data.locations}
            setLocations={data.setLocations}
            calendarConfig={data.calendarConfig}
            setCalendarConfig={data.setCalendarConfig}
            garages={data.garages}
            setGarages={data.setGarages}
            maintenances={data.maintenances}
            setMaintenances={data.setMaintenances}
            currentUser={currentUser}
            activeModule={activeModule}
            panelType="management"
            initialVehicleToEdit={vehicleForManagementEdit}
            onClose={() => {
              setVehicleForManagementEdit(null);
              setShowManagement(false);
              if (activeModule === 'planning') {
                setPersonnelRefreshKey((k) => k + 1);
              }
            }}
          />
        </Suspense>
      )}
      renderSettings={() => (
        <Suspense fallback={<LoadingOverlay label="Chargement des paramètres..." />}>
          <ManagementPanel
            vehicles={data.vehicles}
            setVehicles={data.setVehicles}
            reservations={data.reservations}
            setReservations={data.setReservations}
            clients={data.clients}
            setClients={data.setClients}
            locations={data.locations}
            setLocations={data.setLocations}
            calendarConfig={data.calendarConfig}
            setCalendarConfig={data.setCalendarConfig}
            garages={data.garages}
            setGarages={data.setGarages}
            maintenances={data.maintenances}
            setMaintenances={data.setMaintenances}
            currentUser={currentUser}
            panelType="settings"
            onClose={() => setShowSettings(false)}
            onNavigateToPersonnel={(_person) => {
              setShowSettings(false);
              setActiveModule('planning');
            }}
          />
        </Suspense>
      )}
      renderMaintenance={() => (
        <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
          <MaintenanceDialog
            vehicle={selectedVehicleForMaintenance}
            maintenances={data.maintenances}
            garages={data.garages}
            reservations={data.reservations}
            maintenanceToEdit={maintenanceToEdit}
            actionType={maintenanceActionType}
            currentUser={currentUser}
            onSave={data.handleMaintenanceSave}
            onClose={() => {
              setSelectedVehicleForMaintenance(null);
              setMaintenanceToEdit(null);
              setMaintenanceActionType(null);
            }}
          />
        </Suspense>
      )}
      renderVehicleDetails={() => (
        <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
          <VehicleDetailsModal
            vehicle={vehicleForDialog}
            maintenances={data.maintenances}
            currentUser={currentUser}
            onClose={() => setVehicleForDialog(null)}
            onRequestMaintenance={handleRequestMaintenance}
            onReportBreakdown={handleReportBreakdown}
            onScheduleMaintenance={handleScheduleMaintenance}
            onUpdateIntervention={data.handleUpdateIntervention}
            onDeleteIntervention={data.handleDeleteIntervention}
            onOpenMaintenance={(vehicle) => {
              setSelectedVehicleForKilometrageControl(vehicle);
              setVehicleForDialog(null);
            }}
          />
        </Suspense>
      )}
      renderVehicleMaintenance={() => (
        <Suspense fallback={<LoadingOverlay label="Chargement..." />}>
          <VehicleMaintenanceModal
            vehicle={selectedVehicleForKilometrageControl}
            onSave={async (updatedVehicle) => {
              try {
                const response = await api.updateVehicle(updatedVehicle.id, updatedVehicle);
                data.setVehicles((prevVehicles) =>
                  prevVehicles.map((v) => (v.id === response.id ? response : v)),
                );
                setSelectedVehicleForKilometrageControl(response);
              } catch (error) {
                console.error('Erreur lors de la mise à jour du véhicule:', error);
                toast.error('Erreur lors de la mise à jour du véhicule');
                throw error;
              }
            }}
            onClose={() => setSelectedVehicleForKilometrageControl(null)}
          />
        </Suspense>
      )}
      renderMessaging={() => (
        <Suspense fallback={null}>
          <MessagingPanel
            isOpen={showMessaging}
            onClose={() => setShowMessaging(false)}
            currentUser={currentUser}
          />
        </Suspense>
      )}
      renderMailing={() => (
        <Suspense fallback={null}>
          <MailingPanel isOpen={showMailing} onClose={() => setShowMailing(false)} />
        </Suspense>
      )}
      renderPreferences={() => (
        <Suspense fallback={null}>
          <UserPreferencesModal
            isOpen={showPreferences}
            onClose={() => setShowPreferences(false)}
            palette={palette}
            onPaletteChange={setPalette}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            onPreferencesChange={updatePreferences}
          />
        </Suspense>
      )}
      renderHelp={() => (
        <Suspense fallback={null}>
          <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        </Suspense>
      )}
      renderToast={() => <ToastContainer ref={toastRef} />}
      renderGlobalAffaire={() => (
        <Suspense fallback={null}>
          <AffaireDetailModal
            affaire={globalAffaireDialog}
            reservations={data.reservations}
            onClose={() => setGlobalAffaireDialog(null)}
            onDataChanged={(updatedAffaire) => {
              if (updatedAffaire) setGlobalAffaireDialog(updatedAffaire);
            }}
            onNavigateToEntity={handleNavigateToEntity}
          />
        </Suspense>
      )}
    />
  );
}

export default GlobalOverlays;
