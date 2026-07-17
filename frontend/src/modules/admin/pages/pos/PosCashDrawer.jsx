import React, { useState } from 'react';
import { usePosSession } from '../../context/PosSessionContext';
import { posApi } from '../../services/posApi';
import { Banknote, ArrowUpRight, ArrowDownRight, History, ArrowRight, Power, X } from 'lucide-react';
import { Button } from '@mui/material';
import { toast } from 'sonner';

export default function PosCashDrawer() {
    const { activeSession, fetchCurrentSession, closeSession } = usePosSession();
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('deposit');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
    const [actualCash, setActualCash] = useState('');

    if (!activeSession) {
        return <div className="p-8 text-center text-red-500 font-bold">No active session found. Please open a session first.</div>;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || amount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }
        
        setIsSubmitting(true);
        try {
            const { data } = await posApi.addCashMovement({
                sessionId: activeSession._id,
                type: type.toUpperCase(),
                amount: Number(amount),
                notes
            });
            
            if (data.success) {
                toast.success(`Cash ${type} recorded successfully`);
                setAmount('');
                setNotes('');
                // Refresh session data to get updated expectedCash
                fetchCurrentSession(); 
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to record cash movement");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseSession = async () => {
        if (actualCash === '') {
            toast.error("Please enter the actual cash amount");
            return;
        }
        setIsSubmitting(true);
        const success = await closeSession(Number(actualCash));
        setIsSubmitting(false);
        if (success) {
            setIsClosingModalOpen(false);
            window.location.href = '/admin/pos';
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Side: Actions */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Banknote className="w-7 h-7 mr-3 text-blue-600" />
                        Manage Cash Drawer
                    </h1>
                    <Button 
                        variant="contained" 
                        color="error" 
                        startIcon={<Power />}
                        onClick={() => {
                            setActualCash(activeSession.expectedCash); // default to expected
                            setIsClosingModalOpen(true);
                        }}
                    >
                        End Session
                    </Button>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Record Cash Movement</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex gap-4 mb-4">
                            <button
                                type="button"
                                onClick={() => setType('deposit')}
                                className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-lg border-2 font-bold transition-all ${
                                    type === 'deposit' 
                                    ? 'border-green-500 bg-green-50 text-green-700' 
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                <ArrowDownRight className="w-5 h-5" /> Pay In (Deposit)
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('withdrawal')}
                                className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-lg border-2 font-bold transition-all ${
                                    type === 'withdrawal' 
                                    ? 'border-orange-500 bg-orange-50 text-orange-700' 
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                <ArrowUpRight className="w-5 h-5" /> Pay Out (Withdrawal)
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (₹)</label>
                            <input 
                                type="number" 
                                min="1"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full text-2xl p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                                placeholder="0.00"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Reason / Notes</label>
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. Added change, Paid vendor, etc."
                                rows={3}
                                required
                            />
                        </div>

                        <Button 
                            type="submit"
                            variant="contained" 
                            color={type === 'deposit' ? 'success' : 'warning'}
                            fullWidth
                            size="large"
                            disabled={isSubmitting || !amount}
                            className="!py-3 !font-bold"
                        >
                            Record {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right Side: Status & History */}
            <div className="space-y-6">
                <div className="bg-blue-600 text-white p-6 rounded-xl shadow-md flex items-center justify-between">
                    <div>
                        <p className="text-blue-100 font-medium mb-1">Expected Cash in Drawer</p>
                        <h2 className="text-4xl font-black">₹{activeSession.expectedCash.toFixed(2)}</h2>
                    </div>
                    <Banknote className="w-16 h-16 opacity-20" />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <History className="w-4 h-4 mr-2" /> Recent Movements
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {/* Fake history data for UI since backend doesn't return full audit array in session endpoint yet, 
                            We will just show summary stats from session for now until a history endpoint is wired. */}
                        
                        <MovementItem type="opening" amount={activeSession.openingCash} note="Session Opened" time={activeSession.openedAt} />
                        
                        {activeSession.totalCashSales > 0 && (
                            <MovementItem type="sale" amount={activeSession.totalCashSales} note="Cash Sales (Aggregated)" />
                        )}
                        
                        {activeSession.totalRefunds > 0 && (
                            <MovementItem type="withdrawal" amount={activeSession.totalRefunds} note="Refunds (Aggregated)" />
                        )}

                        {activeSession.transactions?.map(tx => (
                            <MovementItem 
                                key={tx._id}
                                type={tx.type.toLowerCase()} 
                                amount={Math.abs(tx.amount)} 
                                note={tx.remarks} 
                                time={tx.createdAt}
                            />
                        ))}

                        {(!activeSession.transactions || activeSession.transactions.length === 0) && (
                            <div className="py-8 text-center text-gray-400 text-sm italic">
                                No manual deposits or withdrawals yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* End Session Modal */}
            {isClosingModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 flex items-center">
                                <Power className="w-5 h-5 mr-2 text-red-500" /> End POS Session
                            </h3>
                            <button onClick={() => setIsClosingModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 flex justify-between items-center border border-blue-100">
                                <div>
                                    <p className="text-sm font-medium opacity-80">Expected Cash</p>
                                    <h4 className="text-2xl font-bold">₹{activeSession.expectedCash.toFixed(2)}</h4>
                                </div>
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Actual Cash in Drawer (₹)</label>
                                <input 
                                    type="number" 
                                    value={actualCash}
                                    onChange={(e) => setActualCash(e.target.value)}
                                    className="w-full text-2xl p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 font-bold"
                                    placeholder="0.00"
                                />
                                <p className="text-xs text-gray-500 mt-2">Count the physical cash in your drawer and enter it above to calculate any discrepancies.</p>
                            </div>
                            <div className="flex gap-4">
                                <Button 
                                    variant="outlined" 
                                    color="inherit" 
                                    fullWidth
                                    onClick={() => setIsClosingModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    variant="contained" 
                                    color="error" 
                                    fullWidth
                                    disabled={isSubmitting || actualCash === ''}
                                    onClick={handleCloseSession}
                                >
                                    {isSubmitting ? "Closing..." : "Close Session"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const MovementItem = ({ type, amount, note, time }) => {
    const isPositive = ['opening', 'sale', 'deposit'].includes(type);
    
    return (
        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {isPositive ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div>
                    <p className="font-semibold text-gray-800 text-sm capitalize">{type}</p>
                    <p className="text-xs text-gray-500">{note}</p>
                </div>
            </div>
            <div className="text-right">
                <p className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : '-'}₹{amount.toFixed(2)}
                </p>
                {time && <p className="text-[10px] text-gray-400">{new Date(time).toLocaleTimeString()}</p>}
            </div>
        </div>
    );
};
