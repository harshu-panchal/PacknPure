/**
 * Server-side Pricing Calculation Service
 * 
 * CRITICAL: All pricing must be calculated here, NOT trusted from frontend.
 * This ensures:
 * - Correct product pricing
 * - Variant pricing
 * - GST application
 * - Coupon revalidation
 * - Wallet deduction
 * - Delivery fees
 */

import Product from "../models/product.js";
import Promotion from "../models/promotion.js";
import User from "../models/customer.js";
import { calculateDeliveryFee } from "../utils/deliveryFeeUtil.js";
import crypto from "crypto";

/**
 * Validates and recalculates pricing from scratch
 * @param {Object} params
 * @param {Array} params.items - Cart items [{productId, quantity, variantId}]
 * @param {String} params.couponCode - Coupon code to apply
 * @param {Number} params.walletBalance - User's current wallet balance
 * @param {Number} params.walletToUse - Amount user wants to deduct from wallet
 * @param {Object} params.deliveryCoords - {lat, lng} for delivery fee calc
 * @param {String} params.userId - User ID for personalized offers
 * @returns {Promise<Object>} Validated pricing breakdown or error
 */
export async function calculateAndValidatePricing(params) {
  const {
    items,
    couponCode,
    walletBalance = 0,
    walletToUse = 0,
    deliveryCoords,
    userId,
  } = params;

  // 1. VALIDATE ITEMS & GET PRODUCT DETAILS
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Invalid or empty cart items");
  }

  let subtotal = 0;
  let totalGst = 0;
  const validatedItems = [];

  for (const item of items) {
    const pId = item.productId || item.product || item._id;
    if (!pId) throw new Error("Missing productId in cart item");
    
    // Normalize it back to productId for consistency
    item.productId = pId;

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error("Invalid quantity for product");
    }

    const product = await Product.findById(pId).lean();
    if (!product) throw new Error(`Product ${pId} not found`);
    if (!product.status || product.status !== "active") {
      throw new Error(`Product ${product.name} is not available`);
    }

    // Get price from variant or product
    let itemPrice = product.price || 0;
    let itemGstEnabled = product.gstEnabled || false;
    let itemGstRate = product.gstRate || 0;

    if (item.variantId) {
      const variant = product.variants?.find(
        (v) =>
          String(v._id) === String(item.variantId) ||
          String(v.id) === String(item.variantId)
      );
      if (!variant) throw new Error(`Variant not found for product ${product.name}`);

      itemPrice = variant.price || itemPrice;
      if (variant.gstEnabled !== undefined) itemGstEnabled = variant.gstEnabled;
      if (itemGstEnabled && variant.gstRate) itemGstRate = variant.gstRate;
    }

    // Calculate item total
    const itemSubtotal = itemPrice * item.quantity;
    subtotal += itemSubtotal;

    // Calculate GST if enabled
    let itemGst = 0;
    if (itemGstEnabled && itemGstRate > 0) {
      // GST formula: price includes GST, so base = price / (1 + gst%)
      const basePrice = itemSubtotal / (1 + itemGstRate / 100);
      itemGst = itemSubtotal - basePrice;
    }
    totalGst += itemGst;

    validatedItems.push({
      productId: item.productId,
      variantId: item.variantId || null,
      quantity: item.quantity,
      price: itemPrice,
      gstEnabled: itemGstEnabled,
      gstRate: itemGstRate,
      itemGst: Number(itemGst.toFixed(2)),
    });
  }

  // 2. VALIDATE & APPLY COUPON (REVALIDATION)
  let couponDiscount = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const coupon = await Promotion.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
    }).lean();

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    // Check expiry
    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new Error("Coupon is not yet valid");
    }
    if (coupon.validTill && coupon.validTill < now) {
      throw new Error("Coupon has expired");
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new Error("Coupon usage limit reached");
    }

    // Check per-user limit
    if (userId && coupon.perUserLimit) {
      const userUsageCount = await countCouponUsageByUser(
        coupon._id,
        userId
      );
      if (userUsageCount >= coupon.perUserLimit) {
        throw new Error("You have already used this coupon");
      }
    }

    // Check minimum order value
    if (coupon.conditions?.minOrderValue) {
      if (subtotal < coupon.conditions.minOrderValue) {
        throw new Error(
          `Minimum order value ₹${coupon.conditions.minOrderValue} required`
        );
      }
    }

    // Check if first order only
    if (coupon.conditions?.firstOrderOnly && userId) {
      const userOrders = await countUserOrders(userId);
      if (userOrders > 0) {
        throw new Error("This coupon is for first order only");
      }
    }

    // Apply discount
    if (coupon.discountType === "percentage") {
      couponDiscount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount) {
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
      }
    } else if (coupon.discountType === "fixed") {
      couponDiscount = coupon.discountValue;
    } else if (coupon.discountType === "free_delivery") {
      couponDiscount = 0; // Will set deliveryFee to 0 later
    }

    appliedCoupon = {
      id: coupon._id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
    };
  }

  // 3. CALCULATE DELIVERY FEE
  let deliveryFee = 0;
  let isFreeDelivery = false;
  if (deliveryCoords && (deliveryCoords.lat || deliveryCoords.lng)) {
    const deliveryInfo = await calculateDeliveryFee(deliveryCoords);
    
    if (deliveryInfo.isOutOfRange) {
      throw new Error("Delivery address is outside service area");
    }

    // Check if free delivery applies
    const subtotalAfterCoupon = subtotal - couponDiscount;
    if (subtotalAfterCoupon >= (deliveryInfo.freeDeliveryThreshold || 500)) {
      isFreeDelivery = true;
      deliveryFee = 0;
    } else if (
      appliedCoupon?.discountType === "free_delivery"
    ) {
      isFreeDelivery = true;
      deliveryFee = 0;
    } else {
      deliveryFee = deliveryInfo.deliveryFee || 0;
    }
  }

  // 4. CALCULATE WALLET DEDUCTION
  const maxWalletDeduction = Math.max(
    0,
    subtotal + totalGst + deliveryFee - couponDiscount
  );
  const actualWalletUsed = Math.min(
    walletToUse,
    walletBalance,
    maxWalletDeduction
  );

  if (walletToUse > walletBalance) {
    throw new Error("Insufficient wallet balance");
  }

  // 5. CALCULATE FINAL TOTAL
  const total =
    subtotal +
    totalGst +
    deliveryFee -
    couponDiscount -
    actualWalletUsed;

  if (total <= 0) {
    throw new Error("Invalid final amount");
  }

  // 6. CREATE PRICING VERSION HASH (for idempotency checking)
  const pricingHash = generatePricingHash({
    items: validatedItems,
    subtotal,
    couponCode,
    walletUsed: actualWalletUsed,
    deliveryFee,
  });

  // RETURN VALIDATED PRICING
  const pricing = {
    subtotal: Number(subtotal.toFixed(2)),
    itemGst: Number(totalGst.toFixed(2)),
    couponDiscount: Number(couponDiscount.toFixed(2)),
    couponCode: couponCode?.toUpperCase() || null,
    walletUsed: Number(actualWalletUsed.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    platformFee: 0, // Can be added per business logic
    total: Number(total.toFixed(2)),
    pricingVersion: pricingHash,
  };

  return {
    pricing,
    validatedItems,
    appliedCoupon,
    isFreeDelivery,
  };
}

