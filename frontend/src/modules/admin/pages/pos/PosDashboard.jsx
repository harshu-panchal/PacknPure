import React, { useState, useEffect } from 'react';
import { usePosSession } from '../../context/PosSessionContext';
import { posApi } from '../../services/posApi';
import { Terminal, Banknote, Power, CheckCircle, Store, AlertTriangle, ArrowRight, PackageSearch, Boxes, ShoppingCart } from 'lucide-react';
import { Button } from '@mui/material';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function PosDashboard() {
    const { activeSession, activeTerminal, openSession } = usePosSession();
    const [terminals, setTerminals] = useState([]);
    const [selectedTerminal, setSelectedTerminal] = useState('');
    const [openingCash, setOpeningCash] = useState(0);
    const [isOpening, setIsOpening] = useState(false);
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    useEffect(() => {
        fetchTerminals();
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            setIsLoadingStats(true);
            const { data } = await posApi.getDashboardStats();
            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error("Failed to load POS dashboard stats", error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    const fetchTerminals = async () => {
        try {
            const { data } = await posApi.getTerminals();
            if (data.success) {
                setTerminals(data.results || []);
                if (data.results?.length > 0 && !activeTerminal) {
                    setSelectedTerminal(data.results[0]._id);
                }
            }
        } catch (error) {
            console.error("Failed to load terminals", error);
        }
    };

    const handleOpenSession = async () => {
        if (!selectedTerminal) {
            toast.error("Please select a terminal");
            return;
        }
        setIsOpening(true);
        const success = await openSession(selectedTerminal, Number(openingCash));
        if (success) {
            toast.success("POS Control Center Activated");
        }
        setIsOpening(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Store className="mr-3 w-8 h-8 text-blue-600" />
                        PacknPure Operational Control Center
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Unified view of Hub Inventory, POS Sales, and Procurement
                    </p>
                </div>
                {activeSession && (
                    <Button 
                        variant="contained" 
                        color="primary" 
                        size="large"
                        startIcon={<ShoppingCart />}
                        onClick={() => navigate('/admin/pos/checkout')}
                    >
                        Quick Order (F4)
                    </Button>
                )}
            </div>

            {/* Quick Session Launcher if no active session */}
            {!activeSession && (
                <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                            <Power className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-blue-900 text-lg">POS Session Offline</h3>
                            <p className="text-blue-700 text-sm">You must open a register session to process Quick Orders.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto flex-wrap">
                        <select 
                            value={selectedTerminal} 
                            onChange={(e) => setSelectedTerminal(e.target.value)}
                            className="p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                        >
                            <option value="" disabled>-- Choose Terminal --</option>
                            {terminals.map(t => (
                                <option key={t._id} value={t._id}>{t.name}</option>
                            ))}
                        </select>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                            <input 
                                type="number" 
                                min="0"
                                value={openingCash} 
                                onChange={(e) => setOpeningCash(e.target.value)}
                                placeholder="Opening Float"
                                className="pl-8 pr-3 py-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 w-32 font-medium"
                            />
                        </div>
                        <Button 
                            variant="contained" 
                            color="primary"
                            disabled={!selectedTerminal || isOpening}
                            onClick={handleOpenSession}
                        >
                            {isOpening ? "Opening..." : "Start Session"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Unified Business Metrics */}
            <h2 className="text-lg font-bold text-gray-800 mb-4">Today's Performance Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                    title="Today's POS Sales" 
                    value={isLoadingStats ? '...' : `₹${stats?.sales?.pos?.toLocaleString() || 0}`} 
                    icon={Banknote} 
                    color="emerald" 
                    trend={isLoadingStats ? '...' : `${stats?.orders?.totalPosToday || 0} Orders`} 
                />
                <StatCard 
                    title="Today's Online Sales" 
                    value={isLoadingStats ? '...' : `₹${stats?.sales?.online?.toLocaleString() || 0}`} 
                    icon={ShoppingCart} 
                    color="blue" 
                    trend={isLoadingStats ? '...' : `${stats?.orders?.totalOnlineToday || 0} Orders`} 
                />
                <StatCard 
                    title="Pending POS Orders" 
                    value={isLoadingStats ? '...' : stats?.orders?.pendingPos || 0} 
                    icon={Boxes} 
                    color="indigo" 
                    subtitle="Awaiting Take Away / Delivery" 
                />
                <StatCard 
                    title="Low Stock Alerts" 
                    value={isLoadingStats ? '...' : stats?.inventory?.lowStockAlerts || 0} 
                    icon={AlertTriangle} 
                    color="red" 
                    subtitle="Requires immediate procurement" 
                    action={() => navigate('/admin/pos/low-stock')} 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Operations Links */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <Terminal className="w-5 h-5 mr-2 text-gray-500" />
                        Quick Access
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <QuickLink 
                            title="Hub Inventory" 
                            desc="View total available stock" 
                            icon={Boxes} 
                            onClick={() => navigate('/admin/pos/inventory')} 
                        />
                        <QuickLink 
                            title="Procurement Status" 
                            desc="Track vendor stock requests" 
                            icon={PackageSearch} 
                            onClick={() => navigate('/admin/pos/procurement')} 
                        />
                        <QuickLink 
                            title="Current POS Orders" 
                            desc="Track active take-aways & deliveries" 
                            icon={ShoppingCart} 
                            onClick={() => navigate('/admin/pos/orders')} 
                        />
                        <QuickLink 
                            title="Manage Cash Drawer" 
                            desc="Session cash drops/withdrawals" 
                            icon={Banknote} 
                            onClick={() => navigate('/admin/pos/cash-drawer')} 
                            disabled={!activeSession}
                        />
                    </div>
                </div>

                {/* Session details */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                        Active Session Health
                    </h3>
                    {activeSession ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600">Opened At</span>
                                <span className="font-semibold text-gray-800">{format(new Date(activeSession.openedAt), "dd MMM yyyy, hh:mm a")}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600">Expected Cash</span>
                                <span className="font-semibold text-gray-800">₹{activeSession.expectedCash.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-gray-600">POS Sales Today</span>
                                <span className="font-semibold text-gray-800">
                                    {(activeSession.totalCashSales + activeSession.totalCardSales + activeSession.totalUpiSales).toFixed(2)}
                                </span>
                            </div>
                            <div className="pt-2 text-right">
                                <Button variant="text" onClick={() => navigate('/admin/pos/cash-drawer')}>
                                    Close Session <ArrowRight className="w-4 h-4 ml-1"/>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Power className="w-8 h-8 mb-2" />
                            <p>No active session</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const StatCard = ({ title, value, icon: Icon, color, trend, subtitle, action }) => {
    const colorMap = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        red: 'bg-red-50 text-red-600 border-red-100 cursor-pointer hover:shadow-md transition-shadow',
    };

    return (
        <div 
            onClick={action}
            className={`p-5 rounded-xl border ${colorMap[color] || 'bg-gray-50 border-gray-200'} flex flex-col justify-between`}
        >
            <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-bold opacity-90">{title}</p>
                <Icon className="w-5 h-5 opacity-70" />
            </div>
            <div>
                <h3 className="text-3xl font-black mb-1">{value}</h3>
                {trend && <p className="text-xs font-semibold opacity-80">{trend}</p>}
                {subtitle && <p className="text-xs opacity-70">{subtitle}</p>}
            </div>
        </div>
    );
};

const QuickLink = ({ title, desc, icon: Icon, onClick, disabled }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`text-left p-4 rounded-lg border flex items-start transition-colors ${
            disabled ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 bg-white'
        }`}
    >
        <div className={`p-2 rounded-lg mr-3 ${disabled ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <h4 className={`font-bold text-sm ${disabled ? 'text-gray-500' : 'text-gray-800'}`}>{title}</h4>
            <p className="text-xs text-gray-500 mt-1">{desc}</p>
        </div>
    </button>
);
