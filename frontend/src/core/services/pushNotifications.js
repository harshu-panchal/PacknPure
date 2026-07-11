import { toast } from "sonner";
import { deleteToken, getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@core/firebase/client";
import { notificationsApi } from "./notificationsApi";

const STORAGE_PREFIX = "packnpure_fcm";
const SW_PATH = "/firebase-messaging-sw.js";

const readRole = (role) => String(role || "customer").toLowerCase();

const getStorageKey = (role) => `${STORAGE_PREFIX}:${readRole(role)}:token`;

const getDeviceIdKey = () => `${STORAGE_PREFIX}:deviceId`;

const getOrCreateDeviceId = () => {
  const existing = localStorage.getItem(getDeviceIdKey());
  if (existing) return existing;
  const created = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  localStorage.setItem(getDeviceIdKey(), created);
  return created;
};

const getDeviceMetadata = () => {
  const ua = navigator.userAgent || "";
  const platform = /Android/i.test(ua)
    ? "android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "ios"
      : "web";
  return {
    platform,
    deviceId: getOrCreateDeviceId(),
    deviceName: navigator.platform || "browser",
    browser: ua,
    os: navigator.platform || "",
    appVersion: import.meta.env.VITE_APP_VERSION || "web",
  };
};

const getMessagingInstance = async () => {
  try {
    return await getFirebaseMessaging();
  } catch (error) {
    console.warn("[push] messaging unavailable", error.message);
    return null;
  }
};

export const ensurePushServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return null;
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  };
  const encoded = encodeURIComponent(JSON.stringify(firebaseConfig));
  return navigator.serviceWorker.register(`${SW_PATH}?firebaseConfig=${encoded}`);
};

export const requestPushPermission = async () => {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
};

export const syncPushToken = async ({ role, authToken } = {}) => {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  const permission = await requestPushPermission();
  if (permission !== "granted") return null;

  const registration = await ensurePushServiceWorker();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("[push] Missing VITE_FIREBASE_VAPID_KEY");
    return null;
  }

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration || undefined,
  });
  if (!token) return null;

  const storageKey = getStorageKey(role);
  const previousToken = localStorage.getItem(storageKey);
  if (previousToken !== token) {
    await notificationsApi.registerDeviceToken({
      token,
      ...getDeviceMetadata(),
    });
    localStorage.setItem(storageKey, token);
  }

  return token;
};

export const clearPushToken = async ({ role } = {}) => {
  const messaging = await getMessagingInstance();
  const storageKey = getStorageKey(role);
  const token = localStorage.getItem(storageKey);
  if (!token) return null;

  try {
    await notificationsApi.removeDeviceToken({
      token,
      ...getDeviceMetadata(),
    });
  } catch (error) {
    console.warn("[push] token cleanup failed", error.message);
  }

  if (messaging) {
    try {
      await deleteToken(messaging);
    } catch {
      /* ignore */
    }
  }

  localStorage.removeItem(storageKey);
  return true;
};

export const listenForForegroundNotifications = ({ onNavigate } = {}) => {
  let unsubscribed = false;
  let unsubscribe = () => {};

  void (async () => {
    const messaging = await getMessagingInstance();
    if (!messaging || unsubscribed) return;
    unsubscribe = onMessage(messaging, (payload) => {
      const title = payload?.notification?.title || "Notification";
      const body = payload?.notification?.body || "You have a new update.";
      const deepLink = payload?.data?.deepLink || payload?.data?.route || "/";

      try {
        if (Notification.permission === "granted") {
          const n = new Notification(title, {
            body,
            icon: payload?.data?.imageUrl || undefined,
            data: payload?.data || {},
          });
          n.onclick = () => {
            window.focus();
            if (typeof onNavigate === "function" && deepLink) {
              onNavigate(deepLink);
            }
            n.close();
          };
        } else {
          toast.info(title, { description: body });
        }
      } catch {
        toast.info(title, { description: body });
      }
    });
  })();

  return () => {
    unsubscribed = true;
    unsubscribe?.();
  };
};

export const openNotificationRoute = (payload, navigate) => {
  const deepLink = payload?.data?.deepLink || payload?.data?.route || "/";
  if (typeof navigate === "function" && deepLink) {
    navigate(deepLink);
  }
};

export const syncPushPreferences = async () => {
  try {
    return await notificationsApi.getPreferences();
  } catch {
    return null;
  }
};
