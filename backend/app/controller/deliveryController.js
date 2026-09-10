import Order from "../models/order.js";
import { orderMatchQueryFromRouteParam } from "../utils/orderLookup.js";
import Transaction from "../models/transaction.js";
import Delivery from "../models/delivery.js";
import DeliveryAssignment from "../models/deliveryAssignment.js";
import handleResponse from "../utils/helper.js";
import mongoose from "mongoose";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { writeDeliveryLocation, appendTrailPoint } from "../services/firebaseService.js";
import { getRedisClient } from "../config/redis.js";
import { distanceMeters } from "../utils/geoUtils.js";
import { transitionOrderFulfillment } from "../services/fulfillmentWorkflowEngine.js";
import {
  recordDeliveryAudit,
  maybeRecordGpsSnapshot,
} from "../services/deliveryAuditService.js";
import { advanceTripOnOrderDelivered } from "../services/deliveryTripService.js";
import { calculateDeliveryBoyEarning } from "../utils/deliveryFeeUtil.js";
import { getSettings } from "../services/settingsService.js";
import {
  computeEarningsWalletBalance,
  computeCashWalletBalance,
  getDeliveryWalletSummary as buildDeliveryWalletSummary,
} from "../services/deliveryWalletService.js";

const LOC_MIN_INTERVAL_MS = () =>
  parseInt(process.env.LOCATION_MIN_INTERVAL_MS || "3000", 10);
const LOC_MIN_MOVE_M = () =>
  parseInt(process.env.LOCATION_MIN_MOVE_METERS || "20", 10);

async function throttleLocationUpdate(deliveryId, lat, lng) {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    const key = `loc:last:${deliveryId}`;
    const raw = await redis.get(key);
    const now = Date.now();
    if (raw) {
      const prev = JSON.parse(raw);
      const dt = now - prev.t;
      const d = distanceMeters(lat, lng, prev.lat, prev.lng);
      if (dt < LOC_MIN_INTERVAL_MS() && d < LOC_MIN_MOVE_M()) {
        return true;
      }
    }
    await redis.set(
      key,
      JSON.stringify({ lat, lng, t: now }),
      "EX",
      3600,
    );
  } catch {
    return false;
  }
  return false;
}

