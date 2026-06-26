import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import RootErrorBoundary, { NotFoundPage } from '@shared/components/RootErrorBoundary';
import AppProviders from '@core/AppProviders';
import { authRoutes, roleModuleRoutes } from './moduleRoutes';
import { customerRouteChildren } from './customer/customerRouteConfig';

const UnauthorizedPage = () => (
  <div className="flex h-screen items-center justify-center font-outfit">
    Unauthorized Access
  </div>
);

const AppRouter = () => {
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: '/',
          element: (
            <AppProviders>
              <Outlet />
            </AppProviders>
          ),
          errorElement: <RootErrorBoundary />,
          children: [
            ...authRoutes,
            ...roleModuleRoutes,
            { path: 'unauthorized', element: <UnauthorizedPage /> },
            ...customerRouteChildren,
            // Keep this as an explicit route so unknown URLs show a branded 404 page
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ]),
    [],
  );

  return <RouterProvider router={router} />;
};

export default AppRouter;
 