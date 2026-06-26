import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Phone, Mail, Camera, Save, MapPin, Building2, FileText, Shield, Leaf, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@core/context/AuthContext';
import { uploadApi, getUploadResult } from '@core/api/uploadApi';
import { customerApi } from '../services/customerApi';

const AVATAR_FOLDER = 'customers';

const businessTypeOptions = [
    "Restaurant", "Cafe", "Cloud Kitchen", "QSR", "Bakery", "Sweet Shop", 
    "Bar", "Pub", "Food Court Stall", "Dhaba", "Catering Service", "Tiffin Service", 
    "Grocery Store", "Supermarket", "Pharmacy", "Dark Store", "Warehouse", 
    "Wholesale Store", "Supplier", "Manufacturer", "Other"
];

const loadBusinessType = (type) => {
    if (!type) return { businessType: '', customBusinessType: '' };
    if (businessTypeOptions.includes(type)) {
        return { businessType: type, customBusinessType: '' };
    } else {
        return { businessType: 'Other', customBusinessType: type };
    }
};

const EditProfilePage = () => {
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const fileInputRef = useRef(null);
    const previewBlobRef = useRef(null);
    const dropdownRef = useRef(null);

    const [isLoading, setIsLoading] = useState(false);
    const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState('');
    const [savedAvatarUrl, setSavedAvatarUrl] = useState('');
    const [showBusinessTypeDropdown, setShowBusinessTypeDropdown] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowBusinessTypeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        businessName: '',
        businessAddress: '',
        businessType: '',
        customBusinessType: '',
        panNo: '',
        gstNo: '',
        fssaiNumber: '',
    });

    const revokePreviewBlob = () => {
        if (previewBlobRef.current) {
            URL.revokeObjectURL(previewBlobRef.current);
            previewBlobRef.current = null;
        }
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await customerApi.getProfile();
                const profile = res.data?.result ?? res.data?.data ?? user;
                if (cancelled || !profile) return;
                const bt = loadBusinessType(profile.businessType);
                setFormData({
                    name: profile.name ?? '',
                    phone: profile.phone ?? '',
                    email: profile.email ?? '',
                    businessName: profile.businessName ?? '',
                    businessAddress: profile.businessAddress ?? '',
                    businessType: bt.businessType,
                    customBusinessType: bt.customBusinessType,
                    panNo: profile.panNo ?? '',
                    gstNo: profile.gstNo ?? '',
                    fssaiNumber: profile.fssaiNumber ?? '',
                });
                const url = profile.avatar ?? '';
                setSavedAvatarUrl(url);
                setAvatarPreview(url);
            } catch {
                if (!cancelled && user) {
                    const bt = loadBusinessType(user.businessType);
                    setFormData({
                        name: user.name ?? '',
                        phone: user.phone ?? '',
                        email: user.email ?? '',
                        businessName: user.businessName ?? '',
                        businessAddress: user.businessAddress ?? '',
                        businessType: bt.businessType,
                        customBusinessType: bt.customBusinessType,
                        panNo: user.panNo ?? '',
                        gstNo: user.gstNo ?? '',
                        fssaiNumber: user.fssaiNumber ?? '',
                    });
                    const url = user.avatar ?? '';
                    setSavedAvatarUrl(url);
                    setAvatarPreview(url);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
            revokePreviewBlob();
        };
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'phone') return;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    /** Only preview locally — upload happens on Save */
    const handleAvatarPick = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please choose an image file');
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            toast.error('Image must be 15MB or smaller');
            return;
        }

        revokePreviewBlob();
        const blobUrl = URL.createObjectURL(file);
        previewBlobRef.current = blobUrl;
        setPendingAvatarFile(file);
        setAvatarPreview(blobUrl);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            let avatarUrl = savedAvatarUrl;

            if (pendingAvatarFile) {
                const uploadRes = await uploadApi.uploadSingle(
                    pendingAvatarFile,
                    AVATAR_FOLDER,
                );
                const uploaded = getUploadResult(uploadRes);
                if (!uploaded?.url) {
                    throw new Error('Image upload failed — no URL returned');
                }
                avatarUrl = uploaded.url;
            }

            const finalBusinessType = formData.businessType === 'Other' ? formData.customBusinessType.trim() : formData.businessType;
            await customerApi.updateProfile({
                name: formData.name.trim(),
                email: formData.email?.trim() || undefined,
                avatar: avatarUrl || undefined,
                businessName: formData.businessName?.trim() || undefined,
                businessAddress: formData.businessAddress?.trim() || undefined,
                businessType: finalBusinessType || undefined,
                panNo: formData.panNo?.trim() || undefined,
                gstNo: formData.gstNo?.trim() || undefined,
                fssaiNumber: formData.fssaiNumber?.trim() || undefined,
            });

            revokePreviewBlob();
            setPendingAvatarFile(null);
            setSavedAvatarUrl(avatarUrl);
            setAvatarPreview(avatarUrl);

            await refreshUser();
            toast.success('Profile updated successfully!');
            navigate('/profile', { replace: true });
        } catch (error) {
            const msg =
                error.response?.data?.message ||
                error.message ||
                'Failed to update profile';
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const hasPendingPhoto = Boolean(pendingAvatarFile);

    const handleBack = () => {
        const finalBusinessType = formData.businessType === 'Other' ? formData.customBusinessType.trim() : formData.businessType;
        const hasChanges =
            formData.name !== (user?.name ?? '') ||
            (formData.email || '') !== (user?.email || '') ||
            (formData.businessName || '') !== (user?.businessName || '') ||
            (formData.businessAddress || '') !== (user?.businessAddress || '') ||
            (finalBusinessType || '') !== (user?.businessType || '') ||
            (formData.panNo || '') !== (user?.panNo || '') ||
            (formData.gstNo || '') !== (user?.gstNo || '') ||
            (formData.fssaiNumber || '') !== (user?.fssaiNumber || '') ||
            hasPendingPhoto;

        if (hasChanges) {
            if (window.confirm("You have unsaved changes. Are you sure you want to go back without saving?")) {
                navigate('/profile', { replace: true });
            }
        } else {
            navigate('/profile', { replace: true });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-10">
            <main className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
                {/* Header — matches ProfilePage style */}
                <div className="mb-2">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="shrink-0 rounded-full p-1.5 hover:bg-slate-200/70 transition-colors -ml-1.5"
                            aria-label="Back"
                        >
                            <ChevronLeft size={22} className="text-slate-900" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Edit Profile</h1>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center mb-8">
                    <div className="relative">
                        <div className="h-28 w-28 rounded-full bg-slate-200 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                            {avatarPreview ? (
                                <img
                                    src={avatarPreview}
                                    alt="Profile preview"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <User size={48} className="text-slate-400" />
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 p-2 bg-[#E23744] text-white rounded-full border-2 border-white shadow-sm hover:bg-[#C41E35] transition-colors disabled:opacity-60"
                        >
                            <Camera size={18} />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarPick}
                        />
                    </div>
                    <p className="mt-3 text-sm font-bold text-[#E23744]">Change Photo</p>
                    {hasPendingPhoto && (
                        <p className="mt-1 text-[11px] font-medium text-amber-600">
                            New photo selected — tap Save to upload
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all">
                                <User size={20} className="text-slate-400" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-slate-800 font-bold outline-none placeholder:font-medium"
                                    placeholder="Enter your name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                            <div className="flex items-center gap-3 bg-slate-100 px-4 py-3 rounded-xl border border-slate-200 opacity-80">
                                <Phone size={20} className="text-slate-400" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    readOnly
                                    className="bg-transparent w-full text-slate-600 font-bold outline-none cursor-not-allowed"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Phone is used for login and cannot be changed here.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all">
                                <Mail size={20} className="text-slate-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-slate-800 font-bold outline-none placeholder:font-medium"
                                    placeholder="Enter email address"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Business Info Section */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                        <div className="flex items-center gap-2 mb-1">
                            <Building2 size={16} className="text-[#E23744]" />
                            <p className="text-sm font-black text-slate-700">Business Info</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Business Name</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all">
                                <Building2 size={20} className="text-slate-400" />
                                <input
                                    type="text"
                                    name="businessName"
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-slate-800 font-bold outline-none placeholder:font-medium"
                                    placeholder="Enter business name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Business Address</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all">
                                <MapPin size={20} className="text-slate-400" />
                                <input
                                    type="text"
                                    name="businessAddress"
                                    value={formData.businessAddress}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-slate-800 font-bold outline-none placeholder:font-medium"
                                    placeholder="Enter business address"
                                />
                            </div>
                        </div>

                        <div className="relative" ref={dropdownRef}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Business Type</label>
                            <button
                                type="button"
                                onClick={() => !isLoading && setShowBusinessTypeDropdown(!showBusinessTypeDropdown)}
                                className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all w-full text-left"
                            >
                                <Building2 size={20} className="text-slate-400" />
                                <span className={`flex-1 font-bold ${formData.businessType ? 'text-slate-800' : 'text-slate-400'}`}>
                                    {formData.businessType || 'Select Business Type'}
                                </span>
                                <ChevronDown size={20} className={`text-slate-400 transition-transform duration-200 ${showBusinessTypeDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showBusinessTypeDropdown && (
                                <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar">
                                    {businessTypeOptions.map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, businessType: opt }));
                                                setShowBusinessTypeDropdown(false);
                                            }}
                                            className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#E23744] transition-colors flex items-center justify-between"
                                        >
                                            {opt}
                                            {formData.businessType === opt && (
                                                <span className="h-2 w-2 rounded-full bg-[#E23744] shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {formData.businessType === 'Other' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Custom Business Type</label>
                                <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all">
                                    <Building2 size={20} className="text-slate-400" />
                                    <input
                                        type="text"
                                        name="customBusinessType"
                                        value={formData.customBusinessType}
                                        onChange={handleChange}
                                        className="bg-transparent w-full text-slate-800 font-bold outline-none placeholder:font-medium"
                                        placeholder="Specify business type"
                                        maxLength={50}
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">PAN Number</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all">
                                <FileText size={20} className="text-slate-400" />
                                <input
                                    type="text"
                                    name="panNo"
                                    value={formData.panNo}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-slate-800 font-bold outline-none placeholder:font-medium uppercase"
                                    placeholder="Enter PAN number"
                                    maxLength={10}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">GST Number</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all">
                                <Shield size={20} className="text-slate-400" />
                                <input
                                    type="text"
                                    name="gstNo"
                                    value={formData.gstNo}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-slate-800 font-bold outline-none placeholder:font-medium uppercase"
                                    placeholder="Enter GST number"
                                    maxLength={15}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">FSSAI Number</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 focus-within:border-[#E23744] focus-within:ring-4 focus-within:ring-[#E23744]/10 transition-all">
                                <Leaf size={20} className="text-slate-400" />
                                <input
                                    type="text"
                                    name="fssaiNumber"
                                    value={formData.fssaiNumber}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-slate-800 font-bold outline-none placeholder:font-medium"
                                    placeholder="Enter FSSAI number"
                                    maxLength={14}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-[#E23744] text-white font-bold rounded-2xl shadow-lg shadow-brand-200 hover:bg-[#C41E35] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save size={20} />
                        )}
                        {isLoading
                            ? hasPendingPhoto
                                ? 'Uploading photo & saving...'
                                : 'Saving...'
                            : 'Save Changes'}
                    </button>
                </form>
            </main>
        </div>
    );
};


export default EditProfilePage;
