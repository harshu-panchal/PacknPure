import React from "react";
import NotificationCenter from "@core/components/notifications/NotificationCenter";
import { sellerApi } from "../services/sellerApi";

const Notifications = () => (
  <div className="px-2 py-4 sm:p-6 md:p-8 pb-24 md:pb-12 bg-slate-50/50 min-h-screen font-['Outfit',_sans-serif] w-full overflow-x-hidden">
    <div className="mx-auto max-w-6xl w-full min-w-0">
      <NotificationCenter
        api={sellerApi}
        title="Notifications"
        description="Procurement, pickup OTP, payment, and operational alerts for your store."
        showPreferences
        panelBasePath="/seller"
        variant="panel"
      />
    </div>
  </div>
);

export default Notifications;
