import { Suspense } from 'react';
import AppRouter from './core/routes/AppRouter';
import { SettingsProvider } from './core/context/SettingsContext';
import { ToastProvider } from './shared/components/ui/Toast';
import Loader from './shared/components/ui/Loader';
import ErrorBoundary from './shared/components/ErrorBoundary';
import LenisScroll from './shared/components/LenisScroll';

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <Suspense fallback={<Loader fullScreen />}>
            <LenisScroll />
            <AppRouter />
          </Suspense>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
