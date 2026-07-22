import handleResponse from "../utils/helper.js";
import Order from "../models/order.js";
import { orderMatchQueryFlexible } from "../utils/orderLookup.js";
import { getDeliveryTimelineForOrder } from "../services/deliveryTimelineService.js";

export async function getDeliveryTimeline(req, res) {
  try {
    const { orderId } = req.params;
    const { role } = req.user;
    const userId = req.user?.id ?? req.user?._id;
    const uid = userId != null ? String(userId).trim() : "";

    const orderKey = orderMatchQueryFlexible(orderId);
    if (!orderKey) {
      return handleResponse(res, 404, "Order not found");
    }

    const order = await Order.findOne(orderKey)
      .select(
        "orderId customer deliveryBoy returnDeliveryBoy workflowStatus status assignedAt pickupReadyAt pickupConfirmedAt outForDeliveryAt deliveredAt otpValidatedAt sellerAcceptedAt updatedAt",
      )
      .lean();

    if (!order) {
      return handleResponse(res, 404, "Order not found");
    }

    const roleNorm = String(role || "").toLowerCase();
    const customerId =
      typeof order.customer === "object" && order.customer?._id
        ? String(order.customer._id)
        : String(order.customer || "");
    const deliveryId =
      typeof order.deliveryBoy === "object" && order.deliveryBoy?._id
        ? String(order.deliveryBoy._id)
        : String(order.deliveryBoy || "");
    const returnRiderId =
      typeof order.returnDeliveryBoy === "object" && order.returnDeliveryBoy?._id
        ? String(order.returnDeliveryBoy._id)
        : String(order.returnDeliveryBoy || "");

    const allowed =
      roleNorm === "admin" ||
      ((roleNorm === "customer" || roleNorm === "user") && customerId === uid) ||
      (roleNorm === "delivery" && (deliveryId === uid || returnRiderId === uid));

    if (!allowed) {
      return handleResponse(res, 403, "Access denied");
    }

    const timeline = await getDeliveryTimelineForOrder(order);
    return handleResponse(res, 200, "Delivery timeline fetched", timeline);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
}
