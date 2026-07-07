import { Suspense } from 'react';
import AppRouter from './core/routes/AppRouter';
import { SettingsProvider } from './core/context/SettingsContext';
import { ToastProvider } from './shared/components/ui/Toast';
import Loader from './shared/components/ui/Loader';
import ErrorBoundary from './shared/components/ErrorBoundary';
import LenisProvider from './shared/components/LenisProvider';

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
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
