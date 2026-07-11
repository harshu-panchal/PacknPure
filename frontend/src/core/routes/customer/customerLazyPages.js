/**
 * Lazy-loaded customer storefront pages.
 * Single import surface for AppRouter / route config.
 */
import { lazy } from 'react';

export const CustomerPages = {
  Home: lazy(() => import('@modules/customer/pages/Home')),
  CategoriesPage: lazy(() => import('@modules/customer/pages/CategoriesPage')),
  CategoryProductsPage: lazy(() => import('@modules/customer/pages/CategoryProductsPage')),
  WishlistPage: lazy(() => import('@modules/customer/pages/WishlistPage')),
  OffersPage: lazy(() => import('@modules/customer/pages/OffersPage')),
  ProfilePage: lazy(() => import('@modules/customer/pages/ProfilePage')),
  OrdersPage: lazy(() => import('@modules/customer/pages/OrdersPage')),
  OrderTransactionsPage: lazy(() => import('@modules/customer/pages/OrderTransactionsPage')),
  AddressesPage: lazy(() => import('@modules/customer/pages/AddressesPage')),
  SettingsPage: lazy(() => import('@modules/customer/pages/SettingsPage')),
  SupportPage: lazy(() => import('@modules/customer/pages/SupportPage')),
  NotificationsPage: lazy(() => import('@modules/customer/pages/Notifications')),
  ChatPage: lazy(() => import('@modules/customer/pages/ChatPage')),
  TermsPage: lazy(() => import('@modules/customer/pages/TermsPage')),
  PrivacyPage: lazy(() => import('@modules/customer/pages/PrivacyPage')),
  AboutPage: lazy(() => import('@modules/customer/pages/AboutPage')),
  EditProfilePage: lazy(() => import('@modules/customer/pages/EditProfilePage')),
  OrderDetailPage: lazy(() => import('@modules/customer/pages/OrderDetailPage')),
  ProductDetailPage: lazy(() => import('@modules/customer/pages/ProductDetailPage')),
  CheckoutPage: lazy(() => import('@modules/customer/pages/CheckoutPage')),
  CartPage: lazy(() => import('@modules/customer/pages/CartPage')),
  SearchPage: lazy(() => import('@modules/customer/pages/SearchPage')),
  WalletPage: lazy(() => import('@modules/customer/pages/WalletPage')),
  RequestProductPage: lazy(() => import('@modules/customer/pages/RequestProductPage')),
};
