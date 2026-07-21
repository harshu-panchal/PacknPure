import { WORKFLOW_STATUS, legacyStatusFromWorkflow } from "../constants/orderWorkflow.js";
import { transitionOrderFulfillment } from "./fulfillmentWorkflowEngine.js";
import Order from "../models/order.js";

const VALID_HUB_STATUSES = new Set([
  "inventory_reserved",
  "procurement_required",
  "ready_for_packing",
  "on_hold",
  "dispatching",
  "delivered",
]);

const pushHubEvent = (order, fromState, toState, { actor = {}, reason = "" } = {}) => {
  if (!Array.isArray(order.fulfillmentEvents)) order.fulfillmentEvents = [];
  order.fulfillmentEvents.push({
    domain: "hub",
    oldState: fromState,
    newState: toState,
    actorId: actor.id || null,
    actorRole: actor.role || null,
    reason: reason || null,
    timestamp: new Date(),
  });
};

/**
 * Single workflow writer facade.
 * Services must transition orders through this module.
 */
export const transitionOrder = (order, toState, options = {}) =>
  transitionOrderFulfillment(order, { toState, ...options });

export const setOrderHubStatus = (order, hubStatus, options = {}) => {
  if (!VALID_HUB_STATUSES.has(hubStatus)) {
    const err = new Error(`Invalid hubStatus: ${hubStatus}`);
    err.statusCode = 400;
    throw err;
  }
  const fromState = order.hubStatus;
  if (fromState === hubStatus) return order;
  order.hubStatus = hubStatus;
  pushHubEvent(order, fromState, hubStatus, options);
  return order;
};

export const setOrderLegacyStatus = (order, status, options = {}) => {
  const fromState = order.status;
  order.status = status;
  if (Array.isArray(order.fulfillmentEvents)) {
    order.fulfillmentEvents.push({
      domain: "legacy",
      oldState: fromState,
      newState: status,
      actorId: options.actor?.id || null,
      actorRole: options.actor?.role || null,
      reason: options.reason || null,
      timestamp: new Date(),
    });
  }
  return order;
};

export const markOrderInventoryReserved = (order, options = {}) =>
  setOrderHubStatus(order, "inventory_reserved", {
    actor: { role: "system" },
    reason: "inventory_reserved",
    ...options,
  });

export const markOrderProcurementRequiredHub = (order, options = {}) =>
  setOrderHubStatus(order, "procurement_required", {
    actor: { role: "system" },
    reason: "procurement_required",
    ...options,
  });

export const markOrderReadyForPacking = (order, options = {}) => {
  order.procurementRequired = false;
  setOrderHubStatus(order, "ready_for_packing", {
    actor: { role: "system" },
    reason: "procurement_complete",
    ...options,
  });
  if (order.workflowVersion >= 2) {
    transitionOrder(order, WORKFLOW_STATUS.SELLER_ACCEPTED, {
      actor: { role: "system" },
      reason: "procurement_complete",
      ...options,
    });
  }
  if (order.status === "pending") {
    setOrderLegacyStatus(order, "confirmed", options);
  }
  return order;
};

export const markOrderOnHold = (order, options = {}) =>
  setOrderHubStatus(order, "on_hold", {
    actor: { role: "system" },
    reason: options.reason || "procurement_failed",
    ...options,
  });

export const markOrderProcurementFailedCancelled = (order, options = {}) => {
  transitionOrder(order, WORKFLOW_STATUS.CANCELLED, {
    actor: { role: "system" },
    reason: options.reason || "procurement_failed",
    ...options,
  });
  setOrderLegacyStatus(order, "cancelled", options);
  order.cancelReason = options.reason || "Procurement failed";
  return order;
};

export const markOrderProcurementRequired = (order, options = {}) =>
  transitionOrder(order, WORKFLOW_STATUS.PROCUREMENT_REQUIRED, {
    actor: { role: "system" },
    reason: "procurement_required",
    ...options,
  });

export const markOrderProcurementCompleted = (order, options = {}) =>
  transitionOrder(order, WORKFLOW_STATUS.PROCUREMENT_COMPLETED, {
    actor: { role: "system" },
    reason: "procurement_completed",
    ...options,
  });

export const markOrderReadyForDelivery = (order, options = {}) =>
  transitionOrder(order, WORKFLOW_STATUS.READY_FOR_DELIVERY, {
    actor: { role: "admin" },
    reason: "ready_for_delivery",
    ...options,
  });

export const markOrderCancelled = (order, actor = { role: "system" }, options = {}) =>
  transitionOrder(order, WORKFLOW_STATUS.ORDER_CANCELLED, {
    actor,
    reason: "order_cancelled",
    ...options,
  });

export const markOrderDelivered = (order, actor = { role: "delivery" }, options = {}) =>
  transitionOrder(order, WORKFLOW_STATUS.DELIVERED, {
    actor,
    reason: "delivered",
    otp: { required: true, verified: true },
    ...options,
  });

/**
 * Load order by filter, validate transition, apply fields, persist.
 * Sole path for atomic workflow writes outside fulfillmentWorkflowEngine.
 */
export const findAndTransitionOrder = async ({
  filter,
  toState,
  assign = {},
  unset = {},
  inc = {},
  options = {},
  populate = [],
  session = null,
}) => {
  let query = Order.findOne(filter);
  if (session) query = query.session(session);
  for (const path of populate) {
    if (typeof path === "string") query = query.populate(path);
    else query = query.populate(path);
  }
  const order = await query;
  if (!order) return null;
  transitionOrder(order, toState, options);
  Object.assign(order, assign);
  for (const [key, delta] of Object.entries(inc)) {
    order[key] = (Number(order[key]) || 0) + Number(delta);
  }
  if (session) await order.save({ session });
  else await order.save();
  if (Object.keys(unset).length > 0) {
    await Order.updateOne({ _id: order._id }, { $unset: unset });
    for (const key of Object.keys(unset)) {
      order.set(key, undefined);
    }
  }
  return order;
};

export const persistOrder = async (order, { session = null } = {}) => {
  if (session) return order.save({ session });
  return order.save();
};

export { legacyStatusFromWorkflow, WORKFLOW_STATUS };
