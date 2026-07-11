import React, { useState, useEffect, useRef } from 'react';
import { User, Sparkles, ChevronRight, Loader2, Mail, MapPin, Building2, FileText, Shield, Leaf, Briefcase, ChevronDown, X, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../../services/customerApi';
import { BRAND_COLOR, BRAND_COLOR_DARK, BRAND_COLOR_LIGHT } from '../../constants/brandTheme';

const businessTypes = [
    "Restaurant", "Cafe", "Cloud Kitchen", "QSR", "Bakery", "Sweet Shop", 
    "Bar", "Pub", "Food Court Stall", "Dhaba", "Catering Service", "Tiffin Service", 
    "Grocery Store", "Supermarket", "Pharmacy", "Dark Store", "Warehouse", 
    "Wholesale Store", "Supplier", "Manufacturer", "Other"
];

/**
 * SetNameModal
 *
 * A slide-up bottom-sheet style modal that prompts the user to complete their profile.
 * Shown when:
 *   - The user has not filled all their profile details (checked via API).
 *
 * Props:
 *   open       — boolean: whether to show the modal
 *   onSuccess  — (name: string) => void: called after profile is saved to DB
 */
const SetNameModal = ({ open, onSuccess, onLogout }) => {
    const [form, setForm] = useState({
        name: '',
        address: '',
        landmark: '',
        email: '',
        businessName: '',
        businessAddress: '',
        businessType: '',
        customBusinessType: '',
        panNo: '',
        gstNo: '',
        fssaiNumber: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [animIn, setAnimIn] = useState(false);
    const [showBusinessTypeDropdown, setShowBusinessTypeDropdown] = useState(false);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const [showConfirmLogout, setShowConfirmLogout] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowBusinessTypeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* ── Mount / unmount animation ── */
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            setVisible(true);
            const t = setTimeout(() => {
                setAnimIn(true);
                setTimeout(() => inputRef.current?.focus(), 300);
            }, 30);
            return () => {
                clearTimeout(t);
                document.body.style.overflow = 'unset';
            };
        } else {
            document.body.style.overflow = 'unset';
            setAnimIn(false);
            const t = setTimeout(() => {
                setVisible(false);
                setShowConfirmLogout(false);
                setForm({
                    name: '',
                    address: '',
                    landmark: '',
                    email: '',
                    businessName: '',
                    businessAddress: '',
                    businessType: '',
                    customBusinessType: '',
                    panNo: '',
                    gstNo: '',
                    fssaiNumber: '',
                });
            }, 350);
            return () => clearTimeout(t);
        }
    }, [open]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isNameValid = (name) => name.trim().length >= 2 && /[a-zA-Z]/.test(name);
    const isAddressValid = (address) => address.trim().length >= 5;
    const isLandmarkValid = (landmark) => landmark.trim().length >= 3;
    const isPanValid = (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(pan.trim());
    const isGstValid = (gst) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[A-Z]{1}[0-9A-Z]{1}$/i.test(gst.trim());
    const isFssaiValid = (fssai) => /^[0-9]{14}$/.test(fssai.trim());
    const isBusinessTypeValid = (type, customType) => {
        if (!type) return false;
        if (type === 'Other') return customType.trim().length >= 2;
        return true;
    };

    /* ── Save handler ── */
    const handleSave = async (e) => {
        e?.preventDefault();
        const trimmedName = form.name.trim();
        const trimmedAddress = form.address.trim();
        const trimmedLandmark = form.landmark.trim();
        const trimmedEmail = form.email.trim();
        const trimmedBusinessName = form.businessName.trim();
        const trimmedBusinessAddress = form.businessAddress.trim();
        const finalBusinessType = form.businessType === 'Other' ? form.customBusinessType.trim() : form.businessType;
        const trimmedPanNo = form.panNo.trim().toUpperCase();
        const trimmedGstNo = form.gstNo.trim().toUpperCase();
        const trimmedFssai = form.fssaiNumber.trim();

        if (!isNameValid(trimmedName)) {
            toast.error('Please enter a valid name with letters (min 2 chars)');
            inputRef.current?.focus();
            return;
        }
        if (!isAddressValid(trimmedAddress)) {
            toast.error('Please enter a complete address (min 5 chars)');
            return;
        }
        if (!isLandmarkValid(trimmedLandmark)) {
            toast.error('Please enter a landmark (min 3 chars)');
            return;
        }
        if (!isEmailValid(trimmedEmail)) {
            toast.error('Please enter a valid email address');
            return;
        }
        if (!trimmedBusinessName) {
            toast.error('Business name is required');
            return;
        }
        if (!trimmedBusinessAddress) {
            toast.error('Business address is required');
            return;
        }
        if (!finalBusinessType) {
            toast.error('Please select or specify a business type');
            return;
        }
        if (!isPanValid(trimmedPanNo)) {
            toast.error('Invalid PAN Number format');
            return;
        }
        if (trimmedGstNo && !isGstValid(trimmedGstNo)) {
            toast.error('Invalid GST Number format');
            return;
        }
        if (trimmedFssai && !isFssaiValid(trimmedFssai)) {
            toast.error('FSSAI Number must be exactly 14 digits');
            return;
        }

        setIsLoading(true);
        try {
            const response = await customerApi.updateProfile({
                name: trimmedName,
                email: trimmedEmail,
                businessName: trimmedBusinessName,
                businessAddress: trimmedBusinessAddress,
                businessType: finalBusinessType,
                panNo: trimmedPanNo,
                gstNo: trimmedGstNo,
                fssaiNumber: trimmedFssai,
                addresses: [
                    {
                        label: 'home',
                        fullAddress: trimmedAddress,
                        landmark: trimmedLandmark,
                    }
                ]
            });
            toast.success(`Welcome, ${trimmedName}! 🎉`);
            onSuccess?.(trimmedName, response.data.result);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to save profile. Please try again.';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    if (!visible) return null;

    const inputClass = (hasValue) => ({
        borderColor: hasValue ? BRAND_COLOR : '#e2e8f0',
        boxShadow: hasValue ? `0 0 0 3px ${BRAND_COLOR}18` : 'none',
    });

    const fieldClass = 'flex items-center gap-3 rounded-2xl border px-4 py-3 bg-slate-50 transition-all';
    const inputInnerClass = 'flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 disabled:opacity-60';

    const isFormValid =
        isNameValid(form.name) &&
        isAddressValid(form.address) &&
        isLandmarkValid(form.landmark) &&
        isEmailValid(form.email) &&
        form.businessName.trim().length >= 2 &&
        form.businessAddress.trim().length >= 5 &&
        isBusinessTypeValid(form.businessType, form.customBusinessType) &&
        isPanValid(form.panNo) &&
        (form.gstNo === '' || isGstValid(form.gstNo)) &&
        (form.fssaiNumber === '' || isFssaiValid(form.fssaiNumber));

    return (
        <>
            {/* ── Backdrop ── */}
            <div
                className="fixed inset-0 z-[9998] transition-all duration-300"
                style={{
                    backgroundColor: animIn ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
                    backdropFilter: animIn ? 'blur(3px)' : 'none',
                    WebkitBackdropFilter: animIn ? 'blur(3px)' : 'none',
                }}
                aria-hidden="true"
            />

            {/* ── Sheet ── */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="set-name-title"
                className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col transition-transform duration-350 ease-out md:inset-0 md:items-center md:justify-center md:p-6"
                style={{
                    transform: animIn ? 'translateY(0%)' : 'translateY(105%)',
                    transitionTimingFunction: animIn
                        ? 'cubic-bezier(0.22, 1, 0.36, 1)'
                        : 'cubic-bezier(0.4, 0, 1, 1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mx-auto w-full max-w-lg rounded-t-3xl md:rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col relative">

                    {/* Drag pill — mobile only */}
                    <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
                        <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                    </div>

                    {/* Fixed Header */}
                    <div className="px-6 pt-5 pb-3 shrink-0 relative">
                        <button
                            type="button"
                            onClick={() => setShowConfirmLogout(true)}
                            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors z-10"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                        {/* Icon */}
                        <div
                            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{ backgroundColor: BRAND_COLOR_LIGHT }}
                        >
                            <div className="relative">
                                <User size={26} style={{ color: BRAND_COLOR }} />
                                <Sparkles
                                    size={12}
                                    style={{ color: BRAND_COLOR }}
                                    className="absolute -top-1.5 -right-2"
                                />
                            </div>
                        </div>

                        {/* Heading */}
                        <h2
                            id="set-name-title"
                            className="text-center text-xl font-black tracking-tight text-slate-900"
                        >
                            Complete Your Profile
                        </h2>
                        <p className="mt-1 text-center text-sm text-slate-500 leading-snug">
                            Let us personalise your experience.<br />
                            Please fill all the mandatory fields below to continue.
                        </p>
                    </div>

                    {/* Scrollable Form Content */}
                    <div className="px-6 pb-6 overflow-y-auto overscroll-contain flex-1 custom-scrollbar" data-lenis-prevent="true">
                        <form id="profile-form" onSubmit={handleSave} className="space-y-4 pt-2" noValidate>

                            {/* ── Personal Info Section ── */}
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Personal Info *</p>

                            {/* Name */}
                            <div className={fieldClass} style={inputClass(form.name.length > 0)}>
                                <User size={18} className="shrink-0 text-slate-400" />
                                <input
                                    ref={inputRef}
                                    id="set-name-input"
                                    type="text"
                                    value={form.name}
                                    onChange={handleChange('name')}
                                    placeholder="Full name *"
                                    maxLength={60}
                                    autoComplete="name"
                                    disabled={isLoading}
                                    className={inputInnerClass}
                                />
                                {form.name.trim().length >= 2 && (
                                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: BRAND_COLOR }} />
                                )}
                            </div>

                            {/* Address */}
                            <div className={fieldClass} style={inputClass(form.address.length > 0)}>
                                <MapPin size={18} className="shrink-0 text-slate-400" />
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={handleChange('address')}
                                    placeholder="Your address *"
                                    maxLength={200}
                                    autoComplete="street-address"
                                    disabled={isLoading}
                                    className={inputInnerClass}
                                />
                            </div>

                            {/* Landmark */}
                            <div className={fieldClass} style={inputClass(form.landmark.length > 0)}>
                                <MapPin size={18} className="shrink-0 text-slate-400" />
                                <input
                                    type="text"
                                    value={form.landmark}
                                    onChange={handleChange('landmark')}
                                    placeholder="Landmark near address *"
                                    maxLength={100}
                                    disabled={isLoading}
                                    className={inputInnerClass}
                                />
                            </div>

                            {/* Email */}
                            <div className={fieldClass} style={inputClass(form.email.length > 0)}>
                                <Mail size={18} className="shrink-0 text-slate-400" />
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={handleChange('email')}
                                    placeholder="Email address *"
                                    maxLength={100}
                                    autoComplete="email"
                                    disabled={isLoading}
                                    className={inputInnerClass}
                                />
                            </div>

                            {/* ── Business Info Section ── */}
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 pt-2">Business Info *</p>

                            {/* Business Name */}
                            <div className={fieldClass} style={inputClass(form.businessName.length > 0)}>
                                <Building2 size={18} className="shrink-0 text-slate-400" />
                                <input
                                    type="text"
                                    value={form.businessName}
                                    onChange={handleChange('businessName')}
                                    placeholder="Business name *"
                                    maxLength={100}
                                    disabled={isLoading}
                                    className={inputInnerClass}
                                />
                            </div>

                            {/* Business Address */}
                            <div className={fieldClass} style={inputClass(form.businessAddress.length > 0)}>
                                <MapPin size={18} className="shrink-0 text-slate-400" />
                                <input
                                    type="text"
                                    value={form.businessAddress}
                                    onChange={handleChange('businessAddress')}
                                    placeholder="Business address *"
                                    maxLength={200}
                                    disabled={isLoading}
                                    className={inputInnerClass}
                                />
                            </div>

                            {/* Business Type Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => !isLoading && setShowBusinessTypeDropdown(!showBusinessTypeDropdown)}
                                    className={`${fieldClass} w-full text-left`}
                                    style={inputClass(form.businessType.length > 0)}
                                >
                                    <Briefcase size={18} className="shrink-0 text-slate-400" />
                                    <span className={`flex-1 text-sm font-semibold outline-none ${form.businessType ? 'text-slate-900' : 'text-slate-400'}`}>
                                        {form.businessType || 'Select Business Type *'}
                                    </span>
                                    <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform duration-200 ${showBusinessTypeDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showBusinessTypeDropdown && (
                                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar">
                                        {businessTypes.map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => {
                                                    setForm(prev => ({ ...prev, businessType: type }));
                                                    setShowBusinessTypeDropdown(false);
                                                }}
                                                className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition-colors flex items-center justify-between"
                                            >
                                                {type}
                                                {form.businessType === type && (
                                                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: BRAND_COLOR }} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Custom Business Type input */}
                            {form.businessType === 'Other' && (
                                <div className={fieldClass} style={inputClass(form.customBusinessType.length > 0)}>
                                    <Briefcase size={18} className="shrink-0 text-slate-400" />
                                    <input
                                        type="text"
                                        value={form.customBusinessType}
                                        onChange={handleChange('customBusinessType')}
                                        placeholder="Specify business type *"
                                        maxLength={50}
                                        disabled={isLoading}
                                        className={inputInnerClass}
                                    />
                                </div>
                            )}

                            {/* PAN No */}
                            <div className={fieldClass} style={inputClass(form.panNo.length > 0)}>
                                <FileText size={18} className="shrink-0 text-slate-400" />
                                <input
                                    type="text"
                                    value={form.panNo}
                                    onChange={handleChange('panNo')}
                                    placeholder="PAN number *"
                                    maxLength={10}
                                    disabled={isLoading}
                                    className={`${inputInnerClass} uppercase`}
                                />
                            </div>

                            {/* GST No */}
                            <div className={fieldClass} style={inputClass(form.gstNo.length > 0)}>
                                <Shield size={18} className="shrink-0 text-slate-400" />
                                <input
                                    type="text"
                                    value={form.gstNo}
                                    onChange={handleChange('gstNo')}
                                    placeholder="GST number (Optional)"
                                    maxLength={15}
                                    disabled={isLoading}
                                    className={`${inputInnerClass} uppercase`}
                                />
                            </div>

                            {/* FSSAI */}
                            <div className={fieldClass} style={inputClass(form.fssaiNumber.length > 0)}>
                                <Leaf size={18} className="shrink-0 text-slate-400" />
                                <input
                                    type="text"
                                    value={form.fssaiNumber}
                                    onChange={handleChange('fssaiNumber')}
                                    placeholder="FSSAI number (Optional)"
                                    maxLength={14}
                                    disabled={isLoading}
                                    className={inputInnerClass}
                                />
                            </div>
                        </form>
                    </div>

                    {/* Fixed Footer */}
                    <div className="shrink-0 p-4 md:px-6 border-t border-slate-100 bg-white shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.03)] z-10">
                        <button
                            id="set-name-save-btn"
                            type="submit"
                            form="profile-form"
                            disabled={isLoading}
                            className="relative w-full overflow-hidden rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{
                                background: isLoading
                                    ? '#9ca3af'
                                    : `linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 100%)`,
                                boxShadow: !isLoading
                                    ? `0 8px 24px ${BRAND_COLOR}40`
                                    : 'none',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    Save &amp; Continue
                                    <ChevronRight size={20} />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Confirmation Dialog Overlay */}
                    {showConfirmLogout && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 text-center animate-in zoom-in-95 duration-200">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
                                    <LogOut size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Are you sure?</h3>
                                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                                    If you close this screen, you'll be logged out and will need to verify your OTP again.
                                </p>
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmLogout(false)}
                                        className="w-full rounded-xl py-3.5 text-base font-bold text-white transition-all bg-slate-900 hover:bg-slate-800 active:scale-[0.98]"
                                    >
                                        Continue Profile
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowConfirmLogout(false);
                                            onLogout?.();
                                        }}
                                        className="w-full rounded-xl py-3.5 text-base font-bold text-red-600 transition-all bg-red-50 hover:bg-red-100 active:scale-[0.98]"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default SetNameModal;
