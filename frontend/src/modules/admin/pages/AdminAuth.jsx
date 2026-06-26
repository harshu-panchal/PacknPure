import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import {
    Mail,
    Lock,
    User,
    ShieldCheck,
    ArrowRight,
    ArrowLeft,
    Activity,
    LockKeyhole,
    Globe,
    Building2
} from 'lucide-react';
import { toast } from 'sonner';
import Lottie from 'lottie-react';
import backendAnimation from '../../../assets/Backend Icon.json';
import { adminApi } from '../services/adminApi';
import Badge from '@shared/components/ui/Badge';

const AdminAuth = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0: None, 1: Email, 2: Reset
    const [otpError, setOtpError] = useState('');
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const appName = settings?.appName || 'Pack n Pure';
    const logoUrl = settings?.logoUrl || '';

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        adminCode: '',
        phone: '',
        forgotEmail: '',
        otp: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'password' || name === 'newPassword' || name === 'confirmPassword') {
            const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
            setFormData({ ...formData, [name]: cleaned });
        } else if (name === 'otp') {
            const cleaned = value.replace(/[^0-9]/g, '').slice(0, 6);
            setFormData({ ...formData, [name]: cleaned });
            if (otpError) setOtpError('');
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        
        if (forgotPasswordStep === 1) {
            if (!formData.forgotEmail) {
                toast.error('Enter a valid email address.');
                return;
            }
            setIsLoading(true);
            try {
                await adminApi.forgotPasswordOtp({ email: formData.forgotEmail });
                toast.success('OTP sent successfully. Please check your system/phone.');
                setForgotPasswordStep(2);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to send OTP');
            } finally {
                setIsLoading(false);
            }
        } else if (forgotPasswordStep === 2) {
            if (!formData.otp) {
                toast.error('Please enter the OTP.');
                return;
            }
            if (formData.newPassword !== formData.confirmPassword) {
                toast.error('New PINs do not match.');
                return;
            }
            if (formData.newPassword.length !== 6) {
                toast.error('PIN must be exactly 6 characters.');
                return;
            }
            setIsLoading(true);
            try {
                const response = await adminApi.resetPasswordWithOtp({
                    email: formData.forgotEmail,
                    otp: formData.otp,
                    newPassword: formData.newPassword
                });
                const { token, admin } = response.data.result;
                setOtpError('');
                toast.success('Access PIN reset successfully! Authorizing...');
                login({ ...admin, token, role: 'admin' });
                navigate('/admin');
            } catch (error) {
                const msg = error.response?.data?.message || 'Failed to reset PIN';
                if (msg.toLowerCase().includes('otp')) {
                    setOtpError('OTP does not match or has expired. Please check your OTP.');
                } else {
                    toast.error(msg);
                }
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (forgotPasswordStep > 0) {
            return handleForgotPasswordSubmit(e);
        }

        const pwd = (formData.password || '').trim();
        if (!/^[a-zA-Z0-9]{6}$/.test(pwd)) {
            toast.error('Password must be exactly 6 characters.');
            return;
        }
        setIsLoading(true);

        try {
            const response = await adminApi.login({ email: formData.email, password: formData.password });

            const { token, admin } = response.data.result;
            login({ ...admin, token, role: 'admin' });
            toast.success('Welcome back, Administrator.');
            navigate('/admin');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0F172A] p-4 lg:p-6 font-['Outfit',_sans-serif] overflow-hidden relative">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-6xl min-h-[700px] bg-white rounded-[48px] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row border border-white/10"
            >
                {/* Form Section */}
                <div className="w-full md:w-1/2 p-10 lg:p-20 flex flex-col justify-center relative z-10 bg-white">
                    <div className="max-w-md mx-auto w-full">
                        <div className="flex items-center gap-3 mb-12">
                            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                                <ShieldCheck className="text-white" size={20} />
                            </div>
                            <span className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Security Gateway</span>
                        </div>

                        <div className="mb-10">
                            {forgotPasswordStep > 0 ? (
                                <>
                                    <button type="button" onClick={() => setForgotPasswordStep(0)} className="mb-4 text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                                        <ArrowLeft size={14} /> Back to Login
                                    </button>
                                    <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter leading-none mb-4">
                                        {forgotPasswordStep === 1 ? 'Reset Access PIN' : 'Verify & Reset'}
                                    </h1>
                                    <p className="text-slate-400 font-medium text-lg">
                                        {forgotPasswordStep === 1 ? 'Enter your master email to receive a reset code.' : `Enter the code sent to ${formData.forgotEmail} and your new PIN.`}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-4">
                                        Admin Access
                                    </h1>
                                    <p className="text-slate-400 font-medium text-lg">
                                        Authorize to manage {appName} ecosystem.
                                    </p>
                                </>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <AnimatePresence mode="wait">
                                {forgotPasswordStep === 1 && (
                                    <motion.div
                                        key="forgot-step-1"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-4"
                                    >
                                        <div className="relative group">
                                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                            <input type="email" name="forgotEmail" required value={formData.forgotEmail} onChange={handleChange} placeholder="Master Email Address" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all shadow-inner" />
                                        </div>
                                    </motion.div>
                                )}

                                {forgotPasswordStep === 2 && (
                                    <motion.div
                                        key="forgot-step-2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div>
                                            <div className="relative group">
                                                <LockKeyhole className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                                <input type="text" name="otp" required value={formData.otp} onChange={handleChange} placeholder="Enter OTP Code" className={`w-full pl-14 pr-6 py-5 bg-slate-50 border-2 rounded-[24px] text-sm font-bold text-slate-700 outline-none transition-all tracking-[0.8em] shadow-inner ${otpError ? 'border-red-300 focus:border-red-400 focus:bg-white' : 'border-transparent focus:border-indigo-100 focus:bg-white'}`} />
                                            </div>
                                            {otpError && <p className="text-red-500 text-[11px] font-bold mt-2 ml-4">{otpError}</p>}
                                        </div>

                                        <div className="relative group">
                                            <LockKeyhole className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                            <input type="password" name="newPassword" required value={formData.newPassword} onChange={handleChange} placeholder="New 6-Digit PIN" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all tracking-[0.8em] shadow-inner" />
                                        </div>

                                        <div>
                                            <div className="relative group">
                                                <LockKeyhole className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                                <input type="password" name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm 6-Digit PIN" className={`w-full pl-14 pr-6 py-5 bg-slate-50 border-2 rounded-[24px] text-sm font-bold text-slate-700 outline-none transition-all tracking-[0.8em] shadow-inner ${formData.confirmPassword && formData.newPassword !== formData.confirmPassword ? 'border-red-300 focus:border-red-400 focus:bg-white' : 'border-transparent focus:border-indigo-100 focus:bg-white'}`} />
                                            </div>
                                            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                                                <p className="text-red-500 text-[11px] font-bold mt-2 ml-4">PINs do not match.</p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {forgotPasswordStep === 0 && (
                                    <motion.div
                                        key="login-step"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-6"
                                    >
                                        <div className="relative group">
                                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                            <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="Master Email Address" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all shadow-inner" />
                                        </div>

                                        <div>
                                            <div className="flex justify-end mb-2 mr-2">
                                                <button type="button" onClick={() => setForgotPasswordStep(1)} className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 hover:underline transition-colors">
                                                    Forgot PIN?
                                                </button>
                                            </div>
                                            <div className="relative group">
                                                <LockKeyhole className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                                                <input type="password" name="password" required value={formData.password} onChange={handleChange} placeholder="6-Digit Access PIN" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all tracking-[0.8em] shadow-inner" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white rounded-[24px] py-6 text-lg font-black shadow-[0_20px_40px_rgba(15,23,42,0.2)] hover:bg-black hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                                {isLoading ? (
                                    <>
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>AUTHENTICATING...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>
                                            {forgotPasswordStep === 1 ? 'REQUEST RESET CODE' : 
                                             forgotPasswordStep === 2 ? 'CONFIRM NEW PIN' : 
                                             'ENTER TERMINAL'}
                                        </span>
                                        <ArrowRight size={22} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Info Section */}
                <div className="hidden md:flex w-1/2 relative bg-slate-50 overflow-hidden items-center justify-center border-l border-slate-100">
                    <div className="absolute top-12 left-12 z-30">
                        <Badge variant="outline" className="bg-white border-slate-200 text-slate-400 font-black tracking-widest px-4 py-2 rounded-xl shadow-sm">
                            HQ CORE: ACTIVE
                        </Badge>
                    </div>

                    {/* Logo Floating */}
                    <div className="absolute top-12 right-12 z-30">
                        <div className="h-16 w-16 rounded-[24px] bg-white shadow-2xl flex items-center justify-center border border-slate-100">
                            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain" /> : <Building2 className="text-slate-900" size={28} />}
                        </div>
                    </div>

                    {/* Abstract Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    <div className="relative z-10 w-full flex flex-col items-center">
                        <div className="w-full max-w-[450px] relative">
                             {/* Decorative Rings */}
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-indigo-100 rounded-full animate-ping opacity-20"></div>
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-slate-200 rounded-full"></div>
                             
                             <Lottie animationData={backendAnimation} loop={true} className="relative z-10 drop-shadow-[0_35px_60px_rgba(0,0,0,0.1)]" />
                        </div>

                        <div className="mt-12 text-center space-y-4 px-12">
                             <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                 <Activity size={12} /> System Health: 100%
                             </div>
                             <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Master Command Center</h3>
                             <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto opacity-80">Oversee entire supply chain, manage users, and monitor financial health from a single secure node.</p>
                        </div>
                    </div>

                    {/* Bottom Floating Stats */}
                    <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center text-slate-300">
                         <div className="flex items-center gap-2">
                             <Globe size={14} />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Global Ops Node</span>
                         </div>
                         <div className="h-px flex-1 mx-6 bg-slate-200 opacity-50"></div>
                         <span className="text-[10px] font-bold uppercase tracking-widest">v4.2.0-secure</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminAuth;
