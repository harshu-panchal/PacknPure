import React from 'react';
import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';
import { ShoppingBag, RefreshCw, Home, AlertCircle, Search, ArrowLeft } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor } from '@modules/customer/constants/brandTheme';

function buildErrorMeta(error) {
    let status = 500;
    let title = 'Something went wrong';
    let message = 'An unexpected error occurred. Please try again.';

    if (isRouteErrorResponse(error)) {
        status = error.status;
        title =
            status === 404
                ? 'Page not found'
                : status === 401
                    ? 'Unauthorized'
                    : status === 403
                        ? 'Forbidden'
                        : 'Something went wrong';
        message = error.data?.message || error.statusText || message;
    } else if (error instanceof Error) {
        message = error.message || message;
    }

    return { status, title, message };
}

const BrandedFooter = ({ appName, primaryColor }) => (
    <div className="mt-8 flex items-center justify-center gap-2 font-bold">
        <ShoppingBag className="h-5 w-5" style={{ color: primaryColor }} />
        <span className="text-sm tracking-tight text-slate-700">{appName}</span>
    </div>
);

export const NotFoundPage = ({ message: messageProp } = {}) => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const primaryColor = brandColor(settings);
    const message =
        messageProp ||
        'The page you’re looking for doesn’t exist, or it may have been moved.';

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4 font-outfit">
            <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 shadow-xl shadow-slate-200/50 text-center">
                <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${primaryColor}14` }}
                >
                    <AlertCircle className="h-7 w-7" style={{ color: primaryColor }} />
                </div>

                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                    404
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    Page not found
                </h1>
                <p className="mt-2 text-sm font-medium text-slate-500">{message}</p>

                <div className="mt-6 grid gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go back
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <Home className="h-4 w-4" />
                        Back to home
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/search')}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <Search className="h-4 w-4" />
                        Search products
                    </button>
                </div>

                <BrandedFooter appName={appName} primaryColor={primaryColor} />
            </div>
        </div>
    );
};

const RootErrorBoundary = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const primaryColor = brandColor(settings);

    // Keep this for debugging route loader/action errors
    console.error('Route Error:', error);

    const { status, title, message } = buildErrorMeta(error);

    if (status === 404) {
        return <NotFoundPage message={message} />;
    }

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4 font-outfit">
            <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 shadow-xl shadow-slate-200/50 text-center">
                <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${primaryColor}14` }}
                >
                    <AlertCircle className="h-7 w-7" style={{ color: primaryColor }} />
                </div>

                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                    {status}
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    {title}
                </h1>
                <p className="mt-2 text-sm font-medium text-slate-500">{message}</p>

                <div className="mt-6 grid gap-2">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </button>
                    <button
                        onClick={() => {
                            const path = window.location.pathname;
                            if (path.startsWith('/seller')) {
                                navigate('/seller');
                            } else if (path.startsWith('/admin')) {
                                navigate('/admin');
                            } else if (path.startsWith('/delivery')) {
                                navigate('/delivery');
                            } else {
                                navigate('/');
                            }
                        }}
                        className="w-full bg-white border-2 border-gray-100 hover:border-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <Home className="h-4 w-4" />
                        Back to home
                    </button>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4">
                    <p className="text-[11px] text-slate-400">
                        {appName} · {new Date().toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RootErrorBoundary;
