import React, { useState, useEffect, useCallback } from "react";
import {
  HiOutlineUser,
  HiOutlineBuildingStorefront,
  HiOutlinePhone,
  HiOutlineEnvelope,
  HiOutlineMapPin,
  HiOutlineShieldCheck,
  HiOutlinePencilSquare,
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlineLockClosed,
} from "react-icons/hi2";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import Input from "@shared/components/ui/Input";
import PageHeader from "@shared/components/ui/PageHeader";
import MapPicker from "@shared/components/MapPicker";
import { cn } from "@/lib/utils";

function profileToForm(data) {
  if (!data) {
    return {
      name: "",
      shopName: "",
      phone: "",
      email: "",
      lat: null,
      lng: null,
      radius: 5,
      address: "",
    };
  }
  const coords = data.location?.coordinates;
  return {
    name: data.name || "",
    shopName: data.shopName || "",
    phone: data.phone || "",
    email: data.email || "",
    lat: coords?.[1] ?? null,
    lng: coords?.[0] ?? null,
    radius: data.serviceRadius ?? 5,
    address: data.address || "",
  };
}

function Field({ label, icon: Icon, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function ReadOnlyValue({ value, placeholder = "—" }) {
  return (
    <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 ring-1 ring-slate-100">
      {value || placeholder}
    </p>
  );
}

const SellerProfile = () => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [formData, setFormData] = useState(profileToForm(null));
  const [security, setSecurity] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await sellerApi.getProfile();
      const data = response.data.result;
      setProfile(data);
      setFormData(profileToForm(data));
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleCancel = () => {
    setFormData(profileToForm(profile));
    setIsEditing(false);
  };

  const handleLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      lat: location.lat,
      lng: location.lng,
      radius: location.radius,
      address: location.address || prev.address,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "name") {
      setFormData((prev) => ({ ...prev, name: value.replace(/[0-9]/g, "") }));
    } else if (name === "phone") {
      setFormData((prev) => ({
        ...prev,
        phone: value.replace(/[^0-9]/g, "").slice(0, 10),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[0-9]{10}$/.test(formData.phone)) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    if (!formData.lat || !formData.lng) {
      toast.error("Set your shop location on the map before saving");
      return;
    }
    if (!String(formData.address || "").trim()) {
      toast.error("Enter your full store address");
      return;
    }

    setIsSaving(true);
    try {
      await sellerApi.updateProfile({
        name: formData.name,
        shopName: formData.shopName,
        phone: formData.phone,
        lat: formData.lat,
        lng: formData.lng,
        radius: formData.radius,
        address: formData.address,
      });
      toast.success("Profile updated");
      setIsEditing(false);
      await fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (security.newPassword !== security.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await sellerApi.updatePassword({
        currentPassword: security.currentPassword,
        newPassword: security.newPassword,
      });
      toast.success("Password updated successfully");
      setSecurity({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const hasLocation = Boolean(formData.lat && formData.lng);

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
        <p className="text-sm font-medium">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <PageHeader
        title="Profile"
        description="Your shop details and delivery area shown to customers nearby."
        badge={
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={profile?.isVerified ? "success" : "warning"}
              className="text-[10px] font-bold uppercase tracking-wide"
            >
              {profile?.isVerified ? "Verified" : "Pending verification"}
            </Badge>
            <Badge
              variant={profile?.isActive ? "success" : "error"}
              className="text-[10px] font-bold uppercase tracking-wide"
            >
              {profile?.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        }
        actions={
          !isEditing ? (
            <Button
              type="button"
              onClick={() => setIsEditing(true)}
              className="gap-2 text-xs font-bold"
            >
              <HiOutlinePencilSquare className="h-4 w-4" />
              Edit profile
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="gap-2 text-xs font-bold"
              >
                <HiOutlineXMark className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="gap-2 text-xs font-bold"
              >
                <HiOutlineCheck className="h-4 w-4" />
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )
        }
      />

      {/* Identity summary */}
      <Card className="border-none p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-black text-white">
            {profile?.name?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-slate-900">
              {profile?.name}
            </h2>
            <p className="truncate text-sm text-slate-500">{profile?.shopName}</p>
            <p className="mt-1 text-xs text-slate-400">
              Seller account · {profile?.email}
            </p>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        {/* Account */}
        <Card className="border-none p-5 shadow-sm ring-1 ring-slate-100 lg:col-span-1">
          <h3 className="mb-4 text-sm font-bold text-slate-900">Account</h3>
          <div className="space-y-4">
            <Field label="Your name" icon={HiOutlineUser}>
              {isEditing ? (
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="h-10"
                />
              ) : (
                <ReadOnlyValue value={formData.name} />
              )}
            </Field>

            <Field label="Shop name" icon={HiOutlineBuildingStorefront}>
              {isEditing ? (
                <Input
                  name="shopName"
                  value={formData.shopName}
                  onChange={handleChange}
                  className="h-10"
                />
              ) : (
                <ReadOnlyValue value={formData.shopName} />
              )}
            </Field>

            <Field label="Phone" icon={HiOutlinePhone}>
              {isEditing ? (
                <Input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={10}
                  className="h-10"
                />
              ) : (
                <ReadOnlyValue value={formData.phone} />
              )}
            </Field>

            <Field
              label="Email"
              icon={HiOutlineEnvelope}
              hint="Contact support to change your login email."
            >
              <ReadOnlyValue value={formData.email} />
            </Field>
          </div>
        </Card>

        {/* Delivery area */}
        <Card className="border-none p-5 shadow-sm ring-1 ring-slate-100 lg:col-span-1">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delivery area</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Pin your storefront and set how far you deliver.
              </p>
            </div>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMapOpen(true)}
                className="shrink-0 text-xs font-bold"
              >
                <HiOutlineMapPin className="mr-1 h-3.5 w-3.5" />
                {hasLocation ? "Update map" : "Set on map"}
              </Button>
            )}
          </div>

          <div
            className={cn(
              "rounded-xl border p-4",
              hasLocation
                ? "border-emerald-100 bg-emerald-50/50"
                : "border-amber-100 bg-amber-50/50",
            )}
          >
            <div className="flex gap-3">
              <HiOutlineMapPin
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  hasLocation ? "text-emerald-600" : "text-amber-600",
                )}
              />
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  {hasLocation ? "Location set" : "Location not set"}
                </p>
                <p className="text-xs leading-relaxed text-slate-600">
                  {formData.address ||
                    (hasLocation
                      ? "Address label not saved — update on map to add one."
                      : "Add your shop pin so nearby customers can see your products.")}
                </p>
                {hasLocation && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 text-xs">
                    <div>
                      <dt className="font-semibold text-slate-500">Radius</dt>
                      <dd className="font-bold text-slate-800">
                        {formData.radius} km
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Coordinates</dt>
                      <dd className="font-mono text-[10px] text-slate-700">
                        {Number(formData.lat).toFixed(5)},{" "}
                        {Number(formData.lng).toFixed(5)}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          </div>

          {!isEditing && !hasLocation && (
            <Button
              type="button"
              className="mt-4 w-full text-xs font-bold"
              onClick={() => setIsEditing(true)}
            >
              Set up delivery area
            </Button>
          )}
        </Card>
      </form>

      {/* Security */}
      <Card className="border-none p-5 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-4 text-sm font-bold text-slate-900">Security & Password</h3>
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <Field label="Current Password" icon={HiOutlineLockClosed}>
            <Input
              type="password"
              value={security.currentPassword}
              onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
              className="h-10"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New Password" icon={HiOutlineLockClosed}>
              <Input
                type="password"
                value={security.newPassword}
                onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                className="h-10"
                required
              />
            </Field>
            <Field label="Confirm New Password" icon={HiOutlineLockClosed}>
              <Input
                type="password"
                value={security.confirmPassword}
                onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                className="h-10"
                required
              />
            </Field>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isUpdatingPassword}
              className="gap-2 text-xs font-bold"
            >
              {isUpdatingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Trust strip */}
      <Card className="border-none p-5 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Account status</h3>
        <ul className="divide-y divide-slate-100">
          <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <HiOutlineShieldCheck className="h-4 w-4 text-slate-400" />
              Verification
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {profile?.isVerified ? "Verified by admin" : "Awaiting admin review"}
            </span>
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-slate-600">Account</span>
            <span className="text-sm font-semibold text-slate-900">
              {profile?.isActive ? "Active — visible to platform" : "Inactive"}
            </span>
          </li>
          {profile?.category ? (
            <li className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-slate-600">Category</span>
              <span className="text-sm font-semibold text-slate-900">
                {profile.category}
              </span>
            </li>
          ) : null}
        </ul>
      </Card>

      {isMapOpen && (
        <MapPicker
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          onConfirm={handleLocationSelect}
          title="Set shop location"
          initialLocation={
            formData.lat ? { lat: formData.lat, lng: formData.lng } : null
          }
          initialAddress={formData.address}
          initialRadius={formData.radius}
          geocodeApi={{
            reverseGeocode: (lat, lng) => sellerApi.reverseGeocode(lat, lng),
            geocodeAddress: (address) => sellerApi.geocodeAddress(address),
          }}
        />
      )}
    </div>
  );
};

export default SellerProfile;
