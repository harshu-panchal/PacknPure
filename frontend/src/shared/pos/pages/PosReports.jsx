import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, Banknote, ShoppingBag } from 'lucide-react';
import { Button } from '@mui/material';
import { posApi } from '../services/posApi';
import { usePosEngine } from '../context/PosEngineContext';
import jsPDF from 'jspdf';
import brandLogo from '../../../assets/brand_logo.png';

export default function PosReports() {
    const { role } = usePosEngine();
    const isSeller = role === 'seller';
    const [dateRange, setDateRange] = useState('today');
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, [dateRange]);

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            const { data } = await posApi.getPosReports({ range: dateRange });
            if (data.success) {
                setReportData(data.result || data.data);
            }
        } catch (error) {
            console.error("Failed to load POS reports", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async () => {
        if (!reportData) return;

        const doc = new jsPDF();
        
        // Helper to load image
        const img = new Image();
        img.src = brandLogo;
        
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
        });

        // Header / Logo area
        try {
            // Draw image centered (approx 60x20)
            doc.addImage(img, 'PNG', 75, 10, 60, 20);
        } catch (error) {
            // Fallback to text if image fails
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(37, 99, 235);
            doc.text("PackNPure", 105, 20, null, null, "center");
        }
        
        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(31, 41, 55); // Gray-800
        doc.text("POS Analytics & Reports", 105, 38, null, null, "center");
        
        doc.setFontSize(12);
        doc.setTextColor(107, 114, 128); // Gray-500
        doc.text(`Period: ${dateRange.toUpperCase()}`, 105, 45, null, null, "center");

        // Separator
        doc.setDrawColor(229, 231, 235); // Gray-200
        doc.setLineWidth(0.5);
        doc.line(20, 50, 190, 50);

        let y = 60;
        
        // Summary
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(17, 24, 39); // Gray-900
        doc.text("Executive Summary", 20, y);
        y += 10;
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(55, 65, 81);
        doc.text(`Gross Sales: Rs. ${(reportData.grossSales || 0).toLocaleString()}`, 20, y); y += 8;
        doc.text(`Total Orders: ${reportData.totalOrders || 0}`, 20, y); y += 8;
        doc.text(`Total Refunds: Rs. ${(reportData.totalRefunds || 0).toLocaleString()}`, 20, y); y += 8;
        doc.text(`Unique Customers: ${reportData.uniqueCustomers || 0}`, 20, y); y += 15;

        // Payment Methods
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(17, 24, 39);
        doc.text("Payment Methods", 20, y);
        y += 10;
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(55, 65, 81);
        if (isSeller) {
            // Seller POS reports show only Cash / Online totals (from paymentMode)
            doc.text(`Cash: Rs. ${(reportData.paymentModes?.cash || 0).toLocaleString()}`, 20, y); y += 8;
            doc.text(`Online: Rs. ${(reportData.paymentModes?.online || 0).toLocaleString()}`, 20, y); y += 15;
        } else {
            doc.text(`Cash: Rs. ${(reportData.paymentMethods?.cash || 0).toLocaleString()}`, 20, y); y += 8;
            doc.text(`UPI / Razorpay: Rs. ${(reportData.paymentMethods?.upi || 0).toLocaleString()}`, 20, y); y += 8;
            doc.text(`Card: Rs. ${(reportData.paymentMethods?.card || 0).toLocaleString()}`, 20, y); y += 15;
        }

        // Categories
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(17, 24, 39);
        doc.text("Top Selling Categories", 20, y);
        y += 10;
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(55, 65, 81);
        if (reportData.topCategories && reportData.topCategories.length > 0) {
            reportData.topCategories.forEach(cat => {
                doc.text(`${cat.name} (${cat.count} units)`, 20, y); 
                y += 8;
            });
        } else {
            doc.text("No category data for this period", 20, y);
        }

        doc.save(`PackNPure_POS_Report_${dateRange}.pdf`);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <BarChart3 className="mr-3 w-7 h-7 text-indigo-600" />
                        POS Analytics & Reports
                    </h1>
                    <p className="text-gray-500 mt-1">Unified view of offline store performance</p>
                </div>
                <div className="flex bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                    {['today', 'week', 'month', 'year'].map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                                dateRange === range 
                                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-gray-500 font-medium">Gross Sales</div>
                        <Banknote className="text-green-500 w-6 h-6" />
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-2">₹{reportData?.grossSales?.toLocaleString() || 0}</div>
                    <div className="text-sm font-medium text-green-600 flex items-center">
                        Based on completed orders
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-gray-500 font-medium">Total Orders</div>
                        <ShoppingBag className="text-blue-500 w-6 h-6" />
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-2">{reportData?.totalOrders || 0}</div>
                    <div className="text-sm font-medium text-green-600 flex items-center">
                        POS orders placed
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-gray-500 font-medium">Total Refunds</div>
                        <BarChart3 className="text-orange-500 w-6 h-6" />
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-2">₹{reportData?.totalRefunds?.toLocaleString() || 0}</div>
                    <div className="text-sm font-medium text-red-600 flex items-center">
                        Voided or refunded
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-gray-500 font-medium">Unique Customers</div>
                        <Users className="text-purple-500 w-6 h-6" />
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-2">{reportData?.uniqueCustomers || 0}</div>
                    <div className="text-sm font-medium text-green-600 flex items-center">
                        Walk-in & Registered
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6">Payment Methods</h3>
                    <div className="space-y-4">
                        {isSeller ? (
                            /* Seller POS: Cash / Online totals computed from paymentMode */
                            <>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-semibold text-gray-700">Cash</span>
                                    <span className="font-bold text-gray-900">₹{(reportData?.paymentModes?.cash || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-semibold text-gray-700">Online</span>
                                    <span className="font-bold text-gray-900">₹{(reportData?.paymentModes?.online || 0).toLocaleString()}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-semibold text-gray-700">Cash</span>
                                    <span className="font-bold text-gray-900">₹{(reportData?.paymentMethods?.cash || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-semibold text-gray-700">UPI / Razorpay</span>
                                    <span className="font-bold text-gray-900">₹{(reportData?.paymentMethods?.upi || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-semibold text-gray-700">Card</span>
                                    <span className="font-bold text-gray-900">₹{(reportData?.paymentMethods?.card || 0).toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6">Top Selling Categories</h3>
                    <div className="space-y-4">
                        {reportData?.topCategories?.length > 0 ? (
                            reportData.topCategories.map((cat, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border-l-4 border-blue-500 bg-gray-50 rounded-r-lg">
                                    <span className="font-semibold text-gray-700">{cat.name}</span>
                                    <span className="font-bold text-gray-900">{cat.count} units</span>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-gray-500">No category data for this period</div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="mt-8 text-center">
                <Button variant="outlined" startIcon={<Calendar />} onClick={handleExport} disabled={!reportData || isLoading}>
                    Download Report (PDF)
                </Button>
            </div>
        </div>
    );
}