/**
 * Generate hash of pricing to detect tampering
 */
function generatePricingHash(pricingData) {
  const str = JSON.stringify(pricingData);
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * Count how many times user has used a coupon
 */
async function countCouponUsageByUser(couponId, userId) {
  // This would typically query Order/Transaction history
  // For now, returning 0 - should be implemented per your Order schema
  return 0;
}

/**
 * Count total orders for a user (for first-order-only coupon)
 */
async function countUserOrders(userId) {
  // This would query Order collection
  // For now, returning 0 - should be implemented per your Order schema
  return 0;
}

/**
 * Validates pricing against a saved PaymentIntent
 * Used during payment verification to ensure no tampering
 */
export async function validatePricingConsistency(
  calculatedPricing,
  intentPricing
) {
  // Compare critical fields
  const tolerance = 0.01; // 1 paise tolerance for rounding
  
  if (Math.abs(calculatedPricing.total - intentPricing.total) > tolerance) {
    throw new Error("Pricing mismatch detected - total amount changed");
  }

  if (calculatedPricing.couponCode !== intentPricing.couponCode) {
    throw new Error("Coupon mismatch detected");
  }

  // Pricing version should match to ensure no item changes
  // (This is a secondary check; ideally would compare item lists too)
  if (calculatedPricing.pricingVersion !== intentPricing.pricingVersion) {
    console.warn("[PRICING] Version mismatch - items may have changed");
    // Decide: hard fail or soft warning?
    // For now, warning - business may allow price to go UP but not down
  }

  return true;
}
