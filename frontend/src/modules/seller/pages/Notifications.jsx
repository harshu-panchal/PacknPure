import React from "react";
import NotificationCenter from "@core/components/notifications/NotificationCenter";
import { sellerApi } from "../services/sellerApi";

const Notifications = () => (
  <div className="p-4 sm:p-8 bg-slate-50/50 min-h-screen font-['Outfit',_sans-serif]">
    <div className="mx-auto max-w-6xl min-w-0">
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
