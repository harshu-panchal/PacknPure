import { lazy } from 'react';
import ProtectedRoute from '@core/guards/ProtectedRoute';
import RoleGuard from '@core/guards/RoleGuard';
import { UserRole } from '@core/constants/roles';

import CustomerAuth from '@modules/customer/pages/CustomerAuth';
import SellerAuth from '@modules/seller/pages/Auth';
import AdminAuth from '@modules/admin/pages/AdminAuth';
import DeliveryAuth from '@modules/delivery/pages/DeliveryAuth';
import PickupAuth from '@modules/pickup/pages/Auth';

const SellerModule = lazy(() => import('@modules/seller/routes/index'));
const AdminModule = lazy(() => import('@modules/admin/routes/index'));
const DeliveryModule = lazy(() => import('@modules/delivery/routes/index'));
const PickupModule = lazy(() => import('@modules/pickup/routes/index'));

/** Public auth routes (no layout wrapper). */
export const authRoutes = [
  { path: 'login', element: <CustomerAuth /> },
  { path: 'signup', element: <CustomerAuth /> },
  { path: 'seller/auth', element: <SellerAuth /> },
  { path: 'admin/auth', element: <AdminAuth /> },
  { path: 'delivery/auth', element: <DeliveryAuth /> },
  { path: 'pickup/auth', element: <PickupAuth /> },
];

/** Role dashboards — lazy-loaded sub-routers. */
export const roleModuleRoutes = [
  {
    path: 'seller/*',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.SELLER]}>
          <SellerModule />
        </RoleGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: 'admin/*',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.ADMIN]}>
          <AdminModule />
        </RoleGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: 'delivery/*',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.DELIVERY]}>
          <DeliveryModule />
        </RoleGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: 'pickup/*',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.PICKUP_PARTNER]}>
          <PickupModule />
        </RoleGuard>
      </ProtectedRoute>
    ),
  },
];
