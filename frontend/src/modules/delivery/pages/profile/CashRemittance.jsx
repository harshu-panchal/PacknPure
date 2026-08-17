import React, { useState, useEffect } from "react";
import {
    IndianRupee,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowLeft,
    Banknote,
    Smartphone,
    AlertTriangle,
    RotateCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import { deliveryApi } from "../../services/deliveryApi";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const CashRemittance = () => {
    const navigate = useNavigate();
    const [amount, setAmount] = useState("");
    const [mode, setMode] = useState("Cash");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [wallet, setWallet] = useState({
        cashWallet: 0,
        cashLimit: 5000,
        isOverCashLimit: false,
    });
    const [history, setHistory] = useState([]);

    const fetchData = async () => {
        try {
            setFetching(true);
            const [summaryRes, historyRes] = await Promise.all([
                deliveryApi.getWalletSummary(),
                deliveryApi.getEarnings(),
            ]);
            if (summaryRes.data?.success) {
                setWallet(summaryRes.data.result);
            }
            if (historyRes.data?.success) {
                const txns = historyRes.data.result?.recentTransactions || historyRes.data.result?.transactions || [];
                setHistory(txns.filter((t) => t.type === "Cash Settlement"));
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRequest = async () => {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            return toast.error("Please enter a valid amount");
        }
        if (Number(amount) > wallet.cashWallet) {
            return toast.error("Amount exceeds your cash collection balance");
        }

        setLoading(true);
        try {
            const res = await deliveryApi.requestCashRemittance({ amount: Number(amount), mode });
            if (res.data.success) {
                toast.success("Transfer request submitted. Waiting for admin approval.");
                setAmount("");
                fetchData();
            } else {
                toast.error(res.data.message || "Failed to submit request");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to submit request");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-100 dark:bg-gray-900 transition-colors min-h-screen pb-24">
            <div className="bg-white dark:bg-gray-800 px-6 py-4 flex items-center shadow-sm sticky top-0 z-50">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    aria-label="Go back"
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-gray-700 transition-colors mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                    <ArrowLeft className="text-gray-900 dark:text-white" size={24} />
                </button>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Transfer Cash to Admin</h1>
            </div>

            <div className="p-6 space-y-6 max-w-lg mx-auto">
                {/* Cash Wallet Balance Card */}
                <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden border border-slate-700/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <div className="relative z-10">
                        <p className="text-slate-300 text-xs font-bold uppercase tracking-wider mb-2 opacity-90">
                            Cash Collection Wallet
                        </p>
                        <h2 className="text-4xl font-extrabold flex items-baseline leading-none tracking-tight">
                            <span className="text-2xl mr-1 font-bold">₹</span>
                            {(wallet.cashWallet || 0).toLocaleString()}
                        </h2>
                        <div className="mt-6 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                                <span>Limit: ₹{(wallet.cashLimit || 0).toLocaleString()}</span>
                                <span>{wallet.cashLimitUsedPercent ?? 0}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all",
                                        wallet.isOverCashLimit ? "bg-rose-500" : "bg-emerald-400",
                                    )}
                                    style={{ width: `${Math.min(wallet.cashLimitUsedPercent ?? 0, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {wallet.isOverCashLimit && (
                    <div className="flex items-start gap-3 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                        <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-xs text-rose-700 font-semibold leading-relaxed">
                            You've reached your cash-in-hand limit. New COD orders are blocked until you transfer cash to admin.
                        </p>
                    </div>
                )}

                {/* Transfer Form */}
                <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                            <Banknote size={20} />
                        </div>
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">Submit Transfer</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Mode Toggle */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                                Transfer Mode
                            </label>
                            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setMode("Cash")}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
                                        mode === "Cash" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-400",
                                    )}
                                >
                                    <Banknote size={16} /> Cash
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode("Online")}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
                                        mode === "Online" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-400",
                                    )}
                                >
                                    <Smartphone size={16} /> Online
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                                Amount to Transfer
                            </label>
                            <div className="relative">
                                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-2xl py-4 pl-12 pr-16 font-bold text-xl outline-none ring-1 ring-gray-100 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setAmount(String(wallet.cashWallet || 0))}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary uppercase"
                                >
                                    Max
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                            <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                                {mode === "Cash"
                                    ? "Hand over the physical cash to admin/hub staff. Your wallet updates once admin confirms receipt."
                                    : "Transfer the amount online to admin's account, then submit. Your wallet updates once admin confirms receipt."}
                            </p>
                        </div>

                        <Button
                            onClick={handleRequest}
                            disabled={loading || !amount || Number(amount) <= 0}
                            className="w-full py-4 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20"
                        >
                            {loading ? <RotateCw className="animate-spin mr-2" size={18} /> : null}
                            {loading ? "SUBMITTING..." : "SUBMIT TRANSFER"}
                        </Button>
                    </div>
                </Card>

                {/* History */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                            Transfer History
                        </h3>
                        <button
                            onClick={fetchData}
                            className="text-primary text-[10px] font-bold flex items-center gap-1 uppercase"
                        >
                            <RotateCw size={12} className={fetching ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>

                    <div className="space-y-3">
                        {history.length > 0 ? (
                            history.map((item, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={item._id || item.id || idx}
                                    className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-50 flex items-center justify-between"
                                >
                                    <div className="flex items-center">
                                        <div
                                            className={cn(
                                                "p-3 rounded-full mr-4",
                                                item.status === "Settled"
                                                    ? "bg-green-50 text-green-600"
                                                    : item.status === "Failed"
                                                        ? "bg-red-50 text-red-600"
                                                        : "bg-amber-50 text-amber-600",
                                            )}
                                        >
                                            {item.status === "Settled" ? (
                                                <CheckCircle2 size={18} />
                                            ) : item.status === "Failed" ? (
                                                <XCircle size={18} />
                                            ) : (
                                                <Clock size={18} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">
                                                ₹{Math.abs(item.amount).toLocaleString()}
                                            </p>
                                            <p className="text-[10px] font-medium text-gray-400 mt-0.5">
                                                {new Date(item.createdAt || item.date).toLocaleDateString()} •{" "}
                                                {item.meta?.mode || "Cash"}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={cn(
                                            "px-2 py-1 rounded text-[10px] font-bold tracking-wider leading-none",
                                            item.status === "Settled"
                                                ? "bg-green-50 text-green-600"
                                                : item.status === "Failed"
                                                    ? "bg-red-50 text-red-600"
                                                    : "bg-amber-50 text-amber-600",
                                        )}
                                    >
                                        {(item.status || "Pending").toUpperCase()}
                                    </span>
                                </motion.div>
                            ))
                        ) : (
                            <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl border border-dashed border-gray-200 text-center">
                                <Clock className="mx-auto text-gray-200 mb-2" size={32} />
                                <p className="text-xs text-gray-400 font-medium tracking-tight">No transfers yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashRemittance;
