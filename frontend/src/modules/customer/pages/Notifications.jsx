import React from "react";
import NotificationCenter from "@core/components/notifications/NotificationCenter";
import { customerApi } from "../services/customerApi";

const Notifications = () => (
  <div className="min-h-screen bg-slate-50 px-3 sm:px-4 py-3 sm:py-6 pb-24 md:pb-8">
    <div className="mx-auto max-w-6xl">
      <NotificationCenter
        api={customerApi}
        title="My Notifications"
        description="Order updates, refunds, OTPs, and account alerts appear here."
        showPreferences
      />
    </div>
  </div>
);

export default Notifications;
