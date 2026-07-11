import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

let firebaseApp = null;
let firebaseMessaging = null;
let messagingSupportPromise = null;

export const getFirebaseApp = () => {
  if (firebaseApp) return firebaseApp;

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn(
      "[firebase] Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID; Firebase is disabled.",
    );
    return null;
  }

  const existing = getApps()[0];
  if (existing) {
    firebaseApp = existing;
    return firebaseApp;
  }

  const firebaseConfig = {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  firebaseApp = initializeApp(firebaseConfig);
  return firebaseApp;
};

export const getRealtimeDb = () => {
  const app = getFirebaseApp();
  if (!app) return null;
  return getDatabase(app);
};

export const isFirebaseMessagingSupported = async () => {
  if (messagingSupportPromise) return messagingSupportPromise;
  messagingSupportPromise = isMessagingSupported().catch(() => false);
  return messagingSupportPromise;
};

export const getFirebaseMessaging = async () => {
  if (firebaseMessaging) return firebaseMessaging;

  const supported = await isFirebaseMessagingSupported();
  if (!supported) return null;

  const app = getFirebaseApp();
  if (!app) return null;

  firebaseMessaging = getMessaging(app);
  return firebaseMessaging;
};

