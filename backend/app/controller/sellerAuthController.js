import Seller from "../models/seller.js";
import jwt from "jsonwebtoken";
import handleResponse from "../utils/helper.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import Admin from "../models/admin.js";
import { generateOTP, useRealSMS } from "../utils/otp.js";
import { sendSmsOtp, verifySmsOtp } from "../services/otpService.js";
import { normalizePhone, isValidIndianPhone } from "../utils/phone.js";
import { createNotificationBatch } from "../services/notificationService.js";

const OTP_TTL_MS = 5 * 60 * 1000;

const logOtpDev = (label, otp) => {
    if (useRealSMS()) {
        console.log(`${label} OTP (real SMS mode):`, otp);
    } else {
        console.log(`${label} OTP (mock mode): use 1234`);
    }
};

/* ===============================
   Utils
================================ */

const generateToken = (seller) =>
    jwt.sign(
        { id: seller._id, role: "seller" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

/* ===============================
   SIGNUP: SEND PHONE OTP
================================ */
export const sendSellerSignupOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);

        if (!isValidIndianPhone(phone)) {
            return handleResponse(res, 400, "Enter a valid 10-digit mobile number");
        }

        const existing = await Seller.findOne({ phone }).select("_id");
        if (existing) {
            return handleResponse(res, 400, "This phone number is already registered. Please log in instead.");
        }

        const smsResult = await sendSmsOtp(phone, "Seller");

        return handleResponse(res, 200, smsResult.message || "OTP sent successfully", {
            phone,
            sessionId: smsResult.sessionId,
            otp: smsResult.otp,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   SIGNUP: VERIFY PHONE OTP
================================ */
export const verifySellerSignupOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);
        const otp = String(req.body?.otp ?? "").trim();

        if (!isValidIndianPhone(phone) || !otp) {
            return handleResponse(res, 400, "Phone and OTP are required");
        }

        const isOtpValid = await verifySmsOtp(phone, otp, "Seller");
        if (!isOtpValid) {
            return handleResponse(res, 400, "Invalid or expired OTP. Please request a new one.");
        }

        // Short-lived proof of verification, checked server-side at actual signup so
        // the phone field can't just be typed in and submitted without ever verifying.
        const phoneVerificationToken = jwt.sign(
            { phone, purpose: "seller_signup_phone_verified" },
            process.env.JWT_SECRET,
            { expiresIn: "20m" },
        );

        return handleResponse(res, 200, "Phone number verified", { phone, phoneVerificationToken });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   SELLER SIGNUP
================================ */
export const signupSeller = async (req, res) => {
    try {
        const { name, email, phone, password, shopName, address, lat, lng, radius, description, category, phoneVerificationToken } = req.body;

        if (!name || !email || !phone || !password || !shopName) {
            return handleResponse(res, 400, "All fields are required");
        }

        const cleanPhone = normalizePhone(phone);
        const cleanEmail = String(email || "").trim().toLowerCase();

        if (!isValidIndianPhone(cleanPhone)) {
            return handleResponse(res, 400, "Enter a valid 10-digit mobile number");
        }

        if (!phoneVerificationToken) {
            return handleResponse(res, 400, "Please verify your phone number before registering");
        }
        try {
            const payload = jwt.verify(phoneVerificationToken, process.env.JWT_SECRET);
            if (
                payload.purpose !== "seller_signup_phone_verified" ||
                normalizePhone(payload.phone) !== cleanPhone
            ) {
                return handleResponse(res, 400, "Phone verification doesn't match this number — please verify again");
            }
        } catch (e) {
            return handleResponse(res, 400, "Phone verification expired — please verify again");
        }

        const numLat = lat !== undefined && lat !== "" ? Number(lat) : undefined;
        const numLng = lng !== undefined && lng !== "" ? Number(lng) : undefined;
        const numRadius = radius !== undefined && radius !== "" ? Number(radius) : undefined;

        // Validate coordinates and radius if provided
        if (numLat !== undefined && (Number.isNaN(numLat) || numLat < -90 || numLat > 90)) {
            return handleResponse(res, 400, "Invalid latitude");
        }
        if (numLng !== undefined && (Number.isNaN(numLng) || numLng < -180 || numLng > 180)) {
            return handleResponse(res, 400, "Invalid longitude");
        }
        if (numRadius !== undefined && (Number.isNaN(numRadius) || numRadius < 1 || numRadius > 100)) {
            return handleResponse(res, 400, "Radius must be between 1 and 100 km");
        }

        let seller = await Seller.findOne({ $or: [{ email: cleanEmail }, { phone: cleanPhone }] });

        if (seller) {
            return handleResponse(res, 400, "Seller with this email or phone already exists");
        }

        const sellerData = {
            name: String(name).trim(),
            email: cleanEmail,
            phone: cleanPhone,
            password,
            shopName: String(shopName).trim(),
            address: address ? String(address).trim() : "",
            description: description ? String(description).trim() : "",
            category: category || "General",
            documents: {}
        };

        // Handle SOP Documents
        if (req.files) {
            try {
                if (req.files.tradeLicense && req.files.tradeLicense[0]) {
                    sellerData.documents.tradeLicense = await uploadToCloudinary(req.files.tradeLicense[0].buffer, "seller_docs");
                }
                if (req.files.gstCertificate && req.files.gstCertificate[0]) {
                    sellerData.documents.gstCertificate = await uploadToCloudinary(req.files.gstCertificate[0].buffer, "seller_docs");
                }
                if (req.files.idProof && req.files.idProof[0]) {
                    sellerData.documents.idProof = await uploadToCloudinary(req.files.idProof[0].buffer, "seller_docs");
                }
            } catch (uploadError) {
                console.error("[signupSeller] Document upload failed:", uploadError);
                return handleResponse(res, 500, `Failed to upload documents: ${uploadError.message || "Please check your file formats and try again"}`);
            }
        }

        if (numLat !== undefined && numLng !== undefined) {
            sellerData.location = {
                type: "Point",
                coordinates: [numLng, numLat],
            };
        }

        if (numRadius !== undefined) {
            sellerData.serviceRadius = numRadius;
        }

        seller = await Seller.create(sellerData);

        // --- NOTIFY ADMINS ---
        try {
            const admins = await Admin.find({}, '_id');
            const notifications = admins.map(admin => ({
                recipient: admin._id,
                recipientModel: 'Admin',
                title: 'New Vendor Registration',
                message: `New Vendor Registered: ${seller.shopName} - Category: ${seller.category}. Awaiting Approval.`,
                type: 'system',
                data: { sellerId: seller._id }
            }));
            if (notifications.length > 0) {
                await createNotificationBatch(notifications);
            }
        } catch (notifErr) {
            console.error("Error creating admin notification for new vendor:", notifErr);
        }
        // ---------------------

        const token = generateToken(seller);

        return handleResponse(res, 201, "Seller registered successfully", {
            token,
            seller,
        });
    } catch (error) {
        if (error?.code === 11000) {
            return handleResponse(res, 400, "A seller with this email or phone number is already registered.");
        }
        return handleResponse(res, 500, error.message);
    }
};


/* ===============================
   SELLER LOGIN
================================ */
export const loginSeller = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return handleResponse(res, 400, "Email and password are required");
        }

        // Include password for comparison
        const seller = await Seller.findOne({ email }).select("+password");

        if (!seller) {
            return handleResponse(res, 404, "Seller not found");
        }

        const isMatch = await seller.comparePassword(password);

        if (!isMatch) {
            return handleResponse(res, 401, "Invalid credentials");
        }

        seller.lastLogin = new Date();
        await seller.save();

        const token = generateToken(seller);

        return handleResponse(res, 200, "Login successful", {
            token,
            seller,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   FORGOT PASSWORD OTP
================================ */
export const forgotPasswordOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);

        if (!isValidIndianPhone(phone)) {
            return handleResponse(res, 400, "Enter a valid 10-digit mobile number");
        }

        const seller = await Seller.findOne({ phone }).select("+otp +otpExpiry");

        if (!seller) {
            return handleResponse(res, 404, "No seller found with this phone number");
        }

        if (!seller.isActive) {
            return handleResponse(res, 403, "Your account is suspended. Please contact support.");
        }

        const smsResult = await sendSmsOtp(phone, "Seller");

        return handleResponse(res, 200, smsResult.message || "OTP sent successfully", {
            phone,
            sessionId: smsResult.sessionId,
            otp: smsResult.otp,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   RESET PASSWORD WITH OTP
================================ */
export const resetPasswordWithOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);
        const otp = String(req.body?.otp ?? "").trim();
        const { newPassword } = req.body;

        if (!isValidIndianPhone(phone) || !otp) {
            return handleResponse(res, 400, "Phone and OTP are required");
        }

        if (!newPassword || newPassword.length !== 6) {
            return handleResponse(res, 400, "PIN must be exactly 6 characters");
        }

        const seller = await Seller.findOne({ phone }).select("+otp +otpExpiry +password");

        if (!seller) {
            return handleResponse(res, 404, "Seller not found");
        }

        let isOtpValid = await verifySmsOtp(phone, otp, "Seller");

        // Fallback check for legacy seller.otp field
        if (!isOtpValid && seller.otp && seller.otpExpiry) {
            const expired = seller.otpExpiry.getTime() <= Date.now();
            if (seller.otp === otp && !expired) {
                isOtpValid = true;
            }
        }

        if (!isOtpValid) {
            return handleResponse(res, 400, "Invalid or expired OTP");
        }

        if (!seller.isActive) {
            return handleResponse(res, 403, "Your account is suspended. Please contact support.");
        }

        seller.password = newPassword;
        seller.otp = undefined;
        seller.otpExpiry = undefined;
        seller.lastLogin = new Date();

        await seller.save();

        const token = generateToken(seller);

        return handleResponse(res, 200, "Password reset successfully. Logging you in...", {
            token,
            seller,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
