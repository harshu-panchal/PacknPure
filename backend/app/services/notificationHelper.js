import mongoose from "mongoose";
import Notification from "../models/notification.js";
import Admin from "../models/admin.js";
import User from "../models/customer.js";
import Seller from "../models/seller.js";
import Delivery from "../models/delivery.js";
import PickupPartner from "../models/pickupPartner.js";
import {
  buildDefaultNotificationPreferences,
  MAX_ACTIVE_TOKENS_PER_PLATFORM,
} from "../models/shared/notificationSchemas.js";
import {
  MODEL_ROLE_MAP,
  ROLE_MODEL_MAP,
  ROLE_NOTIFICATION_DEFAULTS,
  isPushCategoryEnabled,
} from "./notificationTypes.js";

const MODEL_MAP = {
  User,
  Seller,
  Admin,
  Delivery,
  PickupPartner,
};

export const normalizeRole = (role) => {
  if (!role) return null;
  return String(role).trim().toLowerCase();
};

export const resolveModelNameFromRole = (role) => {
  const normalized = normalizeRole(role);
  return ROLE_MODEL_MAP[normalized] || null;
};

export const resolveRoleFromModelName = (modelName) => {
  if (!modelName) return null;
  return MODEL_ROLE_MAP[modelName] || null;
};

export const getModelForRole = (role) => {
  const modelName = resolveModelNameFromRole(role);
  return modelName ? MODEL_MAP[modelName] : null;
};

export const getModelForRecipientModel = (recipientModel) => {
  if (!recipientModel) return null;
  return MODEL_MAP[recipientModel] || null;
};

