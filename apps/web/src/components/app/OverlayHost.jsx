import { Suspense } from 'react';

import ErrorBoundary from '../ErrorBoundary';

function OverlayHost({
  showManagement,
  showSettings,
  selectedVehicleForMaintenance,
  vehicleForDialog,
  selectedVehicleForKilometrageControl,
  showPreferences,
  showHelp,
  globalAffaireDialog,
  renderManagement,
  renderSettings,
  renderMaintenance,
  renderVehicleDetails,
  renderVehicleMaintenance,
  renderMessaging,
  renderMailing,
  renderPreferences,
  renderHelp,
  renderToast,
  renderGlobalAffaire,
}) {
  return (
    <>
      {showManagement && <ErrorBoundary moduleName="Gestion">{renderManagement()}</ErrorBoundary>}

      {showSettings && <ErrorBoundary moduleName="Paramètres">{renderSettings()}</ErrorBoundary>}

      {selectedVehicleForMaintenance && (
        <ErrorBoundary moduleName="Maintenance">{renderMaintenance()}</ErrorBoundary>
      )}

      {vehicleForDialog && renderVehicleDetails()}

      {selectedVehicleForKilometrageControl && (
        <ErrorBoundary moduleName="Kilométrage">{renderVehicleMaintenance()}</ErrorBoundary>
      )}

      <ErrorBoundary moduleName="Messagerie">{renderMessaging()}</ErrorBoundary>

      <ErrorBoundary moduleName="Mailing">{renderMailing()}</ErrorBoundary>

      {showPreferences && renderPreferences()}

      {showHelp && renderHelp()}

      <Suspense fallback={null}>{renderToast()}</Suspense>

      {globalAffaireDialog && (
        <ErrorBoundary moduleName="Détail Affaire">{renderGlobalAffaire()}</ErrorBoundary>
      )}
    </>
  );
}

export default OverlayHost;
