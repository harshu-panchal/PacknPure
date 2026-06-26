import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import PageHeader from '@shared/components/ui/PageHeader';
import StatCard from '@shared/components/ui/StatCard';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import {
    Users,
    Store,
    Truck,
    BarChart3,
    Activity,
    Database,
    RotateCw,
    Loader2
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await adminApi.getStats();
                if (res.data.success) {
                    setStatsData(res.data.result);
                }
            } catch (error) {
                console.error("Dashboard Stats Error:", error);
                toast.error("Failed to fetch dashboard data");
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Synchronizing Data...</p>
            </div>
        );
    }

    const overview = statsData?.overview || {};

    const stats = [
        {
            label: 'Total Users',
            value: overview.totalUsers?.toLocaleString() || '0',
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            trend: '+12.5%',
            description: 'Active this month',
            path: '/admin/customers'
        },
        {
            label: 'Active Sellers',
            value: overview.activeSellers?.toLocaleString() || '0',
            icon: Store,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            trend: '+5.2%',
            description: 'Verified stores',
            path: '/admin/suppliers'
        },
        {
            label: 'Total Orders',
            value: overview.totalOrders?.toLocaleString() || '0',
            icon: Truck,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            trend: '+18.4%',
            description: 'Last 30 days',
            path: '/admin/orders/all'
        },

        {
            label: 'All Categories',
            value: overview.allCategoryCount?.toLocaleString() || '0',
            icon: Database,
            color: 'text-teal-600',
            bg: 'bg-teal-50',
            trend: 'Active',
            description: 'Platform categories',
            path: '/admin/categories/hierarchy'
        },
        {
            label: 'Inactive Sellers',
            value: overview.inactiveSellerCount?.toLocaleString() || '0',
            icon: RotateCw,
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            trend: 'Review',
            description: 'Pending approval',
            path: '/admin/sellers/pending'
        },
        {
            label: 'Revenue',
            value: `₹${overview.totalRevenue?.toLocaleString() || '0'}`,
            icon: BarChart3,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            trend: '+8.2%',
            description: 'Net earnings',
            path: '/admin/reports'
        },
    ];

    const chartData = statsData?.revenueHistory || [];
    const categoryData = statsData?.categoryData || [];
    const recentOrders = statsData?.recentOrders || [];
    const topProducts = statsData?.topProducts || [];

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Dashboard"
                description="Overview of your platform's performance."
                actions={
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <Badge variant="outline" className="ds-badge ds-badge-gray hidden sm:inline-flex">
                            Last Update: Today, 12:45 PM
                        </Badge>
                        <button className="bg-primary text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 whitespace-nowrap transition-transform">
                            Download Report
                        </button>
                    </div>
                }
            />

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {stats.map((stat) => (
                    <div 
                        key={stat.label} 
                        onClick={() => navigate(stat.path)}
                        className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
                    >
                        <StatCard
                            label={stat.label}
                            value={stat.value}
                            icon={stat.icon}
                            trend={stat.trend}
                            description={stat.description}
                            color={stat.color}
                            bg={stat.bg}
                            className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 p-5 h-full"
                        />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Revenue Analytics */}
                <div className="lg:col-span-2">
                    <Card
                        title="Earnings"
                        subtitle="Monthly revenue trends"
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 h-full"
                    >
                        <div className="ds-chart-container min-h-[250px] relative">
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        dy={8}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        tickFormatter={(value) => `₹${value}`}
                                    />
                                    <Tooltip
                                        formatter={(value) => [`₹${value}`, "Revenue"]}
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            padding: '8px',
                                            fontSize: '11px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#4f46e5"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorRevenue)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Categories Distribution */}
                <div className="lg:col-span-1">
                    <Card
                        title="Top Categories"
                        subtitle="Sales breakdown by category"
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 h-full"
                    >
                        <div className="h-[250px] min-h-[250px] relative">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}

                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-bold text-gray-900">72%</span>
                                <span className="text-[10px] text-gray-400 font-semibold uppercase">Growth</span>
                            </div>
                        </div>
                        <div className="space-y-3 mt-4">
                            {categoryData.map((cat) => (
                                <div key={cat.name} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                        <span className="text-sm font-semibold text-gray-600">{cat.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">{cat.value}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Orders */}
                <div className="lg:col-span-2">
                    <Card
                        title="Recent Orders"
                        subtitle="Track the latest customer orders"
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 h-full"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left border-b border-gray-100">
                                        <th className="admin-table-header">Order ID</th>
                                        <th className="admin-table-header">Customer</th>
                                        <th className="admin-table-header">Status</th>
                                        <th className="admin-table-header">Amount</th>
                                        <th className="admin-table-header">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} className="group hover:bg-gray-50/50 transition-all">
                                            <td className="py-4 text-sm font-semibold text-primary">{order.id}</td>
                                            <td className="py-4">
                                                <div className="flex items-center space-x-2">
                                                    <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-500 ring-2 ring-white shadow-sm uppercase">
                                                        {order.customer?.[0] || "?"}
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-700">{order.customer}</span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <Badge variant={order.status} className="rounded-full px-3 py-0.5 text-[10px] font-bold tracking-tight uppercase">
                                                    {order.statusText}
                                                </Badge>
                                            </td>
                                            <td className="py-4 text-sm font-bold text-gray-900">{order.amount}</td>
                                            <td className="py-4 text-xs font-semibold text-gray-400">{order.time}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button className="w-full mt-6 py-3 rounded-xl bg-gray-50 text-xs font-bold text-gray-500 hover:bg-primary hover:text-white transition-all">
                            VIEW ALL ORDERS
                        </button>
                    </Card>
                </div>

                {/* Top Products */}
                <div className="lg:col-span-1">
                    <Card
                        title="Top Products"
                        subtitle="Best selling items this week"
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 h-full"
                    >
                        <div className="space-y-4">
                            {topProducts.length > 0 ? topProducts.map((product, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group">
                                    <div className="flex items-center space-x-3">
                                        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform", product.color)}>
                                            {product.icon}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 leading-none">{product.name}</p>
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase mt-1.5">{product.cat}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">{product.rev}</p>
                                        <p className="text-[10px] text-emerald-600 font-bold">{product.trend}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-12 text-center text-slate-300 italic text-xs">No sales data yet</div>
                            )}
                        </div>
                        <button className="w-full mt-6 py-3 border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-gray-400 hover:border-primary hover:text-primary transition-all">
                            VIEW ALL PRODUCTS
                        </button>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;