/* ===============================
   GET DELIVERY DASHBOARD STATS
================================ */
export const getDeliveryStats = async (req, res) => {
    try {
        const deliveryBoyId = new mongoose.Types.ObjectId(req.user.id);

        const totalDeliveries = await Order.countDocuments({ deliveryBoy: deliveryBoyId, status: 'delivered' });

        // Today's earnings - Using a more robust date check
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const allTransactions = await Transaction.find({
            user: deliveryBoyId,
            userModel: 'Delivery',
            createdAt: { $gte: startOfToday }
        })
            .select('status type amount')
            .lean();

        const todayEarnings = allTransactions
            .filter(t => t.status === 'Settled' && (t.type === 'Delivery Earning' || t.type === 'Incentive' || t.type === 'Bonus'))
            .reduce((acc, t) => acc + t.amount, 0);

        const incentives = allTransactions
            .filter(t => t.status === 'Settled' && (t.type === 'Incentive' || t.type === 'Bonus'))
            .reduce((acc, t) => acc + t.amount, 0);

        // All-time cash collected logic
        const cashTransactions = await Transaction.find({
            user: deliveryBoyId,
            userModel: 'Delivery',
            type: { $in: ['Cash Collection', 'Cash Settlement'] }
        })
            .select('type amount')
            .lean();

        const cashCollected = cashTransactions.reduce((acc, t) => {
            return t.type === 'Cash Collection' ? acc + t.amount : acc - Math.abs(t.amount);
        }, 0);

        return handleResponse(res, 200, "Stats fetched", {
            today: todayEarnings,
            deliveries: totalDeliveries,
            incentives,
            cashCollected
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET DELIVERY EARNINGS
================================ */
export const getDeliveryEarnings = async (req, res) => {
    try {
        const deliveryBoyId = new mongoose.Types.ObjectId(req.user.id);
        const { period = "weekly" } = req.query;
        const normalizedPeriod = String(period).toLowerCase();

        const now = new Date();
        let startDate;
        let chartData = [];

        if (normalizedPeriod === "today") {
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);

            const [allPeriodTransactions, hourlyAggregation] = await Promise.all([
                Transaction.find({
                    user: deliveryBoyId,
                    userModel: "Delivery",
                    createdAt: { $gte: startDate }
                }).sort({ createdAt: -1 }).populate("order", "orderId pricing").lean(),
                Transaction.aggregate([
                    {
                        $match: {
                            user: deliveryBoyId,
                            userModel: "Delivery",
                            status: "Settled",
                            createdAt: { $gte: startDate },
                            type: { $in: ["Delivery Earning", "Incentive", "Bonus"] }
                        }
                    },
                    {
                        $group: {
                            _id: { $hour: "$createdAt" },
                            amount: { $sum: "$amount" }
                        }
                    }
                ])
            ]);

            const slots = [
                { label: "12-4 AM", hours: [0, 1, 2, 3] },
                { label: "4-8 AM", hours: [4, 5, 6, 7] },
                { label: "8-12 PM", hours: [8, 9, 10, 11] },
                { label: "12-4 PM", hours: [12, 13, 14, 15] },
                { label: "4-8 PM", hours: [16, 17, 18, 19] },
                { label: "8-12 AM", hours: [20, 21, 22, 23] },
            ];

            chartData = slots.map((slot) => {
                const total = slot.hours.reduce((acc, h) => {
                    const match = hourlyAggregation.find((item) => item._id === h);
                    return acc + (match ? match.amount : 0);
                }, 0);
                return { name: slot.label, earnings: total, incentives: 0 };
            });

            const totalEarnings = allPeriodTransactions
                .filter((t) => t.status === "Settled" && (t.type === "Delivery Earning" || t.type === "Incentive" || t.type === "Bonus"))
                .reduce((acc, t) => acc + t.amount, 0);

            const onlinePay = allPeriodTransactions
                .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
                .reduce((acc, t) => acc + t.amount, 0);

            const incentives = allPeriodTransactions
                .filter((t) => (t.type === "Incentive" || t.type === "Bonus") && t.status === "Settled")
                .reduce((acc, t) => acc + t.amount, 0);

            const cashTransactions = allPeriodTransactions.filter((t) => t.status === "Settled" && (t.type === "Cash Collection" || t.type === "Cash Settlement"));
            const cashCollected = cashTransactions.reduce((acc, t) => {
                return t.type === "Cash Collection" ? acc + t.amount : acc - Math.abs(t.amount);
            }, 0);

            return handleResponse(res, 200, "Earnings fetched", {
                period: "today",
                totalEarnings,
                onlinePay,
                incentives,
                bonuses: 0,
                cashCollected,
                chartData,
                transactions: allPeriodTransactions.slice(0, 20)
            });
        } else if (normalizedPeriod === "monthly") {
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);

            const [allPeriodTransactions, dailyAggregation] = await Promise.all([
                Transaction.find({
                    user: deliveryBoyId,
                    userModel: "Delivery",
                    createdAt: { $gte: startDate }
                }).sort({ createdAt: -1 }).populate("order", "orderId pricing").lean(),
                Transaction.aggregate([
                    {
                        $match: {
                            user: deliveryBoyId,
                            userModel: "Delivery",
                            status: "Settled",
                            createdAt: { $gte: startDate },
                            type: { $in: ["Delivery Earning", "Incentive", "Bonus"] }
                        }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            amount: { $sum: "$amount" }
                        }
                    }
                ])
            ]);

            const weeks = [
                { label: "W1", daysAgoStart: 30, daysAgoEnd: 22 },
                { label: "W2", daysAgoStart: 21, daysAgoEnd: 15 },
                { label: "W3", daysAgoStart: 14, daysAgoEnd: 8 },
                { label: "W4", daysAgoStart: 7, daysAgoEnd: 0 },
            ];

            chartData = weeks.map((w) => {
                let total = 0;
                for (let i = w.daysAgoStart; i >= w.daysAgoEnd; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().split("T")[0];
                    const found = dailyAggregation.find((a) => a._id === dateStr);
                    if (found) total += found.amount;
                }
                return { name: w.label, earnings: total, incentives: 0 };
            });

            const totalEarnings = allPeriodTransactions
                .filter((t) => t.status === "Settled" && (t.type === "Delivery Earning" || t.type === "Incentive" || t.type === "Bonus"))
                .reduce((acc, t) => acc + t.amount, 0);

            const onlinePay = allPeriodTransactions
                .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
                .reduce((acc, t) => acc + t.amount, 0);

            const incentives = allPeriodTransactions
                .filter((t) => (t.type === "Incentive" || t.type === "Bonus") && t.status === "Settled")
                .reduce((acc, t) => acc + t.amount, 0);

            const cashTransactions = allPeriodTransactions.filter((t) => t.status === "Settled" && (t.type === "Cash Collection" || t.type === "Cash Settlement"));
            const cashCollected = cashTransactions.reduce((acc, t) => {
                return t.type === "Cash Collection" ? acc + t.amount : acc - Math.abs(t.amount);
            }, 0);

            return handleResponse(res, 200, "Earnings fetched", {
                period: "monthly",
                totalEarnings,
                onlinePay,
                incentives,
                bonuses: 0,
                cashCollected,
                chartData,
                transactions: allPeriodTransactions.slice(0, 20)
            });
        } else {
            // Weekly (Last 7 Days)
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);

            const [allPeriodTransactions, dailyAggregation] = await Promise.all([
                Transaction.find({
                    user: deliveryBoyId,
                    userModel: "Delivery",
                    createdAt: { $gte: startDate }
                }).sort({ createdAt: -1 }).populate("order", "orderId pricing").lean(),
                Transaction.aggregate([
                    {
                        $match: {
                            user: deliveryBoyId,
                            userModel: "Delivery",
                            status: "Settled",
                            createdAt: { $gte: startDate },
                            type: { $in: ["Delivery Earning", "Incentive", "Bonus"] }
                        }
                    },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            amount: { $sum: "$amount" }
                        }
                    },
                    { $sort: { _id: 1 } }
                ])
            ]);

            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            chartData = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split("T")[0];
                const foundAt = dailyAggregation.find((a) => a._id === dateStr);
                chartData.push({
                    name: dayNames[d.getDay()],
                    earnings: foundAt ? foundAt.amount : 0,
                    incentives: 0
                });
            }

            const totalEarnings = allPeriodTransactions
                .filter((t) => t.status === "Settled" && (t.type === "Delivery Earning" || t.type === "Incentive" || t.type === "Bonus"))
                .reduce((acc, t) => acc + t.amount, 0);

            const onlinePay = allPeriodTransactions
                .filter((t) => t.type === "Delivery Earning" && t.status === "Settled")
                .reduce((acc, t) => acc + t.amount, 0);

            const incentives = allPeriodTransactions
                .filter((t) => (t.type === "Incentive" || t.type === "Bonus") && t.status === "Settled")
                .reduce((acc, t) => acc + t.amount, 0);

            const cashTransactions = allPeriodTransactions.filter((t) => t.status === "Settled" && (t.type === "Cash Collection" || t.type === "Cash Settlement"));
            const cashCollected = cashTransactions.reduce((acc, t) => {
                return t.type === "Cash Collection" ? acc + t.amount : acc - Math.abs(t.amount);
            }, 0);

            return handleResponse(res, 200, "Earnings fetched", {
                period: "weekly",
                totalEarnings,
                onlinePay,
                incentives,
                bonuses: 0,
                cashCollected,
                chartData,
                transactions: allPeriodTransactions.slice(0, 20)
            });
        }
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET DELIVERY ORDER HISTORY
================================ */
/**
 * Any order this rider was linked to: primary assignment, return pickup, or v2 broadcast winner.
 */
