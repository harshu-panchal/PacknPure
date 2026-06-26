import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, User, Mail, Phone, MapPin, Calendar, Droplet, Camera, Loader2 } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";
import { deliveryApi } from "../../services/deliveryApi";

const PersonalDetails = () => {
  const navigate = useNavigate();
  const { user, patchUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  
  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    phone: user?.phone ? `+91 ${user.phone}` : "",
    email: user?.email || "",
    address: user?.address || "",
    dob: user?.dob ? new Date(user.dob).toISOString().split('T')[0] : "1995-08-15", // fallback if null
    bloodGroup: user?.bloodGroup || "",
  });

  // Keep form in sync if user data loads slightly after initial render
  React.useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.name || "",
        phone: user.phone ? `+91 ${user.phone}` : "",
        email: user.email || prev.email,
        address: user.address || prev.address,
        dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : prev.dob,
        bloodGroup: user.bloodGroup || prev.bloodGroup,
      }));
    }
  }, [user]);

  const handleSave = async () => {
    try {
      const updatePayload = {
        email: formData.email,
        address: formData.address,
        bloodGroup: formData.bloodGroup
      };

      if (uploadedImageUrl) {
        updatePayload.profileImage = uploadedImageUrl;
      }

      await deliveryApi.updateProfile(updatePayload);
      
      const userPatch = {
        email: formData.email,
        address: formData.address,
        bloodGroup: formData.bloodGroup
      };

      if (uploadedImageUrl) {
        userPatch.documents = { ...user.documents, profileImage: uploadedImageUrl };
      }

      patchUser(userPatch);
      setIsEditing(false);
      setUploadedImageUrl(null);
      toast.success("Personal details updated successfully!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update details");
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await deliveryApi.uploadFile(formData);
      const imageUrl = uploadResponse.data.result.url;

      setUploadedImageUrl(imageUrl);
      toast.success("Image uploaded! Click Save to apply changes.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 rounded-full hover:bg-gray-100 dark:bg-gray-700 transition-colors mr-2"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="ds-h3 text-gray-900 dark:text-white">Personal Details</h1>
          <div className="ml-auto">
            {isEditing ? (
              <Button size="sm" onClick={handleSave} className="h-8 px-3">
                Save
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditing(true)} 
                className="text-primary hover:bg-primary/5"
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Profile Photo */}
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative">
            <div 
              className={`w-24 h-24 rounded-full p-1 bg-white dark:bg-gray-800 shadow-md ${isEditing ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={() => isEditing && fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="w-full h-full rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <img
                  src={uploadedImageUrl || user?.documents?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'User'}`}
                  alt="Profile"
                  className="w-full h-full rounded-full object-cover bg-gray-100 dark:bg-gray-700"
                />
              )}
            </div>
            {isEditing && (
              <button 
                className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg hover:bg-primary/90 transition-colors pointer-events-none"
              >
                <Camera size={14} />
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
            />
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Delivery Partner ID: {user?._id?.slice(-6).toUpperCase() || '------'}</p>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
          <Input
            label="Full Name"
            value={formData.fullName}
            readOnly={!isEditing} // Usually name is locked after verification
            icon={User}
            className={!isEditing ? "bg-gray-100 dark:bg-gray-900 border-transparent" : ""}
          />
          
          <Input
            label="Phone Number"
            value={formData.phone}
            readOnly={true} // Phone is usually locked
            icon={Phone}
            className="bg-gray-100 dark:bg-gray-900 border-transparent text-gray-500 dark:text-gray-400"
            helperText="Contact support to change phone number"
          />

          <Input
            label="Email Address"
            value={formData.email}
            readOnly={!isEditing}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            icon={Mail}
            type="email"
            className={!isEditing ? "bg-gray-100 dark:bg-gray-900 border-transparent" : ""}
          />

          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1 ml-1">Current Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <MapPin size={18} />
              </div>
              <textarea
                value={formData.address}
                readOnly={!isEditing}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none ${
                  !isEditing ? "bg-gray-100 dark:bg-gray-900 border-transparent text-gray-600 dark:text-gray-300" : "bg-white dark:bg-gray-800 border-gray-200"
                }`}
                rows={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date of Birth"
              value={formData.dob}
              readOnly={true}
              icon={Calendar}
              className="bg-gray-100 dark:bg-gray-900 border-transparent"
            />
            <Input
              label="Blood Group"
              value={formData.bloodGroup}
              readOnly={!isEditing}
              onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})}
              icon={Droplet}
              className={!isEditing ? "bg-gray-100 dark:bg-gray-900 border-transparent" : ""}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalDetails;
