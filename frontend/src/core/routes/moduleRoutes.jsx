import { lazy } from 'react';
import { Outlet } from 'react-router-dom';
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

/**
 * RR v7: multi-segment splats like `seller/*` break descendant <Routes> matching.
 * Split into path + child splat so /seller/earnings resolves inside SellerModule.
 */
export const roleModuleRoutes = [
  {
    path: 'seller',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.SELLER]}>
          <Outlet />
        </RoleGuard>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <SellerModule /> },
      { path: '*', element: <SellerModule /> },
    ],
  },
  {
    path: 'admin',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.ADMIN]}>
          <Outlet />
        </RoleGuard>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminModule /> },
      { path: '*', element: <AdminModule /> },
    ],
  },
  {
    path: 'delivery',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.DELIVERY]}>
          <Outlet />
        </RoleGuard>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DeliveryModule /> },
      { path: '*', element: <DeliveryModule /> },
    ],
  },
  {
    path: 'pickup',
    element: (
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.PICKUP_PARTNER]}>
          <Outlet />
        </RoleGuard>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PickupModule /> },
      { path: '*', element: <PickupModule /> },
    ],
  },
];
