import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { 
    Mail, 
    Lock, 
    Phone, 
    ArrowRight, 
    ArrowLeft,
    Store, 
    MapPin, 
    FileText, 
    Upload, 
    CheckCircle2, 
    ShieldCheck,
    Building2,
    Sparkles,
    User,
    X
} from 'lucide-react';
import { toast } from 'sonner';
import { sellerApi } from '../services/sellerApi';
import { cn } from '@/lib/utils';
import Badge from '@shared/components/ui/Badge';
import SellerLocationModal from '../components/SellerLocationModal';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0: None, 1: Phone, 2: Reset
    const [isLoading, setIsLoading] = useState(false);
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
        shopName: '',
        phone: '',
        address: '',
        description: '',
        category: 'Grocery',
        lat: '',
        lng: '',
        forgotPhone: '',
        otp: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

    const [documents, setDocuments] = useState({
        tradeLicense: null,
        gstCertificate: null,
        idProof: null
    });

    const handleLocationSelect = (loc) => {
        setFormData(prev => ({
            ...prev,
            address: loc.address,
            lat: loc.lat,
            lng: loc.lng
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'name') {
            const cleaned = value.replace(/[^a-zA-Z\s]/g, '');
            setFormData({ ...formData, [name]: cleaned });
        } else if (name === 'email') {
            const cleaned = value.replace(/\s+/g, '').toLowerCase();
            setFormData({ ...formData, [name]: cleaned });
        } else if (name === 'phone' || name === 'forgotPhone') {
            const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 10);
            setFormData({ ...formData, [name]: digitsOnly });
        } else if (name === 'password' || name === 'newPassword' || name === 'confirmPassword') {
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

    const handleFileChange = (e) => {
        const { name, files } = e.target;
        if (files && files[0]) {
            setDocuments(prev => ({ ...prev, [name]: files[0] }));
            toast.success(`${name.replace(/([A-Z])/g, ' $1')} attached`);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        
        if (forgotPasswordStep === 1) {
            if (formData.forgotPhone.length !== 10) {
                toast.error('Enter a valid 10-digit mobile number.');
                return;
            }
            setIsLoading(true);
            try {
                await sellerApi.forgotPasswordOtp({ phone: formData.forgotPhone });
                toast.success('OTP sent successfully. Please check your phone.');
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
                toast.error('New passwords do not match.');
                return;
            }
            if (formData.newPassword.length !== 6) {
                toast.error('PIN must be exactly 6 characters.');
                return;
            }
            setIsLoading(true);
            try {
                const response = await sellerApi.resetPasswordWithOtp({
                    phone: formData.forgotPhone,
                    otp: formData.otp,
                    newPassword: formData.newPassword
                });
                const { token, seller } = response.data.result;
                setOtpError('');
                toast.success('Password reset successfully! Logging you in...');
                login({ ...seller, token, role: 'seller' });
                navigate('/seller');
            } catch (error) {
                const msg = error.response?.data?.message || 'Failed to reset password';
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

        if (!isLogin) {
            if (!documents.tradeLicense || !documents.gstCertificate || !documents.idProof) {
                toast.error('All SOP documents are required for registration.');
                return;
            }
            if (!formData.lat || !formData.lng) {
                toast.error('Shop location is required. Please detect or enter coordinates.');
                return;
            }
            if (!formData.description) {
                toast.error('Shop description is required.');
                return;
            }
        }

        const pwd = (formData.password || '').trim();
        if (!/^[a-zA-Z0-9]{6}$/.test(pwd)) {
            toast.error('PIN must be exactly 6 characters.');
            return;
        }

        setIsLoading(true);
        try {
            let response;
            if (isLogin) {
                response = await sellerApi.login({ email: formData.email, password: formData.password });
            } else {
                const data = new FormData();
                Object.keys(formData).forEach(key => data.append(key, formData[key]));
                Object.keys(documents).forEach(key => {
                    if (documents[key]) data.append(key, documents[key]);
                });
                response = await sellerApi.signup(data);
            }

            const { token, seller } = response.data.result;
            login({ ...seller, token, role: 'seller' });
            toast.success(isLogin ? 'Welcome back, Partner!' : 'Application submitted successfully!');
            navigate('/seller');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveFile = (name, e) => {
        e.preventDefault();
        e.stopPropagation();
        setDocuments(prev => ({ ...prev, [name]: null }));
    };

    const FileInput = ({ name, label }) => {
        const file = documents[name];
        const isImage = file && file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : null;

        return (
            <label className={cn(
                "relative flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-3xl transition-all group overflow-hidden",
                file ? "border-indigo-200 bg-white" : "border-slate-200 hover:bg-slate-50 hover:border-indigo-300 bg-slate-50/50 cursor-pointer"
            )}>
                {!file && <input type="file" name={name} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />}
                
                {file ? (
                    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center group/preview">
                        {isImage ? (
                            <>
                                <img src={previewUrl} alt={label} className="w-full h-full object-cover opacity-60 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Attached</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center text-emerald-600 animate-in zoom-in-95 duration-300">
                                <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mb-1">
                                    <FileText size={20} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest">PDF Attached</span>
                            </div>
                        )}
                        <button 
                            type="button"
                            onClick={(e) => handleRemoveFile(name, e)}
                            className="absolute top-2 right-2 h-6 w-6 bg-white/90 backdrop-blur-sm hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-full flex items-center justify-center transition-all shadow-sm opacity-100 sm:opacity-0 sm:group-hover/preview:opacity-100 z-10"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                        <Upload size={18} className="mb-1 group-hover:-translate-y-1 transition-transform" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-center px-2">{label}</span>
                    </div>
                )}
            </label>
        );
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 lg:p-6 font-['Outfit',_sans-serif] relative">
            {/* Animated Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-100/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

            <div
                className="w-full max-w-6xl bg-white rounded-[40px] shadow-[0_32px_120px_rgba(0,0,0,0.08)] flex flex-col md:flex-row relative z-10 border border-white my-10 min-h-0 sm:min-h-[600px]"
            >
                {/* Left Side: Form Section */}
                <div className="w-full md:w-1/2 p-4 sm:p-8 lg:p-16 flex flex-col bg-white relative z-20">
                    <div className="flex-1">
                        <div className="mb-10 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-3 mb-6 group cursor-pointer">
                                <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                                    {logoUrl ? (
                                        <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                                    ) : (
                                        <Building2 className="text-white" size={24} />
                                    )}
                                </div>
                                <div>
                                    <span className="text-xl font-black text-slate-900 tracking-tight block leading-none">{appName}</span>
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em] mt-1 block">Merchant Portal</span>
                                </div>
                            </div>

                            {forgotPasswordStep > 0 ? (
                                <>
                                    <button onClick={() => setForgotPasswordStep(0)} className="mb-4 text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                                        <ArrowLeft size={14} /> Back to Login
                                    </button>
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight leading-tight">
                                        {forgotPasswordStep === 1 ? 'Reset Password' : 'Verify & Reset'}
                                    </h1>
                                    <p className="text-slate-400 font-medium text-base">
                                        {forgotPasswordStep === 1 ? 'Enter your registered mobile number to receive an OTP.' : `Enter the OTP sent to ${formData.forgotPhone} and your new PIN.`}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight leading-tight">
                                        {isLogin ? 'Welcome Back' : 'Join Our Network'}
                                    </h1>
                                    <p className="text-slate-400 font-medium text-base">
                                        {isLogin ? 'Access your store dashboard and manage orders.' : 'Register your business to reach more customers.'}
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
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Registered Phone Number</label>
                                        <div className="relative group">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                            <input type="tel" name="forgotPhone" required value={formData.forgotPhone} onChange={handleChange} placeholder="10 Digit Number" className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all" />
                                        </div>
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
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Enter OTP</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                            <input type="text" name="otp" required value={formData.otp} onChange={handleChange} placeholder="OTP Code" className={`w-full pl-12 pr-5 py-4 bg-slate-50 border-2 rounded-[20px] text-sm font-bold text-slate-700 outline-none transition-all tracking-[0.5em] ${otpError ? 'border-red-300 focus:border-red-400 focus:bg-white' : 'border-transparent focus:border-indigo-100 focus:bg-white'}`} />
                                        </div>
                                        {otpError && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{otpError}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">New 6-Digit PIN</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                            <input type="password" name="newPassword" required value={formData.newPassword} onChange={handleChange} placeholder="••••••" className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all tracking-[0.5em]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Confirm 6-Digit PIN</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                            <input type="password" name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} placeholder="••••••" className={`w-full pl-12 pr-5 py-4 bg-slate-50 border-2 rounded-[20px] text-sm font-bold text-slate-700 outline-none transition-all tracking-[0.5em] ${formData.confirmPassword && formData.newPassword !== formData.confirmPassword ? 'border-red-300 focus:border-red-400 focus:bg-white' : 'border-transparent focus:border-indigo-100 focus:bg-white'}`} />
                                        </div>
                                        {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                                            <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">Passwords do not match.</p>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {forgotPasswordStep === 0 && !isLogin && (
                                <motion.div
                                    key="signup-fields"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Owner Name</label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                                <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="Your Full Name" className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Shop Name</label>
                                            <div className="relative group">
                                                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                                <input type="text" name="shopName" required value={formData.shopName} onChange={handleChange} placeholder="Business Name" className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Phone Number</label>
                                            <div className="relative group">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                                <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} placeholder="10 Digit Number" className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Store Category</label>
                                            <div className="relative group">
                                                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                                <select name="category" required value={formData.category} onChange={handleChange} className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all appearance-none">
                                                    <option value="Grocery">Grocery</option>
                                                    <option value="Vegetables">Fruits & Vegetables</option>
                                                    <option value="Meat">Meat & Fish</option>
                                                    <option value="Bakery">Bakery & Snacks</option>
                                                    <option value="Pharmacy">Pharmacy</option>
                                                    <option value="General">General Store</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between ml-1">
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Shop Location & Address</label>
                                            <button type="button" onClick={() => setIsLocationModalOpen(true)} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1">
                                                <MapPin size={10} /> Search / Auto Detect
                                            </button>
                                        </div>
                                        
                                        <div className="relative group">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                            <input type="text" readOnly onClick={() => setIsLocationModalOpen(true)} required value={formData.address} placeholder="Search or detect your location..." className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all cursor-pointer" />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            <input type="text" name="lat" required readOnly value={formData.lat} placeholder="Latitude" className="w-full px-5 py-3 bg-slate-50 border-none rounded-[16px] text-xs font-bold text-slate-500 outline-none" />
                                            <input type="text" name="lng" required readOnly value={formData.lng} placeholder="Longitude" className="w-full px-5 py-3 bg-slate-50 border-none rounded-[16px] text-xs font-bold text-slate-500 outline-none" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Shop Description</label>
                                        <textarea name="description" required value={formData.description} onChange={handleChange} placeholder="Describe your store and products..." className="w-full px-5 py-3 bg-slate-50 border-2 border-transparent rounded-[20px] text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all min-h-[80px] resize-none" />
                                    </div>

                                    <div className="pt-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 block ml-1 flex items-center gap-2">
                                            <FileText size={14} /> Verification Documents
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <FileInput name="tradeLicense" label="Trade License" />
                                            <FileInput name="gstCertificate" label="GST Certificate" />
                                            <FileInput name="idProof" label="ID Proof" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {forgotPasswordStep === 0 && (
                            <motion.div
                                key="login-fields"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                        <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="email@business.com" className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between ml-1">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">6-Digit Security PIN</label>
                                        {isLogin && <button type="button" onClick={() => setForgotPasswordStep(1)} className="text-[10px] font-bold text-indigo-500 hover:underline">Forgot PIN?</button>}
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                        <input type="password" name="password" required value={formData.password} onChange={handleChange} placeholder="••••••" className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 transition-all tracking-[0.5em]" />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white rounded-[24px] py-5 text-base font-black shadow-2xl shadow-slate-200 hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-6">
                            {isLoading ? (
                                <>
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>PROCESSING...</span>
                                </>
                            ) : (
                                <>
                                    <span>
                                        {forgotPasswordStep === 1 ? 'SEND OTP' : 
                                         forgotPasswordStep === 2 ? 'RESET PASSWORD' :
                                         isLogin ? 'LOG IN' : 'SUBMIT APPLICATION'}
                                    </span>
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>
                    
                    {forgotPasswordStep === 0 && (
                        <div className="text-center mt-8">
                            <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors group">
                                {isLogin ? (
                                    <>New merchant? <span className="text-indigo-600 group-hover:underline">Create an account</span></>
                                ) : (
                                    <>Already registered? <span className="text-indigo-600 group-hover:underline">Log in here</span></>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

                {/* Right Side: Branding/Visual */}
                <div className="hidden md:flex w-1/2 bg-slate-900 p-12 lg:p-20 text-white flex-col justify-between relative overflow-hidden">
                    {/* Visual Decor */}
                    <div className="absolute top-0 right-0 w-full h-full opacity-30">
                        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-600 rounded-full blur-[100px]"></div>
                        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-emerald-500 rounded-full blur-[100px]"></div>
                    </div>

                    <div className="relative z-10 flex justify-end">
                         <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60 text-[10px] font-bold tracking-widest px-4 py-2 rounded-full backdrop-blur-md">
                             V2.0 STABLE
                         </Badge>
                    </div>
                    
                    <div className="space-y-12 relative z-10">
                        <div className="inline-flex p-6 bg-white/5 rounded-[32px] backdrop-blur-2xl border border-white/10 shadow-2xl animate-bounce-slow">
                            <Sparkles size={48} className="text-indigo-400" />
                        </div>
                        <div className="space-y-6">
                            <h2 className="text-5xl font-black leading-tight tracking-tight">Grow Your<br /><span className="text-indigo-400">Digital Store</span></h2>
                            <p className="text-slate-400 font-medium text-lg opacity-80 max-w-sm">Join the fastest growing quick-commerce network and deliver happiness to your neighborhood.</p>
                        </div>
                        <div className="flex items-center gap-6">
                             <div className="flex -space-x-3">
                                 {[1,2,3,4].map(i => (
                                     <div key={i} className="h-10 w-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                                         {String.fromCharCode(64 + i)}
                                     </div>
                                 ))}
                             </div>
                             <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">Trusted by 500+ Local Merchants</p>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-2">
                        <div className="h-1 w-12 bg-indigo-500 rounded-full"></div>
                        <div className="h-1 w-2 bg-slate-700 rounded-full"></div>
                        <div className="h-1 w-2 bg-slate-700 rounded-full"></div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 4s ease-in-out infinite;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #CBD5E1;
                }
            `}} />
            <SellerLocationModal 
                isOpen={isLocationModalOpen} 
                onClose={() => setIsLocationModalOpen(false)} 
                onSelectLocation={handleLocationSelect} 
            />
        </div>
    );
};

export default Auth;