async function buildAssignedToPartnerFilter(deliveryBoyId) {
    const clauses = [
        { deliveryBoy: deliveryBoyId },
        { returnDeliveryBoy: deliveryBoyId },
    ];
    try {
        const winnerOrderIds = await DeliveryAssignment.distinct("orderId", {
            winnerDeliveryId: deliveryBoyId,
        });
        if (winnerOrderIds?.length) {
            clauses.push({ orderId: { $in: winnerOrderIds } });
        }
    } catch {
        /* ignore */
    }
    return { $or: clauses };
}

export const getMyDeliveryOrders = async (req, res) => {
    try {
        const rawId = req.user?.id ?? req.user?._id;
        if (!rawId) {
            return handleResponse(res, 401, "Unauthorized");
        }
        if (!mongoose.Types.ObjectId.isValid(String(rawId))) {
            return handleResponse(res, 401, "Invalid user id");
        }
        const deliveryBoyId = new mongoose.Types.ObjectId(String(rawId));
        const { status } = req.query;
        const normalized = (status || "all").toLowerCase();

        const assignedToPartner = await buildAssignedToPartnerFilter(deliveryBoyId);

        /** v2 orders use workflowStatus; legacy uses status — both must be respected. */
        let query;
        if (normalized === "delivered") {
            query = {
                $and: [
                    assignedToPartner,
                    {
                        $or: [
                            { status: "delivered" },
                            { workflowStatus: WORKFLOW_STATUS.DELIVERED },
                        ],
                    },
                ],
            };
        } else if (normalized === "cancelled") {
            query = {
                $and: [
                    assignedToPartner,
                    {
                        $or: [
                            { status: "cancelled" },
                            { workflowStatus: WORKFLOW_STATUS.CANCELLED },
                        ],
                    },
                ],
            };
        } else if (normalized === "returns") {
            query = {
                returnStatus: { $ne: "none" },
                $or: [
                    { deliveryBoy: deliveryBoyId },
                    { returnDeliveryBoy: deliveryBoyId },
                ],
            };
        } else if (normalized === "active") {
            query = {
                $and: [
                    assignedToPartner,
                    { status: { $nin: ["delivered", "cancelled"] } },
                    { workflowStatus: { $nin: ["DELIVERED", "CANCELLED"] } }
                ]
            };
        } else {
            query = assignedToPartner;
        }

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("seller", "shopName address")
            .populate("customer", "name phone")
            .lean();

        const settings = await getSettings();
        for (const o of orders) {
            o.deliveryBoyPayout = await calculateDeliveryBoyEarning(o, settings);
        }

        return handleResponse(res, 200, "Delivery orders fetched", orders);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   REQUEST WITHDRAWAL (Delivery — Earnings Wallet)
================================ */
export const requestWithdrawal = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const deliveryBoyId = req.user.id;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return handleResponse(res, 400, "Please enter a valid amount");
        }

        let withdrawal;
        await session.withTransaction(async () => {
            // Earnings wallet only — cash collected from customers is admin's
            // money and must never be withdrawable as if it were a payout.
            const availableBalance = await computeEarningsWalletBalance(deliveryBoyId, {
                includePending: true,
                session,
            });

            if (amount > availableBalance) {
                const err = new Error(`Insufficient balance. Available: ₹${availableBalance}`);
                err.statusCode = 400;
                throw err;
            }

            const created = await Transaction.create(
                [
                    {
                        user: deliveryBoyId,
                        userModel: "Delivery",
                        type: "Withdrawal",
                        amount: -Math.abs(amount),
                        status: "Pending",
                        reference: `WDR-DL-${Date.now()}-${deliveryBoyId}`,
                    },
                ],
                { session },
            );
            withdrawal = created[0];
        });

        return handleResponse(res, 201, "Withdrawal request submitted successfully", withdrawal);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    } finally {
        session.endSession();
    }
};

