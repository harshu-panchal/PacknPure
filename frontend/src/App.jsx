import { Suspense, useEffect } from 'react';
import AppRouter from './core/routes/AppRouter';
import { SettingsProvider } from './core/context/SettingsContext';
import { ToastProvider } from './shared/components/ui/Toast';
import Loader from './shared/components/ui/Loader';
import ErrorBoundary from './shared/components/ErrorBoundary';
import MobileAppHardening from './core/components/MobileAppHardening';
import { captureReferralCodeFromUrl } from './core/utils/referralCapture';
import { clearChunkReloadGuard } from './core/utils/chunkReload';

function App() {
  useEffect(() => {
    captureReferralCodeFromUrl();
    // A successful boot means the current build is up to date — reset the
    // stale-chunk auto-reload guard so a later deployment can trigger it again.
    clearChunkReloadGuard();
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
