import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Home, Briefcase, MapPin, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';
import { useLocation } from '../context/LocationContext';
import MapPicker from '@/shared/components/MapPicker';

const AddressesPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { refreshAddresses } = useLocation();
    const [addresses, setAddresses] = useState([]);
    const [rawAddresses, setRawAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profileName, setProfileName] = useState('');
    const [profilePhone, setProfilePhone] = useState('');

    const fetchAddresses = useCallback(async () => {
        try {
            const { data } = await customerApi.getProfile();
            const profile = data?.result ?? data?.data ?? data;
            const raw = Array.isArray(profile?.addresses) ? profile.addresses : [];
            setRawAddresses(raw);
            setProfileName(profile?.name ?? '');
            setProfilePhone(profile?.phone ?? '');
            setAddresses(raw.map((addr, idx) => ({
                id: addr._id ?? idx,
                type: (addr.label || 'home').charAt(0).toUpperCase() + (addr.label || 'home').slice(1),
                name: profile?.name ?? '',
                address: addr.fullAddress || [addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || '',
                city: addr.city,
                state: addr.state,
                pincode: addr.pincode,
                phone: profile?.phone ?? '',
                isDefault: idx === 0
            })));
        } catch {
            setAddresses([]);
            setRawAddresses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    // Auto-open Add modal when navigated from LocationDrawer with ?add=1
    useEffect(() => {
        if (searchParams.get('add') === '1' && !loading) {
            setSearchParams({}, { replace: true });
            openAddModal();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, loading]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [saving, setSaving] = useState(false);

    const [addForm, setAddForm] = useState({
        type: 'home',
        name: '',
        phone: '',
        address: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        location: null // { lat, lng }
    });

    const [isMapOpen, setIsMapOpen] = useState(false);
    const [mapMode, setMapMode] = useState('add'); // 'add' or 'edit'

    const openAddModal = () => {
        setAddForm({
            type: 'home',
            name: profileName,
            phone: profilePhone || '',
            address: '',
            landmark: '',
            city: '',
            state: '',
            pincode: '',
            location: null
        });
        setIsAddOpen(true);
    };

    const handleMapConfirm = (data) => {
        if (mapMode === 'add') {
            setAddForm(f => ({
                ...f,
                address: data.address || f.address,
                location: { lat: data.lat, lng: data.lng }
            }));
        } else {
            setEditForm(f => ({
                ...f,
                address: data.address || f.address,
                location: { lat: data.lat, lng: data.lng }
            }));
        }
    };

    const handleSaveNewAddress = async () => {
        const name = addForm.name?.trim();
        const address = addForm.address?.trim();
        const city = addForm.city?.trim();
        const landmark = addForm.landmark?.trim();
        const state = addForm.state?.trim();
        const pincode = addForm.pincode?.trim();
        if (!addForm.location) {
            toast.error('Please pin your location on the map first');
            return;
        }
        if (!address) {
            toast.error('Please enter the address details');
            return;
        }
        const newAddr = {
            label: addForm.type.toLowerCase(),
            fullAddress: address,
            location: addForm.location,
            ...(landmark && { landmark }),
            ...(city && { city }),
            ...(state && { state }),
            ...(pincode && { pincode })
        };
        setSaving(true);
        try {
            await customerApi.updateProfile({
                ...(name && { name }),
                ...(addForm.phone && { phone: addForm.phone.trim() }),
                addresses: [...rawAddresses, newAddr]
            });
            toast.success('Address saved successfully');
            setIsAddOpen(false);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save address');
        } finally {
            setSaving(false);
        }
    };

    const [editForm, setEditForm] = useState({
        type: 'home',
        name: '',
        phone: '',
        address: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        location: null
    });
    const [updating, setUpdating] = useState(false);

    const handleEdit = (addr) => {
        setSelectedAddress(addr);
        setEditForm({
            type: (addr.type || 'Home').toLowerCase(),
            name: addr.name ?? '',
            phone: addr.phone ?? '',
            address: addr.address ?? '',
            landmark: addr.landmark ?? '',
            city: addr.city ?? '',
            state: addr.state ?? '',
            pincode: addr.pincode ?? '',
            location: addr.location || null
        });
        setIsEditOpen(true);
    };

    const handleUpdateAddress = async () => {
        if (!selectedAddress) return;
        const address = editForm.address?.trim();
        if (!editForm.location) {
            toast.error('Please pin your location on the map');
            return;
        }
        if (!address) {
            toast.error('Please enter the address details');
            return;
        }
        const idx = addresses.findIndex(a => (a.id === selectedAddress.id) || (a.address === selectedAddress.address && a.type === selectedAddress.type));
        if (idx < 0) {
            setIsEditOpen(false);
            return;
        }
        const updatedRaw = {
            ...(rawAddresses[idx] && typeof rawAddresses[idx] === 'object' ? rawAddresses[idx] : {}),
            label: editForm.type.toLowerCase(),
            fullAddress: address,
            location: editForm.location,
            ...(editForm.landmark?.trim() && { landmark: editForm.landmark.trim() }),
            ...(editForm.city?.trim() && { city: editForm.city.trim() }),
            ...(editForm.state?.trim() && { state: editForm.state.trim() }),
            ...(editForm.pincode?.trim() && { pincode: editForm.pincode.trim() })
        };
        const updatedAddresses = rawAddresses.map((raw, i) => (i === idx ? updatedRaw : raw));
        setUpdating(true);
        try {
            await customerApi.updateProfile({
                ...(editForm.name?.trim() && { name: editForm.name.trim() }),
                ...(editForm.phone?.trim() && { phone: editForm.phone.trim() }),
                addresses: updatedAddresses
            });
            toast.success('Address updated successfully');
            setIsEditOpen(false);
            setSelectedAddress(null);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update address');
        } finally {
            setUpdating(false);
        }
    };

    const handleDelete = (addr) => {
        setSelectedAddress(addr);
        setIsDeleteOpen(true);
    };

    const [deleting, setDeleting] = useState(false);

    const handleConfirmDelete = async () => {
        if (!selectedAddress) return;
        const idx = addresses.findIndex(a => (a.id === selectedAddress.id) || (a.address === selectedAddress.address && a.type === selectedAddress.type));
        if (idx < 0) {
            setIsDeleteOpen(false);
            return;
        }
        const updatedAddresses = rawAddresses.filter((_, i) => i !== idx);
        setDeleting(true);
        try {
            await customerApi.updateProfile({ addresses: updatedAddresses });
            toast.success('Address deleted successfully');
            setIsDeleteOpen(false);
            setSelectedAddress(null);
            setLoading(true);
            await fetchAddresses();
            await refreshAddresses?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete address');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24 font-sans">
            <main className="max-w-2xl mx-auto px-4 pt-4 relative z-20 space-y-4">
                <div className="mb-2">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="shrink-0 rounded-full p-1.5 hover:bg-slate-200/70 transition-colors -ml-1.5"
                            aria-label="Back"
                        >
                            <ChevronLeft size={22} className="text-slate-900" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Saved Addresses</h1>
                        </div>
                    </div>
                </div>
                {/* Add New Address Button */}
                <button
                    onClick={openAddModal}
                    className="w-full bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-slate-700 hover:bg-slate-50 transition-colors group"
                >
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Plus size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-semibold text-sm">Add New Address</span>
                </button>

                {/* Address List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <p className="text-slate-500 font-medium">Loading addresses...</p>
                        </div>
                    ) : addresses.length === 0 ? (
                        <div className="bg-white rounded-xl p-6 border border-slate-200 text-center">
                            <MapPin size={30} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-700 font-semibold mb-1">No saved addresses</p>
                            <p className="text-slate-500 text-sm">Add your first delivery address above</p>
                        </div>
                    ) : addresses.map((addr) => (
                        <div key={addr.id} className="bg-white rounded-xl p-4 border border-slate-200 relative overflow-hidden">
                            {addr.isDefault && (
                                <div className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1 rounded-bl-lg uppercase tracking-wide">
                                    Default
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                                    {addr.type === 'Home' ? <Home size={18} /> : addr.type === 'Work' ? <Briefcase size={18} /> : <MapPin size={18} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="text-sm font-semibold text-slate-800">{addr.type}</h3>
                                    </div>
                                    <p className="text-slate-800 font-medium text-sm mb-1">{addr.name}</p>
                                    <p className="text-slate-500 text-xs leading-relaxed mb-1">{addr.address}</p>
                                    <p className="text-slate-500 text-xs mb-2">{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
                                    <p className="text-slate-700 font-medium text-xs">Phone: {addr.phone}</p>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                                <button
                                    onClick={() => handleEdit(addr)}
                                    className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(addr)}
                                    className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Add Address Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add New Address</DialogTitle>
                        <DialogDescription>
                            Enter your delivery details below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Address Type</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'home' ? 'border-[#E23744] text-[#E23744] bg-rose-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'home' }))}>Home</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'work' ? 'border-[#E23744] text-[#E23744] bg-rose-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'work' }))}>Work</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${addForm.type === 'other' ? 'border-[#E23744] text-[#E23744] bg-rose-50' : ''}`} onClick={() => setAddForm(f => ({ ...f, type: 'other' }))}>Other</Button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Pin Location</Label>
                            <Button
                                type="button"
                                variant="outline"
                                className={`w-full flex items-center gap-2 h-12 border-dashed ${addForm.location ? 'bg-rose-50 border-rose-500 text-rose-700' : 'border-slate-300'}`}
                                onClick={() => {
                                    setMapMode('add');
                                    setIsMapOpen(true);
                                }}
                            >
                                <MapPin size={18} className={addForm.location ? 'fill-rose-500' : ''} />
                                {addForm.location ? 'Location Pinned ✅' : 'Select on Map (Required)'}
                            </Button>
                            {addForm.location && (
                                <p className="text-[10px] text-rose-600 font-bold px-1">
                                    Coords: {addForm.location.lat.toFixed(4)}, {addForm.location.lng.toFixed(4)}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" placeholder="John Doe" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" placeholder="+91 98765 43210" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea id="address" placeholder="Flat No, Building, Street" value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="landmark">Nearest Landmark (optional)</Label>
                            <Input
                                id="landmark"
                                placeholder="Near City Mall, Opp. Temple"
                                value={addForm.landmark}
                                onChange={e => setAddForm(f => ({ ...f, landmark: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="city">City</Label>
                                <Input id="city" placeholder="New Delhi" value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="state">State</Label>
                                <Input id="state" placeholder="Delhi" value={addForm.state} onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pincode">Pincode</Label>
                            <Input id="pincode" placeholder="110075" value={addForm.pincode} onChange={e => setAddForm(f => ({ ...f, pincode: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancel</Button>
                        <Button className="bg-[#E23744] hover:bg-[#C41E35]" onClick={handleSaveNewAddress} disabled={saving}>{saving ? 'Saving...' : 'Save Address'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Address Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Address</DialogTitle>
                        <DialogDescription>
                            Update your delivery details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Address Type</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'home' ? 'border-[#E23744] text-[#E23744] bg-rose-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'home' }))}>Home</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'work' ? 'border-[#E23744] text-[#E23744] bg-rose-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'work' }))}>Work</Button>
                                <Button type="button" variant="outline" className={`flex-1 ${editForm.type === 'other' ? 'border-[#E23744] text-[#E23744] bg-rose-50' : ''}`} onClick={() => setEditForm(f => ({ ...f, type: 'other' }))}>Other</Button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Pin Location</Label>
                            <Button
                                type="button"
                                variant="outline"
                                className={`w-full flex items-center gap-2 h-12 border-dashed ${editForm.location ? 'bg-rose-50 border-rose-500 text-rose-700' : 'border-slate-300'}`}
                                onClick={() => {
                                    setMapMode('edit');
                                    setIsMapOpen(true);
                                }}
                            >
                                <MapPin size={18} className={editForm.location ? 'fill-rose-500' : ''} />
                                {editForm.location ? 'Location Pinned ✅' : 'Select on Map (Required)'}
                            </Button>
                            {editForm.location && (
                                <p className="text-[10px] text-rose-600 font-bold px-1">
                                    Coords: {editForm.location.lat.toFixed(4)}, {editForm.location.lng.toFixed(4)}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Full Name</Label>
                            <Input id="edit-name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-phone">Phone Number</Label>
                            <Input id="edit-phone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-address">Address</Label>
                            <Textarea id="edit-address" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-landmark">Nearest Landmark (optional)</Label>
                            <Input
                                id="edit-landmark"
                                placeholder="Near City Mall, Opp. Temple"
                                value={editForm.landmark}
                                onChange={e => setEditForm(f => ({ ...f, landmark: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-city">City</Label>
                                <Input id="edit-city" placeholder="New Delhi" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-state">State</Label>
                                <Input id="edit-state" placeholder="Delhi" value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-pincode">Pincode</Label>
                            <Input id="edit-pincode" placeholder="110075" value={editForm.pincode} onChange={e => setEditForm(f => ({ ...f, pincode: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={updating}>Cancel</Button>
                        <Button className="bg-[#E23744] hover:bg-[#C41E35]" onClick={handleUpdateAddress} disabled={updating}>{updating ? 'Updating...' : 'Update Address'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Delete Address?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this address? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedAddress && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 my-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800">{selectedAddress.type}</span>
                            </div>
                            <p className="text-slate-600 text-sm">{selectedAddress.address}</p>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleting}>Cancel</Button>
                        <Button variant="destructive" className="bg-red-500 hover:bg-red-600" onClick={handleConfirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <MapPicker
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                onConfirm={handleMapConfirm}
                initialLocation={mapMode === 'add' ? addForm.location : editForm.location}
                showRadius={false}
                title="Select Delivery Location"
            />
        </div>
    );
};

export default AddressesPage;
