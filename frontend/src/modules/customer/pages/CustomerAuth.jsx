import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CustomerLoginPanel from '../components/auth/CustomerLoginPanel';

/**
 * Full-page login at /login and /signup — same UI as the modal.
 */
const CustomerAuth = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const fromState = location.state?.from;
    const from = typeof fromState === 'string' 
        ? fromState 
        : (fromState ? { pathname: fromState.pathname || '/', search: fromState.search || '', hash: fromState.hash || '' } : '/');

    const handleClose = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white p-4">
            <div className="relative w-full max-w-[420px] rounded-2xl border border-slate-100 bg-white px-6 pb-8 pt-14 shadow-xl">
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
                    aria-label="Go back"
                >
                    <ArrowLeft size={22} strokeWidth={2.5} />
                </button>

                <CustomerLoginPanel
                    subtitle="Log in or Sign up"
                    onClose={handleClose}
                    onSuccess={() => navigate(from, { replace: true, state: location.state })}
                    className="text-center"
                />
            </div>
        </div>
    );
};

export default CustomerAuth;
