import '../../App.css';

import { Suspense } from 'react';

import { NavigationProvider } from '../../contexts/NavigationContext';
import TaskAlertBanner from '../alerts/TaskAlertBanner';
import Header from '../Header';
import { PrintPreviewProvider } from '../ui/PrintPreviewProvider';

function AppChrome({
  onNavigateToEntity,
  apiNetworkStatus,
  headerProps,
  showGoogleBanner,
  googleBannerProps,
  GoogleCalendarBanner,
  children,
}) {
  return (
    <PrintPreviewProvider>
      <NavigationProvider value={onNavigateToEntity}>
        <div className="app">
          <a href="#main-content" className="skip-link">
            Aller au contenu principal
          </a>
          {apiNetworkStatus.unavailable && (
            <div className="api-offline-banner" role="status" aria-live="polite">
              <strong>Service local indisponible.</strong>
              <span>
                Les requêtes automatiques sont ralenties temporairement pour éviter les erreurs en
                cascade.
              </span>
            </div>
          )}

          <Header {...headerProps} />

          <TaskAlertBanner />

          {showGoogleBanner && (
            <Suspense fallback={null}>
              <GoogleCalendarBanner {...googleBannerProps} />
            </Suspense>
          )}

          {children}
        </div>
      </NavigationProvider>
    </PrintPreviewProvider>
  );
}

export default AppChrome;
