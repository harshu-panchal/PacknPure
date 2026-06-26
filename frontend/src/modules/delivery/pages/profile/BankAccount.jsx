import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Landmark, CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Card from "@/shared/components/ui/Card";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";
import { deliveryApi } from "../../services/deliveryApi";

const BankAccount = () => {
  const navigate = useNavigate();

  const { user, patchUser } = useAuth();
  
  const [formData, setFormData] = React.useState({
    accountHolder: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: '',
  });

  const bankDetails = {
    accountHolder: user?.accountHolder || "Not Provided",
    accountNumber: user?.accountNumber ? `XXXX${user.accountNumber.slice(-4)}` : "XXXX",
    ifsc: user?.ifsc || "Not Provided",
    bankName: "Bank Account", // Derived bank name logic can be added later if needed
    status: user?.isVerified ? "Active" : "Pending",
  };

  const handleUpdate = async () => {
    if (!formData.accountHolder || !formData.accountNumber || !formData.ifsc) {
      toast.error("Please fill all bank details");
      return;
    }
    if (formData.accountNumber !== formData.confirmAccountNumber) {
      toast.error("Account numbers do not match");
      return;
    }

    try {
      await deliveryApi.updateProfile({
        accountHolder: formData.accountHolder,
        accountNumber: formData.accountNumber,
        ifsc: formData.ifsc,
      });
      patchUser({
        accountHolder: formData.accountHolder,
        accountNumber: formData.accountNumber,
        ifsc: formData.ifsc,
      });
      toast.success("Bank details updated successfully!");
      setFormData({ accountHolder: '', accountNumber: '', confirmAccountNumber: '', ifsc: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update bank details");
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
          <h1 className="ds-h3 text-gray-900 dark:text-white">Bank Account</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Bank Card Visual */}
        <div className="bg-gradient-to-br from-indigo-900 to-blue-800 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white dark:bg-gray-800/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="flex justify-between items-start mb-8 relative z-10">
            <Landmark size={32} className="text-white/80" />
            <span className={`${user?.isVerified ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'} px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center`}>
              <CheckCircle2 size={12} className="mr-1" /> {bankDetails.status}
            </span>
          </div>

          <div className="space-y-1 relative z-10">
            <p className="text-indigo-200 text-xs uppercase tracking-wider">Account Number</p>
            <p className="font-mono text-2xl tracking-widest">{bankDetails.accountNumber}</p>
          </div>

          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-indigo-200 text-xs uppercase tracking-wider mb-1">Account Holder</p>
              <p className="font-bold text-lg">{bankDetails.accountHolder}</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold">{bankDetails.bankName}</p>
              <p className="text-indigo-200 text-xs">{bankDetails.ifsc}</p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl flex items-start">
          <AlertTriangle size={20} className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-yellow-800 font-bold text-sm mb-1">Payment Information</h4>
            <p className="text-xs text-yellow-700 leading-relaxed">
              Your weekly earnings will be deposited to this account every Tuesday. 
              Changes to bank details may delay your next payout by up to 7 days.
            </p>
          </div>
        </div>

        {/* Change Request Form */}
        <div className="pt-4">
          <h3 className="ds-h4 text-gray-900 dark:text-white mb-4">Request Change</h3>
          <div className="space-y-4">
            <Input 
              label="Account Holder Name" 
              placeholder="Enter account holder name" 
              value={formData.accountHolder}
              onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
              icon={Landmark}
            />
            <Input 
              label="New Account Number" 
              placeholder="Enter account number" 
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              icon={CreditCard}
            />
            <Input 
              label="Confirm Account Number" 
              placeholder="Re-enter account number" 
              value={formData.confirmAccountNumber}
              onChange={(e) => setFormData({ ...formData, confirmAccountNumber: e.target.value })}
              icon={CreditCard}
            />
            <Input 
              label="IFSC Code" 
              placeholder="Enter IFSC code" 
              value={formData.ifsc}
              onChange={(e) => setFormData({ ...formData, ifsc: e.target.value })}
              icon={Landmark}
            />
            <Button onClick={handleUpdate} className="w-full mt-2" variant="outline">
              Verify & Update
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankAccount;
