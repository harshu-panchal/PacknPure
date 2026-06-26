import React from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';
import { brandColor, brandLogo } from '../../constants/brandTheme';
import { cn } from '@/lib/utils';
import CustomerLoginForm from './CustomerLoginForm';

/**
 * Shared login UI — used by modal and /login page.
 */
const CustomerLoginPanel = ({
    title,
    subtitle = 'Log in or Sign up',
    onSuccess,
    onClose,
    className = '',
}) => {
    const { settings } = useSettings();
    const primary = brandColor(settings);
    const logoUrl = brandLogo(settings);
    const appName = settings?.appName || 'Pack & Pure';

    return (
        <div className={className}>
            <img
                src={logoUrl}
                alt={appName}
                className="mx-auto mb-6 h-20 w-auto max-w-[280px] object-contain sm:h-24 sm:max-w-[320px]"
            />

            <h2
                id="customer-login-title"
                className="text-center text-[1.35rem] font-black leading-tight tracking-tight text-slate-900"
            >
                India&apos;s smart supplier app
            </h2>

            {title ? (
                <p className="mt-1 text-center text-sm font-semibold text-slate-600">
                    {title}
                </p>
            ) : null}

            {subtitle ? (
                <p
                    className={cn(
                        'text-center text-base font-semibold text-slate-800',
                        title ? 'mt-3' : 'mt-3',
                    )}
                >
                    {subtitle}
                </p>
            ) : null}

            <div className="mt-8 text-left">
                <CustomerLoginForm
                    variant="embedded"
                    onClose={onClose}
                    onSuccess={onSuccess}
                />
            </div>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500">
                By continuing, you agree to our{' '}
                <Link
                    to="/terms"
                    onClick={onClose}
                    className="font-semibold underline underline-offset-2"
                    style={{ color: primary }}
                >
                    Terms of service
                </Link>{' '}
                &amp;{' '}
                <Link
                    to="/privacy"
                    onClick={onClose}
                    className="font-semibold underline underline-offset-2"
                    style={{ color: primary }}
                >
                    Privacy policy
                </Link>
            </p>
        </div>
    );
};

export default CustomerLoginPanel;
