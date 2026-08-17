import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Clock3, Settings2, ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";
import Card from "@shared/components/ui/Card";
import Button from "@shared/components/ui/Button";
import { cn } from "@/lib/utils";

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

/**
 * @param {"default" | "panel"} variant
 *  - default: consumer-style (rose accents)
 *  - panel: seller/admin dashboard chrome (slate + primary)
 */
const NotificationCenter = ({
  api,
  title = "Notifications",
  description = "Stay on top of updates across your account.",
  showPreferences = true,
  showBroadcastHistory = false,
  panelBasePath = "",
  variant = "default",
}) => {
  const navigate = useNavigate();
  const isPanel = variant === "panel";
  const [notifications, setNotifications] = useState([]);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [preferences, setPreferences] = useState(normalizePreferences());
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const resolveDeepLink = (notification) => {
    const raw =
      notification?.deepLink ||
      notification?.data?.deepLink ||
      notification?.data?.route ||
      "";
    const link = String(raw || "").trim();
    const base = String(panelBasePath || "").replace(/\/$/, "");

    if (!link) {
      return base ? `${base}/notifications` : null;
    }
    if (!base) return link;

    if (
      link.startsWith("/seller") ||
      link.startsWith("/admin") ||
      link.startsWith("/delivery") ||
      link.startsWith("/pickup")
    ) {
      if (base.startsWith("/seller") && !link.startsWith("/seller")) {
        return `${base}/notifications`;
      }
      return link;
    }

    if (base.startsWith("/seller")) {
      if (link.includes("procure") || link.includes("purchase") || link.includes("order")) {
        return `${base}/procurement`;
      }
      if (link.includes("return")) return `${base}/returns`;
      if (link.includes("product") || link.includes("stock") || link.includes("inventor")) {
        return `${base}/products`;
      }
      if (link.includes("withdraw") || link.includes("earning") || link.includes("payment")) {
        return `${base}/earnings`;
      }
      if (link.toLowerCase().includes("otp") || link.toLowerCase().includes("pickup")) {
        return `${base}/procurement`;
      }
      return `${base}/notifications`;
    }

    return link;
  };

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
        await Promise.all([loadNotifications(), loadPreferences(), loadBroadcastHistory()]);
      } catch {
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
        const deepLink = resolveDeepLink(notification);
        if (deepLink) navigate(deepLink);
      }}
      className={cn(
        "w-full text-left rounded-xl sm:rounded-2xl border p-3 sm:p-4 transition overflow-hidden min-w-0",
        isPanel
          ? notification.isRead
            ? "bg-white border-slate-100 ring-1 ring-slate-100/80 hover:bg-slate-50"
            : "bg-indigo-50/50 border-indigo-100 ring-1 ring-indigo-100 hover:bg-indigo-50"
          : notification.isRead
            ? "bg-white border-slate-100 shadow-sm hover:shadow-md"
            : "bg-rose-50/60 border-rose-100 shadow-sm hover:shadow-md",
      )}
    >
      <div className="flex gap-2.5 sm:gap-3 items-start min-w-0">
        <div
          className={cn(
            "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
            isPanel
              ? notification.isRead
                ? "bg-slate-100 text-slate-500"
                : "bg-primary/10 text-primary"
              : notification.isRead
                ? "bg-slate-100 text-slate-500"
                : "bg-rose-100 text-rose-600",
          )}
        >
          <Bell size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 break-words line-clamp-2">{notification.title}</h4>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed break-words">{notification.message}</p>
            </div>
            {!notification.isRead ? (
              <span
                className={cn(
                  "h-2 w-2 rounded-full mt-1.5 shrink-0",
                  isPanel ? "bg-primary" : "bg-rose-500",
                )}
              />
            ) : null}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 font-medium min-w-0 flex-wrap">
            <Clock3 size={13} className="shrink-0" />
            <span>{new Date(notification.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className={cn("space-y-4 sm:space-y-6 w-full min-w-0", isPanel && "font-['Outfit',_sans-serif]")}>
      {isPanel ? (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight break-words">{title}</h2>
            <p className="text-xs sm:text-sm md:text-base text-slate-500 mt-1 max-w-2xl break-words">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 sm:px-4 sm:py-2.5 ring-1 ring-slate-100 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Unread
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">{unreadCount}</span>
            </div>
            {unreadCount > 0 ? (
              <Button
                onClick={markAllRead}
                className="rounded-xl bg-primary text-white hover:brightness-105 font-semibold text-xs sm:text-sm px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-sm"
              >
                <CheckCheck size={16} className="mr-1.5 sm:mr-2" />
                Mark all as read
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-rose-500 via-rose-600 to-orange-500 text-white border-none shadow-xl rounded-2xl sm:rounded-3xl min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 min-w-0">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-white/80 font-bold">
                Notification Center
              </p>
              <h1 className="text-xl sm:text-3xl font-black mt-1 sm:mt-2 break-words">{title}</h1>
              <p className="text-xs sm:text-sm text-white/85 mt-1 sm:mt-2 max-w-2xl break-words">{description}</p>
            </div>
            <div className="rounded-xl sm:rounded-2xl bg-white/15 px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-sm shrink-0 self-start sm:self-auto">
              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-white/70 font-semibold">
                Unread
              </div>
              <div className="text-2xl sm:text-3xl font-black leading-none mt-1">{unreadCount}</div>
            </div>
          </div>
          {unreadCount > 0 ? (
            <div className="mt-4 sm:mt-5">
              <Button
                onClick={markAllRead}
                className="bg-white text-rose-600 hover:bg-rose-50 font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-sm"
              >
                <CheckCheck size={16} className="mr-2" />
                Mark all as read
              </Button>
            </div>
          ) : null}
        </Card>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.35fr_0.85fr] min-w-0">
        <Card
          className={cn(
            "p-3.5 sm:p-5 min-w-0 overflow-hidden",
            isPanel && "border-none shadow-sm ring-1 ring-slate-100 rounded-2xl sm:rounded-3xl bg-white",
          )}
        >
          <div className="flex items-center justify-between mb-4 gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">Inbox</h3>
              <p className="text-xs sm:text-sm text-slate-500 truncate">Latest alerts for your store.</p>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-500 tabular-nums shrink-0 whitespace-nowrap">
              {notifications.length} items
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 font-medium text-sm">
              Loading notifications...
            </div>
          ) : notifications.length ? (
            <div className="space-y-2.5 sm:space-y-3 min-w-0">{notifications.map(renderNotification)}</div>
          ) : (
            <div className="py-14 text-center text-slate-500 text-sm">
              <ShieldCheck size={32} className="mx-auto mb-3 text-slate-300" />
              No notifications yet.
            </div>
          )}
        </Card>

        <div className="space-y-4 sm:space-y-6 min-w-0">
          {showPreferences ? (
            <Card
              className={cn(
                "p-3.5 sm:p-5 min-w-0 overflow-hidden",
                isPanel && "border-none shadow-sm ring-1 ring-slate-100 rounded-2xl sm:rounded-3xl bg-white",
              )}
            >
              <div className="flex items-center gap-2 mb-4 min-w-0">
                <Settings2 size={18} className={cn("shrink-0", isPanel ? "text-primary" : "text-rose-600")} />
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">Preferences</h3>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">Enable or disable categories.</p>
                </div>
              </div>

              <div className="space-y-2.5 sm:space-y-3 min-w-0">
                {preferenceEntries.map((key) => (
                  <label
                    key={key}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl border p-3 sm:px-4 sm:py-3 min-w-0 cursor-pointer",
                      isPanel
                        ? preferences[key]
                          ? "border-indigo-100 bg-indigo-50/40"
                          : "border-slate-100 bg-slate-50/50"
                        : preferences[key]
                          ? "border-rose-100 bg-rose-50/50"
                          : "border-slate-100 bg-white",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs sm:text-sm text-slate-900 break-words">
                        {DEFAULT_LABELS[key] || toTitle(key)}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-500 break-words mt-0.5">
                        {key === "push"
                          ? "Allow push notifications"
                          : key === "inApp"
                            ? "Keep entries in notification center"
                            : `Toggle ${toTitle(key).toLowerCase()}`}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[key])}
                      onChange={() => togglePreference(key)}
                      disabled={savingPrefs}
                      className={cn(
                        "h-4 w-4 sm:h-5 sm:w-5 shrink-0 rounded",
                        isPanel ? "accent-indigo-600" : "accent-rose-600",
                      )}
                    />
                  </label>
                ))}
              </div>
            </Card>
          ) : null}

          {showBroadcastHistory ? (
            <Card
              className={cn(
                "p-3.5 sm:p-5 min-w-0 overflow-hidden",
                isPanel && "border-none shadow-sm ring-1 ring-slate-100 rounded-2xl sm:rounded-3xl bg-white",
              )}
            >
              <div className="flex items-center gap-2 mb-4 min-w-0">
                <Send size={18} className={cn("shrink-0", isPanel ? "text-primary" : "text-rose-600")} />
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">Broadcast History</h3>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">Recent admin notifications.</p>
                </div>
              </div>

              <div className="space-y-2.5 sm:space-y-3 min-w-0">
                {broadcastHistory.length ? (
                  broadcastHistory.map((item) => (
                    <div
                      key={item._id}
                      className="rounded-xl sm:rounded-2xl border border-slate-100 p-3 sm:p-4 bg-slate-50/60 min-w-0"
                    >
                      <div className="font-semibold text-xs sm:text-sm text-slate-900 break-words">{item.title}</div>
                      <div className="text-xs sm:text-sm text-slate-600 mt-1 break-words">{item.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs sm:text-sm text-slate-500">No broadcasts yet.</div>
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
