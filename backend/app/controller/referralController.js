import Customer from "../models/customer.js";
import Referral from "../models/referral.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { generateUniqueReferralCode } from "../utils/referralCode.js";
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
            customer.referralCode = await generateUniqueReferralCode();
            await customer.save();
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
