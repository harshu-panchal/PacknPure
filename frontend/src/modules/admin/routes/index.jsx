import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import {
  LayoutDashboard,
  Tag,
  Box,
  Boxes,
  Store,
  Truck,
  Bike,
  FileClock,
  Wallet,
  Banknote,
  Receipt,
  CircleDollarSign,
  Users,
  HelpCircle,
  ClipboardList,
  RotateCcw,
  Settings,
  Terminal,
  Sparkles,
  User,
  MapPin,
  PackageSearch,
} from "lucide-react";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const CategoryManagement = React.lazy(
  () => import("../pages/CategoryManagement"),
);
const Level2Categories = React.lazy(
  () => import("../pages/categories/Level2Categories"),
);
const SubCategories = React.lazy(
  () => import("../pages/categories/SubCategories"),
);
const CategoryHierarchy = React.lazy(
  () => import("../pages/categories/CategoryHierarchy"),
);
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const HubInventoryPage = React.lazy(() => import("../pages/HubInventoryPage"));
const PurchaseRequestsPage = React.lazy(
  () => import("../pages/PurchaseRequestsPage"),
);
const PickupPartnersPage = React.lazy(
  () => import("../pages/PickupPartnersPage"),
);
const DeliveryPartnersPage = React.lazy(
  () => import("../pages/DeliveryPartnersPage"),
);
const DeliveryPartnerProfile = React.lazy(
  () => import("../pages/DeliveryPartnerProfile"),
);
const ActiveSellers = React.lazy(() => import("../pages/ActiveSellers"));
const PendingSellers = React.lazy(() => import("../pages/PendingSellers"));
const SuppliersManagementPage = React.lazy(
  () => import("../pages/SuppliersManagementPage"),
);
const SellerLocations = React.lazy(() => import("../pages/SellerLocations"));
const ActiveDeliveryBoys = React.lazy(
  () => import("../pages/ActiveDeliveryBoys"),
);
const PendingDeliveryBoys = React.lazy(
  () => import("../pages/PendingDeliveryBoys"),
);
const DeliveryFunds = React.lazy(() => import("../pages/DeliveryFunds"));
const AdminWallet = React.lazy(() => import("../pages/AdminWallet"));
const WithdrawalRequests = React.lazy(
  () => import("../pages/WithdrawalRequests"),
);
const SellerTransactions = React.lazy(
  () => import("../pages/SellerTransactions"),
);
const CashCollection = React.lazy(() => import("../pages/CashCollection"));
const CustomerManagement = React.lazy(
  () => import("../pages/CustomerManagement"),
);
const CustomerDetail = React.lazy(() => import("../pages/CustomerDetail"));
const UserManagement = React.lazy(() => import("../pages/UserManagement"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const FAQManagement = React.lazy(() => import("../pages/FAQManagement"));
const OrdersList = React.lazy(() => import("../pages/OrdersList"));
const OrderDetail = React.lazy(() => import("../pages/OrderDetail"));
const SellerDetail = React.lazy(() => import("../pages/SellerDetail"));
const SupportTickets = React.lazy(() => import("../pages/SupportTickets"));
const ReviewModeration = React.lazy(() => import("../pages/ReviewModeration"));
const FleetTracking = React.lazy(() => import("../pages/FleetTracking"));
const CouponManagement = React.lazy(() => import("../pages/CouponManagement"));
const ContentManager = React.lazy(() => import("../pages/ContentManager"));
const HeroCategoriesPerPage = React.lazy(() => import("../pages/HeroCategoriesPerPage"));
const NotificationComposer = React.lazy(
  () => import("../pages/NotificationComposer"),
);
const OffersManagement = React.lazy(
  () => import("../pages/OffersManagement"),
);
const AdminSettings = React.lazy(() => import("../pages/AdminSettings"));

const AdminProfile = React.lazy(() => import("../pages/AdminProfile"));
const HubSettings = React.lazy(() => import("../pages/HubSettings"));
const Reports = React.lazy(() => import("../pages/Reports"));
const ProductRequestsList = React.lazy(() => import("../pages/ProductRequestsList"));

// POS Components
const PosDashboard = React.lazy(() => import("../pages/pos/PosDashboard"));
const PosTerminals = React.lazy(() => import("../pages/pos/PosTerminals"));
const PosCheckout = React.lazy(() => import("../pages/pos/PosCheckout"));
const CurrentOrders = React.lazy(() => import("../pages/pos/CurrentOrders"));
const PosInventory = React.lazy(() => import("../pages/pos/PosInventory"));
const LowStockAlerts = React.lazy(() => import("../pages/pos/LowStockAlerts"));
const ProcurementStatus = React.lazy(() => import("../pages/pos/ProcurementStatus"));
const PosCashDrawer = React.lazy(() => import("../pages/pos/PosCashDrawer"));
const Returns = React.lazy(() => import("../pages/pos/Returns"));
const PosReports = React.lazy(() => import("../pages/pos/PosReports"));
const PosSettings = React.lazy(() => import("../pages/pos/PosSettings"));
import { PosLayout } from "../components/pos/PosLayout";

const navItems = [
  { sectionHeader: "Core Management" },
  {
    label: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    color: "indigo",
    end: true,
  },
  {
    label: "Orders",
    icon: ClipboardList,
    color: "fuchsia",
    path: "/admin/orders/all"
  },
  {
    label: "Reports",
    path: "/admin/reports",
    icon: Sparkles,
    color: "indigo",
  },

  { sectionHeader: "Point of Sale" },
  {
    label: "POS System",
    icon: Terminal,
    color: "cyan",
    children: [
      { label: "Dashboard", path: "/admin/pos" },
      { label: "Terminals", path: "/admin/pos/terminals" },
      { label: "Quick Order", path: "/admin/pos/checkout" },
      { label: "Current Orders", path: "/admin/pos/orders" },
      { label: "Hub Inventory", path: "/admin/pos/inventory" },
      { label: "Low Stock Alerts", path: "/admin/pos/low-stock" },
      { label: "Procurement Status", path: "/admin/pos/procurement" },
      { label: "Cash Drawer", path: "/admin/pos/cash-drawer" },
      { label: "Returns", path: "/admin/pos/returns" },
      { label: "Reports", path: "/admin/pos/reports" },
      { label: "Settings", path: "/admin/pos/settings" },
    ],
  },

  { sectionHeader: "Menu & Categories" },
  {
    label: "Categories",
    icon: Tag,
    color: "rose",
    children: [
      { label: "All Categories", path: "/admin/categories/hierarchy" },
      { label: "Parent Categories", path: "/admin/categories/level2" },
      { label: "Sub-Categories", path: "/admin/categories/sub" },
    ],
  },
  {
    label: "Marketing Tools",
    icon: Sparkles,
    color: "amber",
    children: [
      { label: "Content Manager", path: "/admin/experience-studio" },
      { label: "Hero & categories per page", path: "/admin/hero-categories" },
      { label: "Send Notifications", path: "/admin/notifications" },
      { label: "Coupons & Promos", path: "/admin/coupons" },
    ],
  },

  { sectionHeader: "Product Management" },
  { label: "Products", path: "/admin/products", icon: Box, color: "amber" },
  {
    label: "Hub Inventory",
    path: "/admin/hub-inventory",
    icon: Boxes,
    color: "teal",
  },
  {
    label: "Product Requests",
    path: "/admin/product-requests",
    icon: PackageSearch,
    color: "blue",
  },

  { sectionHeader: "Vendors & Sellers" },
  {
    label: "Suppliers",
    path: "/admin/suppliers",
    icon: Store,
    color: "lime",
  },
  {
    label: "Purchase Requests",
    path: "/admin/purchase-requests",
    icon: FileClock,
    color: "orange",
  },

  { sectionHeader: "Delivery & Logistics" },
  {
    label: "Pickup Partners",
    path: "/admin/pickup-partners",
    icon: Truck,
    color: "emerald",
  },
  {
    label: "Delivery Partners",
    path: "/admin/delivery-partners",
    icon: Bike,
    color: "indigo",
  },
  {
    label: "Delivery Drivers",
    icon: Truck,
    color: "emerald",
    children: [
      { label: "Active Drivers", path: "/admin/delivery-boys/active" },
      { label: "Waiting for Review", path: "/admin/delivery-boys/pending" },
      { label: "Track Drivers", path: "/admin/tracking" },
      { label: "Send Money", path: "/admin/delivery-funds" },
    ],
  },

  { sectionHeader: "Customers & Support" },
  { label: "Customers", path: "/admin/customers", icon: Users, color: "sky" },
  {
    label: "Customer Support",
    icon: Receipt,
    color: "emerald",
    children: [
      { label: "Help Tickets", path: "/admin/support-tickets" },
      { label: "Review Content", path: "/admin/moderation" },
    ],
  },
  { label: "FAQs", path: "/admin/faqs", icon: HelpCircle, color: "pink" },

  { sectionHeader: "Finance" },
  { label: "Wallet", path: "/admin/wallet", icon: Wallet, color: "violet" },
  {
    label: "Money Requests",
    path: "/admin/withdrawals",
    icon: Banknote,
    color: "cyan",
  },
  {
    label: "Seller Payments",
    path: "/admin/seller-transactions",
    icon: Receipt,
    color: "orange",
  },
  {
    label: "Collect Cash",
    path: "/admin/cash-collection",
    icon: CircleDollarSign,
    color: "green",
  },

  { sectionHeader: "Settings" },
  {
    label: "Logistics & Returns",
    path: "/admin/billing",
    icon: RotateCcw,
    color: "red",
  },
  {
    label: "Hub Settings",
    path: "/admin/hub-settings",
    icon: MapPin,
    color: "indigo",
  },
  { label: "My Profile", path: "/admin/profile", icon: User, color: "indigo" },
  {
    label: "Settings",
    path: "/admin/settings",
    icon: Settings,
    color: "slate",
  },
];

const BillingCharges = React.lazy(() => import("../pages/BillingCharges"));

const AdminRoutes = () => {
  return (
    <DashboardLayout navItems={navItems} title="Admin Center">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/profile" element={<AdminProfile />} />
        {/* Lazy routes for new sections */}
        <Route
          path="/categories"
          element={<Navigate to="/admin/categories/hierarchy" replace />}
        />
        <Route path="/categories/level2" element={<Level2Categories />} />
        <Route path="/categories/sub" element={<SubCategories />} />
        <Route path="/categories/hierarchy" element={<CategoryHierarchy />} />
        <Route path="/products" element={<ProductManagement />} />
        <Route path="/hub-inventory" element={<HubInventoryPage />} />
        <Route path="/suppliers" element={<SuppliersManagementPage />} />
        <Route path="/suppliers/:id" element={<SellerDetail />} />
        <Route path="/vendors" element={<Navigate to="/admin/suppliers" replace />} />
        <Route path="/product-requests" element={<ProductRequestsList />} />
        <Route path="/purchase-requests" element={<PurchaseRequestsPage />} />
        <Route path="/pickup-partners" element={<PickupPartnersPage />} />
        <Route path="/delivery-partners" element={<DeliveryPartnersPage />} />
        <Route path="/sellers/active" element={<Navigate to="/admin/suppliers?tab=verified" replace />} />
        <Route path="/sellers/active/:id" element={<SellerDetail />} />
        <Route path="/support-tickets" element={<SupportTickets />} />
        <Route path="/moderation" element={<ReviewModeration />} />
        <Route path="/experience-studio" element={<ContentManager />} />
        <Route path="/hero-categories" element={<HeroCategoriesPerPage />} />
        <Route path="/notifications" element={<NotificationComposer />} />
        <Route path="/offers" element={<OffersManagement />} />
        <Route path="/coupons" element={<CouponManagement />} />
        <Route path="/sellers/pending" element={<Navigate to="/admin/suppliers?tab=pending" replace />} />
        <Route path="/seller-locations" element={<SellerLocations />} />
        <Route path="/delivery-boys/active" element={<ActiveDeliveryBoys />} />
        <Route path="/delivery-boys/:id" element={<DeliveryPartnerProfile />} />
        <Route
          path="/delivery-boys/pending"
          element={<PendingDeliveryBoys />}
        />
        <Route path="/tracking" element={<FleetTracking />} />
        <Route path="/delivery-funds" element={<DeliveryFunds />} />
        <Route path="/wallet" element={<AdminWallet />} />
        <Route path="/withdrawals" element={<WithdrawalRequests />} />
        <Route path="/seller-transactions" element={<SellerTransactions />} />
        <Route path="/cash-collection" element={<CashCollection />} />
        <Route path="/customers" element={<CustomerManagement />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/faqs" element={<FAQManagement />} />
        <Route path="/orders/:status" element={<OrdersList />} />
        <Route path="/orders/view/:orderId" element={<OrderDetail />} />
        <Route path="/billing" element={<BillingCharges />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<AdminSettings />} />
        <Route path="/hub-settings" element={<HubSettings />} />

        {/* POS Routes wrapped in PosLayout */}
        <Route path="/pos" element={<PosLayout />}>
          <Route index element={<PosDashboard />} />
          <Route path="terminals" element={<PosTerminals />} />
          <Route path="checkout" element={<PosCheckout />} />
          <Route path="orders" element={<CurrentOrders />} />
          <Route path="inventory" element={<PosInventory />} />
          <Route path="low-stock" element={<LowStockAlerts />} />
          <Route path="procurement" element={<ProcurementStatus />} />
          <Route path="cash-drawer" element={<PosCashDrawer />} />
          <Route path="returns" element={<Returns />} />
          <Route path="reports" element={<PosReports />} />
          <Route path="settings" element={<PosSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default AdminRoutes;
