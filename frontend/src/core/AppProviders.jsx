import { AuthProvider } from '@core/context/AuthContext';
import SeoHead from '@core/components/SeoHead';

/**
 * Route-level providers (must render inside React Router for useLocation in Auth).
 */
const AppProviders = ({ children }) => (
  <AuthProvider>
    <SeoHead />
    {children}
  </AuthProvider>
);

export default AppProviders;
