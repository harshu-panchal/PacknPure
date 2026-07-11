import ProtectedRoute from '@core/guards/ProtectedRoute';
import CustomerLayoutWrapper from './CustomerLayoutWrapper';
import { CustomerPages as P } from './customerLazyPages';

/**
 * Customer storefront route children (mounted under `/` in AppRouter).
 */
export const customerRouteChildren = [
  {
    element: <CustomerLayoutWrapper />,
    children: [
      { index: true, element: <P.Home /> },
      { path: 'categories', element: <P.CategoriesPage /> },
      { path: 'category/:categoryName', element: <P.CategoryProductsPage /> },
      { path: 'product/:id', element: <P.ProductDetailPage /> },
      { path: 'terms', element: <P.TermsPage /> },
      { path: 'privacy', element: <P.PrivacyPage /> },
      { path: 'about', element: <P.AboutPage /> },
      { path: 'offers', element: <P.OffersPage /> },
      { path: 'search', element: <P.SearchPage /> },
      {
        path: 'wishlist',
        element: (
          <ProtectedRoute>
            <P.WishlistPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute>
            <P.OrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:orderId',
        element: (
          <ProtectedRoute>
            <P.OrderDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transactions',
        element: (
          <ProtectedRoute>
            <P.OrderTransactionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'addresses',
        element: (
          <ProtectedRoute>
            <P.AddressesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <P.SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute>
            <P.NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'support',
        element: (
          <ProtectedRoute>
            <P.SupportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'chat',
        element: (
          <ProtectedRoute>
            <P.ChatPage />
          </ProtectedRoute>
        ),
      },
      { path: 'cart', element: <P.CartPage /> },
      { path: 'checkout', element: <P.CheckoutPage /> },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <P.ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile/edit',
        element: (
          <ProtectedRoute>
            <P.EditProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile/request-product',
        element: (
          <ProtectedRoute>
            <P.RequestProductPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'wallet',
        element: (
          <ProtectedRoute>
            <P.WalletPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
];
