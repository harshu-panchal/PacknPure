import Order from "../../models/order.js";
import Delivery from "../../models/delivery.js";
import User from "../../models/customer.js";
import { orderMatchQueryFromRouteParam } from "../../utils/orderLookup.js";
import { initiateWithProvider } from "./providers/index.js";

function refId(value) {
  if (!value) return null;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

/**
 * Resolve real phone numbers server-side only — never returned to clients.
 */
async function resolvePartyPhones(order) {
  const deliveryBoyId = refId(order.deliveryBoy);
  const customerId = refId(order.customer);

  const [deliveryDoc, customerDoc] = await Promise.all([
    deliveryBoyId
      ? Delivery.findById(deliveryBoyId).select("phone name").lean()
      : null,
    customerId ? User.findById(customerId).select("phone name").lean() : null,
  ]);

  return {
    deliveryPhone: deliveryDoc?.phone || null,
    customerPhone: customerDoc?.phone || order.address?.phone || null,
    deliveryName: deliveryDoc?.name || "Delivery Partner",
    customerName: customerDoc?.name || order.address?.name || "Customer",
  };
}

/**
 * Initiate a masked call between customer ↔ delivery partner for an order.
 * Personal numbers are never exposed to either party.
 */
export async function initiateMaskedCall({ orderId, callerRole, callerUserId }) {
  const orderKey = orderMatchQueryFromRouteParam(orderId);
  if (!orderKey) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const order = await Order.findOne(orderKey)
    .select("orderId deliveryBoy customer address.name address.phone workflowStatus status")
    .lean();

  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  const deliveryBoyId = refId(order.deliveryBoy);
  const customerId = refId(order.customer);
  const role = String(callerRole || "").toLowerCase();

  if (role === "customer" || role === "user") {
    if (customerId !== String(callerUserId)) {
      const err = new Error("Access denied");
      err.statusCode = 403;
      throw err;
    }
    if (!deliveryBoyId) {
      const err = new Error("No delivery partner assigned yet");
      err.statusCode = 400;
      throw err;
    }
  } else if (role === "delivery") {
    if (deliveryBoyId !== String(callerUserId)) {
      const err = new Error("Access denied");
      err.statusCode = 403;
      throw err;
    }
  } else {
    const err = new Error("Invalid caller role");
    err.statusCode = 400;
    throw err;
  }

  const phones = await resolvePartyPhones(order);

  const calleeRole = role === "delivery" ? "customer" : "delivery";

  const session = await initiateWithProvider({
    orderId: order.orderId,
    callerRole: role,
    calleeRole,
    callerUserId: String(callerUserId),
    // Real numbers stay server-side for future provider bridge
    callerPhone: role === "delivery" ? phones.deliveryPhone : phones.customerPhone,
    calleePhone: role === "delivery" ? phones.customerPhone : phones.deliveryPhone,
  });

  return {
    ...session,
    maskedCallingReady: true,
  };
}
