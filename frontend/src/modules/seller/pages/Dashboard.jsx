import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import PageHeader from "@shared/components/ui/PageHeader";
import Badge from "@shared/components/ui/Badge";
import {
  IndianRupee,
  Truck,
  Package,
  TrendingUp,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  Plus,
  Eye,
} from "lucide-react";
import {
  HiOutlineTruck,
  HiOutlineXMark,
  HiOutlineMapPin,
  HiOutlinePhone,
  HiOutlineBanknotes,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";

const prTotalAmount = (pr) => {
  if (pr?.pricing?.grandTotal != null) return Number(pr.pricing.grandTotal);
  if (pr?.totalCost != null) return Number(pr.totalCost);
  const items = Array.isArray(pr?.items) ? pr.items : [];
  return items.reduce(
    (sum, it) =>
      sum +
      Number(
        it.totalCost ||
          Number(it.unitCost || 0) * Number(it.shortageQty || it.requiredQty || 0) +
            Number(it.gstAmount || 0),
      ),
    0,
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [recentPRs, setRecentPRs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, prRes] = await Promise.all([
          sellerApi.getStats(),
          sellerApi.getPurchaseRequests({ limit: 5 })
        ]);

        if (cancelled) return;

        if (statsRes.data.success) setStatsData(statsRes.data.result);
        if (prRes.data.success) {
          setRecentPRs(prRes.data.result?.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard Fetch Error:", error);
          toast.error("Failed to load dashboard data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const loadingOrStats = loading;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const revenueChartData = React.useMemo(() => {
    const raw = statsData?.salesTrend ?? statsData?.chartData ?? [];
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length > 0) {
      return arr.map((d) => ({
        name: d.name ?? d.date ?? "—",
        sales: Number(d.sales ?? d.revenue ?? d.total ?? 0) || 0,
      }));
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { name: dayNames[d.getDay()], sales: 0 };
    });
  }, [statsData?.salesTrend, statsData?.chartData]);
  const revenueMax = Math.max(1, ...revenueChartData.map((d) => d.sales));

  const stats = [
    {
      label: "Total Supply Value",
      value: statsData?.overview?.totalSales || "₹0",
      change: "+12.5%",
      changeType: "increase",
      icon: IndianRupee,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      description: "all-time earnings",
    },
    {
      label: "Fulfillment Tasks",
      value: statsData?.overview?.totalOrders || "0",
      change: "+8.2%",
      changeType: "increase",
      icon: ShoppingBag,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      description: "total PRs handled",
    },
    {
      label: "Pending Supplies",
      value: statsData?.overview?.pendingPRs || "0",
      change: "Action Required",
      changeType: "increase",
      icon: Clock,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
      description: "PRs to fulfill",
    },
  ];

  const quickActions = [
    {
      label: "View Purchase Orders",
      title: "View Tasks",
      description: "Manage and fulfill procurement requests",
      icon: Truck,
      path: "/seller/procurement",
      variant: "primary",
    },
    {
      title: "View Earnings",
      description: "Check your revenue and payouts",
      icon: IndianRupee,
      path: "/seller/earnings",
      variant: "outline",
    },
    {
      title: "Manage Stock",
      description: "Update your inventory levels",
      icon: Package,
      path: "/seller/inventory",
      variant: "outline",
    },
  ];

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    switch (s) {
      case "pending":
        return "warning";
      case "processing":
      case "confirmed":
        return "info";
      case "packed":
        return "primary";
      case "shipped":
      case "out_for_delivery":
        return "secondary";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "secondary";
    }
  };

  if (loadingOrStats) {
    return <div className="flex items-center justify-center min-h-[40vh] font-bold text-slate-600">Updating Dashboard...</div>;
  }

  return (
    <div className="ds-section-spacing relative">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's what's happening with your store today."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-base font-medium text-slate-600">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "text-xs font-semibold flex items-center gap-1",
                      stat.changeType === "increase" ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    <TrendingUp className={cn("h-3 w-3", stat.changeType === "decrease" && "rotate-180")} />
                    {stat.change}
                  </span>
                  <span className="text-sm text-slate-600">{stat.description}</span>
                </div>
              </div>
              <div className={cn("p-3 rounded-lg", stat.iconBg)}>
                <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {quickActions.map((action) => {
          const isPrimary = action.variant === "primary";
          const isEmerald = action.variant === "outline-emerald";
          return (
            <button
              key={action.title}
              onClick={() => navigate(action.path)}
              className={cn(
                "p-6 rounded-xl text-left transition-all duration-200 shadow-sm hover:shadow-md border-2",
                isPrimary && "bg-primary border-primary text-white hover:bg-primary/90 hover:border-primary/90",
                action.variant === "outline" && "bg-white border-slate-200 text-slate-900 hover:border-primary hover:bg-primary/5",
                isEmerald && "bg-white border-slate-200 text-slate-900 hover:border-emerald-500 hover:bg-emerald-50"
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-lg",
                  isPrimary ? "bg-white/20" : isEmerald ? "bg-emerald-50" : "bg-slate-100"
                )}>
                  <action.icon className={cn(
                    "h-5 w-5",
                    isPrimary ? "text-white" : isEmerald ? "text-emerald-600" : "text-slate-700"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-semibold text-sm",
                    isPrimary ? "text-white" : "text-slate-900"
                  )}>
                    {action.title}
                  </h3>
                  <p className={cn(
                    "text-xs mt-1",
                    isPrimary ? "text-white/90" : "text-slate-600"
                  )}>
                    {action.description}
                  </p>
                </div>
                <ArrowUpRight className={cn(
                  "h-4 w-4 shrink-0",
                  isPrimary ? "text-white/70" : "text-slate-600"
                )} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Revenue Chart */}
        <Card title="Supply Value Trend" subtitle="Last 7 days performance" className="w-full">
          <div className="h-[220px] sm:h-[280px] md:h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => `₹${Number(value).toLocaleString()}`}
                  domain={[0, revenueMax]}
                  allowDataOverflow
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: "#334155",
                  }}
                  formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Supply Value"]}
                  labelFormatter={(label) => `Day: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>


      {/* Recent Purchase Orders */}
      <Card
        title="Recent Purchase Orders"
        subtitle="Latest procurement requests from Hub"
        actions={
          <button
            onClick={() => navigate("/seller/procurement")}
            className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 flex-wrap"
          >
            View All
            <ArrowUpRight className="h-4 w-4" />
          </button>
        }
      >
        {/* Mobile View: Stacked Cards */}
        <div className="block md:hidden space-y-3 mt-3">
          {recentPRs.map((pr) => (
            <div key={pr._id} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="text-sm font-black text-slate-900">{pr.requestId}</span>
                <Badge variant={getStatusColor(pr.status)} className="capitalize text-[10px] px-2 py-0.5 font-bold tracking-wider">
                  {pr.status?.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="flex flex-col gap-1 text-xs text-slate-500 font-bold">
                <p>Destination: <span className="text-slate-800">Central Hub</span></p>
                <p>Date: <span className="text-slate-800">{new Date(pr.createdAt).toLocaleDateString()}</span></p>
                <p>Item: <span className="text-slate-800">{pr.product || (Array.isArray(pr.items) && pr.items.length > 0 ? pr.items[0].productName : "Products")}</span></p>
              </div>
              <div className="flex justify-between items-center border-t border-slate-50 pt-2 mt-1">
                <span className="text-xs font-bold text-slate-400">Total Amount</span>
                <span className="text-sm font-black text-slate-900">₹{prTotalAmount(pr).toFixed(2)}</span>
              </div>
            </div>
          ))}
          {recentPRs.length === 0 && (
            <p className="py-8 text-center text-slate-500 font-medium">No recent purchase orders found</p>
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  PR ID
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Destination
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Items
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentPRs.map((pr) => (
                <tr key={pr._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm font-semibold text-slate-900">{pr.requestId}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                        H
                      </div>
                      <span className="text-sm font-medium text-slate-700">Central Hub</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm text-slate-600">{new Date(pr.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="text-xs font-medium text-slate-600">
                      {pr.product || (Array.isArray(pr.items) && pr.items.length > 0 ? pr.items[0].productName : "Products")}
                    </span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="text-sm font-semibold text-slate-900">₹{prTotalAmount(pr).toFixed(2)}</span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <Badge variant={getStatusColor(pr.status)} className="capitalize">
                      {pr.status?.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
              {recentPRs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                    No recent purchase orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
