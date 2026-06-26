import { useEffect } from 'react';
import { toast } from 'sonner';
import { getOrderSocket, onAdminOrderNew } from '@core/services/orderSocket';

const ALERT_SOUND_URL =
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

/**
 * Admin-only: socket listener for new orders (no seller polling).
 */
export function useAdminOrderNotifications(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;

    const getToken = () => localStorage.getItem('auth_admin');
    getOrderSocket(getToken);

    return onAdminOrderNew(getToken, (payload) => {
      const id = payload?.orderId || payload?.mongoOrderId || 'New';
      const amount = Number(payload?.totalAmount || 0);
      const hubStatus = payload?.hubStatus || 'pending';
      toast.success(`New order #${id} received (₹${amount.toLocaleString('en-IN')})`, {
        description: `Hub status: ${hubStatus}`,
      });
      new Audio(ALERT_SOUND_URL).play().catch(() => {});
    });
  }, [enabled]);
}
