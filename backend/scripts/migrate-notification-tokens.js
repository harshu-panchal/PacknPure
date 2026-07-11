/**
 * Backfills notification token subdocuments and default preferences across account collections.
 *
 * Usage:
 *   node scripts/migrate-notification-tokens.js
 *   node scripts/migrate-notification-tokens.js --dry-run
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import User from "../app/models/customer.js";
import Seller from "../app/models/seller.js";
import Admin from "../app/models/admin.js";
import Delivery from "../app/models/delivery.js";
import PickupPartner from "../app/models/pickupPartner.js";
import {
  enforceTokenLimits,
  normalizeNotificationPreferences,
  normalizeNotificationTokenList,
} from "../app/services/notificationHelper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DRY_RUN = process.argv.includes("--dry-run");

const MODELS = [
  { label: "Customer", role: "customer", Model: User },
  { label: "Seller", role: "seller", Model: Seller },
  { label: "Admin", role: "admin", Model: Admin },
  { label: "Delivery", role: "delivery", Model: Delivery },
  { label: "PickupPartner", role: "pickup_partner", Model: PickupPartner },
];

const tokenFingerprint = (tokens = []) =>
  JSON.stringify(
    tokens.map((token) => ({
      token: String(token?.token || "").trim(),
      platform: String(token?.platform || "web").toLowerCase(),
      deviceId: String(token?.deviceId || "").trim(),
      deviceName: String(token?.deviceName || "").trim(),
      browser: String(token?.browser || "").trim(),
      os: String(token?.os || "").trim(),
      appVersion: String(token?.appVersion || "").trim(),
      isActive: token?.isActive !== false,
    })),
  );

async function runForModel({ label, role, Model }) {
  let scanned = 0;
  let updated = 0;

  const cursor = Model.find({}).cursor();
  for await (const doc of cursor) {
    scanned += 1;

    const normalizedTokens = enforceTokenLimits(
      normalizeNotificationTokenList(doc.fcmTokens || []),
    );
    const normalizedPreferences = normalizeNotificationPreferences(
      doc.notificationPreferences || {},
      role,
    );

    const needsTokenUpdate =
      tokenFingerprint(normalizedTokens) !== tokenFingerprint(normalizeNotificationTokenList(doc.fcmTokens || []));
    const needsPrefUpdate = JSON.stringify(doc.notificationPreferences || {}) !== JSON.stringify(normalizedPreferences);

    if (!needsTokenUpdate && !needsPrefUpdate) continue;

    updated += 1;
    if (DRY_RUN) {
      continue;
    }

    doc.fcmTokens = normalizedTokens;
    doc.notificationPreferences = normalizedPreferences;
    await doc.save();
  }

  console.log(`[migrate-notification-tokens] ${label}: scanned=${scanned}, updated=${updated}`);
}

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(mongoUri);

  for (const model of MODELS) {
    // eslint-disable-next-line no-await-in-loop
    await runForModel(model);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[migrate-notification-tokens] failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
