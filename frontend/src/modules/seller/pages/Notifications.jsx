import React from "react";
import NotificationCenter from "@core/components/notifications/NotificationCenter";
import { sellerApi } from "../services/sellerApi";

const Notifications = () => (
  <div className="min-h-screen bg-slate-50 px-4 py-6">
    <div className="mx-auto max-w-6xl">
      <NotificationCenter
        api={sellerApi}
        title="Seller Notifications"
        description="Procurement, acceptance, payment, and operational alerts for your store."
        showPreferences
        showBroadcastHistory
      />
    </div>
  </div>
);

export default Notifications;