/* ===============================
   REQUEST CASH REMITTANCE (Delivery — Cash Collection Wallet -> Admin)
================================ */
export const requestCashRemittance = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const deliveryBoyId = req.user.id;
        const { amount, mode } = req.body;

        if (!amount || amount <= 0) {
            return handleResponse(res, 400, "Please enter a valid amount");
        }
        const normalizedMode = mode === "Online" ? "Online" : "Cash";

        let remittance;
        await session.withTransaction(async () => {
            const availableToRemit = await computeCashWalletBalance(deliveryBoyId, {
                includePending: true,
                session,
            });

            if (amount > availableToRemit) {
                const err = new Error(`Amount exceeds your cash collection balance. Available: ₹${availableToRemit}`);
                err.statusCode = 400;
                throw err;
            }

            const created = await Transaction.create(
                [
                    {
                        user: deliveryBoyId,
                        userModel: "Delivery",
                        type: "Cash Settlement",
                        amount: -Math.abs(amount),
                        status: "Pending",
                        reference: `CSH-REQ-${Date.now()}-${deliveryBoyId}`,
                        meta: { mode: normalizedMode, initiatedBy: "delivery" },
                        notes: `Method: ${normalizedMode}`,
                    },
                ],
                { session },
            );
            remittance = created[0];
        });

        return handleResponse(res, 201, "Transfer request submitted successfully. Waiting for admin approval.", remittance);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    } finally {
        session.endSession();
    }
};

