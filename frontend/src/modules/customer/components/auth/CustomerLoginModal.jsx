import React from 'react';
import { ArrowLeft } from 'lucide-react';
import CustomerLoginPanel from './CustomerLoginPanel';

/**
 * Modal login — open via `useCustomerLogin().openCustomerLogin()`.
 */
const CustomerLoginModal = ({ open, onClose, onSuccess, title, subtitle }) => {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-login-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close login"
            />

            <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl bg-white px-6 pb-8 pt-14 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
                    aria-label="Close"
                >
                    <ArrowLeft size={22} strokeWidth={2.5} />
                </button>

                <CustomerLoginPanel
                    title={title}
                    subtitle={subtitle}
                    onClose={onClose}
                    onSuccess={(customer, token) => {
                        onSuccess?.(customer, token);
                        onClose?.();
                    }}
                    className="text-center"
                />
            </div>
        </div>
    );
};

export default CustomerLoginModal;
