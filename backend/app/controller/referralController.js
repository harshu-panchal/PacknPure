import Customer from "../models/customer.js";
import Referral from "../models/referral.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { ensureReferralCode } from "../utils/referralCode.js";
import { getReferralSettings } from "../services/settingsService.js";

const getFrontendBaseUrl = () =>
    (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim();

/* ===============================
   GET MY REFERRAL SUMMARY (Customer)
================================ */
export const getMyReferralSummary = async (req, res) => {
    try {
        let customer = await Customer.findById(req.user.id).select(
            "referralCode walletBalance",
        );
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        // Self-heal accounts created before the referral system existed.
        if (!customer.referralCode) {
            customer.referralCode = await ensureReferralCode(customer._id, customer.referralCode);
        }

        const [settings, referrals] = await Promise.all([
            getReferralSettings(),
            Referral.find({ referrer: customer._id }).sort({ createdAt: -1 }).lean(),
        ]);

        const stats = referrals.reduce(
            (acc, r) => {
                acc.total += 1;
                if (r.status === "pending") acc.pending += 1;
                if (r.status === "completed") {
                    acc.completed += 1;
                    acc.totalEarned += Number(r.referrerBonus || 0);
                }
                if (r.status === "not_qualified") acc.notQualified += 1;
                return acc;
            },
            { total: 0, pending: 0, completed: 0, notQualified: 0, totalEarned: 0 },
        );

        return handleResponse(res, 200, "Referral summary fetched", {
            referralCode: customer.referralCode,
            shareLink: `${getFrontendBaseUrl()}/?ref=${customer.referralCode}`,
            program: settings,
            stats,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADMIN: LIST ALL REFERRALS
================================ */
export const getAdminReferrals = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req, { defaultLimit: 25, maxLimit: 100 });
        const { status, search } = req.query;

        const query = {};
        if (status && status !== "all") query.status = status;

        let referralIdsFromSearch = null;
        if (search && search.trim()) {
            const term = search.trim();
            const matchingUsers = await Customer.find({
                $or: [
                    { name: { $regex: term, $options: "i" } },
                    { phone: { $regex: term, $options: "i" } },
                    { referralCode: { $regex: term, $options: "i" } },
                ],
            }).select("_id");
            const ids = matchingUsers.map((u) => u._id);
            query.$or = [{ referrer: { $in: ids } }, { referee: { $in: ids } }];
        }

        const [items, total] = await Promise.all([
            Referral.find(query)
                .populate("referrer", "name phone referralCode")
                .populate("referee", "name phone")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Referral.countDocuments(query),
        ]);

        return handleResponse(res, 200, "Referrals fetched", {
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

/* ===============================
   ADMIN: REFERRAL PROGRAM STATS
================================ */
export const getAdminReferralStats = async (req, res) => {
    try {
        const [totals] = await Referral.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    notQualified: { $sum: { $cond: [{ $eq: ["$status", "not_qualified"] }, 1, 0] } },
                    referrerBonusPaid: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$referrerBonus", 0] },
                    },
                    refereeSignupBonusPaid: { $sum: "$refereeSignupBonus" },
                },
            },
        ]);

        const settings = await getReferralSettings();

        return handleResponse(res, 200, "Referral stats fetched", {
            ...(totals || {
                total: 0,
                pending: 0,
                completed: 0,
                notQualified: 0,
                referrerBonusPaid: 0,
                refereeSignupBonusPaid: 0,
            }),
            program: settings,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADMIN: LIST ALL USERS + REFERRAL LIMITS
================================ */
export const getAdminReferralUsers = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req, { defaultLimit: 25, maxLimit: 100 });
        const { search } = req.query;

        const query = {};
        if (search && search.trim()) {
            const term = search.trim();
            query.$or = [
                { name: { $regex: term, $options: "i" } },
                { phone: { $regex: term, $options: "i" } },
                { referralCode: { $regex: term, $options: "i" } },
            ];
        }

        const [users, total] = await Promise.all([
            Customer.find(query)
                .select(
                    "name phone referralCode referralMaxAllowed referralLimitLocked walletBalance isActive createdAt",
                )
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Customer.countDocuments(query),
        ]);

        // Self-heal accounts created before the referral system existed (or created
        // outside the OTP signup flow) — they never got a referralCode assigned.
        const usersMissingCode = users.filter((u) => !u.referralCode);
        if (usersMissingCode.length > 0) {
            await Promise.all(
                usersMissingCode.map(async (u) => {
                    u.referralCode = await ensureReferralCode(u._id, u.referralCode);
                }),
            );
        }

        const userIds = users.map((u) => u._id);
        const counts = await Referral.aggregate([
            { $match: { referrer: { $in: userIds } } },
            {
                $group: {
                    _id: "$referrer",
                    total: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    bonusEarned: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$referrerBonus", 0] },
                    },
                },
            },
        ]);
        const countMap = new Map(counts.map((c) => [String(c._id), c]));

        const items = users.map((u) => {
            const c = countMap.get(String(u._id));
            return {
                ...u,
                referralStats: {
                    total: c?.total || 0,
                    pending: c?.pending || 0,
                    completed: c?.completed || 0,
                    bonusEarned: c?.bonusEarned || 0,
                },
            };
        });

        return handleResponse(res, 200, "Users fetched", {
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

/* ===============================
   ADMIN: SET A USER'S REFERRAL LIMIT
================================ */
export const updateUserReferralLimit = async (req, res) => {
    try {
        const { id } = req.params;
        let { referralMaxAllowed, referralLimitLocked } = req.body;

        if (referralMaxAllowed === null || referralMaxAllowed === "" || referralMaxAllowed === undefined) {
            referralMaxAllowed = null;
        } else {
            referralMaxAllowed = Math.floor(Number(referralMaxAllowed));
            if (!Number.isFinite(referralMaxAllowed) || referralMaxAllowed < 0) {
                return handleResponse(
                    res,
                    400,
                    "Referral limit must be a non-negative whole number, or empty for unlimited",
                );
            }
        }

        const update = { referralMaxAllowed };
        if (referralLimitLocked !== undefined) {
            update.referralLimitLocked = Boolean(referralLimitLocked);
        }

        const user = await Customer.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true },
        ).select("name phone referralCode referralMaxAllowed referralLimitLocked");

        if (!user) {
            return handleResponse(res, 404, "User not found");
        }

        return handleResponse(res, 200, "Referral limit updated", user);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADMIN: SET ONE REFERRAL LIMIT FOR EVERY USER
================================ */
export const bulkSetReferralLimit = async (req, res) => {
    try {
        let { referralMaxAllowed } = req.body;

        if (referralMaxAllowed === null || referralMaxAllowed === "" || referralMaxAllowed === undefined) {
            referralMaxAllowed = null;
        } else {
            referralMaxAllowed = Math.floor(Number(referralMaxAllowed));
            if (!Number.isFinite(referralMaxAllowed) || referralMaxAllowed < 0) {
                return handleResponse(
                    res,
                    400,
                    "Referral limit must be a non-negative whole number, or empty for unlimited",
                );
            }
        }

        const [result, skipped] = await Promise.all([
            Customer.updateMany(
                { referralLimitLocked: { $ne: true } },
                { $set: { referralMaxAllowed } },
            ),
            Customer.countDocuments({ referralLimitLocked: true }),
        ]);

        return handleResponse(res, 200, "Referral limit applied to all users", {
            referralMaxAllowed,
            matched: result.matchedCount ?? result.n ?? 0,
            modified: result.modifiedCount ?? result.nModified ?? 0,
            skipped,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
