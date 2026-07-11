import React from 'react';
import { History, Search } from 'lucide-react';

export default function PosSessions() {
    return (
        <div className="p-6 max-w-6xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <History className="w-7 h-7 mr-3 text-blue-600" />
                        POS Sessions History
                    </h1>
                    <p className="text-gray-500 mt-1">Review past shifts and end-of-day reports</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search Cashier or Terminal..." 
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                    <History className="w-12 h-12 mb-4 text-gray-300" />
                    <p className="text-lg">No past sessions found.</p>
                    <p className="text-sm">Historical session data will appear here once shifts are closed.</p>
                </div>
            </div>
        </div>
    );
}
