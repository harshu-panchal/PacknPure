import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Clock3, Settings2, ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";

const DEFAULT_LABELS = {
  push: "Push Alerts",
  inApp: "In-app Alerts",
  transactional: "Transactional",
  marketing: "Marketing",
  orderUpdates: "Order Updates",
  procurement: "Procurement",
  delivery: "Delivery",
  payment: "Payment",
  system: "System",
  adminBroadcast: "Admin Broadcast",
  promotional: "Promotional",
};

const toTitle = (value) =>
  String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .trim();

const normalizePreferences = (preferences = {}) => ({
  push: preferences.push !== false,
  inApp: preferences.inApp !== false,
  transactional: preferences.transactional !== false,
  marketing: preferences.marketing !== false,
  orderUpdates: preferences.orderUpdates !== false,
  procurement: preferences.procurement !== false,
  delivery: preferences.delivery !== false,
  payment: preferences.payment !== false,
  system: preferences.system !== false,
  adminBroadcast: preferences.adminBroadcast !== false,
  promotional: preferences.promotional !== false,
});

const preferenceEntries = [
  "push",
  "inApp",
  "transactional",
  "marketing",
  "orderUpdates",
  "procurement",
  "delivery",
  "payment",
  "system",
  "adminBroadcast",
  "promotional",
];

const NotificationCenter = ({
  api,
  title = "Notifications",
  description = "Stay on top of updates across your account.",
  showPreferences = true,
  showBroadcastHistory = false,
}) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [preferences, setPreferences] = useState(normalizePreferences());
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const loadNotifications = async () => {
    const response = await api.getNotifications();
    if (response?.data?.success) {
      setNotifications(response.data.result.notifications || []);
    }
  };

  const loadPreferences = async () => {
    if (!showPreferences || !api.getNotificationPreferences) return;
    const response = await api.getNotificationPreferences();
    if (response?.data?.success) {
      setPreferences(
        normalizePreferences(response.data.result?.preferences || response.data.result || {}),
      );
    }
  };

  const loadBroadcastHistory = async () => {
    if (!showBroadcastHistory || !api.getBroadcastHistory) return;
    const response = await api.getBroadcastHistory({ page: 1, limit: 10 });
    if (response?.data?.success) {
      setBroadcastHistory(response.data.result.items || []);
    }
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        setLoading(true);
        await Promise.all([
          loadNotifications(),
          loadPreferences(),
          loadBroadcastHistory(),
        ]);
      } catch (error) {
        if (mounted) toast.error("Failed to load notifications");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const markRead = async (notificationId) => {
    try {
      await api.markNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((item) =>
          item._id === notificationId ? { ...item, isRead: true } : item,
        ),
      );
    } catch {
      toast.error("Failed to update notification");
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to update notification status");
    }
  };

  const togglePreference = async (key) => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSavingPrefs(true);
    try {
      await api.updateNotificationPreferences(next);
      toast.success("Preferences updated");
    } catch {
      toast.error("Failed to save preferences");
      setPreferences((current) => ({ ...current, [key]: !current[key] }));
    } finally {
      setSavingPrefs(false);
    }
  };

  const renderNotification = (notification) => (
    <button
      key={notification._id}
      type="button"
      onClick={() => {
        if (!notification.isRead) void markRead(notification._id);
        const deepLink = notification?.deepLink || notification?.data?.deepLink || notification?.data?.route;
        if (deepLink) navigate(deepLink);
      }}
      className={`w-full text-left rounded-2xl border p-4 transition shadow-sm hover:shadow-md ${
        notification.isRead ? "bg-white border-slate-100" : "bg-rose-50/60 border-rose-100"
      }`}
    >
      <div className="flex gap-3">
        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${
          notification.isRead ? "bg-slate-100 text-slate-500" : "bg-rose-100 text-rose-600"
        }`}>
          <Bell size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-900 truncate">{notification.title}</h4>
              <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
            </div>
            {!notification.isRead ? <span className="h-2 w-2 rounded-full bg-rose-500 mt-2" /> : null}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <Clock3 size={14} />
            <span>{new Date(notification.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-rose-500 via-rose-600 to-orange-500 text-white border-none shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/80 font-bold">Notification Center</p>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">{title}</h1>
            <p className="text-white/85 mt-2 max-w-2xl">{description}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm shrink-0 self-start">
            <div className="text-xs uppercase tracking-wider text-white/70 font-semibold">Unread</div>
            <div className="text-3xl font-black leading-none mt-1">{unreadCount}</div>
          </div>
        </div>

        {unreadCount > 0 ? (
          <div className="mt-5">
            <Button
              onClick={markAllRead}
              className="bg-white text-rose-600 hover:bg-rose-50 font-bold"
            >
              <CheckCheck size={16} className="mr-2" />
              Mark all as read
            </Button>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Inbox</h2>
              <p className="text-sm text-slate-500">Latest notifications for this account.</p>
            </div>
            <div className="text-sm text-slate-500">{notifications.length} items</div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading notifications...</div>
          ) : notifications.length ? (
            <div className="space-y-3">
              {notifications.map(renderNotification)}
            </div>
          ) : (
            <div className="py-14 text-center text-slate-500">
              <ShieldCheck size={32} className="mx-auto mb-3 text-slate-300" />
              No notifications yet.
            </div>
          )}
        </Card>

        <div className="space-y-6">
          {showPreferences ? (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 size={18} className="text-rose-600" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Preferences</h2>
                  <p className="text-sm text-slate-500">Enable or disable categories.</p>
                </div>
              </div>

              <div className="space-y-3">
                {preferenceEntries.map((key) => (
                  <label
                    key={key}
                    className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${
                      preferences[key] ? "border-rose-100 bg-rose-50/50" : "border-slate-100 bg-white"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{DEFAULT_LABELS[key] || toTitle(key)}</div>
                      <div className="text-xs text-slate-500">
                        {key === "push" ? "Allow push notifications" : key === "inApp" ? "Keep entries in notification center" : `Toggle ${toTitle(key).toLowerCase()}`}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[key])}
                      onChange={() => togglePreference(key)}
                      disabled={savingPrefs}
                      className="h-5 w-5 accent-rose-600"
                    />
                  </label>
                ))}
              </div>
            </Card>
          ) : null}

          {showBroadcastHistory ? (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Send size={18} className="text-rose-600" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Broadcast History</h2>
                  <p className="text-sm text-slate-500">Recent admin notifications.</p>
                </div>
              </div>

              <div className="space-y-3">
                {broadcastHistory.length ? broadcastHistory.map((item) => (
                  <div key={item._id} className="rounded-2xl border border-slate-100 p-4 bg-slate-50/60">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-600 mt-1">{item.message}</div>
                  </div>
                )) : (
                  <div className="text-sm text-slate-500">No broadcasts yet.</div>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