/* ===============================
   GET WALLET SUMMARY (Delivery — both wallets, today's cash, limit progress)
================================ */
export const getDeliveryWalletSummary = async (req, res) => {
    try {
        const deliveryBoyId = req.user.id;
        const summary = await buildDeliveryWalletSummary(deliveryBoyId);
        return handleResponse(res, 200, "Wallet summary fetched", summary);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   UPDATE LIVE LOCATION (Delivery)
================================ */
export const updateDeliveryLocation = async (req, res) => {
    try {
        const deliveryId = req.user.id;
        const { lat, lng, accuracy, heading, speed, orderId } = req.body || {};

        if (
            typeof lat !== "number" ||
            typeof lng !== "number" ||
            Number.isNaN(lat) ||
            Number.isNaN(lng)
        ) {
            return handleResponse(res, 400, "Valid numeric lat and lng are required");
        }

        const throttled = await throttleLocationUpdate(deliveryId, lat, lng);
        if (throttled) {
            return handleResponse(res, 200, "Location update throttled", {
                throttled: true,
            });
        }

        // Normalize to [lng, lat] as required by GeoJSON
        const coordinates = [Number(lng), Number(lat)];

        const delivery = await Delivery.findByIdAndUpdate(
            deliveryId,
            {
                $set: {
                    location: {
                        type: "Point",
                        coordinates,
                    },
                    lastLocationAt: new Date(),
                },
            },
            { new: true }
        ).select("_id location isOnline");

        if (!delivery) {
            return handleResponse(res, 404, "Delivery partner not found");
        }

        // If orderId is provided, verify this rider is assigned; otherwise auto-detect active order
        let activeOrderId = orderId || null;
        if (orderId) {
            const orderKey = orderMatchQueryFromRouteParam(orderId);
            const order = orderKey
                ? await Order.findOne(orderKey).select(
                      "orderId deliveryBoy workflowStatus workflowVersion",
                  )
                : null;
            if (!order || order.deliveryBoy?.toString() !== deliveryId) {
                activeOrderId = null;
            } else {
                activeOrderId = order.orderId;
            }
        }

        if (!activeOrderId) {
            const activeOrder = await Order.findOne({
                deliveryBoy: deliveryId,
                status: { $in: ["confirmed", "packed", "out_for_delivery", "assigned", "picked"] },
            })
            .sort({ updatedAt: -1 })
            .select("orderId");

            if (activeOrder) {
                activeOrderId = activeOrder.orderId;
            }
        }

        const snapshot = {
            lat,
            lng,
            accuracy: typeof accuracy === "number" ? accuracy : undefined,
            heading: typeof heading === "number" ? heading : undefined,
            speed: typeof speed === "number" ? speed : undefined,
            lastUpdatedAt: new Date().toISOString(),
            deliveryId,
            orderId: activeOrderId,
        };

        // Fan out to Firebase (no-op until fully wired) and keep a short trail
        await writeDeliveryLocation(deliveryId, activeOrderId, snapshot);
        if (activeOrderId) {
            await appendTrailPoint(activeOrderId, {
                lat,
                lng,
                t: Date.now(),
            });
            await maybeRecordGpsSnapshot(activeOrderId, deliveryId, {
                lat,
                lng,
                accuracy: typeof accuracy === "number" ? accuracy : undefined,
                heading: typeof heading === "number" ? heading : undefined,
                speed: typeof speed === "number" ? speed : undefined,
            });
        }

        return handleResponse(res, 200, "Location updated", {
            location: delivery.location,
            activeOrderId,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};


/* ===============================
   GENERATE DELIVERY OTP
================================ */
export const generateDeliveryOtp = async (req, res) => {
    try {
        const { orderId } = req.params;
        let { location } = req.body || {};
        const deliveryBoyId = req.user.id;

        // If location is not provided in request body, fetch from database
        if (!location) {
            const delivery = await Delivery.findById(deliveryBoyId).select('location lastLocationAt');
            
            if (!delivery) {
                return handleResponse(res, 404, "Delivery person not found", {
                    error: {
                        code: "DELIVERY_NOT_FOUND",
                        message: "Delivery person not found"
                    }
                });
            }

            // Extract coordinates from GeoJSON format [lng, lat]
            const coords = delivery.location?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) {
                return handleResponse(res, 400, "Location not available", {
                    error: {
                        code: "LOCATION_REQUIRED",
                        message: "Your location is not available. Please ensure location tracking is enabled."
                    }
                });
            }

            const [lng, lat] = coords;

            // Validate stored location is not default [0, 0]
            if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) {
                return handleResponse(res, 400, "Location not available", {
                    error: {
                        code: "LOCATION_REQUIRED",
                        message: "Your location is not available. Please ensure location tracking is enabled."
                    }
                });
            }

            // Validate lastLocationAt is recent (within last 5 minutes)
            if (!delivery.lastLocationAt) {
                return handleResponse(res, 400, "Location data is stale", {
                    error: {
                        code: "LOCATION_STALE",
                        message: "Your location data is not available. Please ensure location tracking is enabled."
                    }
                });
            }

            const locationAge = Date.now() - delivery.lastLocationAt.getTime();
            const fiveMinutes = 5 * 60 * 1000;
            if (locationAge > fiveMinutes) {
                return handleResponse(res, 400, "Location data is stale", {
                    error: {
                        code: "LOCATION_STALE",
                        message: "Your location data is outdated. Please ensure location tracking is enabled and try again."
                    }
                });
            }

            // Use stored location
            location = { lat, lng };
        } else {
            // Validate provided location data
            if (typeof location !== 'object') {
                return handleResponse(res, 400, "Invalid location data", {
                    error: {
                        code: "LOCATION_REQUIRED",
                        message: "Valid location data with lat and lng is required"
                    }
                });
            }

            if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
                return handleResponse(res, 400, "Invalid location coordinates", {
                    error: {
                        code: "LOCATION_REQUIRED",
                        message: "Location must have numeric lat and lng properties"
                    }
                });
            }

            // Validate coordinates are within valid ranges
            if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
                return handleResponse(res, 400, "Invalid location coordinates", {
                    error: {
                        code: "LOCATION_REQUIRED",
                        message: "Latitude must be between -90 and 90, longitude between -180 and 180"
                    }
                });
            }
        }

        // Find the order and verify it's assigned to this delivery person
        const orderKey = orderMatchQueryFromRouteParam(orderId);
        if (!orderKey) {
            return handleResponse(res, 404, "Order not found", {
                error: {
                    code: "ORDER_NOT_FOUND",
                    message: "Order not found"
                }
            });
        }

        const order = await Order.findOne(orderKey).populate('customer', 'name phone');
        if (!order) {
            return handleResponse(res, 404, "Order not found", {
                error: {
                    code: "ORDER_NOT_FOUND",
                    message: "Order not found"
                }
            });
        }

        // Verify the order is assigned to this delivery person
        if (order.deliveryBoy?.toString() !== deliveryBoyId) {
            return handleResponse(res, 404, "Order not found or not assigned to you", {
                error: {
                    code: "UNAUTHORIZED_DELIVERY",
                    message: "This order is not assigned to you"
                }
            });
        }

        // Import the service dynamically to avoid circular dependencies
        const { generateDeliveryOtp: generateOtp } = await import('../services/deliveryOtpService.js');
        
        // Generate OTP with proximity validation
        const result = await generateOtp(order.orderId, location);

        if (!result.success) {
            // Determine appropriate status code based on error
            let statusCode = 500;
            let errorCode = "GENERATION_FAILED";

            if (result.error.includes('proximity') || result.error.includes('distance')) {
                statusCode = 403;
                errorCode = "PROXIMITY_OUT_OF_RANGE";
            } else if (result.error.includes('not found')) {
                statusCode = 404;
                errorCode = "ORDER_NOT_FOUND";
            } else if (result.error.includes('location')) {
                statusCode = 400;
                errorCode = "LOCATION_REQUIRED";
            }

            return handleResponse(res, statusCode, result.error, {
                error: {
                    code: errorCode,
                    message: result.error
                }
            });
        }

        // Emit Socket.IO event to customer
        try {
            const { getIO } = await import('../socket/socketManager.js');
            const io = getIO();
            
            const otpPayload = {
                orderId: order.orderId,
                otp: result.otp,
                expiresAt: result.expiresAt,
                deliveryPersonNearby: true
            };

            console.log('[generateDeliveryOtp] Emitting delivery:otp:generated event:', otpPayload);
            console.log('[generateDeliveryOtp] Customer ID:', order.customer?._id || order.customer);
            console.log('[generateDeliveryOtp] Order ID:', order.orderId);
            
            // Emit to customer's room
            const customerId = order.customer?._id || order.customer;
            if (customerId) {
                const customerRoom = `customer:${customerId}`;
                console.log('[generateDeliveryOtp] Emitting to customer room:', customerRoom);
                io.to(customerRoom).emit('delivery:otp:generated', otpPayload);
            }

            // Also emit to order room in case customer is listening there
            const orderRoom = `order:${order.orderId}`;
            console.log('[generateDeliveryOtp] Emitting to order room:', orderRoom);
            io.to(orderRoom).emit('delivery:otp:generated', otpPayload);
            
            console.log('[generateDeliveryOtp] Socket.IO events emitted successfully');
        } catch (socketError) {
            console.error('[generateDeliveryOtp] Error emitting Socket.IO event:', socketError);
            // Don't fail the request if socket emission fails
        }

        // Send Push Notification directly to customer so they see OTP on their phone screen even if the app is closed
        try {
            const { createNotification } = await import('../services/notificationService.js');
            const customerId = order.customer?._id || order.customer;
            if (customerId) {
                await createNotification({
                    recipient: customerId,
                    recipientModel: "User",
                    title: `Delivery OTP: ${result.otp}`,
                    message: `Your OTP for Order #${order.orderId} is ${result.otp}. Share this code with the delivery partner to receive your order.`,
                    type: "order",
                    category: "order",
                    priority: 10,
                    channel: "both",
                    deepLink: `/orders/${order.orderId}`,
                    data: {
                        orderId: order.orderId,
                        mongoOrderId: order._id ? order._id.toString() : "",
                        otp: String(result.otp),
                        type: "delivery_otp",
                        expiresAt: result.expiresAt ? new Date(result.expiresAt).toISOString() : "",
                    },
                });
                console.log(`[generateDeliveryOtp] Dispatched push notification OTP (${result.otp}) to customer ${customerId}`);
            }
        } catch (notifyErr) {
            console.warn('[generateDeliveryOtp] Push notification dispatch failed:', notifyErr.message);
        }

        await recordDeliveryAudit({
            orderId: order.orderId,
            orderRef: order._id,
            deliveryBoy: deliveryBoyId,
            event: "nearby",
            metadata: { source: "otp_generate" },
            gpsSnapshot: location ? { lat: location.lat, lng: location.lng } : null,
        });
        await recordDeliveryAudit({
            orderId: order.orderId,
            orderRef: order._id,
            deliveryBoy: deliveryBoyId,
            event: "reached_customer",
            metadata: { source: "otp_generate" },
        });

        return handleResponse(res, 200, "OTP generated and sent to customer", {
            success: true,
            data: {
                otpGenerated: true,
                expiresAt: result.expiresAt,
                attemptsRemaining: 3
            }
        });
    } catch (error) {
        console.error('Error in generateDeliveryOtp controller:', error);
        return handleResponse(res, 500, "Failed to generate OTP", {
            error: {
                code: "GENERATION_FAILED",
                message: error.message
            }
        });
    }
};

/* ===============================
   VALIDATE DELIVERY OTP
================================ */
export const validateDeliveryOtp = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { otp } = req.body;
        const deliveryBoyId = req.user.id;

        // Validate OTP format in request body
        if (!otp || typeof otp !== 'string') {
            return handleResponse(res, 400, "OTP is required", {
                error: {
                    code: "OTP_INVALID_FORMAT",
                    message: "OTP must be a 4-digit string"
                }
            });
        }

        // Validate OTP format: exactly 4 digits
        const otpPattern = /^\d{4}$/;
        if (!otpPattern.test(otp)) {
            return handleResponse(res, 400, "Invalid OTP format", {
                error: {
                    code: "OTP_INVALID_FORMAT",
                    message: "OTP must be exactly 4 digits"
                }
            });
        }

        // Find the order and verify it's assigned to this delivery person
        const orderKey = orderMatchQueryFromRouteParam(orderId);
        if (!orderKey) {
            return handleResponse(res, 404, "Order not found", {
                error: {
                    code: "ORDER_NOT_FOUND",
                    message: "Order not found"
                }
            });
        }

        const order = await Order.findOne(orderKey).populate('customer', 'name phone');
        if (!order) {
            return handleResponse(res, 404, "Order not found", {
                error: {
                    code: "ORDER_NOT_FOUND",
                    message: "Order not found"
                }
            });
        }

        // Verify the order is assigned to this delivery person
        if (order.deliveryBoy?.toString() !== deliveryBoyId) {
            return handleResponse(res, 404, "Order not found or not assigned to you", {
                error: {
                    code: "UNAUTHORIZED_DELIVERY",
                    message: "This order is not assigned to you"
                }
            });
        }

        // Import the service dynamically to avoid circular dependencies
        const { validateDeliveryOtp: validateOtp } = await import('../services/deliveryOtpService.js');

        // Validate OTP
        const result = await validateOtp(order.orderId, otp);

        if (!result.valid) {
            // Determine appropriate status code based on error
            let statusCode = 500;

            if (result.error === 'INVALID_FORMAT' || result.error === 'OTP_INVALID_FORMAT') {
                statusCode = 400;
            } else if (result.error === 'OTP_EXPIRED') {
                statusCode = 401;
            } else if (result.error === 'OTP_MISMATCH') {
                statusCode = 403;
            } else if (result.error === 'OTP_NOT_FOUND') {
                statusCode = 404;
            } else if (result.error === 'MAX_ATTEMPTS_EXCEEDED') {
                statusCode = 423;
            }

            return handleResponse(res, statusCode, result.message, {
                error: {
                    code: result.error,
                    message: result.message,
                    attemptsRemaining: result.attemptsRemaining
                }
            });
        }

        // OTP validated successfully - update order status to delivered
        const now = new Date();

        // Get current delivery location for recording
        const delivery = await Delivery.findById(deliveryBoyId).select('location');
        const validationLocation = delivery?.location?.coordinates
            ? { lng: delivery.location.coordinates[0], lat: delivery.location.coordinates[1] }
            : null;

        // Update order status
        transitionOrderFulfillment(order, {
            toState: WORKFLOW_STATUS.DELIVERED,
            actor: { id: deliveryBoyId, role: "delivery" },
            reason: "Delivery OTP validated",
            otp: { required: true, verified: true },
            metadata: { otpValidatedAt: now.toISOString() },
        });
        order.deliveredAt = now;
        order.otpValidatedAt = now;
        order.otpValidationLocation = validationLocation;

        // If Cash on Delivery, mark payment completed and record cash collected
        const pMethod = (order.payment?.method || "").toLowerCase();
        const pMode = (order.payment?.paymentMode || "").toLowerCase();
        const isCodOrder = pMethod === "cash" || pMethod === "cod" || pMode === "cash";
        if (isCodOrder) {
            order.payment = order.payment || {};
            order.payment.status = "completed";
            order.payment.paidAmount = order.pricing?.total || 0;
            order.payment.remainingAmount = 0;
            if (req.body?.cashCollected) {
                const collected = Number(req.body.cashCollected);
                if (Number.isFinite(collected) && collected >= (order.pricing?.total || 0)) {
                    order.payment.changeReturned = Math.max(0, collected - (order.pricing?.total || 0));
                }
            }
        }

        const updatedOrder = await order.save();

        // Batch delivery trip: mark this stop done and surface the next
        // nearest-first stop so the rider's dashboard stops showing it as
        // outstanding and unlocks whatever comes next.
        let nextStop = null;
        try {
            nextStop = await advanceTripOnOrderDelivered(updatedOrder);
        } catch (tripErr) {
            console.error('[validateDeliveryOtp] Trip advance failed:', tripErr.message);
        }

        // Hub Reserved (HR) deduction for this order's product/variant lines
        try {
            const { finalizeHubInventoryOnDelivery } = await import(
                '../services/inventory/inventoryEngine.js'
            );
            await finalizeHubInventoryOnDelivery(updatedOrder);
            console.log(
                `[validateDeliveryOtp] Hub reserved stock deducted for order ${updatedOrder.orderId}`,
            );
        } catch (inventoryErr) {
            console.error(
                '[validateDeliveryOtp] Hub inventory deduction failed:',
                inventoryErr.message,
            );
        }

        // Financial side effects - Apply delivered financial settlements
        try {
            const { applyDeliveredSettlement } = await import('../services/orderSettlement.js');
            await applyDeliveredSettlement(updatedOrder, updatedOrder.orderId);
            console.log(`[validateDeliveryOtp] Applied financial side effects for order ${updatedOrder.orderId}`);
        } catch (settlementErr) {
            console.error('[validateDeliveryOtp] Settlement failed:', settlementErr.message);
        }

        // Notify customer via FCM
        try {
            const { createNotification } = await import('../services/notificationService.js');
            await createNotification({
                recipient: order.customer?._id || order.customer,
                recipientModel: "User",
                title: "Order Delivered",
                message: `Your order #${order.orderId} has been delivered successfully. Enjoy!`,
                type: "order",
                data: { orderId: order.orderId, mongoOrderId: order._id.toString() },
            });
        } catch (notifyErr) {
            console.warn('[validateDeliveryOtp] Notification failed:', notifyErr.message);
        }

        // Emit Socket.IO event to customer
        try {
            const { getIO } = await import('../socket/socketManager.js');
            const io = getIO();

            // Emit to customer's room
            if (order.customer?._id) {
                io.to(`customer:${order.customer._id}`).emit('delivery:otp:validated', {
                    orderId: order.orderId,
                    status: "delivered",
                    deliveredAt: now.toISOString()
                });
            }

            // Also emit to order room
            io.to(`order:${order.orderId}`).emit('delivery:otp:validated', {
                orderId: order.orderId,
                status: "delivered",
                deliveredAt: now.toISOString()
            });
        } catch (socketError) {
            console.error('Error emitting Socket.IO event:', socketError);
            // Don't fail the request if socket emission fails
        }

        const assignedAt = order.assignedAt ? new Date(order.assignedAt).getTime() : null;
        const deliveryDurationMs =
          assignedAt != null ? now.getTime() - assignedAt : null;

        await recordDeliveryAudit({
            orderId: order.orderId,
            orderRef: order._id,
            deliveryBoy: deliveryBoyId,
            event: "otp_verified",
            gpsSnapshot: validationLocation,
        });
        await recordDeliveryAudit({
            orderId: order.orderId,
            orderRef: order._id,
            deliveryBoy: deliveryBoyId,
            event: "delivered",
            durationMs: deliveryDurationMs,
            gpsSnapshot: validationLocation,
        });

        return handleResponse(res, 200, "Order delivered successfully", {
            success: true,
            message: "Order delivered successfully",
            data: {
                orderId: order.orderId,
                deliveredAt: now.toISOString()
            },
            nextStop,
        });
    } catch (error) {
        console.error('Error in validateDeliveryOtp controller:', error);
        return handleResponse(res, 500, "Failed to validate OTP", {
            error: {
                code: "VALIDATION_FAILED",
                message: error.message
            }
        });
    }
};

