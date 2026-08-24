import Order from "../models/order.js";

/**
 * Single source of truth for whether a Promotion applies to a given cart/customer,
 * and how much discount it produces. Shared by:
 *  - promotionController.validatePromotion / getAvailablePromotions (customer-facing)
 *  - coreOrderService.executeCoreOrderFulfillment (COD/Wallet order creation)
 * so a coupon can never be honored on one path but rejected on another.
 */
export async function validatePromoRules(promo, { cartTotal, items, customerId }) {
    const now = new Date();

    if (!promo.isActive) return { valid: false, reason: "Promotion is not active" };
    if (promo.validFrom && promo.validFrom > now) return { valid: false, reason: "Promotion has not started yet" };
    if (promo.validTill && promo.validTill < now) return { valid: false, reason: "Promotion has expired" };

    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
        return { valid: false, reason: "Promotion usage limit reached" };
    }

    if (promo.conditions?.minOrderValue && cartTotal < promo.conditions.minOrderValue) {
        return { valid: false, reason: `Minimum order value should be ₹${promo.conditions.minOrderValue}` };
    }

    if (promo.conditions?.maxOrderValue && cartTotal > promo.conditions.maxOrderValue) {
        return { valid: false, reason: `Maximum order value for this promotion is ₹${promo.conditions.maxOrderValue}` };
    }

    const totalQty = items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
    if (promo.conditions?.minQuantity && totalQty < promo.conditions.minQuantity) {
        return { valid: false, reason: `Add at least ${promo.conditions.minQuantity} items to use this promotion` };
    }

    if (customerId) {
        const userOrdersCount = await Order.countDocuments({ customer: customerId });

        if (promo.conditions?.firstOrderOnly && userOrdersCount > 0) {
            return { valid: false, reason: "This promotion is only valid for your first order" };
        }

        if (promo.conditions?.newUserOnly && userOrdersCount > 0) {
            return { valid: false, reason: "This promotion is only available for new users" };
        }

        if (promo.conditions?.applicableUsers?.length > 0) {
            if (!promo.conditions.applicableUsers.map((id) => id.toString()).includes(String(customerId))) {
                return { valid: false, reason: "You are not eligible for this promotion" };
            }
        }

        if (promo.perUserLimit) {
            const userUsageCount = await Order.countDocuments({
                customer: customerId,
                promotionApplied: promo._id,
            });
            if (userUsageCount >= promo.perUserLimit) {
                return { valid: false, reason: "You have reached the usage limit for this promotion" };
            }
        }
    } else if (
        promo.conditions?.firstOrderOnly ||
        promo.conditions?.newUserOnly ||
        promo.conditions?.applicableUsers?.length > 0 ||
        promo.perUserLimit
    ) {
        return { valid: false, reason: "Please login to use this promotion" };
    }

    if (promo.conditions?.applicableCategories?.length > 0) {
        const hasApplicableCategory = items?.some(
            (item) =>
                item.category &&
                promo.conditions.applicableCategories.map((c) => c.toString()).includes(item.category.toString()),
        );
        if (!hasApplicableCategory) {
            return { valid: false, reason: "Your cart does not contain eligible categories for this promotion" };
        }
    }

    if (promo.conditions?.applicableProducts?.length > 0) {
        const hasApplicableProduct = items?.some((item) =>
            promo.conditions.applicableProducts
                .map((p) => p.toString())
                .includes((item.productId || item._id)?.toString()),
        );
        if (!hasApplicableProduct) {
            return { valid: false, reason: "Your cart does not contain eligible products for this promotion" };
        }
    }

    let discountAmount = 0;
    let freeDelivery = false;

    if (promo.discountType === "free_delivery") {
        freeDelivery = true;
    } else if (promo.discountType === "percentage") {
        discountAmount = Math.round((cartTotal * promo.discountValue) / 100);
    } else if (promo.discountType === "fixed") {
        discountAmount = promo.discountValue;
    }

    if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
    }

    if (discountAmount <= 0 && !freeDelivery) {
        return { valid: false, reason: "This promotion does not provide any discount on current cart" };
    }

    return { valid: true, discountAmount, freeDelivery };
}
