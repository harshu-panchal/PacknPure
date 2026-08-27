import mongoose from "mongoose";
import {
    buildDefaultNotificationPreferences,
    notificationPreferencesSchema,
    notificationTokenSchema,
} from "./shared/notificationSchemas.js";

const addressSchema = new mongoose.Schema({
    label: {
        type: String,
        enum: ["home", "work", "other"],
        default: "home",
    },
    fullAddress: {
        type: String,
        required: true,
    },
    landmark: String,
    city: String,
    state: String,
    country: String,
    pincode: String,
    /** Google Place ID for the selected address (optional; manual entries omit this). */
    placeId: String,
    location: {
        lat: Number,
        lng: Number,
    },
});

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },
        businessName: {
            type: String,
            trim: true,
        },
        businessAddress: {
            type: String,
            trim: true,
        },
        /** Precise business location from Google Places (optional for legacy profiles). */
        businessLatitude: {
            type: Number,
        },
        businessLongitude: {
            type: Number,
        },
        businessPlaceId: {
            type: String,
            trim: true,
        },
        businessType: {
            type: String,
            trim: true,
        },
        contactPerson: {
            type: String,
            trim: true,
        },
        panNo: {
            type: String,
            trim: true,
        },
        gstNo: {
            type: String,
            trim: true,
        },
        fssaiNumber: {
            type: String,
            trim: true,
        },

        email: {
            type: String,
            lowercase: true,
            unique: true,
            sparse: true,
        },

        avatar: {
            type: String,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        /** Storefront account — JWT uses role `customer`. */
        role: {
            type: String,
            enum: ["customer", "user"],
            default: "customer",
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        otp: {
            type: String,
            select: false,
        },

        otpExpiry: {
            type: Date,
            select: false,
        },

        addresses: [addressSchema],

        walletBalance: {
            type: Number,
            default: 0,
        },

        /** Payout destination for wallet withdrawals — filled in by the customer before requesting one. */
        bankName: { type: String, trim: true, default: "" },
        accountHolder: { type: String, trim: true, default: "" },
        accountNumber: { type: String, trim: true, default: "" },
        ifsc: { type: String, trim: true, uppercase: true, default: "" },
        upiId: { type: String, trim: true, default: "" },

        /**
         * Auto-generated on account creation (or backfilled for legacy accounts).
         * Settable exactly once — locked as soon as a value exists — never user-editable
         * after that. Plain `immutable: true` would also block ever assigning it in the
         * first place on a document re-fetched from the DB (isNew === false), which is
         * every legacy account, so the predicate checks the current value instead.
         */
        referralCode: {
            type: String,
            trim: true,
            uppercase: true,
            unique: true,
            sparse: true,
            immutable: function () {
                return this.referralCode != null;
            },
        },
        /** The other customer whose referral code this user redeemed at signup (null if none/self-registered). */
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        /** Raw code the user typed in at registration, kept for audit even if referredBy resolution changes. */
        referralCodeUsed: {
            type: String,
            trim: true,
            uppercase: true,
            default: null,
        },
        /** Guards against granting the signup bonus more than once for this account. */
        referralSignupBonusGranted: {
            type: Boolean,
            default: false,
        },
        /** Admin-set cap on how many people this user can refer for a bonus. null = unlimited, 0 = blocked. */
        referralMaxAllowed: {
            type: Number,
            default: null,
            min: 0,
        },
        /** When true, the "Apply to All Users" bulk referral-limit action skips this user's referralMaxAllowed. */
        referralLimitLocked: {
            type: Boolean,
            default: false,
        },
        fcmTokens: {
            type: [notificationTokenSchema],
            default: [],
        },
        notificationPreferences: {
            type: notificationPreferencesSchema,
            default: buildDefaultNotificationPreferences,
        },
        codCancelCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        codBlocked: {
            type: Boolean,
            default: false,
        },
        codBlockedAt: {
            type: Date,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        lastLogin: Date,
    },
    {
        timestamps: true,
    }
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ codBlocked: 1, codCancelCount: 1 });
userSchema.index({ referredBy: 1 });

/** Safe profile for API responses (no OTP fields). */
userSchema.methods.toPublicJSON = function () {
    const obj = this.toObject();
    delete obj.otp;
    delete obj.otpExpiry;
    delete obj.__v;
    return obj;
};

export default mongoose.model("User", userSchema);
