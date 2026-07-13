import React, { useState } from 'react';
import { User, Phone, CheckCircle, Search, Home, Store, MapPin } from 'lucide-react';
import { usePosCart } from '../../context/PosCartContext';
import { posApi } from '../../services/posApi';
import { toast } from 'sonner';
import { Button } from '@mui/material';

export const CustomerPanel = () => {
    const { 
        guestCustomer, 
        setGuestCustomer, 
        fulfillmentType, 
        setFulfillmentType,
        deliveryAddress,
        setDeliveryAddress
    } = usePosCart();
    
    const [searchPhone, setSearchPhone] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [customerProfile, setCustomerProfile] = useState(null);

    const handleSearchCustomer = async () => {
        if (!searchPhone || searchPhone.length < 10) {
            toast.error("Please enter a valid 10-digit phone number");
            return;
        }

        setIsSearching(true);
        try {
            // Note: In a real implementation this would hit the exact users search API. 
            // Mocking successful lookup for UI purposes until hooked up.
            const { data } = await posApi.searchCustomer(searchPhone);
            if (data.success && data.result?.customer) {
                setCustomerProfile(data.result.customer);
                setGuestCustomer({ name: data.result.customer.name, phone: data.result.customer.phone });
                toast.success("Customer found!");
            } else {
                toast.error("Customer not found. Will proceed as guest.");
                setCustomerProfile(null);
                setGuestCustomer({ name: '', phone: searchPhone });
            }
        } catch (error) {
            toast.error("Customer not found. Proceeding as guest.");
            setCustomerProfile(null);
            setGuestCustomer({ name: '', phone: searchPhone });
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-4">
            
            {/* Fulfillment Type Toggle */}
            <div>
                <h3 className="font-bold text-gray-800 flex items-center text-sm mb-2">
                    <Store className="w-4 h-4 mr-1.5 text-blue-600" /> Fulfillment
                </h3>
                <div className="flex bg-gray-100 rounded-lg p-1 w-full relative">
                    <button
                        onClick={() => setFulfillmentType('TAKE_AWAY')}
                        className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 z-10 ${
                            fulfillmentType === 'TAKE_AWAY' 
                                ? 'bg-white shadow text-blue-700' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Store className="w-4 h-4" /> Take Away
                    </button>
                    <button
                        onClick={() => setFulfillmentType('HOME_DELIVERY')}
                        className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 z-10 ${
                            fulfillmentType === 'HOME_DELIVERY' 
                                ? 'bg-white shadow text-blue-700' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Home className="w-4 h-4" /> Home Delivery
                    </button>
                </div>
            </div>

            <hr className="border-gray-100" />

            {/* Customer Search & Details */}
            <div>
                <h3 className="font-bold text-gray-800 flex items-center text-sm mb-2">
                    <User className="w-4 h-4 mr-1.5 text-blue-600" /> Customer Details
                </h3>
                
                <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="tel"
                            placeholder="Phone Number"
                            value={searchPhone}
                            onChange={(e) => setSearchPhone(e.target.value.replace(/\D/g, ''))}
                            maxLength={10}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-medium"
                        />
                    </div>
                    <Button 
                        variant="outlined" 
                        size="small" 
                        onClick={handleSearchCustomer}
                        disabled={isSearching}
                        className="!min-w-[40px] !px-0"
                    >
                        <Search className="w-4 h-4" />
                    </Button>
                </div>

                {customerProfile ? (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-blue-900">{customerProfile.name}</p>
                                <p className="text-blue-700 font-medium">{customerProfile.phone}</p>
                            </div>
                            <CheckCircle className="text-green-500 w-5 h-5" />
                        </div>
                        {customerProfile.walletBalance !== undefined && (
                            <div className="mt-2 pt-2 border-t border-blue-200/50 flex justify-between">
                                <span className="text-blue-800 text-xs">Wallet Balance:</span>
                                <span className="font-bold text-blue-900 text-xs">₹{customerProfile.walletBalance}</span>
                            </div>
                        )}
                        {customerProfile.recentOrders?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-blue-200/50">
                                <div className="text-blue-800 text-xs mb-1 font-bold">Recent Orders:</div>
                                <div className="space-y-1">
                                    {customerProfile.recentOrders.slice(0, 3).map((order, i) => (
                                        <div key={i} className="flex justify-between text-[10px] text-blue-900 bg-white/50 px-2 py-1 rounded">
                                            <span>{order.orderId}</span>
                                            <span className="font-bold">₹{order.pricing?.total}</span>
                                            <span className="uppercase text-blue-600">{order.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder="Guest Name (Optional for Take-away)"
                            value={guestCustomer.name}
                            onChange={(e) => setGuestCustomer({ ...guestCustomer, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                )}
            </div>

            {/* Delivery Address Section (Only if Home Delivery) */}
            {fulfillmentType === 'HOME_DELIVERY' && (
                <>
                    <hr className="border-gray-100" />
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center text-sm mb-2">
                            <MapPin className="w-4 h-4 mr-1.5 text-blue-600" /> Delivery Address
                        </h3>
                        {customerProfile?.addresses?.length > 0 ? (
                            <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                {customerProfile.addresses.map((addr, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setDeliveryAddress(addr)}
                                        className={`p-2 text-xs rounded border cursor-pointer transition-colors ${
                                            deliveryAddress?._id === addr._id 
                                            ? 'bg-blue-50 border-blue-500 text-blue-900' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                                        }`}
                                    >
                                        <div className="font-bold mb-0.5 capitalize">{addr.label || 'Home'}</div>
                                        <div className="line-clamp-2">{addr.fullAddress}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <textarea 
                                placeholder="Enter full delivery address..."
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 min-h-[60px]"
                                onChange={(e) => setDeliveryAddress({ fullAddress: e.target.value })}
                            />
                        )}
                    </div>
                </>
            )}

        </div>
    );
};
