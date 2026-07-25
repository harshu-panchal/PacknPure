import React, { Suspense, useMemo } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import DashboardLayout from "@shared/layout/DashboardLayout";
import Loader from "@shared/components/ui/Loader";
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
} from "react-icons/hi2";
import { Terminal } from "lucide-react";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const ProductManagement = React.lazy(
  () => import("../pages/ProductManagement"),
);
const BarcodeStickerManagement = React.lazy(
  () => import("../pages/BarcodeStickerManagement"),
);
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

/** Map /seller/* path → page without relying on descendant <Routes> splat matching. */
function resolveSellerPage(pathname) {
  const sub = pathname.replace(/^\/seller\/?/, "").replace(/\/$/, "");

  if (!sub) return <Dashboard />;

  switch (sub) {
    case "products":
      return <ProductManagement />;
    case "products/add":
      return <AddProduct />;
    case "barcodes":
      return <BarcodeStickerManagement />;
    case "catalog":
      return <CatalogListing />;
    case "inventory":
      return <StockManagement />;
    case "orders":
      return <Navigate to="/seller/procurement" replace />;
    case "procurement":
      return <ProcurementRequests />;
    case "returns":
      return <Returns />;
    case "tracking":
      return <DeliveryTracking />;
    case "analytics":
      return <Analytics />;
    case "withdrawals":
      return <Withdrawals />;
    case "transactions":
      return <Transactions />;
    case "notifications":
      return <Notifications />;
    case "earnings":
      return <Earnings />;
    case "profile":
      return <Profile />;
    default:
      return null;
  }
}

const SellerRoutes = () => {
  const { pathname } = useLocation();
  const isPos = pathname.startsWith("/seller/pos");

  const page = useMemo(() => {
    if (isPos) return null;
    return resolveSellerPage(pathname);
  }, [pathname, isPos]);

  return (
    <DashboardLayout navItems={navItems} title="Vendor Panel">
      <Suspense fallback={<Loader />}>
        {isPos ? (
          <Routes>
            <Route
              path="pos"
              element={
                <PosEngineProvider role="seller">
                  <PosLayout />
                </PosEngineProvider>
              }
            >
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
            <Route
              path="/seller/pos/*"
              element={
                <PosEngineProvider role="seller">
                  <PosLayout />
                </PosEngineProvider>
              }
            >
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
            <Route path="*" element={<Navigate to="/seller/pos" replace />} />
          </Routes>
        ) : page != null ? (
          page
        ) : (
          <Navigate to="/seller" replace />
        )}
      </Suspense>
    </DashboardLayout>
  );
};

export default SellerRoutes;
