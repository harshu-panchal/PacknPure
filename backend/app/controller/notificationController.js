import Notification from "../models/notification.js";
import User from "../models/customer.js";
import Seller from "../models/seller.js";
import Admin from "../models/admin.js";
import Delivery from "../models/delivery.js";
import PickupPartner from "../models/pickupPartner.js";
import handleResponse from "../utils/helper.js";
import {
  ensureObjectId,
  getRecipientPreferences,
  removeRecipientPushToken,
  resolveModelNameFromRole,
  updateRecipientNotificationPreferences,
  upsertRecipientPushToken,
} from "../services/notificationHelper.js";
import { broadcastNotification } from "../services/notificationService.js";

const MODEL_LOOKUP = {
  User,
  Seller,
  Admin,
  Delivery,
  PickupPartner,
};

const getPageConfig = (req) => {
  const page = Math.max(1, parseInt(req.query?.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit || "20", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const getRecipientModelForRequest = (req) => resolveModelNameFromRole(req.user?.role);

export const getMyNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = getPageConfig(req);
    const query = { recipient: req.user.id };
    if (String(req.query?.unreadOnly || "").toLowerCase() === "true") {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user.id, isRead: false }),
    ]);

    return handleResponse(res, 200, "Notifications fetched successfully", {
      notifications,
      unreadCount,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user.id },
      { isRead: true, deliveryStatus: "sent" },
      { new: true },
    );

    if (!notification) {
      return handleResponse(res, 404, "Notification not found");
    }

    return handleResponse(res, 200, "Notification marked as read", notification);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } },
    );

    return handleResponse(res, 200, "All notifications marked as read");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const registerDeviceToken = async (req, res) => {
  try {
    const recipientModel = getRecipientModelForRequest(req);
    if (!recipientModel) {
      return handleResponse(res, 400, "Unsupported role for push registration");
    }

    const token = String(req.body?.token || "").trim();
    if (!token) {
      return handleResponse(res, 400, "A valid FCM token is required");
    }

    const tokens = await upsertRecipientPushToken({
      recipientId: req.user.id,
      recipientModel,
      token,
      platform: req.body?.platform,
      deviceId: req.body?.deviceId,
      deviceName: req.body?.deviceName,
      browser: req.body?.browser,
      os: req.body?.os,
      appVersion: req.body?.appVersion,
    });

    return handleResponse(res, 200, "FCM token registered successfully", {
      tokens,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const removeDeviceToken = async (req, res) => {
  try {
    const recipientModel = getRecipientModelForRequest(req);
    if (!recipientModel) {
      return handleResponse(res, 400, "Unsupported role for push removal");
    }

    const token = String(req.body?.token || "").trim();
    const deviceId = String(req.body?.deviceId || "").trim();
    const tokens = await removeRecipientPushToken({
      recipientId: req.user.id,
      recipientModel,
      token,
      deviceId,
    });

    return handleResponse(res, 200, "FCM token removed successfully", {
      tokens,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getMyNotificationPreferences = async (req, res) => {
  try {
    const recipientModel = getRecipientModelForRequest(req);
    if (!recipientModel) {
      return handleResponse(res, 400, "Unsupported role for notification preferences");
    }

    const Model = MODEL_LOOKUP[recipientModel];
    const recipientDoc = Model ? await Model.findById(req.user.id).lean() : null;
    if (!recipientDoc) {
      return handleResponse(res, 404, "Account not found");
    }

    return handleResponse(res, 200, "Notification preferences fetched", {
      preferences: getRecipientPreferences(recipientDoc, recipientModel),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateMyNotificationPreferences = async (req, res) => {
  try {
    const recipientModel = getRecipientModelForRequest(req);
    if (!recipientModel) {
      return handleResponse(res, 400, "Unsupported role for notification preferences");
    }

    const preferences = await updateRecipientNotificationPreferences({
      recipientId: req.user.id,
      recipientModel,
      preferences: req.body || {},
    });

    return handleResponse(res, 200, "Notification preferences updated", {
      preferences,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const broadcastNotifications = async (req, res) => {
  try {
    const {
      targetRole = "all",
      recipientIds = [],
      recipientModel = null,
      includePickupPartner = true,
      title,
      message,
      type = "system",
      category,
      deepLink,
      imageUrl,
      priority,
      data,
    } = req.body || {};

    if (!title || !message) {
      return handleResponse(res, 400, "title and message are required");
    }

    const notifications = await broadcastNotification({
      targetRole,
      recipientIds,
      recipientModel,
      includePickupPartner,
      title,
      message,
      type,
      category,
      deepLink,
      imageUrl,
      priority,
      data,
      sender: ensureObjectId(req.user.id),
      senderModel: "Admin",
      broadcastBatchId: `broadcast-${Date.now()}`,
      audience: {
        targetRole,
        recipientIds,
        recipientModel,
        includePickupPartner,
      },
    });

    return handleResponse(res, 200, "Broadcast queued successfully", {
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getBroadcastHistory = async (req, res) => {
  try {
    const { page, limit, skip } = getPageConfig(req);
    const query = { broadcastBatchId: { $ne: "" } };
    const [items, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
    ]);

    return handleResponse(res, 200, "Broadcast history fetched", {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
