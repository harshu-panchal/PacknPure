import Customer from "../models/customer.js";
import Transaction from "../models/transaction.js";
import jwt from "jsonwebtoken";
import handleResponse from "../utils/helper.js";
import { generateOTP, useRealSMS } from "../utils/otp.js";
import { sendSmsOtp, verifySmsOtp } from "../services/otpService.js";
import { normalizePhone, isValidIndianPhone } from "../utils/phone.js";
import {
    SUSPENDED_MESSAGE,
    getPlatformSupportContact,
} from "../utils/supportContact.js";
import {
    removeRecipientPushToken,
    upsertRecipientPushToken,
} from "../services/notificationHelper.js";
import { generateUniqueReferralCode } from "../utils/referralCode.js";
import { redeemReferralCode } from "../services/referralService.js";

const OTP_TTL_MS = 5 * 60 * 1000;

/**
 * Parse optional lat/lng. Missing → undefined (backward compatible).
 * Present but invalid → null (caller should reject).
 */
const parseOptionalCoordinate = (value, { min, max }) => {
    if (value === undefined || value === null || value === "") return undefined;
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num) || num < min || num > max) return null;
    return num;
};

const normalizePlaceId = (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const id = String(value).trim();
    return id.length > 0 ? id.slice(0, 256) : undefined;
};

const sanitizeAddressEntry = (addr) => {
    if (!addr || typeof addr !== "object") {
        return { address: addr };
    }

    const next = { ...addr };
    const lat = parseOptionalCoordinate(addr?.location?.lat ?? addr?.latitude ?? addr?.userLatitude, {
        min: -90,
        max: 90,
    });
    const lng = parseOptionalCoordinate(addr?.location?.lng ?? addr?.longitude ?? addr?.userLongitude, {
        min: -180,
        max: 180,
    });

    if (lat === null || lng === null) {
        return { error: "Address latitude/longitude must be valid numbers" };
    }

    if (lat !== undefined && lng !== undefined) {
        next.location = { lat, lng };
    } else if (addr.location === null) {
        next.location = undefined;
    }

    const placeId = normalizePlaceId(addr.placeId ?? addr.userPlaceId);
    if (placeId !== undefined) next.placeId = placeId;

    return { address: next };
};

const generateToken = (customer) =>
    jwt.sign(
        { id: customer._id, role: "customer" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

const isProfileComplete = (customer) => {
    if (!customer) return false;
    const hasPersonal =
        customer.name &&
        customer.email &&
        customer.addresses &&
        customer.addresses.length > 0 &&
        customer.addresses[0].fullAddress &&
        customer.addresses[0].landmark;

    const hasBusiness =
        customer.businessName &&
        customer.businessAddress &&
        customer.businessType &&
        customer.panNo;

    return !!(hasPersonal && hasBusiness);
};

const logOtpDev = (label, otp) => {
    if (useRealSMS()) {
        console.log(`${label} OTP (real SMS mode):`, otp);
    } else {
        console.log(`${label} OTP (mock mode): use 1234`);
    }
};

/* ===============================
   SEND OTP — login + auto-register
   If phone not in DB → create minimal account
================================ */
export const sendCustomerOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);

        if (!isValidIndianPhone(phone)) {
            return handleResponse(res, 400, "Enter a valid 10-digit mobile number");
        }

        let customer = await Customer.findOne({ phone });
        let isNewUser = false;

        if (!customer) {
            const referralCode = await generateUniqueReferralCode();
            customer = await Customer.create({
                phone,
                role: "customer",
                referralCode,
            });
            isNewUser = true;
        }

        const smsResult = await sendSmsOtp(phone, "Customer");

        return handleResponse(res, 200, smsResult.message || "OTP sent successfully", {
            isNewUser,
            phone,
            sessionId: smsResult.sessionId,
            otp: smsResult.otp,
        });
    } catch (error) {
        if (error?.code === 11000) {
            return handleResponse(res, 409, "Phone number already in use");
        }
        return handleResponse(res, 500, error.message);
    }
};