export const ensureObjectId = (value) => {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (value && mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return null;
};

export const normalizeNotificationTokenRecord = (tokenLike = {}) => {
  if (!tokenLike) return null;
  const rawToken = typeof tokenLike === "string" ? tokenLike : tokenLike.token;
  const token = String(rawToken || "").trim();
  if (!token) return null;

  const now = new Date();
  return {
    token,
    platform: String(tokenLike.platform || "web").toLowerCase(),
    deviceId: String(tokenLike.deviceId || "").trim(),
    deviceName: String(tokenLike.deviceName || "").trim(),
    browser: String(tokenLike.browser || "").trim(),
    os: String(tokenLike.os || "").trim(),
    appVersion: String(tokenLike.appVersion || "").trim(),
    lastSeen: tokenLike.lastSeen ? new Date(tokenLike.lastSeen) : now,
    isActive: tokenLike.isActive !== false,
    createdAt: tokenLike.createdAt ? new Date(tokenLike.createdAt) : now,
    updatedAt: now,
  };
};

export const normalizeNotificationTokenList = (tokens = []) =>
  (Array.isArray(tokens) ? tokens : [])
    .map(normalizeNotificationTokenRecord)
    .filter(Boolean);

export const dedupeTokenRecords = (tokens = []) => {
  const seen = new Map();
  for (const tokenRecord of normalizeNotificationTokenList(tokens)) {
    const tokenKey = tokenRecord.token;
    const deviceKey = tokenRecord.deviceId || tokenRecord.token;
    const key = `${tokenRecord.platform}:${deviceKey}:${tokenKey}`;
    const existing = seen.get(key);
    if (!existing || new Date(tokenRecord.lastSeen) > new Date(existing.lastSeen)) {
      seen.set(key, tokenRecord);
    }
  }
  return [...seen.values()];
};

export const enforceTokenLimits = (tokens = []) => {
  const grouped = new Map();
  for (const tokenRecord of dedupeTokenRecords(tokens)) {
    const platform = tokenRecord.platform || "web";
    if (!grouped.has(platform)) grouped.set(platform, []);
    grouped.get(platform).push(tokenRecord);
  }

  const result = [];
  for (const records of grouped.values()) {
    records.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
    result.push(...records.slice(0, MAX_ACTIVE_TOKENS_PER_PLATFORM));
  }
  return result;
};

export const normalizeNotificationPreferences = (preferences = {}, role = null) => {
  const defaults = {
    ...buildDefaultNotificationPreferences(),
    ...(role ? ROLE_NOTIFICATION_DEFAULTS[normalizeRole(role)] || {} : {}),
  };

  const merged = { ...defaults, ...(preferences || {}) };
  return {
    push: merged.push !== false,
    inApp: merged.inApp !== false,
    transactional: merged.transactional !== false,
    marketing: merged.marketing !== false,
    orderUpdates: merged.orderUpdates !== false,
    procurement: merged.procurement !== false,
    delivery: merged.delivery !== false,
    payment: merged.payment !== false,
    system: merged.system !== false,
    adminBroadcast: merged.adminBroadcast !== false,
    promotional: merged.promotional !== false,
  };
};

export const getRecipientPreferences = (recipientDoc, role) =>
  normalizeNotificationPreferences(
    recipientDoc?.notificationPreferences || {},
    role || resolveRoleFromModelName(recipientDoc?.constructor?.modelName || recipientDoc?.recipientModel),
  );

export const updateRecipientNotificationPreferences = async ({
  recipientId,
  recipientModel,
  preferences,
}) => {
  const Model = getModelForRecipientModel(recipientModel);
  const objectId = ensureObjectId(recipientId);
  if (!Model || !objectId) return null;

  const doc = await Model.findById(objectId);
  if (!doc) return null;
  doc.notificationPreferences = normalizeNotificationPreferences(
    preferences,
    resolveRoleFromModelName(recipientModel),
  );
  await doc.save();
  return doc.notificationPreferences;
};

export const getRecipientDocument = async ({ recipientId, recipientModel }) => {
  const Model = getModelForRecipientModel(recipientModel);
  const objectId = ensureObjectId(recipientId);
  if (!Model || !objectId) return null;
  return Model.findById(objectId).lean();
};

export const getRecipientPushTokens = async ({ recipientId, recipientModel }) => {
  const doc = await getRecipientDocument({ recipientId, recipientModel });
  if (!doc) return [];
  return normalizeNotificationTokenList(doc.fcmTokens || []).filter((token) => token.isActive !== false);
};

export const upsertRecipientPushToken = async ({
  recipientId,
  recipientModel,
  token,
  platform = "web",
  deviceId = "",
  deviceName = "",
  browser = "",
  os = "",
  appVersion = "",
}) => {
  const Model = getModelForRecipientModel(recipientModel);
  const objectId = ensureObjectId(recipientId);
  const normalized = normalizeNotificationTokenRecord({
    token,
    platform,
    deviceId,
    deviceName,
    browser,
    os,
    appVersion,
  });

  if (!Model || !objectId || !normalized) return null;

  const doc = await Model.findById(objectId);
  if (!doc) return null;

  const current = normalizeNotificationTokenList(doc.fcmTokens || []);
  const filtered = current.filter(
    (existing) =>
      existing.token !== normalized.token &&
      !(normalized.deviceId && existing.deviceId && existing.deviceId === normalized.deviceId),
  );
  filtered.push({
    ...normalized,
    lastSeen: new Date(),
    updatedAt: new Date(),
  });

  doc.fcmTokens = enforceTokenLimits(filtered);
  await doc.save();
  return doc.fcmTokens;
};

export const removeRecipientPushToken = async ({
  recipientId,
  recipientModel,
  token,
  deviceId = "",
}) => {
  const Model = getModelForRecipientModel(recipientModel);
  const objectId = ensureObjectId(recipientId);
  const rawToken = String(token || "").trim();
  const rawDeviceId = String(deviceId || "").trim();
  if (!Model || !objectId || (!rawToken && !rawDeviceId)) return null;

  const doc = await Model.findById(objectId);
  if (!doc) return null;

  doc.fcmTokens = (doc.fcmTokens || []).filter((entry) => {
    const current = normalizeNotificationTokenRecord(entry);
    if (!current) return false;
    if (rawToken && current.token === rawToken) return false;
    if (rawDeviceId && current.deviceId && current.deviceId === rawDeviceId) return false;
    return true;
  });
  await doc.save();
  return doc.fcmTokens;
};

export const resolveRecipientsFromAudience = async ({
  targetRole,
  recipientIds,
  recipientModel,
  includePickupPartner = true,
  limit = 10000,
}) => {
  const ids = (Array.isArray(recipientIds) ? recipientIds : [])
    .map((id) => ensureObjectId(id))
    .filter(Boolean);

  if (ids.length) {
    const modelName =
      resolveModelNameFromRole(targetRole) ||
      recipientModel ||
      null;
    return ids.map((id) => ({ recipient: id, recipientModel: modelName }))
      .filter((row) => row.recipientModel);
  }

  const normalizedRole = normalizeRole(targetRole);
  if (!normalizedRole || normalizedRole === "all") {
    const results = [];
    const roles = ["customer", "seller", "admin", "delivery"];
    if (includePickupPartner) roles.push("pickup_partner");
    for (const role of roles) {
      // eslint-disable-next-line no-await-in-loop
      const roleRecipients = await resolveRecipientsFromAudience({ targetRole: role, limit });
      results.push(...roleRecipients);
    }
    return results;
  }

  const modelName = resolveModelNameFromRole(normalizedRole);
  const Model = getModelForRecipientModel(modelName);
  if (!Model) return [];

  const docs = await Model.find({})
    .select("_id")
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    recipient: doc._id,
    recipientModel: modelName,
  }));
};

export const isPushEnabledForNotification = (recipientDoc, category) =>
  isPushCategoryEnabled(
    recipientDoc?.notificationPreferences || buildDefaultNotificationPreferences(),
    category,
  );

export const buildRecipientQueryFromRole = (role) => {
  const modelName = resolveModelNameFromRole(role);
  if (!modelName) return null;
  return { modelName, Model: getModelForRecipientModel(modelName) };
};

export const getNotificationPersistedRecord = async (notificationId) => {
  if (!notificationId) return null;
  return Notification.findById(notificationId).lean();
};
