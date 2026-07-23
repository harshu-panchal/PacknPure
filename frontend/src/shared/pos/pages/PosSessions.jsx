import React, { useState, useEffect, useRef } from 'react';
import { History, Search, Terminal } from 'lucide-react';
import { posApi } from '../services/posApi';
import { usePosEngine } from '../context/PosEngineContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function PosSessions() {
    const { role } = usePosEngine();
    const isSeller = role === 'seller';
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const fetchSessions = async (search = '') => {
        setIsLoading(true);
        try {
            const res = await posApi.getSessions({ search });
            if (res.data?.success) {
                setSessions(res.data.results || res.data.result || []);
            }
        } catch (error) {
            toast.error("Failed to load sessions");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const searchTimeout = useRef(null);
    const handleSearch = (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            fetchSessions(val);
        }, 500);
    };

    return (
        <div className="pos-page max-w-6xl mx-auto w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                        <History className="w-7 h-7 text-blue-600 flex-shrink-0" aria-hidden />
                        POS Sessions History
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">Review past shifts and end-of-day reports</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gray-50">
                    <div className="relative w-full sm:w-64 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
                        <input 
                            type="search"
                            aria-label="Search sessions"
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search Cashier or Terminal..." 
                            className="w-full min-h-11 pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-gray-500 min-h-[40vh] flex items-center justify-center" role="status">Loading sessions...</div>
                ) : sessions.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                        <History className="w-12 h-12 mb-4 text-gray-300" />
                        <p className="text-lg">No sessions found.</p>
                        <p className="text-sm">Historical session data will appear here.</p>
                    </div>
                ) : (
                    <>
                    <div className="block lg:hidden divide-y divide-gray-100">
                        {sessions.map((session) => (
                            <div key={session._id} className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-bold text-gray-800 truncate">{session.terminalId?.name || 'Unknown Terminal'}</div>
                                        <div className="text-xs text-gray-500">{session.cashierId?.name || 'Unknown Cashier'}</div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${session.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {session.status}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div><span className="text-gray-500">Opened</span><p className="font-medium text-gray-800">{format(new Date(session.openedAt), 'dd MMM, hh:mm a')}</p></div>
                                    {isSeller ? (
                                        <>
                                            <div><span className="text-gray-500">Cash Sales</span><p className="font-semibold text-gray-800">₹{(session.totalCashSales || 0).toFixed(2)}</p></div>
                                            <div><span className="text-gray-500">Online Sales</span><p className="font-semibold text-gray-800">₹{(session.totalOnlineSales || 0).toFixed(2)}</p></div>
                                            <div><span className="text-gray-500">Total Sales</span><p className="font-bold text-gray-800">₹{((session.totalCashSales || 0) + (session.totalOnlineSales || 0)).toFixed(2)}</p></div>
                                        </>
                                    ) : (
                                        <>
                                            <div><span className="text-gray-500">POS Sales</span><p className="font-bold text-gray-800">₹{((session.totalCashSales || 0) + (session.totalCardSales || 0) + (session.totalUPISales || 0)).toFixed(2)}</p></div>
                                            <div><span className="text-gray-500">Expected</span><p className="font-medium">₹{session.expectedCash?.toFixed(2) || '0.00'}</p></div>
                                            <div><span className="text-gray-500">Difference</span><p className={`font-bold ${session.cashDifference < 0 ? 'text-red-500' : session.cashDifference > 0 ? 'text-green-500' : 'text-gray-400'}`}>{session.cashDifference > 0 ? '+' : ''}{session.cashDifference !== undefined ? session.cashDifference.toFixed(2) : '0.00'}</p></div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="hidden lg:block overflow-x-auto overscroll-x-contain">
                        <table className={`w-full text-left border-collapse ${isSeller ? 'min-w-[720px]' : 'min-w-[900px]'}`}>
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
                                    <th className="p-4 font-semibold">Terminal & Cashier</th>
                                    <th className="p-4 font-semibold">Status</th>
                                    <th className="p-4 font-semibold">Opened</th>
                                    <th className="p-4 font-semibold">Closed</th>
                                    {isSeller && <th className="p-4 font-semibold text-right">Cash Sales</th>}
                                    {isSeller && <th className="p-4 font-semibold text-right">Online Sales</th>}
                                    <th className="p-4 font-semibold text-right">{isSeller ? 'Total Sales' : 'POS Sales'}</th>
                                    {!isSeller && <th className="p-4 font-semibold text-right">Expected</th>}
                                    {!isSeller && <th className="p-4 font-semibold text-right">Actual</th>}
                                    {!isSeller && <th className="p-4 font-semibold text-right">Difference</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((session) => (
                                    <tr key={session._id} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center">
                                                <div className="bg-gray-100 p-2 rounded mr-3">
                                                    <Terminal className="w-5 h-5 text-gray-500" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{session.terminalId?.name || 'Unknown Terminal'}</div>
                                                    <div className="text-xs text-gray-500">{session.cashierId?.name || 'Unknown Cashier'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${session.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {session.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {format(new Date(session.openedAt), 'dd MMM yyyy, hh:mm a')}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {session.closedAt ? format(new Date(session.closedAt), 'dd MMM yyyy, hh:mm a') : '-'}
                                        </td>
                                        {isSeller && (
                                            <td className="p-4 text-right font-semibold text-gray-800">
                                                ₹{(session.totalCashSales || 0).toFixed(2)}
                                            </td>
                                        )}
                                        {isSeller && (
                                            <td className="p-4 text-right font-semibold text-gray-800">
                                                ₹{(session.totalOnlineSales || 0).toFixed(2)}
                                            </td>
                                        )}
                                        <td className="p-4 text-right font-semibold text-gray-800">
                                            ₹{(isSeller
                                                ? (session.totalCashSales || 0) + (session.totalOnlineSales || 0)
                                                : (session.totalCashSales || 0) + (session.totalCardSales || 0) + (session.totalUPISales || 0)
                                            ).toFixed(2)}
                                        </td>
                                        {!isSeller && (
                                            <td className="p-4 text-right text-gray-600">
                                                ₹{session.expectedCash?.toFixed(2) || '0.00'}
                                            </td>
                                        )}
                                        {!isSeller && (
                                            <td className="p-4 text-right font-medium text-gray-800">
                                                ₹{session.actualCash?.toFixed(2) || '0.00'}
                                            </td>
                                        )}
                                        {!isSeller && (
                                            <td className="p-4 text-right">
                                                <span className={`font-bold ${session.cashDifference < 0 ? 'text-red-500' : session.cashDifference > 0 ? 'text-green-500' : 'text-gray-400'}`}>
                                                    {session.cashDifference > 0 ? '+' : ''}{session.cashDifference !== undefined ? session.cashDifference.toFixed(2) : '0.00'}
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
}
