import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  IndianRupee,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Filter,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { deliveryApi } from "../services/deliveryApi";

const Earnings = () => {
  const [activeTab, setActiveTab] = useState("weekly");
  const [loading, setLoading] = useState(true);
  const [earningsData, setEarningsData] = useState({
    totalEarnings: 0,
    incentives: 0,
    bonuses: 0,
    onlinePay: 0,
    cashCollected: 0,
    chartData: [],
    recentTransactions: []
  });

  const fetchEarnings = async (period = activeTab) => {
    try {
      setLoading(true);
      const response = await deliveryApi.getEarnings({ period });
      if (response.data.success && response.data.result) {
        const result = response.data.result;
        setEarningsData({
          totalEarnings: result.totalEarnings || 0,
          incentives: result.incentives || 0,
          bonuses: result.bonuses || 0,
          onlinePay: result.onlinePay || 0,
          cashCollected: result.cashCollected || 0,
          chartData: result.chartData || [],
          recentTransactions: result.transactions || result.recentTransactions || []
        });
      }
    } catch (error) {
      toast.error("Failed to fetch earnings data");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEarnings(activeTab);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    fetchEarnings(tab);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading && !earningsData.totalEarnings && earningsData.chartData.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 transition-colors min-h-screen pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm p-6 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-4">
          <h1 className="ds-h2 text-gray-900 dark:text-white">My Earnings</h1>
          <Button variant="ghost" size="icon">
            <Download size={20} className="text-gray-600 dark:text-gray-300" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl" role="tablist" aria-label="Earnings period">
          {["today", "weekly", "monthly"].map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-2.5 min-h-10 text-sm font-bold rounded-lg transition-all duration-200 capitalize cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${activeTab === tab
                ? "bg-white dark:bg-gray-800 text-primary shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        className="p-6 space-y-6 max-w-lg mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible">
        {/* Total Earnings Card */}
        <motion.div variants={itemVariants}>
          <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-primary/30 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 dark:bg-gray-800/20 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 dark:bg-gray-800/20 rounded-full -ml-10 -mb-10 blur-xl"></div>

            <p className="text-blue-100 font-medium text-sm uppercase tracking-wide mb-1 relative z-10">
              {activeTab === "today" ? "Today's Earnings" : activeTab === "monthly" ? "Monthly Earnings" : "Weekly Earnings"}
            </p>
            <div className="flex items-baseline mb-6 relative z-10">
              <span className="text-3xl font-bold mr-1">₹</span>
              <span className="text-5xl font-extrabold tracking-tight">
                {earningsData.totalEarnings.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20 relative z-10">
              <div>
                <p className="text-blue-100 text-xs mb-1">Incentives</p>
                <p className="font-bold text-lg">+₹{earningsData.incentives}</p>
              </div>
              <div>
                <p className="text-blue-100 text-xs mb-1">Bonuses</p>
                <p className="font-bold text-lg">+₹{earningsData.bonuses}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Chart */}
        <motion.div variants={itemVariants}>
          <Card className="p-5 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center text-sm">
                <TrendingUp size={18} className="mr-2 text-green-500" />
                Earnings Trend
              </h3>
              <span className="text-xs font-semibold text-gray-400 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full border border-gray-100 dark:border-gray-700">
                {activeTab === "today" ? "Today (Hourly)" : activeTab === "monthly" ? "Last 30 Days" : "Last 7 Days"}
              </span>
            </div>
            <div className="w-full h-56 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={earningsData.chartData} barSize={22} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                    dy={6}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0, 102, 255, 0.05)" }}
                    formatter={(value) => [`₹${value}`, "Earnings"]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.1)",
                      fontWeight: "bold",
                    }}
                  />
                  <Bar
                    dataKey="earnings"
                    fill="#0066FF"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Breakdown */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <Wallet size={20} />
              </div>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                +8%
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase">
              Online Pay
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">₹{earningsData.onlinePay.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <IndianRupee size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                0%
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase">
              Cash (COD)
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">₹{earningsData.cashCollected.toLocaleString()}</p>
          </Card>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-100 dark:bg-gray-900 transition-colors">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">Recent Activity</h3>
              <Button
                variant="link"
                className="text-primary text-xs font-bold h-auto p-0">
                View All
              </Button>
            </div>
            <div className="divide-y divide-gray-100">
              {earningsData.recentTransactions.length > 0 ? earningsData.recentTransactions.map((txn, idx) => {
                const isDebit = txn.type.includes('Withdrawal') || txn.type.includes('Cash Settlement');
                const getStatusBadge = () => {
                  if (txn.type === "Delivery Earning" || txn.type === "Incentive" || txn.type === "Bonus") {
                    return { label: "In Wallet", className: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" };
                  }
                  if (txn.type === "Cash Collection") {
                    return { label: "In Hand", className: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" };
                  }
                  if (txn.type === "Withdrawal") {
                    if (txn.status === "Settled") return { label: "Paid to Bank", className: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" };
                    if (txn.status === "Pending" || txn.status === "Processing") return { label: "Pending Approval", className: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800" };
                    return { label: "Rejected", className: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800" };
                  }
                  if (txn.type === "Cash Settlement") {
                    if (txn.status === "Settled") return { label: "Remitted to Admin", className: "text-green-600 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800" };
                    if (txn.status === "Pending" || txn.status === "Processing") return { label: "Pending Approval", className: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800" };
                    return { label: "Rejected", className: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800" };
                  }
                  return { label: txn.status || "Settled", className: "text-gray-600 bg-gray-50 border-gray-200" };
                };
                const badge = getStatusBadge();

                return (
                  <div
                    key={txn._id || txn.id || `txn-${idx}`}
                    className="p-4 flex justify-between items-center hover:bg-gray-100 dark:bg-gray-900 transition-colors cursor-pointer">
                    <div className="flex items-center">
                      <div
                        className={`p-2 rounded-full mr-3 ${!isDebit ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>
                        <ArrowUpRight size={16} className={isDebit ? "rotate-180" : ""} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{txn.type}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {txn.date || new Date(txn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {txn.id || (txn._id ? txn._id.toString().slice(-6).toUpperCase() : 'N/A')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isDebit ? 'text-gray-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isDebit ? '-' : '+'}₹{Math.abs(txn.amount)}
                      </p>
                      <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              }) : (
                <div className="p-12 text-center text-gray-400 text-sm italic">
                  No recent earnings or withdrawals.
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Earnings;
