import React, { useState, useEffect } from 'react';
import { posApi } from '../../services/posApi';
import { Button, IconButton } from '@mui/material';
import { Monitor, Plus, Store, CreditCard, Activity, Edit, Power } from 'lucide-react';
import { toast } from 'sonner';

export default function PosTerminals() {
    const [terminals, setTerminals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTerminals();
    }, []);

    const loadTerminals = async () => {
        setIsLoading(true);
        try {
            const { data } = await posApi.getTerminals();
            if (data.success) {
                setTerminals(data.results || []);
            }
        } catch (error) {
            toast.error("Failed to load terminals");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Terminals...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Monitor className="w-7 h-7 mr-3 text-blue-600" />
                        POS Terminals
                    </h1>
                    <p className="text-gray-500 mt-1">Manage physical registers and store locations</p>
                </div>
                <Button variant="contained" startIcon={<Plus />} color="primary">
                    Add Terminal
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {terminals.map(terminal => (
                    <div key={terminal._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-lg ${terminal.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    <Monitor className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg">{terminal.name}</h3>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${terminal.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {terminal.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                            <IconButton size="small"><Edit className="w-4 h-4 text-gray-500" /></IconButton>
                        </div>
                        
                        <div className="p-5 space-y-4">
                            <div className="flex items-center text-sm text-gray-600">
                                <Store className="w-4 h-4 mr-3 text-gray-400" />
                                <span><strong className="text-gray-800">Store:</strong> {terminal.storeLocation}</span>
                            </div>
                            
                            <div className="flex items-center text-sm text-gray-600">
                                <CreditCard className="w-4 h-4 mr-3 text-gray-400" />
                                <span><strong className="text-gray-800">Payments:</strong> {terminal.allowedPaymentMethods?.join(', ') || 'Cash, Card, UPI'}</span>
                            </div>

                            <div className="flex items-center text-sm text-gray-600">
                                <Activity className="w-4 h-4 mr-3 text-gray-400" />
                                <span><strong className="text-gray-800">Current Session:</strong> {terminal.currentSessionId ? 'Open' : 'Closed'}</span>
                            </div>
                        </div>

                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-xs text-gray-500">Created: {new Date(terminal.createdAt).toLocaleDateString()}</span>
                            <Button size="small" variant="text" color={terminal.isActive ? 'error' : 'success'} startIcon={<Power className="w-4 h-4" />}>
                                {terminal.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                        </div>
                    </div>
                ))}
                
                {terminals.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
                        No terminals found. Click "Add Terminal" to create one.
                    </div>
                )}
            </div>
        </div>
    );
}
