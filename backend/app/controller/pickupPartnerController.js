import PickupPartner from "../models/pickupPartner.js";
import PurchaseRequest from "../models/purchaseRequest.js";
import Delivery from "../models/delivery.js";
import handleResponse from "../utils/helper.js";

async function resolvePickupPartnerId(user) {
  if (!user) return null;
  if (user.role === 'pickup_partner') return user.id;
  if (user.role === 'delivery') {
    const delivery = await Delivery.findById(user.id).select('phone').lean();
    if (delivery && delivery.phone) {
      const pickupPartner = await PickupPartner.findOne({ phone: delivery.phone }).select('_id').lean();
      if (pickupPartner) return String(pickupPartner._id);
    }
  }
  return null;
}
import { savePurchaseRequest, isPickupEligibleLine, buildItemKey, releaseAllocationSellerStock } from "../services/purchaseRequestService.js";
import { getPickupOtpTimeoutMinutes } from "../services/settingsService.js";
import getPagination from "../utils/pagination.js";
import { generateOTP, useRealSMS } from "../utils/otp.js";
import { distanceMeters } from "../utils/geoUtils.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";
const PICKUP_AUTH_DEV_OTP = "1234";
const isPickupAuthDevMode = () => process.env.NODE_ENV !== "production";

const generatePickupLoginOtp = () => {
  if (isPickupAuthDevMode()) return PICKUP_AUTH_DEV_OTP;
  return generateOTP();
};
const PICKUP_RADIUS_M = Math.max(50, Number(process.env.PICKUP_PARTNER_VENDOR_RADIUS_METERS || 1000000));
const HUB_RADIUS_M = Math.max(50, Number(process.env.PICKUP_PARTNER_HUB_RADIUS_METERS || 1000000));

const hashPickupOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

