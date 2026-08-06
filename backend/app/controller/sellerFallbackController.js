/**
 * Controller for seller fallback routing endpoints.
 * Additive — does not modify any existing controller or route.
 */

import handleResponse from "../utils/helper.js";
import {
  acceptSellerOffer,
  rejectSellerOffer,
} from "../services/sellerFallbackService.js";
import {
  orderMatchQueryFromRouteParam,
} from "../utils/orderLookup.js";
import Order from "../models/order.js";

/**
 * PUT /api/orders/seller-offer/accept/:orderId
 * Seller accepts the current offer on the order.
 */
export const handleAcceptSellerOffer = async (req, res) => {
  try {
    const sellerId = req.user?.id || req.user?._id;
    if (!sellerId) {
      return handleResponse(res, 401, "Seller authentication required");
    }

    const matchQuery = orderMatchQueryFromRouteParam(req.params.orderId);
    const order = await Order.findOne(matchQuery).select("_id").lean();
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const updated = await acceptSellerOffer(order._id, sellerId);
    return handleResponse(res, 200, "Offer accepted successfully", updated);
  } catch (err) {
    const code = err.statusCode || 500;
    return handleResponse(res, code, err.message);
  }
};

/**
 * PUT /api/orders/seller-offer/reject/:orderId
 * Seller explicitly rejects the current offer on the order.
 */
export const handleRejectSellerOffer = async (req, res) => {
  try {
    const sellerId = req.user?.id || req.user?._id;
    if (!sellerId) {
      return handleResponse(res, 401, "Seller authentication required");
    }

    const matchQuery = orderMatchQueryFromRouteParam(req.params.orderId);
    const order = await Order.findOne(matchQuery).select("_id").lean();
    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const updated = await rejectSellerOffer(order._id, sellerId);
    return handleResponse(res, 200, "Offer rejected — advanced to next seller", updated);
  } catch (err) {
    const code = err.statusCode || 500;
    return handleResponse(res, code, err.message);
  }
};
