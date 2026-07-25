import { useEffect } from 'react';
import { initMobileAppHardening } from '@core/mobile/mobileAppHardening';

/**
 * Enables native-like mobile/PWA restrictions (zoom, select, copy, long-press).
 * No-op on desktop web. Mount once near the app root.
 */
export default function MobileAppHardening() {
  useEffect(() => initMobileAppHardening(), []);
  return null;
}
