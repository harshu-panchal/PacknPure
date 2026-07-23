import React from "react";
import NotificationCenter from "@core/components/notifications/NotificationCenter";
import { deliveryApi } from "../services/deliveryApi";

const Notifications = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-gray-900 px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] transition-colors">
    <div className="mx-auto max-w-md">
      <NotificationCenter
        api={deliveryApi}
        title="Delivery Notifications"
        description="Track assignment updates, OTP requests, completion status, and payout alerts."
        showPreferences
      />
    </div>
  </div>
);

export default Notifications;
