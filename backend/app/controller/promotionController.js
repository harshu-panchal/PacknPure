import Promotion from "../models/promotion.js";
import Order from "../models/order.js";
import handleResponse from "../utils/helper.js";
import { validatePromoRules } from "../services/promotionValidationService.js";

// --- ADMIN APIs ---

export const listPromotions = async (req, res) => {
    try {
        const { search, type, status } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { code: { $regex: search, $options: "i" } },
                { title: { $regex: search, $options: "i" } },
            ];
        }

        if (type) query.promotionType = type;
        if (status === "active") query.isActive = true;
        else if (status === "inactive") query.isActive = false;

        const promotions = await Promotion.find(query).sort({ createdAt: -1 }).lean();
        return handleResponse(res, 200, "Promotions fetched successfully", promotions);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const getPromotion = async (req, res) => {
    try {
        const promotion = await Promotion.findById(req.params.id);
        if (!promotion) return handleResponse(res, 404, "Promotion not found");
        return handleResponse(res, 200, "Promotion fetched", promotion);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const createPromotion = async (req, res) => {
    try {
        const data = req.body;
        data.code = data.code?.toUpperCase();

        if (data.promotionType === "coupon" && !data.code) {
            return handleResponse(res, 400, "Coupon code is required");
        }

        if (data.code) {
            const existing = await Promotion.findOne({ code: data.code });
            if (existing) {
                return handleResponse(res, 400, "Promotion code already exists");
            }
        }

        const promotion = await Promotion.create(data);
        return handleResponse(res, 201, "Promotion created successfully", promotion);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const updatePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        if (data.code) data.code = data.code.toUpperCase();

        const promotion = await Promotion.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });

        if (!promotion) return handleResponse(res, 404, "Promotion not found");
        return handleResponse(res, 200, "Promotion updated successfully", promotion);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const promotion = await Promotion.findByIdAndUpdate(
            id,
            { isActive },
            { new: true }
        );
        if (!promotion) return handleResponse(res, 404, "Promotion not found");
        return handleResponse(res, 200, "Status updated", promotion);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const deletePromotion = async (req, res) => {
    try {
        await Promotion.findByIdAndDelete(req.params.id);
        return handleResponse(res, 200, "Promotion deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const getAnalytics = async (req, res) => {
    try {
        const promotion = await Promotion.findById(req.params.id);
        if (!promotion) return handleResponse(res, 404, "Promotion not found");

        const orders = await Order.find({ promotionApplied: promotion._id });
        const totalRevenue = orders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);
        const totalDiscountGiven = orders.reduce((sum, o) => sum + (o.pricing?.discount || 0), 0);

        return handleResponse(res, 200, "Analytics fetched", {
            usedCount: promotion.usedCount,
            totalRevenue,
            totalDiscountGiven,
            ordersCount: orders.length,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// --- CUSTOMER APIs ---
// validatePromoRules is shared with coreOrderService.js — see promotionValidationService.js

export const getAvailablePromotions = async (req, res) => {
    try {
        const { customerId } = req.query;
        const now = new Date();
        const activePromotions = await Promotion.find({
            isActive: true,
            $and: [
                { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
                { $or: [{ validTill: null }, { validTill: { $gte: now } }] },
            ],
        }).sort({ priority: -1, createdAt: -1 }).lean();

        let filteredPromotions = activePromotions;

        if (customerId) {
            const userOrdersCount = await Order.countDocuments({ customer: customerId });
            
            filteredPromotions = [];
            for (const promo of activePromotions) {
                let isEligible = true;
                
                if (promo.conditions?.firstOrderOnly && userOrdersCount > 0) {
                    isEligible = false;
                }
                
                if (promo.conditions?.newUserOnly && userOrdersCount > 0) {
                    isEligible = false;
                }
                
                if (promo.conditions?.applicableUsers?.length > 0) {
                    if (!promo.conditions.applicableUsers.map(id => id.toString()).includes(customerId)) {
                        isEligible = false;
                    }
                }
                
                if (promo.perUserLimit) {
                    const userUsageCount = await Order.countDocuments({ 
                        customer: customerId, 
                        promotionApplied: promo._id 
                    });
                    if (userUsageCount >= promo.perUserLimit) {
                        isEligible = false;
                    }
                }
                
                if (isEligible) {
                    filteredPromotions.push(promo);
                }
            }
        }

        return handleResponse(res, 200, "Promotions fetched", filteredPromotions);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const validatePromotion = async (req, res) => {
    try {
        const { code, cartTotal, items, customerId } = req.body;

        if (!code) {
            return handleResponse(res, 400, "Promotion code is required");
        }

        const promo = await Promotion.findOne({ code: code.toUpperCase() });
        if (!promo) {
            return res.status(200).json({ success: false, message: "Invalid promotion code" });
        }

        const result = await validatePromoRules(promo, { cartTotal, items, customerId });
        
        if (!result.valid) {
            return res.status(200).json({ success: false, message: result.reason });
        }

        return handleResponse(res, 200, "Promotion applied", {
            promotionId: promo._id,
            code: promo.code,
            discountAmount: result.discountAmount,
            freeDelivery: result.freeDelivery,
        });

    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
