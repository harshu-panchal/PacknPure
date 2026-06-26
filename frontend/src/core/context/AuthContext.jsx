import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useLocation } from 'react-router-dom';
import axiosInstance from '@core/api/axios';
import { getWithDedupe } from '@core/api/dedupe';

const AuthContext = createContext(undefined);

const ROLE_STORAGE_KEYS = {
  customer: 'auth_customer',
  seller: 'auth_seller',
  admin: 'auth_admin',
  delivery: 'auth_delivery',
  pickup_partner: 'auth_pickup_partner',
};

const getRoleFromPath = (pathname) => {
  if (pathname.startsWith('/seller')) return 'seller';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/delivery')) return 'delivery';
  if (pathname.startsWith('/pickup')) return 'pickup_partner';
  return 'customer';
};

const getProfileEndpointByRole = (role) => {
  if (role === 'pickup_partner') return '/pickup-partner/my/profile';
  return `/${role}/profile`;
};

const getSafeToken = (key) => {
  const val = localStorage.getItem(ROLE_STORAGE_KEYS[key]);
  if (!val) return null;
  if (val.startsWith('{')) {
    try {
      return JSON.parse(val).token;
    } catch {
      return val;
    }
  }
  return val;
};

const readInitialAuthData = () => ({
  customer: getSafeToken('customer'),
  seller: getSafeToken('seller'),
  admin: getSafeToken('admin'),
  delivery: getSafeToken('delivery'),
  pickup_partner: getSafeToken('pickup_partner'),
});

export const AuthProvider = ({ children }) => {
  const { pathname } = useLocation();
  const currentRole = getRoleFromPath(pathname);

  const [authData, setAuthData] = useState(readInitialAuthData);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const token = authData[currentRole];
  const isAuthenticated = Boolean(token);

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        if (!cancelled) setIsLoading(true);
        const endpoint = getProfileEndpointByRole(currentRole);
        const response = await getWithDedupe(endpoint, {}, { ttl: 5000 });
        if (!cancelled) setUser(response.data.result);
      } catch (error) {
        if (!cancelled) {
          console.error('[Auth] Profile fetch failed:', error.response?.status, error.message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [token, currentRole]);

  const login = useCallback((userData) => {
    const role = userData.role?.toLowerCase() || 'customer';
    const storageKey = ROLE_STORAGE_KEYS[role];

    if (storageKey && userData.token) {
      localStorage.setItem(storageKey, userData.token);
      setAuthData((prev) => ({ ...prev, [role]: userData.token }));
      setUser(userData);
    } else {
      console.error('Invalid role or missing token for login:', role);
    }
  }, []);

  const logout = useCallback(async () => {
    if (currentRole === 'delivery' && token) {
      try {
        await axiosInstance.post('/delivery/logout');
      } catch (error) {
        console.error('Failed to notify backend of delivery logout:', error);
      }
    }

    Object.values(ROLE_STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem('token');

    setAuthData({
      customer: null,
      seller: null,
      admin: null,
      delivery: null,
      pickup_partner: null,
    });
    setUser(null);

    if (pathname.startsWith('/admin')) window.location.href = '/admin/auth';
    else if (pathname.startsWith('/seller')) window.location.href = '/seller/auth';
    else if (pathname.startsWith('/delivery')) window.location.href = '/delivery/auth';
    else if (pathname.startsWith('/pickup')) window.location.href = '/pickup/auth';
    else window.location.href = '/login';
  }, [pathname, currentRole, token]);

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    try {
      const endpoint = getProfileEndpointByRole(currentRole);
      const response = await axiosInstance.get(endpoint, {
        params: { _t: Date.now() },
      });
      setUser(response.data.result);
      return response.data.result;
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      return null;
    }
  }, [token, currentRole]);

  /** Merge profile fields without re-writing the JWT in storage */
  const patchUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      role: currentRole,
      isAuthenticated,
      isLoading,
      authData,
      login,
      logout,
      refreshUser,
      patchUser,
    }),
    [user, token, currentRole, isAuthenticated, isLoading, authData, login, logout, refreshUser, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
