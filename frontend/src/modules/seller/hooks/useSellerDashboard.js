import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { sellerApi } from '../services/sellerApi';
import { defaultEarnings } from '../context/SellerEarningsContext';
import {
  getOrderSocket,
  onPurchaseRequestNew,
} from '@core/services/orderSocket';

const ALERT_SOUND_URL =
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const isEarningsRoute = (path) =>
  path.includes('earnings') || path.includes('withdrawals') || path.includes('transactions');

function playAlertSound() {
  new Audio(ALERT_SOUND_URL).play().catch(() => {});
}

/**
 * Seller dashboard data: procurement alerts + earnings (no customer order flow).
 */
export function useSellerDashboard(enabled) {
  const navigate = useNavigate();
  const location = useLocation();

  const [sellerEarningsData, setSellerEarningsData] = useState(defaultEarnings);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const earningsFetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const getToken = () => localStorage.getItem('auth_seller');
    getOrderSocket(getToken);

    const unsubPr = onPurchaseRequestNew(getToken, (payload) => {
      const id = payload?.orderId || 'New';
      toast.info(`New Purchase Request for order #${id}!`, {
        description: `Items: ${payload.itemsCount || 1}`,
        action: { label: 'VIEW', onClick: () => navigate('/seller/procurement') },
      });
      playAlertSound();
    });

    return () => {
      unsubPr();
    };
  }, [enabled, navigate]);

  useEffect(() => {
    if (!enabled || !isEarningsRoute(location.pathname)) {
      if (!isEarningsRoute(location.pathname)) earningsFetchedRef.current = false;
      return;
    }
    if (earningsFetchedRef.current) return;
    earningsFetchedRef.current = true;
    setEarningsLoading(true);
    sellerApi
      .getEarnings()
      .then((response) => {
        const raw = response?.data?.result ?? response?.data?.data;
        if (response?.data?.success && raw && typeof raw === 'object') {
          setSellerEarningsData({
            balances: raw.balances ?? {},
            ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
            monthlyChart: Array.isArray(raw.monthlyChart) ? raw.monthlyChart : [],
          });
        }
      })
      .catch((err) => console.error('Earnings fetch error:', err))
      .finally(() => setEarningsLoading(false));
  }, [enabled, location.pathname]);

  const refreshEarnings = useCallback(() => {
    earningsFetchedRef.current = false;
    setEarningsLoading(true);
    sellerApi
      .getEarnings()
      .then((response) => {
        const raw = response?.data?.result ?? response?.data?.data;
        if (response?.data?.success && raw && typeof raw === 'object') {
          setSellerEarningsData({
            balances: raw.balances ?? {},
            ledger: Array.isArray(raw.ledger) ? raw.ledger : [],
            monthlyChart: Array.isArray(raw.monthlyChart) ? raw.monthlyChart : [],
          });
        }
      })
      .catch((err) => console.error('Earnings fetch error:', err))
      .finally(() => {
        setEarningsLoading(false);
        earningsFetchedRef.current = true;
      });
  }, []);

  return {
    sellerEarningsData,
    earningsLoading,
    refreshEarnings,
  };
}
