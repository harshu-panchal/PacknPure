import React from "react";
import NotificationCenter from "@core/components/notifications/NotificationCenter";
import { sellerApi } from "../services/sellerApi";

const Notifications = () => (
  <div className="min-h-app bg-slate-50 px-0 sm:px-4 py-2 sm:py-6">
    <div className="mx-auto max-w-6xl min-w-0">
      <NotificationCenter
        api={sellerApi}
        title="Seller Notifications"
        description="Procurement, acceptance, payment, and operational alerts for your store."
        showPreferences
      />
    </div>
  </div>
);

export default Notifications;