/** @deprecated Use sendCustomerOtp — kept for older clients */
export const loginCustomer = sendCustomerOtp;

/* ===============================
   VERIFY OTP
================================ */
export const verifyCustomerOTP = async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);
        const otp = String(req.body?.otp ?? "").trim();

        if (!isValidIndianPhone(phone) || !otp) {
            return handleResponse(res, 400, "Phone and OTP are required");
        }

        const customer = await Customer.findOne({ phone }).select("+otp +otpExpiry");

        if (!customer) {
            return handleResponse(res, 400, "Customer account not found");
        }

        // Verify OTP via SMS India Hub service
        let isOtpValid = await verifySmsOtp(phone, otp, "Customer");

        // Fallback check for legacy customer.otp field
        if (!isOtpValid && customer.otp && customer.otpExpiry) {
            const expired = customer.otpExpiry.getTime() <= Date.now();
            if (customer.otp === otp && !expired) {
                isOtpValid = true;
            }
        }

        if (!isOtpValid) {
            return handleResponse(res, 400, "Invalid or expired OTP");
        }

        if (!customer.isActive) {
            const support = await getPlatformSupportContact();
            customer.otp = undefined;
            customer.otpExpiry = undefined;
            await customer.save();
            return handleResponse(res, 403, SUSPENDED_MESSAGE, {
                suspended: true,
                supportEmail: support.supportEmail,
                supportPhone: support.supportPhone,
            });
        }

        customer.isVerified = true;
        customer.otp = undefined;
        customer.otpExpiry = undefined;
        customer.lastLogin = new Date();

        await customer.save();

        const token = generateToken(customer);
        const publicCustomer = customer.toPublicJSON();

        return handleResponse(res, 200, "Login successful", {
            token,
            customer: publicCustomer,
            isNewUser: !isProfileComplete(customer),
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET PROFILE
================================ */
export const getCustomerProfile = async (req, res) => {
    try {
        const customer = await Customer.findById(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }
        if (!customer.isActive) {
            const support = await getPlatformSupportContact();
            return handleResponse(res, 403, SUSPENDED_MESSAGE, {
                suspended: true,
                supportEmail: support.supportEmail,
                supportPhone: support.supportPhone,
            });
        }
        return handleResponse(res, 200, "Profile fetched successfully", customer.toPublicJSON());
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   UPDATE PROFILE
================================ */
export const updateCustomerProfile = async (req, res) => {
    try {
        const {
            name,
            email,
            addresses,
            businessName,
            businessAddress,
            businessType,
            contactPerson,
            panNo,
            gstNo,
            fssaiNumber,
            avatar,
            businessLatitude,
            businessLongitude,
            businessPlaceId,
            referralCode,
        } = req.body;

        const customer = await Customer.findById(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        let referralResult = null;
        if (referralCode !== undefined && String(referralCode || "").trim()) {
            referralResult = await redeemReferralCode(customer, referralCode);
            if (!referralResult.applied) {
                const messages = {
                    invalid: "That referral code doesn't exist. Check and try again, or leave it blank.",
                    self: "You can't use your own referral code.",
                    already_used: "A referral code has already been applied to this account.",
                    disabled: null, // referral program off — silently ignore, don't block profile completion
                    empty: null,
                };
                const message = messages[referralResult.reason];
                if (message) {
                    return handleResponse(res, 400, message);
                }
            }
        }

        if (name !== undefined) customer.name = String(name).trim();
        if (email !== undefined) customer.email = email ? String(email).trim().toLowerCase() : undefined;
        if (businessName !== undefined) customer.businessName = businessName;
        if (businessAddress !== undefined) customer.businessAddress = businessAddress;
        if (businessType !== undefined) customer.businessType = businessType;
        if (contactPerson !== undefined) customer.contactPerson = contactPerson;
        if (panNo !== undefined) customer.panNo = panNo;
        if (gstNo !== undefined) customer.gstNo = gstNo;
        if (fssaiNumber !== undefined) customer.fssaiNumber = fssaiNumber;
        if (avatar !== undefined) customer.avatar = avatar ? String(avatar).trim() : "";

        if (addresses !== undefined) {
            if (!Array.isArray(addresses)) {
                return handleResponse(res, 400, "Addresses must be an array");
            }
            const sanitized = [];
            for (const addr of addresses) {
                const result = sanitizeAddressEntry(addr);
                if (result.error) {
                    return handleResponse(res, 400, result.error);
                }
                sanitized.push(result.address);
            }
            customer.addresses = sanitized;
        }

        // Business coordinates — optional; missing keeps legacy profiles working
        if (
            businessLatitude !== undefined ||
            businessLongitude !== undefined ||
            businessPlaceId !== undefined
        ) {
            const lat = parseOptionalCoordinate(businessLatitude, { min: -90, max: 90 });
            const lng = parseOptionalCoordinate(businessLongitude, { min: -180, max: 180 });

            if (lat === null || lng === null) {
                return handleResponse(
                    res,
                    400,
                    "Business latitude/longitude must be valid numbers"
                );
            }

            // Only update when both are provided together, or clear when explicitly null
            if (lat !== undefined && lng !== undefined) {
                customer.businessLatitude = lat;
                customer.businessLongitude = lng;
            } else if (businessLatitude === null && businessLongitude === null) {
                customer.businessLatitude = undefined;
                customer.businessLongitude = undefined;
            }

            if (businessPlaceId !== undefined) {
                customer.businessPlaceId =
                    businessPlaceId === null || businessPlaceId === ""
                        ? undefined
                        : normalizePlaceId(businessPlaceId);
            }
        }

        await customer.save();

        return handleResponse(res, 200, "Profile updated successfully", customer.toPublicJSON());
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const registerCustomerFcmToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== "string") {
            return handleResponse(res, 400, "A valid FCM token is required");
        }

        const customer = await Customer.findById(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        const tokens = await upsertRecipientPushToken({
            recipientId: customer._id,
            recipientModel: "User",
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

export const removeCustomerFcmToken = async (req, res) => {
    try {
        const { token } = req.body;
        if ((!token || typeof token !== "string") && !req.body?.deviceId) {
            return handleResponse(res, 400, "A valid FCM token is required");
        }

        const tokens = await removeRecipientPushToken({
            recipientId: req.user.id,
            recipientModel: "User",
            token,
            deviceId: req.body?.deviceId,
        });

        return handleResponse(res, 200, "FCM token removed successfully", {
            tokens,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET WALLET TRANSACTIONS
================================ */
export const getCustomerTransactions = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, Math.max(1, parseInt(limit, 10)));
        const perPage = Math.min(50, Math.max(1, parseInt(limit, 10)));

        const [transactions, total] = await Promise.all([
            Transaction.find({ user: customerId, userModel: "User" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(perPage)
                .populate("order", "orderId")
                .lean(),
            Transaction.countDocuments({ user: customerId, userModel: "User" }),
        ]);

        // Credit/debit is derived from the transaction's actual signed amount,
        // not a hardcoded type check — every wallet-crediting type (Refund,
        // Wallet Credit, Promotional Credit, ...) renders correctly this way,
        // including any new type added later.
        const items = transactions.map((t) => ({
            _id: t._id,
            type: t.amount >= 0 ? "credit" : "debit",
            title: t.type || (t.amount >= 0 ? "Wallet credit" : "Wallet debit"),
            amount: Math.abs(t.amount),
            date: t.createdAt,
            reference: t.reference,
            orderId: t.order?.orderId,
        }));

        return handleResponse(res, 200, "Transactions fetched", {
            items,
            total,
            page: parseInt(page, 10),
            totalPages: Math.ceil(total / perPage) || 1,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
