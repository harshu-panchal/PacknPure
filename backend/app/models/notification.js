import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        eventId: {
            type: String,
            trim: true,
            index: true,
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: "recipientModel",
        },
        recipientModel: {
            type: String,
            required: true,
            enum: ["Seller", "Admin", "Customer", "Delivery"],
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: "senderModel",
        },
        senderModel: {
            type: String,
            enum: ["Seller", "Admin", "Customer", "Delivery", "PickupPartner"],
        },
        type: {
            type: String,
            enum: ["order", "payment", "alert", "system", "marketing", "procurement"],
            default: "alert",
        },
        category: {
            type: String,
            enum: ["transactional", "marketing", "system", "order", "delivery", "payment", "procurement", "broadcast"],
            default: "system",
            index: true,
        },
        channel: {
            type: String,
            enum: ["in_app", "push", "both"],
            default: "both",
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        priority: {
            type: Number,
            default: 0,
        },
        deepLink: {
            type: String,
            trim: true,
            default: "",
        },
        imageUrl: {
            type: String,
            trim: true,
            default: "",
        },
        audience: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        broadcastBatchId: {
            type: String,
            trim: true,
            index: true,
        },
        hash: {
            type: String,
            trim: true,
            index: true,
        },
        deliveryStatus: {
            type: String,
            enum: ["pending", "queued", "sent", "failed", "skipped"],
            default: "pending",
            index: true,
        },
        sentAt: {
            type: Date,
        },
        failedAt: {
            type: Date,
        },
        lastError: {
            type: String,
            default: "",
        },
        attemptCount: {
            type: Number,
            default: 0,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

// Index for faster queries on recipient and isRead status
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ broadcastBatchId: 1, recipient: 1 }, { sparse: true });
notificationSchema.index({ eventId: 1, recipient: 1, hash: 1 }, { unique: false });

export default mongoose.model("Notification", notificationSchema);
