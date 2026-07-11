import mongoose from "mongoose";

export const MAX_ACTIVE_TOKENS_PER_PLATFORM = 10;

export const NOTIFICATION_PLATFORMS = ["web", "android", "ios", "unknown"];

export const notificationTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      default: "web",
      enum: NOTIFICATION_PLATFORMS,
    },
    deviceId: {
      type: String,
      trim: true,
      default: "",
    },
    deviceName: {
      type: String,
      trim: true,
      default: "",
    },
    browser: {
      type: String,
      trim: true,
      default: "",
    },
    os: {
      type: String,
      trim: true,
      default: "",
    },
    appVersion: {
      type: String,
      trim: true,
      default: "",
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

export const notificationPreferencesSchema = new mongoose.Schema(
  {
    push: {
      type: Boolean,
      default: true,
    },
    inApp: {
      type: Boolean,
      default: true,
    },
    transactional: {
      type: Boolean,
      default: true,
    },
    marketing: {
      type: Boolean,
      default: true,
    },
    orderUpdates: {
      type: Boolean,
      default: true,
    },
    procurement: {
      type: Boolean,
      default: true,
    },
    delivery: {
      type: Boolean,
      default: true,
    },
    payment: {
      type: Boolean,
      default: true,
    },
    system: {
      type: Boolean,
      default: true,
    },
    adminBroadcast: {
      type: Boolean,
      default: true,
    },
    promotional: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

export const buildDefaultNotificationPreferences = () => ({
  push: true,
  inApp: true,
  transactional: true,
  marketing: true,
  orderUpdates: true,
  procurement: true,
  delivery: true,
  payment: true,
  system: true,
  adminBroadcast: true,
  promotional: true,
});

