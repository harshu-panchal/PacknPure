import { Suspense } from 'react';
import AppRouter from './core/routes/AppRouter';
import { SettingsProvider } from './core/context/SettingsContext';
import { ToastProvider } from './shared/components/ui/Toast';
import Loader from './shared/components/ui/Loader';
import ErrorBoundary from './shared/components/ErrorBoundary';
import LenisProvider from './shared/components/LenisProvider';
import MobileAppHardening from './core/components/MobileAppHardening';

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <MobileAppHardening />
          <Suspense fallback={<Loader fullScreen />}>
            <LenisProvider>
              <AppRouter />
            </LenisProvider>
          </Suspense>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
