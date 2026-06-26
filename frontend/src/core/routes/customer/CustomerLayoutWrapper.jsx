import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';
import { useAuth } from '@core/context/AuthContext';
import { WishlistProvider } from '@modules/customer/context/WishlistContext';
import { CartProvider } from '@modules/customer/context/CartContext';
import { CartAnimationProvider } from '@modules/customer/context/CartAnimationContext';
import { ProductDetailProvider } from '@modules/customer/context/ProductDetailContext';
import { LocationProvider } from '@modules/customer/context/LocationContext';
import { CustomerLoginProvider } from '@modules/customer/context/CustomerLoginContext';
import {
  applyCustomerThemeVariables,
  restoreThemeFromSettings,
} from '@modules/customer/constants/brandTheme';
import ScrollToTop from '@modules/customer/components/shared/ScrollToTop';
import CustomerLayout from '@modules/customer/components/layout/CustomerLayout';
import SetNameModal from '@modules/customer/components/auth/SetNameModal';
import Loader from '@shared/components/ui/Loader';
import { isCustomerProfileComplete } from '@core/utils/profile';

/**
 * Customer storefront shell — forces brand CSS vars; API primaryColor is not used here.
 */
const CustomerLayoutWrapper = () => {
  const { settings } = useSettings();
  const { user, isLoading: authLoading, patchUser } = useAuth();
  const [showSetName, setShowSetName] = useState(false);

  useEffect(() => {
    applyCustomerThemeVariables();
    return () => restoreThemeFromSettings(settings);
  }, [settings]);

  /**
   * Once the auth profile is loaded, if the user is authenticated but
   * has an incomplete profile, show the profile modal.
   * We guard with authLoading so we don't flash it during the initial fetch.
   */
  useEffect(() => {
    if (!authLoading && user && !isCustomerProfileComplete(user)) {
      setShowSetName(true);
    } else {
      setShowSetName(false);
    }
  }, [authLoading, user]);

  const handleNameSaved = (savedName, updatedCustomerData) => {
    // Update the local user state so header/profile reflect the new data immediately
    if (updatedCustomerData) {
        patchUser(updatedCustomerData);
    } else {
        patchUser({ name: savedName });
    }
    setShowSetName(false);
  };

  return (
    <CustomerLoginProvider>
      <LocationProvider>
        <WishlistProvider>
          <CartProvider>
            <CartAnimationProvider>
              <ProductDetailProvider>
                <ScrollToTop />
                <CustomerLayout>
                  <Suspense fallback={<Loader fullScreen />}>
                    <Outlet />
                  </Suspense>
                </CustomerLayout>
                {/* Name prompt for returning users who have no name yet */}
                <SetNameModal
                  open={showSetName}
                  onSuccess={handleNameSaved}
                />
              </ProductDetailProvider>
            </CartAnimationProvider>
          </CartProvider>
        </WishlistProvider>
      </LocationProvider>
    </CustomerLoginProvider>
  );
};

export default CustomerLayoutWrapper;
