import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import {
  HiOutlineSquares2X2,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineClipboardDocumentList,
  HiOutlineArchiveBox,
  HiOutlineChartBarSquare,
  HiOutlineCreditCard,
  HiOutlineMapPin,
  HiOutlineSquaresPlus,
  HiOutlineQrCode,
  HiOutlineClipboardDocumentCheck,
} from "react-icons/hi2";
import { Terminal } from "lucide-react";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const BarcodeStickerManagement = React.lazy(
  () => import("../pages/BarcodeStickerManagement"),
);
const StockAudit = React.lazy(() => import("../pages/StockAudit"));
const StockManagement = React.lazy(() => import("../pages/StockManagement"));
const AddProduct = React.lazy(() => import("../pages/AddProduct"));
const CatalogListing = React.lazy(() => import("../pages/CatalogListing"));
const Returns = React.lazy(() => import("../pages/Returns"));
const ProcurementRequests = React.lazy(
  () => import("../pages/ProcurementRequests"),
);
const Earnings = React.lazy(() => import("../pages/Earnings"));
const Analytics = React.lazy(() => import("../pages/Analytics"));
const Transactions = React.lazy(() => import("../pages/Transactions"));
const DeliveryTracking = React.lazy(() => import("../pages/DeliveryTracking"));
const Profile = React.lazy(() => import("../pages/Profile"));
const Withdrawals = React.lazy(() => import("../pages/Withdrawals"));
const Notifications = React.lazy(() => import("../pages/Notifications"));

// POS Components
const PosDashboard = React.lazy(() => import("@shared/pos/pages/PosDashboard"));
const PosTerminals = React.lazy(() => import("@shared/pos/pages/PosTerminals"));
const PosCheckout = React.lazy(() => import("@shared/pos/pages/PosCheckout"));
const PosReceiptPage = React.lazy(() => import("@shared/pos/pages/PosReceiptPage"));
const CurrentOrders = React.lazy(() => import("@shared/pos/pages/CurrentOrders"));
const PosSessions = React.lazy(() => import("@shared/pos/pages/PosSessions"));
const PosCashDrawer = React.lazy(() => import("@shared/pos/pages/PosCashDrawer"));
const PosReports = React.lazy(() => import("@shared/pos/pages/PosReports"));
const PosSettings = React.lazy(() => import("@shared/pos/pages/PosSettings"));
const PosReturns = React.lazy(() => import("@shared/pos/pages/Returns"));
import { PosLayout } from "@shared/pos/components/PosLayout";
import { PosEngineProvider } from "@shared/pos/context/PosEngineContext";

const navItems = [
  { sectionHeader: "Point of Sale" },
  {
    label: "POS System",
    icon: Terminal,
    children: [
      { label: "Dashboard", path: "/seller/pos" },
      { label: "Terminals", path: "/seller/pos/terminals" },
      { label: "Quick Order", path: "/seller/pos/checkout" },
      { label: "Current Orders", path: "/seller/pos/orders" },
      { label: "Cash Drawer", path: "/seller/pos/cash-drawer" },
      { label: "Returns", path: "/seller/pos/returns" },
      { label: "Sessions", path: "/seller/pos/sessions" },
      { label: "Reports", path: "/seller/pos/reports" },
      { label: "Settings", path: "/seller/pos/settings" },
    ],
  },
  { sectionHeader: "Core Management" },
  { label: "Dashboard", path: "/seller", icon: HiOutlineSquares2X2, end: true },
  { label: "Products", path: "/seller/products", icon: HiOutlineCube },
  { label: "Barcodes", path: "/seller/barcodes", icon: HiOutlineQrCode },
  {
    label: "Stock Audit",
    path: "/seller/stock-audit",
    icon: HiOutlineClipboardDocumentCheck,
  },
  { label: "Hub Catalog", path: "/seller/catalog", icon: HiOutlineSquaresPlus },
  { label: "Stock", path: "/seller/inventory", icon: HiOutlineArchiveBox },
  {
    label: "Purchase Orders",
    path: "/seller/procurement",
    icon: HiOutlineClipboardDocumentList,
  },
  { label: "Returns", path: "/seller/returns", icon: HiOutlineArchiveBox },
  { label: "Track Shipments", path: "/seller/tracking", icon: HiOutlineMapPin },
  {
    label: "Sales Reports",
    path: "/seller/analytics",
    icon: HiOutlineChartBarSquare,
  },
  {
    label: "Withdrawals",
    path: "/seller/withdrawals",
    icon: HiOutlineCurrencyDollar,
  },
  {
    label: "Payment History",
    path: "/seller/transactions",
    icon: HiOutlineCreditCard,
  },
  {
    label: "Notifications",
    path: "/seller/notifications",
    icon: HiOutlineClipboardDocumentList,
  },
  {
    label: "Earnings",
    path: "/seller/earnings",
    icon: HiOutlineCurrencyDollar,
  },
  { label: "Profile", path: "/seller/profile", icon: HiOutlineUser },
];

const SellerRoutes = () => {
  return (
    <DashboardLayout navItems={navItems} title="Vendor Panel">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<ProductManagement />} />
        <Route path="/products/add" element={<AddProduct />} />
        <Route path="/barcodes" element={<BarcodeStickerManagement />} />
        <Route path="/stock-audit" element={<StockAudit />} />
        <Route path="/catalog" element={<CatalogListing />} />
        <Route path="/inventory" element={<StockManagement />} />
        <Route path="/orders" element={<Navigate to="/seller/procurement" replace />} />
        <Route path="/procurement" element={<ProcurementRequests />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/tracking" element={<DeliveryTracking />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/withdrawals" element={<Withdrawals />} />
        <Route path="/profile" element={<Profile />} />

        {/* POS Routes wrapped in PosLayout */}
        <Route path="/pos" element={
          <PosEngineProvider role="seller">
            <PosLayout />
          </PosEngineProvider>
        }>
          <Route index element={<PosDashboard />} />
          <Route path="terminals" element={<PosTerminals />} />
          <Route path="checkout" element={<PosCheckout />} />
          <Route path="receipt/:orderId" element={<PosReceiptPage />} />
          <Route path="orders" element={<CurrentOrders />} />
          <Route path="sessions" element={<PosSessions />} />
          <Route path="cash-drawer" element={<PosCashDrawer />} />
          <Route path="returns" element={<PosReturns />} />
          <Route path="reports" element={<PosReports />} />
          <Route path="settings" element={<PosSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default SellerRoutes;
