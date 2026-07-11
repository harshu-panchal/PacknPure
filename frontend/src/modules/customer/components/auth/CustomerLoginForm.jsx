import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { customerApi } from '../../services/customerApi';
import { brandColor, brandColorDark } from '../../constants/brandTheme';
import SetNameModal from './SetNameModal';
import { isCustomerProfileComplete } from '@core/utils/profile';

const OTP_LENGTH = 4;

/**
 * Phone + OTP login (Blinkit-style fields when embedded in modal).
 */
const CustomerLoginForm = ({ variant = 'page', onSuccess, onClose }) => {
    const navigate = useNavigate();
    const { login, logout, patchUser } = useAuth();
    const { settings } = useSettings();
    const primary = brandColor(settings);
    const primaryDark = brandColorDark(settings);
    const appName = settings?.appName || 'App';
    const defaultSupportEmail = settings?.supportEmail || 'support@packandpure.com';

    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [suspendedInfo, setSuspendedInfo] = useState({
        supportEmail: defaultSupportEmail,
        supportPhone: settings?.supportPhone || '',
    });
    // State for the set-name modal shown to new / unnamed users after login
    const [showSetName, setShowSetName] = useState(false);
    const [pendingLoginData, setPendingLoginData] = useState(null);

    const otpRefs = useRef([]);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('login_suspended');
            if (!raw) return;
            sessionStorage.removeItem('login_suspended');
            const parsed = JSON.parse(raw);
            setSuspendedInfo({
                supportEmail: parsed.supportEmail || defaultSupportEmail,
                supportPhone: parsed.supportPhone || settings?.supportPhone || '',
            });
            setStep('suspended');
        } catch {
            sessionStorage.removeItem('login_suspended');
        }
    }, [defaultSupportEmail, settings?.supportPhone]);

    useEffect(() => {
        if (timer <= 0) return undefined;
        const id = setInterval(() => setTimer((t) => t - 1), 1000);
        return () => clearInterval(id);
    }, [timer]);

    const isEmbedded = variant === 'embedded';
    const canContinuePhone = phone.length === 10 && !isLoading;
    const canVerifyOtp = otp.length === OTP_LENGTH && !isLoading;

    const handleSendOtp = async (e) => {
        e?.preventDefault();
        if (phone.length !== 10) {
            toast.error('Enter a valid 10-digit mobile number');
            return;
        }
        setIsLoading(true);
        try {
            await customerApi.sendOtp({ phone });
            setStep('otp');
            setOtp('');
            setTimer(30);
            toast.success('OTP sent to your number');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (otp.length !== OTP_LENGTH) {
            toast.error('Enter the 4-digit OTP');
            return;
        }
        setIsLoading(true);
        try {
            const response = await customerApi.verifyOtp({ phone, otp });
            const { token, customer, isNewUser } = response.data.result;
            login({ ...customer, token, role: 'customer' });

            // Show name prompt if it's a new user or the profile is not complete
            if (isNewUser || !isCustomerProfileComplete(customer)) {
                setPendingLoginData({ customer, token });
                setShowSetName(true);
                return; // hold navigation until modal is handled
            }

            toast.success('Welcome back!');
            if (onSuccess) {
                onSuccess(customer, token);
            } else if (onClose) {
                onClose();
            } else {
                navigate('/');
            }
        } catch (err) {
            const payload = err.response?.data?.result;
            if (payload?.suspended || err.response?.status === 403) {
                setSuspendedInfo({
                    supportEmail: payload?.supportEmail || defaultSupportEmail,
                    supportPhone: payload?.supportPhone || settings?.supportPhone || '',
                });
                setStep('suspended');
                return;
            }
            toast.error(err.response?.data?.message || 'Invalid OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNameSaved = (savedName, updatedCustomerData) => {
        setShowSetName(false);
        const { customer, token } = pendingLoginData || {};
        const updatedCustomer = updatedCustomerData || { ...customer, name: savedName };
        setPendingLoginData(null);
        patchUser(updatedCustomer);
        toast.success(`Welcome, ${savedName}!`);
        if (onSuccess) {
            onSuccess(updatedCustomer, token);
        } else if (onClose) {
            onClose();
        } else {
            navigate('/');
        }
    };

    const handleLogout = () => {
        logout();
        setPendingLoginData(null);
        setShowSetName(false);
        setStep('phone');
        setPhone('');
        setOtp('');
        if (onClose) {
            onClose();
        }
    };

    const handleOtpDigit = (index, value) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const next = otp.split('');
        next[index] = digit;
        const joined = next.join('').slice(0, OTP_LENGTH);
        setOtp(joined);
        if (digit && index < OTP_LENGTH - 1) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const goBack = () => {
        if (step === 'otp') {
            setStep('phone');
            setOtp('');
            return;
        }
        if (onClose) onClose();
        else navigate(-1);
    };

    const inputRing = { '--tw-ring-color': `${primary}33` };
    const focusBorder = { borderColor: primary, boxShadow: `0 0 0 3px ${primary}22` };

    return (
        <>
        <div className={isEmbedded ? 'w-full' : 'flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-10'}>
            <div
                className={
                    isEmbedded
                        ? 'w-full'
                        : 'mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
                }
            >
                {step !== 'suspended' && !isEmbedded && (
                    <div className="mb-6">
                        {(step === 'otp' || isEmbedded) && (
                            <button
                                type="button"
                                onClick={goBack}
                                className="mb-3 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                        )}
                        <h1 className="text-xl font-bold text-slate-900">
                            {step === 'phone' ? `Sign in to ${appName}` : 'Enter OTP'}
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            {step === 'phone'
                                ? 'We will send a one-time code to your mobile'
                                : `Code sent to +91 ${phone}`}
                        </p>
                    </div>
                )}

                {step === 'phone' && (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                        <div
                            className="flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white transition-all focus-within:ring-2"
                            style={inputRing}
                        >
                            <span className="shrink-0 border-r border-slate-200 py-4 pl-4 pr-3 text-sm font-bold text-slate-800">
                                +91
                            </span>
                            <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                value={phone}
                                onChange={(e) =>
                                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                                }
                                placeholder="Enter mobile number"
                                className="flex-1 bg-transparent py-4 pl-3 pr-4 text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!canContinuePhone}
                            className="w-full rounded-xl py-3.5 text-base font-bold text-white transition-all disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: canContinuePhone ? primary : '#9ca3af',
                            }}
                            onMouseEnter={(e) => {
                                if (canContinuePhone) e.currentTarget.style.backgroundColor = primaryDark;
                            }}
                            onMouseLeave={(e) => {
                                if (canContinuePhone) e.currentTarget.style.backgroundColor = primary;
                            }}
                        >
                            {isLoading ? 'Sending…' : 'Continue'}
                        </button>
                    </form>
                )}

                {step === 'otp' && (
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                        {isEmbedded && (
                            <button
                                type="button"
                                onClick={goBack}
                                className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
                            >
                                <ArrowLeft size={16} />
                                Change number
                            </button>
                        )}
                        <p className="text-center text-sm text-slate-600">
                            OTP sent to <span className="font-bold text-slate-900">+91 {phone}</span>
                        </p>
                        <div className="flex justify-center gap-2">
                            {[...Array(OTP_LENGTH)].map((_, i) => (
                                <input
                                    key={i}
                                    ref={(el) => {
                                        otpRefs.current[i] = el;
                                    }}
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={otp[i] || ''}
                                    onChange={(e) => handleOtpDigit(i, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                    onFocus={(e) => Object.assign(e.target.style, focusBorder)}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '';
                                        e.target.style.boxShadow = '';
                                    }}
                                    className="h-14 w-12 rounded-xl border border-slate-300 text-center text-xl font-bold outline-none"
                                />
                            ))}
                        </div>
                        <button
                            type="submit"
                            disabled={!canVerifyOtp}
                            className="w-full rounded-xl py-3.5 text-base font-bold text-white transition-all disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: canVerifyOtp ? primary : '#9ca3af',
                            }}
                        >
                            {isLoading ? 'Verifying…' : 'Verify & continue'}
                        </button>
                        <button
                            type="button"
                            disabled={timer > 0 || isLoading}
                            onClick={handleSendOtp}
                            className="w-full text-sm font-semibold disabled:text-slate-400"
                            style={{ color: timer > 0 ? undefined : primary }}
                        >
                            {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                        </button>
                    </form>
                )}

                {step === 'suspended' && (
                    <div className="py-2 text-center">
                        <div
                            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${primary}14` }}
                        >
                            <ShieldAlert className="h-7 w-7" style={{ color: primary }} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">Account suspended</h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            Your account is currently suspended. Please contact the administrator.
                        </p>
                        <a
                            href={`mailto:${suspendedInfo.supportEmail}`}
                            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white hover:opacity-95"
                            style={{ backgroundColor: primary }}
                        >
                            <Mail size={18} />
                            {suspendedInfo.supportEmail}
                        </a>
                        {suspendedInfo.supportPhone ? (
                            <p className="mt-3 text-sm text-slate-500">
                                Or call:{' '}
                                <a
                                    href={`tel:${suspendedInfo.supportPhone}`}
                                    className="font-semibold"
                                    style={{ color: primary }}
                                >
                                    {suspendedInfo.supportPhone}
                                </a>
                            </p>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => {
                                setStep('phone');
                                setOtp('');
                                setPhone('');
                            }}
                            className="mt-4 text-sm text-slate-500 hover:text-slate-800"
                        >
                            Use a different number
                        </button>
                    </div>
                )}

                {step === 'phone' && !isEmbedded && (
                    <p className="mt-4 text-center text-[11px] text-slate-400">
                        New users are registered automatically. No password needed.
                    </p>
                )}
            </div>
        </div>

        {/* Name prompt modal — shown to new / unnamed users right after login */}
        <SetNameModal
            open={showSetName}
            onSuccess={handleNameSaved}
            onLogout={handleLogout}
        />
        </>  
    );
};

export default CustomerLoginForm;
