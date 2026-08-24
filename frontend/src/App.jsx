import { Suspense, useEffect } from 'react';
import AppRouter from './core/routes/AppRouter';
import { SettingsProvider } from './core/context/SettingsContext';
import { ToastProvider } from './shared/components/ui/Toast';
import Loader from './shared/components/ui/Loader';
import ErrorBoundary from './shared/components/ErrorBoundary';
import MobileAppHardening from './core/components/MobileAppHardening';
import { captureReferralCodeFromUrl } from './core/utils/referralCapture';

function App() {
  useEffect(() => {
    captureReferralCodeFromUrl();
  }, []);

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <MobileAppHardening />
          <Suspense fallback={<Loader fullScreen />}>
            <AppRouter />
          </Suspense>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