const parseHubCoordinate = (...keys) => {
  for (const key of keys) {
    const raw = process.env[key];
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
};

const buildPartnerToken = (partner) =>
  jwt.sign(
    { id: partner._id, role: "pickup_partner" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

const mapStatusLabel = (status) => {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  return "Available";
};

const serializeRow = (row, assignmentStats = new Map()) => {
  const stat = assignmentStats.get(String(row._id)) || {
    totalAssigned: 0,
    activeAssigned: 0,
  };
  return {
    _id: row._id,
    partnerName: row.name,
    phone: row.phone,
    vehicleType: row.vehicleType,
    hubId: row.hubId,
    status: mapStatusLabel(row.status),
    statusRaw: row.status,
    isActive: row.isActive,
    isVerified: row.isVerified,
    assignedPickups: Number(stat.totalAssigned || 0),
    activeAssignedPickups: Number(stat.activeAssigned || 0),
    paymentType: row.paymentType || "per_trip",
    salaryAmount: row.salaryAmount || 0,
    perKmRate: row.perKmRate || 0,
    baseTripRate: row.baseTripRate || 0,
    walletBalance: row.walletBalance || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const getPickupPartners = async (req, res) => {
  try {
    const { status, search, hubId = DEFAULT_HUB_ID } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const query = { hubId: String(hubId) };
    if (status && status !== "all") query.status = String(status).toLowerCase();
    if (search) {
      query.$or = [
        { name: { $regex: String(search), $options: "i" } },
        { phone: { $regex: String(search), $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      PickupPartner.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PickupPartner.countDocuments(query),
    ]);

    const partnerIds = rows.map((r) => r._id);
    const assignment = await PurchaseRequest.aggregate([
      { $match: { pickupPartnerId: { $in: partnerIds } } },
      {
        $group: {
          _id: "$pickupPartnerId",
          totalAssigned: { $sum: 1 },
          activeAssigned: {
            $sum: {
              $cond: [{ $in: ["$status", ["pickup_assigned", "picked"]] }, 1, 0],
            },
          },
        },
      },
    ]);
    const statsMap = new Map(
      assignment.map((a) => [String(a._id), { totalAssigned: a.totalAssigned, activeAssigned: a.activeAssigned }]),
    );

    return handleResponse(res, 200, "Pickup partners fetched", {
      items: rows.map((row) => serializeRow(row, statsMap)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const createPickupPartner = async (req, res) => {
  try {
    const {
      partnerName, phone, vehicleType, hubId = DEFAULT_HUB_ID,
      paymentType, salaryAmount, perKmRate, baseTripRate
    } = req.body || {};
    if (!partnerName || !String(partnerName).trim()) {
      return handleResponse(res, 400, "partnerName is required");
    }
    if (!phone || !String(phone).trim()) {
      return handleResponse(res, 400, "phone is required");
    }

    const doc = await PickupPartner.create({
      name: String(partnerName).trim(),
      phone: String(phone).trim(),
      vehicleType: String(vehicleType || "bike").trim(),
      hubId: String(hubId),
      status: "available",
      isActive: true,
      isVerified: true,
      paymentType: paymentType || "per_trip",
      salaryAmount: Number(salaryAmount || 0),
      perKmRate: Number(perKmRate || 0),
      baseTripRate: Number(baseTripRate || 0),
    });

    return handleResponse(res, 201, "Pickup partner created", serializeRow(doc.toObject()));
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 400, "Phone already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

export const updatePickupPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      partnerName, phone, vehicleType, status, isActive,
      paymentType, salaryAmount, perKmRate, baseTripRate
    } = req.body || {};

    const doc = await PickupPartner.findById(id);
    if (!doc) return handleResponse(res, 404, "Pickup partner not found");

    if (partnerName !== undefined) doc.name = String(partnerName).trim();
    if (phone !== undefined) doc.phone = String(phone).trim();
    if (vehicleType !== undefined) doc.vehicleType = String(vehicleType).trim();
    if (status !== undefined) doc.status = String(status).toLowerCase();
    if (isActive !== undefined) doc.isActive = Boolean(isActive);
    if (req.body.isVerified !== undefined) doc.isVerified = Boolean(req.body.isVerified);

    if (paymentType !== undefined) doc.paymentType = paymentType;
    if (salaryAmount !== undefined) doc.salaryAmount = Number(salaryAmount);
    if (perKmRate !== undefined) doc.perKmRate = Number(perKmRate);
    if (baseTripRate !== undefined) doc.baseTripRate = Number(baseTripRate);

    await doc.save();
    return handleResponse(res, 200, "Pickup partner updated", serializeRow(doc.toObject()));
  } catch (error) {
    if (error?.code === 11000) {
      return handleResponse(res, 400, "Phone already exists");
    }
    return handleResponse(res, 500, error.message);
  }
};

export const updatePickupPartnerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const normalized = String(status || "").toLowerCase();
    if (!["available", "active", "inactive"].includes(normalized)) {
      return handleResponse(res, 400, "Invalid status");
    }

    const doc = await PickupPartner.findById(id);
    if (!doc) return handleResponse(res, 404, "Pickup partner not found");

    doc.status = normalized;
    doc.isActive = normalized !== "inactive";
    await doc.save();

    return handleResponse(res, 200, "Pickup partner status updated", serializeRow(doc.toObject()));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const sendPickupPartnerLoginOtp = async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone || !String(phone).trim()) {
      return handleResponse(res, 400, "phone is required");
    }

    const partner = await PickupPartner.findOne({ phone: String(phone).trim() }).select("+otp +otpExpiry");
    if (!partner || !partner.isActive || !partner.isVerified) {
      return handleResponse(res, 404, "Pickup partner not found or inactive");
    }

    const otp = generatePickupLoginOtp();
    partner.otp = otp;
    partner.otpExpiry = new Date(Date.now() + (await getPickupOtpTimeoutMinutes()) * 60 * 1000);
    await partner.save();

    if (isPickupAuthDevMode()) {
      console.log("Pickup Partner OTP (dev mode): use 1234 — SMS skipped");
    } else if (useRealSMS()) {
      console.log("Pickup Partner OTP (real SMS mode):", otp);
    } else {
      console.log("Pickup Partner OTP (mock mode): use 1234");
    }

    return handleResponse(res, 200, "OTP sent successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const verifyPickupPartnerOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) {
      return handleResponse(res, 400, "phone and otp are required");
    }

    const normalizedOtp = String(otp).trim();
    if (isPickupAuthDevMode() && normalizedOtp !== PICKUP_AUTH_DEV_OTP) {
      return handleResponse(res, 400, "Invalid OTP");
    }

    const partner = await PickupPartner.findOne({
      phone: String(phone).trim(),
      otp: normalizedOtp,
      otpExpiry: { $gt: new Date() },
    }).select("+otp +otpExpiry");

    if (!partner) {
      return handleResponse(
        res,
        400,
        isPickupAuthDevMode() ? "Invalid OTP" : "Invalid or expired OTP",
      );
    }

    partner.otp = undefined;
    partner.otpExpiry = undefined;
    partner.lastLogin = new Date();
    partner.status = partner.status === "inactive" ? "inactive" : "active";
    await partner.save();

    const token = buildPartnerToken(partner);
    return handleResponse(res, 200, "Login successful", {
      token,
      partner: {
        _id: partner._id,
        name: partner.name,
        phone: partner.phone,
        vehicleType: partner.vehicleType,
        hubId: partner.hubId,
        role: "pickup_partner",
      },
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getPickupPartnerProfile = async (req, res) => {
  try {
    const partnerId = req.user?.id;
    const partner = await PickupPartner.findById(partnerId).lean();
    if (!partner) {
      return handleResponse(res, 404, "Pickup partner not found");
    }

    return handleResponse(res, 200, "Pickup partner profile fetched", {
      _id: partner._id,
      name: partner.name,
      phone: partner.phone,
      vehicleType: partner.vehicleType,
      hubId: partner.hubId,
      status: partner.status,
      isActive: partner.isActive,
      walletBalance: partner.walletBalance || 0,
      baseTripRate: partner.baseTripRate || 0,
      perKmRate: partner.perKmRate || 0,
      paymentType: partner.paymentType || "per_trip",
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updatePickupPartnerProfile = async (req, res) => {
  try {
    const partnerId = req.user?.id;
    const { name, vehicleType, address, location } = req.body || {};

    const partner = await PickupPartner.findById(partnerId);
    if (!partner) {
      return handleResponse(res, 404, "Pickup partner not found");
    }

    if (name !== undefined) partner.name = String(name).trim();
    if (vehicleType !== undefined) partner.vehicleType = String(vehicleType).trim();
    if (address !== undefined) partner.address = String(address).trim();
    if (location !== undefined) partner.location = location;

    await partner.save();

    return handleResponse(res, 200, "Profile updated successfully", {
      _id: partner._id,
      name: partner.name,
      phone: partner.phone,
      vehicleType: partner.vehicleType,
      hubId: partner.hubId,
      status: partner.status,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getMyPickupAssignments = async (req, res) => {
  try {
    const partnerId = await resolvePickupPartnerId(req.user);
    if (!partnerId) return handleResponse(res, 403, "No linked PickupPartner account found. Please ask Admin to create one with the same phone number.");
    const { status = "active" } = req.query || {};

    const query = { pickupPartnerId: partnerId };
    if (status === "active") {
      query.status = { $in: ["pickup_assigned", "picked", "hub_delivered"] };
    } else if (status !== "all") {
      query.status = status;
    }

    const rows = await PurchaseRequest.find(query)
      .populate("vendorId", "shopName name phone location")
      .populate("items.productId", "name sku weight unit")
      .sort({ createdAt: -1 })
      .lean();

    const { buildPrTimeline, mapPrKeyDates } = await import(
      "../utils/purchaseRequestHelpers.js"
    );

    const items = rows.map((row) => ({
      _id: row._id,
      requestId: row.requestId,
      orderId: row.orderId,
      status: row.status,
      vendor: {
        id: row.vendorId?._id || row.vendorId || null,
        name: row.vendorId?.shopName || row.vendorId?.name || "Vendor",
        // Privacy: never expose seller phone to pickup partner
        phone: "",
        maskedCallingReady: true,
        location: row.vendorId?.location || null,
      },
      products: (row.items || [])
        .filter(isPickupEligibleLine)
        .map((i) => ({
          productId: i.productId?._id || i.productId,
          name: i.productId?.name || "Product",
          sku: i.productId?.sku || "",
          weight: i.productId?.weight || "",
          unit: i.productId?.unit || "",
          qty: Number(i.committedQty || i.shortageQty || i.requiredQty || 0),
          unitCost: Number(i.vendorUnitCost || 0),
        })),
      pickupOtpRequired: row.status === "pickup_assigned",
      // Partner must enter OTP from seller — do not return plaintext OTP in list
      pickupOtp: "",
      pickupOtpGenerated: Boolean(
        row.status === "pickup_assigned" &&
        row.pickupOtpHash &&
        (!row.pickupOtpExpiresAt || new Date(row.pickupOtpExpiresAt) > new Date()),
      ),
      pickupOtpVerified: Boolean(
        row.status === "pickup_assigned" && row.pickupOtpVerifiedAt,
      ),
      pickupOtpExpiresAt: row.pickupOtpExpiresAt || null,
      reachedSellerAt: row.pickupProof?.reachedSellerAt || null,
      notes: row.notes || "",
      eta: row.eta || null,
      dates: mapPrKeyDates(row),
      timeline: buildPrTimeline(row),
      pickupAssignedAt: row.pickupAssignedAt || null,
      pickupProof: row.pickupProof || null,
      hubDropProof: row.hubDropProof || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return handleResponse(res, 200, "Pickup assignments fetched", { items });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Partner marks arrival at seller (unlocks parcel images step).
 * Does not change PR business status — pickup_assigned remains.
 */
export const markReachedSeller = async (req, res) => {
  try {
    const partnerId = await resolvePickupPartnerId(req.user);
    if (!partnerId) return handleResponse(res, 403, "No linked PickupPartner account found.");
    const { id } = req.params;
    const { lat, lng } = req.body || {};

    const pr = await PurchaseRequest.findOne({
      _id: id,
      pickupPartnerId: partnerId,
      status: "pickup_assigned",
    });
    if (!pr) return handleResponse(res, 404, "Pickup assignment not found");

    const prev = pr.pickupProof?.toObject?.() || pr.pickupProof || {};
    pr.pickupProof = {
      ...prev,
      reachedSellerAt: new Date(),
      location:
        Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
          ? { lat: Number(lat), lng: Number(lng) }
          : prev.location,
    };
    await savePurchaseRequest(pr);

    return handleResponse(res, 200, "Reached seller recorded", {
      reachedSellerAt: pr.pickupProof.reachedSellerAt,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Partner generates / refreshes handover OTP after parcel photo(s).
 * Dev: always stores and returns 1234. Production: random OTP, provider-ready (no SMS yet).
 */
export const generateAssignmentPickupOtp = async (req, res) => {
  try {
    const partnerId = await resolvePickupPartnerId(req.user);
    if (!partnerId) return handleResponse(res, 403, "No linked PickupPartner account found.");
    const { id } = req.params;
    const { vendorImageUrl, vendorImageUrls } = req.body || {};

    const urls = [
      ...(Array.isArray(vendorImageUrls) ? vendorImageUrls : []),
      ...(vendorImageUrl ? [vendorImageUrl] : []),
    ]
      .map((u) => String(u || "").trim())
      .filter(Boolean);
    const uniqueUrls = [...new Set(urls)].slice(0, 4);

    if (uniqueUrls.length < 1) {
      return handleResponse(res, 400, "At least one parcel image is required before generating OTP");
    }

    const pr = await PurchaseRequest.findOne({
      _id: id,
      pickupPartnerId: partnerId,
      status: "pickup_assigned",
    });
    if (!pr) return handleResponse(res, 404, "Pickup assignment not found");

    const otp =
      process.env.NODE_ENV !== "production"
        ? "1234"
        : String(Math.floor(1000 + Math.random() * 9000));

    pr.pickupOtpCode = otp;
    pr.pickupOtpHash = hashPickupOtp(otp);
    pr.pickupOtpExpiresAt = new Date(
      Date.now() + (await getPickupOtpTimeoutMinutes()) * 60 * 1000,
    );
    pr.pickupOtpVerifiedAt = undefined;
    const prev = pr.pickupProof?.toObject?.() || pr.pickupProof || {};
    pr.pickupProof = {
      ...prev,
      vendorImageUrl: uniqueUrls[0],
      // Extra URLs kept in notes prefix for history without schema migration
      notes: [
        prev.notes && !String(prev.notes).startsWith("VENDOR_IMAGES:")
          ? String(prev.notes)
          : "",
        `VENDOR_IMAGES:${uniqueUrls.join("|")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
    await savePurchaseRequest(pr);

    try {
      const { createNotification } = await import("../services/notificationService.js");
      if (pr.vendorId) {
        await createNotification({
          recipient: pr.vendorId,
          recipientModel: "Seller",
          title: "Pickup OTP Ready",
          message: `Share the pickup OTP with the pickup partner for request ${pr.requestId}.`,
          type: "order",
          data: { purchaseRequestId: String(pr._id), requestId: pr.requestId },
        });
      }
    } catch (notifyErr) {
      console.warn("[generateAssignmentPickupOtp] Notify failed:", notifyErr.message);
    }

    const payload = {
      expiresAt: pr.pickupOtpExpiresAt,
      pickupOtpGenerated: true,
      vendorImageUrls: uniqueUrls,
    };
    if (process.env.NODE_ENV !== "production") {
      payload.otp = "1234";
      payload.devMode = true;
    }

    return handleResponse(res, 200, "OTP generated successfully", payload);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Verify handover OTP only — does not complete pickup.
 * Unlocks Confirm Pickup step on the partner app.
 */
export const verifyAssignmentPickupOtp = async (req, res) => {
  try {
    const partnerId = await resolvePickupPartnerId(req.user);
    if (!partnerId) return handleResponse(res, 403, "No linked PickupPartner account found.");
    const { id } = req.params;
    const { otp } = req.body || {};
    const normalizedOtp = String(otp || "").trim();

    if (!normalizedOtp) {
      return handleResponse(res, 400, "Pickup OTP is required");
    }

    const pr = await PurchaseRequest.findOne({
      _id: id,
      pickupPartnerId: partnerId,
      status: "pickup_assigned",
    }).select("+pickupOtpHash +pickupOtpCode +pickupOtpExpiresAt +pickupOtpVerifiedAt");

    if (!pr) return handleResponse(res, 404, "Pickup assignment not found");

    if (!pr.pickupOtpHash) {
      return handleResponse(res, 400, "Generate OTP before verifying");
    }
    if (pr.pickupOtpExpiresAt && new Date(pr.pickupOtpExpiresAt) < new Date()) {
      return handleResponse(res, 400, "Pickup OTP expired");
    }
    if (pr.pickupOtpHash !== hashPickupOtp(normalizedOtp)) {
      return handleResponse(res, 400, "Invalid OTP");
    }

    pr.pickupOtpVerifiedAt = new Date();
    await savePurchaseRequest(pr);

    return handleResponse(res, 200, "OTP verified successfully", {
      pickupOtpVerified: true,
      verifiedAt: pr.pickupOtpVerifiedAt,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * Live GPS heartbeat for pickup partner.
 * Emits to seller + admin rooms. Future-ready for customer tracking.
 */
export const updatePickupPartnerLiveLocation = async (req, res) => {
  try {
    const partnerId = await resolvePickupPartnerId(req.user);
    if (!partnerId) return handleResponse(res, 403, "No linked PickupPartner account found.");

    const { lat, lng, heading, speed, assignmentId } = req.body || {};
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return handleResponse(res, 400, "Valid lat/lng required");
    }

    const partner = await PickupPartner.findByIdAndUpdate(
      partnerId,
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          lastLocationAt: new Date(),
        },
      },
      { new: true },
    ).select("name location");

    if (!partner) return handleResponse(res, 404, "Pickup partner not found");

    const locationPayload = {
      partnerId: String(partnerId),
      partnerName: partner.name || "Pickup Partner",
      lat: latitude,
      lng: longitude,
      heading: heading != null ? Number(heading) : null,
      speed: speed != null ? Number(speed) : null,
      assignmentId: assignmentId || null,
      at: new Date().toISOString(),
      // Future hooks — no real masked calling / customer track yet
      trackingAudience: ["seller", "admin", "customer_future"],
    };

    try {
      const { getIO } = await import("../socket/socketManager.js");
      const io = getIO();
      if (io) {
        io.to("admin:orders").emit("pickup:location:update", locationPayload);
        if (assignmentId) {
          const pr = await PurchaseRequest.findById(assignmentId)
            .select("vendorId orderId requestId")
            .lean();
          if (pr?.vendorId) {
            io.to(`seller:${String(pr.vendorId)}`).emit(
              "pickup:location:update",
              locationPayload,
            );
          }
          if (pr?.orderId) {
            io.to(`order:${String(pr.orderId)}`).emit(
              "pickup:location:update",
              {
                ...locationPayload,
                // Customer privacy: never include phones; future customer track hook
                customerTrackingReady: true,
              },
            );
          }
        }
      }
    } catch (socketErr) {
      console.warn("[updatePickupPartnerLiveLocation] socket emit failed:", socketErr.message);
    }

    return handleResponse(res, 200, "Location updated", locationPayload);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const markAssignmentPicked = async (req, res) => {
  try {
    const partnerId = await resolvePickupPartnerId(req.user);
    if (!partnerId) return handleResponse(res, 403, "No linked PickupPartner account found.");
    const { id } = req.params;
    const { otp, lat, lng, notes, vendorImageUrl, vendorImageUrls } = req.body || {};
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return handleResponse(res, 400, "Valid lat/lng required");
    }

    const imageUrls = [
      ...(Array.isArray(vendorImageUrls) ? vendorImageUrls : []),
      ...(vendorImageUrl ? [vendorImageUrl] : []),
    ]
      .map((u) => String(u || "").trim())
      .filter(Boolean);
    const uniqueImageUrls = [...new Set(imageUrls)].slice(0, 4);
    if (uniqueImageUrls.length < 1) {
      return handleResponse(res, 400, "Parcel image is required before confirming pickup");
    }

    const pr = await PurchaseRequest.findOne({
      _id: id,
      pickupPartnerId: partnerId,
      status: "pickup_assigned",
    }).populate("vendorId", "location");

    if (!pr) {
      return handleResponse(res, 404, "Pickup assignment not found");
    }

    const eligibleLines = (pr.items || []).filter(isPickupEligibleLine);
    if (eligibleLines.length === 0) {
      return handleResponse(res, 400, "No accepted product lines are available for pickup");
    }

    const expectedHash = pr.pickupOtpHash || "";
    if (!expectedHash || expectedHash !== hashPickupOtp(otp)) {
      return handleResponse(res, 400, "Invalid pickup OTP");
    }
    if (pr.pickupOtpExpiresAt && new Date(pr.pickupOtpExpiresAt) < new Date()) {
      return handleResponse(res, 400, "Pickup OTP expired");
    }
    if (!pr.pickupOtpVerifiedAt) {
      return handleResponse(res, 400, "Verify OTP before confirming pickup");
    }

    const coords = pr.vendorId?.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const [vlng, vlat] = coords;
      const d = distanceMeters(latitude, longitude, vlat, vlng);
      if (d > PICKUP_RADIUS_M) {
        return handleResponse(res, 400, `Too far from vendor (>${PICKUP_RADIUS_M}m)`);
      }
    }

    // Handle partial/failed pickups
    const { actualPickedQty } = req.body || {};
    const lineRows = (pr.items || []).filter(isPickupEligibleLine);
    const isMultiLine = lineRows.length > 1;
    const lineUpdates = Array.isArray(req.body?.items) ? req.body.items : [];
    const pickedByLineKey = new Map(
      lineUpdates
        .filter((row) => row?.productId != null)
        .map((row) => [
          buildItemKey(row.productId, row.variantId || null),
          Number(row.actualPickedQty ?? row.pickedQty ?? 0),
        ]),
    );

    const lineRequestedQty = (line) =>
      Number(line?.committedQty || line?.requestedQty || line?.shortageQty || 0);
    const linePickedQty = (line) => {
      const lineKey = line?.itemKey || buildItemKey(line?.productId?._id || line?.productId, line?.variantId);
      if (isMultiLine && pickedByLineKey.has(lineKey)) {
        return Number(pickedByLineKey.get(lineKey));
      }
      const productKey = String(line?.productId?._id || line?.productId);
      if (isMultiLine && pickedByLineKey.has(productKey)) {
        return Number(pickedByLineKey.get(productKey));
      }
      if (!isMultiLine && actualPickedQty !== undefined) return Number(actualPickedQty);
      return lineRequestedQty(line);
    };

    const requestedQty = isMultiLine
      ? lineRows.reduce((sum, line) => sum + lineRequestedQty(line), 0)
      : lineRequestedQty(lineRows[0]);
    const pickedQty =
      actualPickedQty !== undefined && !isMultiLine
        ? Number(actualPickedQty)
        : lineRows.reduce((sum, line) => sum + linePickedQty(line), 0);
    const remainingQty = Math.max(0, requestedQty - pickedQty);

    const allLinesFailed = isMultiLine
      ? lineRows.every((line) => linePickedQty(line) <= 0)
      : pickedQty <= 0;

    if (allLinesFailed) {
      // Seller failed to provide inventory
      pr.status = "seller_failed";
      pr.pickupOtpCode = undefined;
      pr.pickupOtpHash = undefined;
      pr.pickupOtpExpiresAt = undefined;
      pr.pickupOtpVerifiedAt = new Date();
      pr.exceptionReason = "Seller physically didn't have the stock";
      pr.pickupProof = {
        pickedAt: new Date(),
        pickedBy: partnerId,
        vendorImageUrl: uniqueImageUrls[0],
        notes: [
          String(notes || "Seller failed to provide stock"),
          `VENDOR_IMAGES:${uniqueImageUrls.join("|")}`,
        ]
          .filter(Boolean)
          .join("\n"),
        location: { lat: latitude, lng: longitude },
      };
      await savePurchaseRequest(pr);

      if (!pr.orderId) {
        // Standalone manual PR stock release
        try {
          const { releasePurchaseRequestCommitments } = await import("../services/hubOrderOrchestrator.js");
          await releasePurchaseRequestCommitments(pr);

          // Notifications
          const { createNotification } = await import("../services/notificationService.js");
          // Notify admins
          const admins = await mongoose.model("Admin").find({}).select("_id").lean();
          const adminIds = admins.map((a) => a?._id).filter(Boolean);
          if (adminIds.length) {
            const { createNotificationBatch } = await import("../services/notificationService.js");
            await createNotificationBatch(
              adminIds.map((adminId) => ({
                recipient: adminId,
                recipientModel: "Admin",
                title: "Manual PR Pickup Failed",
                message: `Pickup failed for manual PR ${pr.requestId}. Seller lacked stock.`,
                type: "manual_pr_failed",
                data: { purchaseRequestId: pr._id.toString(), requestId: pr.requestId },
              })),
            );
          }
          // Notify Seller of stock release
          await createNotification({
            recipient: pr.vendorId,
            recipientModel: "Seller",
            title: "Inventory Released",
            message: `Stock committed for purchase request ${pr.requestId} has been released due to failed pickup.`,
            type: "manual_pr_inventory_released",
            data: { purchaseRequestId: pr._id.toString() },
          });
        } catch (releaseErr) {
          console.warn("[ManualPR] Failed to release failed pickup commitments:", releaseErr.message);
        }
        return handleResponse(res, 200, "Marked as seller failed.", pr);
      }

      try {
        const { fallbackPurchaseRequest, fallbackPurchaseRequestLine } = await import(
          "../services/purchaseRequestService.js"
        );

        if (isMultiLine) {
          for (const line of lineRows) {
            const lineRemaining = lineRequestedQty(line);
            if (lineRemaining <= 0) continue;
            const allocId = line.allocationId || pr.allocationId || null;
            if (pr.procurementSessionId && allocId) {
              await releaseAllocationSellerStock({
                procurementSessionId: pr.procurementSessionId,
                allocationId: allocId,
                purchaseRequestId: pr._id,
                orderId: pr.orderId || null,
                quantity: lineRemaining,
                eventType: "SELLER_REJECTED",
                reason: "seller_failed_pickup",
                actor: { type: "pickup" },
                transactionId: `pickup_failed:${String(pr._id)}:${String(allocId)}`,
              });
            }
            await fallbackPurchaseRequestLine(
              pr._id,
              line.productId,
              line.variantId || null,
              lineRemaining,
            );
          }
        } else if (pr.procurementSessionId && pr.allocationId) {
          await releaseAllocationSellerStock({
            procurementSessionId: pr.procurementSessionId,
            allocationId: pr.allocationId,
            purchaseRequestId: pr._id,
            orderId: pr.orderId || null,
            eventType: "SELLER_REJECTED",
            reason: "seller_failed_pickup",
            actor: { type: "pickup" },
            transactionId: `pickup_failed:${String(pr._id)}:${String(pr.allocationId)}`,
          });
          await fallbackPurchaseRequest(pr._id, remainingQty);
        }
      } catch (err) {
        console.warn("[Auto Fallback] Failed after seller_failed:", err.message);
      }

      return handleResponse(res, 200, "Marked as seller failed. New PR created.", pr);
    }

    // Normal or partial pickup
    pr.status = "picked";
    pr.pickupOtpCode = undefined;
    pr.pickupOtpHash = undefined;
    pr.pickupOtpExpiresAt = undefined;
    pr.pickupOtpVerifiedAt = new Date();

    // Update quantities (per line for multi-product PRs)
    if (pr.items && pr.items.length > 0) {
      pr.items = pr.items.map((line) => {
        const lineObj = line.toObject ? line.toObject() : line;
        const lineKey = lineObj.itemKey || buildItemKey(lineObj.productId?._id || lineObj.productId, lineObj.variantId);
        const lineRequested = Number(lineObj.committedQty || lineObj.requestedQty || lineObj.shortageQty || 0);
        let linePicked = pickedQty;
        if (isMultiLine) {
          linePicked = pickedByLineKey.has(lineKey)
            ? Number(pickedByLineKey.get(lineKey))
            : lineRequested;
        } else if (actualPickedQty !== undefined) {
          linePicked = Number(actualPickedQty);
        }
        const lineRemaining = Math.max(0, lineRequested - linePicked);
        return {
          ...lineObj,
          actualPickedQty: linePicked,
          remainingQty: lineRemaining,
          lineStatus: linePicked <= 0 ? "rejected" : linePicked < lineRequested ? "partial" : "accepted",
        };
      });
    }

    pr.pickupProof = {
      pickedAt: new Date(),
      pickedBy: partnerId,
      vendorImageUrl: uniqueImageUrls[0],
      notes: [
        String(notes || ""),
        `VENDOR_IMAGES:${uniqueImageUrls.join("|")}`,
      ]
        .filter(Boolean)
        .join("\n"),
      location: { lat: latitude, lng: longitude },
    };
    await savePurchaseRequest(pr);

    if (!pr.orderId) {
      // Standalone manual PR - Release commitment for unpicked quantities only
      try {
        const { releaseSellerCommit } = await import("../services/inventory/inventoryReleaseService.js");
        let releasedAny = false;
        for (const line of pr.items || []) {
          const lineObj = line.toObject ? line.toObject() : line;
          const lineRequested = Number(lineObj.committedQty || lineObj.requestedQty || lineObj.shortageQty || 0);
          const linePicked = Number(lineObj.actualPickedQty || 0);
          const lineRemaining = Math.max(0, lineRequested - linePicked);
          if (lineRemaining > 0 && lineObj.selectedSellerProductId) {
            releasedAny = true;
            await releaseSellerCommit({
              productId: lineObj.selectedSellerProductId,
              variantId: lineObj.variantId || null,
              quantity: lineRemaining,
              sellerId: pr.vendorId,
              reason: "manual_pr_pickup_partial_unfulfilled",
              idempotencyKey: `manual_pr_pickup_partial:${String(pr._id)}:${String(lineObj.productId)}:${lineRemaining}`,
            });
          }
        }

        // Trigger Notifications
        const { createNotification } = await import("../services/notificationService.js");
        const admins = await mongoose.model("Admin").find({}).select("_id").lean();
        const adminIds = admins.map((a) => a?._id).filter(Boolean);
        if (adminIds.length) {
          const { createNotificationBatch } = await import("../services/notificationService.js");
          await createNotificationBatch(
            adminIds.map((adminId) => ({
              recipient: adminId,
              recipientModel: "Admin",
              title: "Manual PR Pickup Completed",
              message: `Pickup completed for manual PR ${pr.requestId}.`,
              type: "manual_pr_pickup_completed",
              data: { purchaseRequestId: pr._id.toString(), requestId: pr.requestId },
            })),
          );
        }
        await createNotification({
          recipient: pr.vendorId,
          recipientModel: "Seller",
          title: "Pickup Completed",
          message: `Pickup has been completed for purchase request ${pr.requestId}.`,
          type: "manual_pr_picked",
          data: { purchaseRequestId: pr._id.toString() },
        });

        if (releasedAny) {
          await createNotification({
            recipient: pr.vendorId,
            recipientModel: "Seller",
            title: "Inventory Released",
            message: `Unpicked stock committed for purchase request ${pr.requestId} has been released.`,
            type: "manual_pr_inventory_released",
            data: { purchaseRequestId: pr._id.toString() },
          });
        }
      } catch (err) {
        console.warn("[ManualPR] Failed manual PR pickup release/notifications:", err.message);
      }
      return handleResponse(res, 200, "Pickup marked successfully", pr);
    }

    // Pickup does not transfer inventory ownership — only release unfulfilled commitment per line.
    try {
      const { fallbackPurchaseRequestLine, fallbackPurchaseRequest } = await import(
        "../services/purchaseRequestService.js"
      );

      for (const item of pr.items || []) {
        const lineObj = item.toObject ? item.toObject() : item;
        const lineRequested = Number(lineObj.requestedQty || lineObj.shortageQty || 0);
        const linePicked = Number(lineObj.actualPickedQty || 0);
        const lineRemaining = Math.max(0, lineRequested - linePicked);
        if (lineRemaining <= 0 || !lineObj.selectedSellerProductId) continue;

        const allocId = lineObj.allocationId || pr.allocationId || null;
        if (pr.procurementSessionId && allocId) {
          await releaseAllocationSellerStock({
            procurementSessionId: pr.procurementSessionId,
            allocationId: allocId,
            purchaseRequestId: pr._id,
            orderId: pr.orderId || null,
            quantity: lineRemaining,
            eventType: "SELLER_REJECTED",
            reason: "pickup_partial_unfulfilled",
            actor: { type: "pickup" },
            transactionId: `pickup_partial:${String(pr._id)}:${String(allocId)}:${lineRemaining}`,
          });
        }

        if (isMultiLine) {
          await fallbackPurchaseRequestLine(
            pr._id,
            lineObj.productId,
            lineObj.variantId || null,
            lineRemaining,
          );
        }
      }

      if (!isMultiLine && remainingQty > 0) {
        await fallbackPurchaseRequest(pr._id, remainingQty);
      }
    } catch (err) {
      console.warn("[InventorySync] Failed pickup partial release/fallback:", err.message);
    }

    return handleResponse(res, 200, "Pickup marked successfully", pr);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const cancelPickupAssignment = async (req, res) => {
  try {
    const partnerId = await resolvePickupPartnerId(req.user);
    if (!partnerId) return handleResponse(res, 403, "No linked PickupPartner account found.");
    const { id } = req.params;
    const { reason } = req.body || {};

    const pr = await PurchaseRequest.findOne({
      _id: id,
      pickupPartnerId: partnerId,
      status: "pickup_assigned",
    });

    if (!pr) {
      return handleResponse(res, 404, "Pickup assignment not found");
    }

    pr.pickupPartnerId = null;
    pr.pickupPartnerName = null;
    pr.pickupOtpCode = undefined;
    pr.pickupOtpHash = undefined;
    pr.pickupOtpExpiresAt = undefined;
    pr.pickupOtpVerifiedAt = undefined;
    pr.status = "pickup_cancelled";
    pr.exceptionReason = String(reason || "Cancelled by delivery partner");
    await savePurchaseRequest(pr);

    if (!pr.orderId) {
      try {
        const { releasePurchaseRequestCommitments } = await import("../services/hubOrderOrchestrator.js");
        await releasePurchaseRequestCommitments(pr);

        // Trigger Notifications
        const { createNotification } = await import("../services/notificationService.js");
        // Notify admins
        const admins = await mongoose.model("Admin").find({}).select("_id").lean();
        const adminIds = admins.map((a) => a?._id).filter(Boolean);
        if (adminIds.length) {
          const { createNotificationBatch } = await import("../services/notificationService.js");
          await createNotificationBatch(
            adminIds.map((adminId) => ({
              recipient: adminId,
              recipientModel: "Admin",
              title: "Manual PR Pickup Cancelled",
              message: `Pickup assignment was cancelled for manual PR ${pr.requestId}.`,
              type: "manual_pr_pickup_cancelled",
              data: { purchaseRequestId: pr._id.toString(), requestId: pr.requestId },
            })),
          );
        }
        // Notify Seller of cancellation and stock release
        await createNotification({
          recipient: pr.vendorId,
          recipientModel: "Seller",
          title: "Pickup Cancelled",
          message: `Pickup assignment was cancelled for purchase request ${pr.requestId}.`,
          type: "manual_pr_pickup_cancelled",
          data: { purchaseRequestId: pr._id.toString() },
        });
        await createNotification({
          recipient: pr.vendorId,
          recipientModel: "Seller",
          title: "Inventory Released",
          message: `Stock committed for purchase request ${pr.requestId} has been released due to pickup cancellation.`,
          type: "manual_pr_inventory_released",
          data: { purchaseRequestId: pr._id.toString() },
        });
      } catch (err) {
        console.warn("[ManualPR] Failed manual PR pickup cancel stock release/notifications:", err.message);
      }
      return handleResponse(res, 200, "Assignment cancelled successfully");
    }

    // Reassignment stays with existing admin/procurement pickup-assign flow.
    // Pickup module does not call procurement controllers.

    return handleResponse(res, 200, "Assignment cancelled successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const markAssignmentHubDelivered = async (req, res) => {
  try {
    const partnerId = await resolvePickupPartnerId(req.user);
    if (!partnerId) return handleResponse(res, 403, "No linked PickupPartner account found.");
    const { id } = req.params;
    const { lat, lng, notes, hubImageUrl } = req.body || {};
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return handleResponse(res, 400, "Valid lat/lng required");
    }
    if (!hubImageUrl || !String(hubImageUrl).trim()) {
      return handleResponse(res, 400, "Hub drop image is required");
    }

    const pr = await PurchaseRequest.findOne({
      _id: id,
      pickupPartnerId: partnerId,
      status: "picked",
    });

    if (!pr) {
      return handleResponse(res, 404, "Picked assignment not found");
    }

    const hubLat = parseHubCoordinate("HUB_LOCATION_LAT", "HUB_LAT", "DEFAULT_HUB_LAT");
    const hubLng = parseHubCoordinate("HUB_LOCATION_LNG", "HUB_LNG", "DEFAULT_HUB_LNG");
    if (Number.isFinite(hubLat) && Number.isFinite(hubLng)) {
      const d = distanceMeters(latitude, longitude, hubLat, hubLng);
      if (d > HUB_RADIUS_M) {
        return handleResponse(res, 400, `Too far from hub (>${HUB_RADIUS_M}m)`);
      }
    }

    pr.status = "hub_delivered";
    pr.hubDropProof = {
      droppedAt: new Date(),
      droppedBy: partnerId,
      hubImageUrl: String(hubImageUrl || ""),
      notes: String(notes || ""),
      location: { lat: latitude, lng: longitude },
    };
    await savePurchaseRequest(pr);

    // --- CALCULATE EARNINGS ---
    try {
      const partner = await PickupPartner.findById(partnerId);
      if (partner) {
        let earnings = 0;
        if (partner.paymentType === "per_trip") {
          // Calculate distance between Vendor and Hub
          const prPopulated = await PurchaseRequest.findById(id).populate("vendorId", "location");
          const vCoords = prPopulated.vendorId?.location?.coordinates;
          if (Array.isArray(vCoords) && vCoords.length >= 2) {
            const [vlng, vlat] = vCoords;
            const distanceKm = distanceMeters(latitude, longitude, vlat, vlng) / 1000;
            earnings = partner.baseTripRate + (distanceKm * partner.perKmRate);
          } else {
            earnings = partner.baseTripRate; // Fallback to base rate
          }
        }
        // For 'salary' based partners, we don't add to wallet balance automatically per trip,
        // or we can add a 'bonus' if desired. For now, we only auto-credit per_trip partners.

        if (earnings > 0) {
          partner.walletBalance = (partner.walletBalance || 0) + earnings;
          await partner.save();
          console.log(`[Payout] Credited ₹${earnings.toFixed(2)} to Pickup Partner ${partnerId} (Type: ${partner.paymentType})`);
        }
      }
    } catch (err) {
      console.warn("[Payout] Failed to calculate earnings:", err.message);
    }

    return handleResponse(res, 200, "Marked delivered at hub", pr);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const requestPickupWithdrawal = async (req, res) => {
  try {
    const partnerId = req.user?.id;
    const { amount, notes } = req.body || {};
    const reqAmount = Number(amount);

    if (!reqAmount || reqAmount <= 0) {
      return handleResponse(res, 400, "Valid amount required");
    }

    const partner = await PickupPartner.findById(partnerId);
    if (!partner) return handleResponse(res, 404, "Partner not found");

    if ((partner.walletBalance || 0) < reqAmount) {
      return handleResponse(res, 400, "Insufficient wallet balance");
    }

    // Use dynamic import for Transaction to avoid circular deps if any
    const Transaction = (await import("../models/transaction.js")).default;

    // Create Pending Withdrawal Transaction
    const txn = await Transaction.create({
      user: partnerId,
      userModel: "PickupPartner",
      type: "Withdrawal",
      amount: -reqAmount, // Negative because money is going out
      status: "Pending",
      reference: `WITHDRAW-${partnerId.slice(-4)}-${Date.now()}`,
      meta: { notes, requestedAt: new Date() }
    });

    // Deduct from balance
    partner.walletBalance = (partner.walletBalance || 0) - reqAmount;
    await partner.save();

    return handleResponse(res, 201, "Withdrawal request submitted", txn);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getMyWithdrawals = async (req, res) => {
  try {
    const partnerId = req.user?.id;
    const Transaction = (await import("../models/transaction.js")).default;

    const rows = await Transaction.find({
      user: partnerId,
      userModel: "PickupPartner",
      type: "Withdrawal"
    }).sort({ createdAt: -1 }).lean();

    return handleResponse(res, 200, "Withdrawals fetched", { items: rows });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const uploadPickupProofImage = async (req, res) => {
  try {
    const partnerId = req.user?.id;
    if (!partnerId) return handleResponse(res, 401, "Unauthorized");

    const { type = "vendor" } = req.query || {};
    const normalized = String(type || "vendor").toLowerCase();
    const folder = normalized === "hub" ? "pickup_hub_proofs" : "pickup_vendor_proofs";

    if (!req.file?.buffer) {
      return handleResponse(res, 400, "image file is required");
    }

    const url = await uploadToCloudinary(req.file.buffer, folder);
    return handleResponse(res, 200, "Uploaded", { url });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
