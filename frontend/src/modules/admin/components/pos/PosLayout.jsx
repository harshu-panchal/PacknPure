import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { PosSessionProvider, usePosSession } from '../../context/PosSessionContext';
import { PosCartProvider } from '../../context/PosCartContext';
import { PosErrorBoundary } from './PosErrorBoundary';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@mui/material';

const PosGuards = () => {
    const { user, isAuthenticated } = useAuth();
    const { activeSession, isLoading } = usePosSession();
    const location = useLocation();

    // 1. Authentication Check
    if (!isAuthenticated) {
        return <Navigate to="/admin/login" replace />;
    }

    // 2. RBAC Check (Must be Admin or a specific POS role if created)
    if (user?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg m-4">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-lg font-bold text-red-700">Access Denied</h2>
                <p className="text-red-600">You do not have permission to access the POS system.</p>
            </div>
        );
    }

    // 3. Active Session Check
    if (isLoading) {
        return <div className="flex items-center justify-center p-12">Loading POS data...</div>;
    }

    // If trying to access checkout/cash-drawer without an active session, block them.
    // (They are allowed to view /admin/pos/sessions and /admin/pos dashboard to open one)
    const requiresSessionPaths = ['/admin/pos/checkout', '/admin/pos/cash-drawer'];
    const isRestrictedPath = requiresSessionPaths.some(path => location.pathname.includes(path));

    if (isRestrictedPath && !activeSession) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-amber-50 rounded-lg m-4 border border-amber-200">
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                <h2 className="text-lg font-bold text-amber-800">No Active Session</h2>
                <p className="text-amber-700 mb-4 text-center max-w-md">
                    You must open a POS session at a terminal before you can access the checkout or cash drawer.
                </p>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => window.location.href = '/admin/pos'}
                >
                    Go to POS Dashboard
                </Button>
            </div>
        );
    }

    // Wrap everything downstream in PosCartProvider to isolate cart state to POS pages
    return (
        <PosCartProvider>
            <div className="pos-module-container h-full w-full flex flex-col">
                <Outlet />
            </div>
        </PosCartProvider>
    );
};

export const PosLayout = () => {
    return (
        <PosErrorBoundary>
            <PosSessionProvider>
                <PosGuards />
            </PosSessionProvider>
        </PosErrorBoundary>
    );
};
