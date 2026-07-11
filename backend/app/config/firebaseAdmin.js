import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

let firebaseAdminApp = null;

/**
 * Returns a firebase-admin app when FIREBASE_SERVICE_ACCOUNT (JSON string)
 * and FIREBASE_DATABASE_URL are set.
 */
export const getFirebaseAdminApp = () => {
  if (firebaseAdminApp) return firebaseAdminApp;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!databaseURL) {
    return null;
  }

  try {
    let serviceAccount = null;
    if (json) {
      serviceAccount = JSON.parse(json);
    } else if (projectId && clientEmail && privateKey) {
      serviceAccount = {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      };
    }

    if (!serviceAccount) {
      return null;
    }

    firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
    });
    return firebaseAdminApp;
  } catch (e) {
    console.warn("[Firebase] Init skipped:", e.message);
    return null;
  }
};

export const getFirebaseRealtimeDb = () => {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return admin.database(app);
};

