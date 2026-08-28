import mongoose from "mongoose";
import bcrypt from "bcrypt";
import {
  buildDefaultNotificationPreferences,
  notificationPreferencesSchema,
  notificationTokenSchema,
} from "./shared/notificationSchemas.js";

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    otp: {
      type: String,
      select: false,
    },

    otpExpiry: {
      type: Date,
      select: false,
    },

    role: {
      type: String,
      default: "admin",
    },
    fcmTokens: {
      type: [notificationTokenSchema],
      default: [],
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: buildDefaultNotificationPreferences,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },

    lastLogin: Date,
  },
  { timestamps: true },
);

adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

adminSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Admin", adminSchema);
