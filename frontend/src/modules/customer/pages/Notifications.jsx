import React from "react";
import NotificationCenter from "@core/components/notifications/NotificationCenter";
import { customerApi } from "../services/customerApi";

const Notifications = () => (
  <div className="min-h-screen bg-slate-50 px-4 py-6">
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
