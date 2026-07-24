import { WORKFLOW_STATUS, workflowFromLegacyStatus, legacyStatusFromWorkflow } from "../constants/orderWorkflow.js";
import { createNotification } from "./notificationService.js";

export const RETURN_WORKFLOW_STATUS = {
  NONE: "none",
  RETURN_REQUESTED: "return_requested",
  RETURN_APPROVED: "return_approved",
  RETURN_REJECTED: "return_rejected",
  RETURN_PICKUP_ASSIGNED: "return_pickup_assigned",
  RETURN_PICKED: "return_in_transit",
  RETURN_RECEIVED_AT_HUB: "returned",
  REFUND_COMPLETED: "refund_completed",
};

const FULFILLMENT_TRANSITIONS = {
  // CREATED must allow cancel — hub procurement runs while workflow may still be CREATED
  [WORKFLOW_STATUS.CREATED]: new Set([
    WORKFLOW_STATUS.SELLER_PENDING,
    WORKFLOW_STATUS.ORDER_PLACED,
    WORKFLOW_STATUS.PROCUREMENT_REQUIRED,
    WORKFLOW_STATUS.INVENTORY_RESERVED,
    WORKFLOW_STATUS.PROCUREMENT_FAILED,
    WORKFLOW_STATUS.CANCELLED,
    WORKFLOW_STATUS.ORDER_CANCELLED,
  ]),
  [WORKFLOW_STATUS.SELLER_PENDING]: new Set([WORKFLOW_STATUS.SELLER_ACCEPTED, WORKFLOW_STATUS.DELIVERY_SEARCH, WORKFLOW_STATUS.CANCELLED, WORKFLOW_STATUS.ORDER_CANCELLED]),
  [WORKFLOW_STATUS.SELLER_ACCEPTED]: new Set([WORKFLOW_STATUS.DELIVERY_SEARCH, WORKFLOW_STATUS.READY_FOR_DELIVERY, WORKFLOW_STATUS.CANCELLED, WORKFLOW_STATUS.ORDER_CANCELLED]),
  [WORKFLOW_STATUS.DELIVERY_SEARCH]: new Set([WORKFLOW_STATUS.DELIVERY_ASSIGNED, WORKFLOW_STATUS.CANCELLED, WORKFLOW_STATUS.ORDER_CANCELLED]),
  [WORKFLOW_STATUS.PICKUP_READY]: new Set([WORKFLOW_STATUS.OUT_FOR_DELIVERY, WORKFLOW_STATUS.CANCELLED, WORKFLOW_STATUS.ORDER_CANCELLED]),
  [WORKFLOW_STATUS.CANCELLED]: new Set(),
  [WORKFLOW_STATUS.ORDER_CANCELLED]: new Set(),
  [WORKFLOW_STATUS.ORDER_PLACED]: new Set([WORKFLOW_STATUS.PAYMENT_CONFIRMED, WORKFLOW_STATUS.PAYMENT_FAILED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.PAYMENT_CONFIRMED]: new Set([WORKFLOW_STATUS.INVENTORY_RESERVED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.INVENTORY_RESERVED]: new Set([WORKFLOW_STATUS.PROCUREMENT_REQUIRED, WORKFLOW_STATUS.PROCUREMENT_COMPLETED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.PROCUREMENT_REQUIRED]: new Set([WORKFLOW_STATUS.PROCUREMENT_COMPLETED, WORKFLOW_STATUS.PROCUREMENT_FAILED, WORKFLOW_STATUS.SELLER_REJECTED, WORKFLOW_STATUS.SELLER_TIMEOUT, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.PROCUREMENT_FAILED]: new Set([WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.PROCUREMENT_COMPLETED]: new Set([WORKFLOW_STATUS.READY_FOR_PICKUP, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.READY_FOR_PICKUP]: new Set([WORKFLOW_STATUS.PICKUP_ASSIGNED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.PICKUP_ASSIGNED]: new Set([WORKFLOW_STATUS.SELLER_READY, WORKFLOW_STATUS.PICKUP_FAILED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.SELLER_READY]: new Set([WORKFLOW_STATUS.PICKED_UP, WORKFLOW_STATUS.PICKUP_FAILED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.PICKED_UP]: new Set([WORKFLOW_STATUS.IN_TRANSIT_TO_HUB, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.IN_TRANSIT_TO_HUB]: new Set([WORKFLOW_STATUS.RECEIVED_AT_HUB, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.RECEIVED_AT_HUB]: new Set([WORKFLOW_STATUS.QA_PENDING, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.QA_PENDING]: new Set([WORKFLOW_STATUS.QA_PASSED, WORKFLOW_STATUS.QA_FAILED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.QA_PASSED]: new Set([WORKFLOW_STATUS.PACKING, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.PACKING]: new Set([WORKFLOW_STATUS.READY_FOR_DELIVERY, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.READY_FOR_DELIVERY]: new Set([WORKFLOW_STATUS.DELIVERY_ASSIGNED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  // Rider flow: assigned → arrived at store (PICKUP_READY) → out for delivery
  [WORKFLOW_STATUS.DELIVERY_ASSIGNED]: new Set([
    WORKFLOW_STATUS.PICKUP_READY,
    WORKFLOW_STATUS.OUT_FOR_DELIVERY,
    WORKFLOW_STATUS.DELIVERY_FAILED,
    WORKFLOW_STATUS.ORDER_CANCELLED,
    WORKFLOW_STATUS.CANCELLED,
  ]),
  [WORKFLOW_STATUS.OUT_FOR_DELIVERY]: new Set([WORKFLOW_STATUS.DELIVERY_OTP_VERIFIED, WORKFLOW_STATUS.DELIVERED, WORKFLOW_STATUS.DELIVERY_FAILED, WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED]),
  [WORKFLOW_STATUS.DELIVERY_OTP_VERIFIED]: new Set([WORKFLOW_STATUS.DELIVERED]),
  [WORKFLOW_STATUS.DELIVERED]: new Set([WORKFLOW_STATUS.RETURN_REQUESTED]),
};

const RETURN_TRANSITIONS = {
  [RETURN_WORKFLOW_STATUS.NONE]: new Set([RETURN_WORKFLOW_STATUS.RETURN_REQUESTED]),
  [RETURN_WORKFLOW_STATUS.RETURN_REQUESTED]: new Set([RETURN_WORKFLOW_STATUS.RETURN_APPROVED, RETURN_WORKFLOW_STATUS.RETURN_REJECTED]),
  [RETURN_WORKFLOW_STATUS.RETURN_APPROVED]: new Set([RETURN_WORKFLOW_STATUS.RETURN_PICKUP_ASSIGNED]),
  [RETURN_WORKFLOW_STATUS.RETURN_PICKUP_ASSIGNED]: new Set([RETURN_WORKFLOW_STATUS.RETURN_PICKED]),
  [RETURN_WORKFLOW_STATUS.RETURN_PICKED]: new Set([RETURN_WORKFLOW_STATUS.RETURN_RECEIVED_AT_HUB]),
  [RETURN_WORKFLOW_STATUS.RETURN_RECEIVED_AT_HUB]: new Set([RETURN_WORKFLOW_STATUS.REFUND_COMPLETED]),
  [RETURN_WORKFLOW_STATUS.RETURN_REJECTED]: new Set(),
  [RETURN_WORKFLOW_STATUS.REFUND_COMPLETED]: new Set(),
};

function actorRole(actor = {}) {
  return String(actor.role || "").toLowerCase();
}

function assertRoleAllowed(toState, actor = {}, domain = "fulfillment") {
  const role = actorRole(actor);
  if (!role) return;

  if (domain === "fulfillment") {
    // Auto-cancel (procurement timeout) uses role "system"; customers cancel their own orders.
    // Do not require admin for cancellation states — that aborted PROCUREMENT_FAILED and left HR/SC stuck.
    const cancelStates = [WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.CANCELLED];
    if (cancelStates.includes(toState)) {
      const cancelRoles = new Set(["admin", "system", "customer"]);
      if (!cancelRoles.has(role)) {
        const err = new Error(`Role ${role} cannot cancel orders`);
        err.statusCode = 403;
        throw err;
      }
      return;
    }
    if (toState === WORKFLOW_STATUS.QA_PASSED && role !== "admin") {
      const err = new Error(`Only admin can move to ${toState}`);
      err.statusCode = 403;
      throw err;
    }
    // Riders accept broadcast offers; admins can also force-assign.
    if (
      toState === WORKFLOW_STATUS.DELIVERY_ASSIGNED &&
      role !== "admin" &&
      role !== "delivery" &&
      role !== "system"
    ) {
      const err = new Error(`Role ${role} cannot assign delivery`);
      err.statusCode = 403;
      throw err;
    }
    if (toState === WORKFLOW_STATUS.SELLER_READY && role !== "seller") {
      const err = new Error("Only seller can mark seller ready");
      err.statusCode = 403;
      throw err;
    }
    if (toState === WORKFLOW_STATUS.PICKED_UP && role !== "pickup") {
      const err = new Error("Only pickup partner can mark picked up");
      err.statusCode = 403;
      throw err;
    }
    if ([WORKFLOW_STATUS.DELIVERY_OTP_VERIFIED, WORKFLOW_STATUS.DELIVERED].includes(toState) && role !== "delivery") {
      const err = new Error("Only delivery partner can complete delivery");
      err.statusCode = 403;
      throw err;
    }
  }
}

function assertOtpIfRequired(toState, otp = {}) {
  if (![WORKFLOW_STATUS.PICKED_UP, WORKFLOW_STATUS.DELIVERED].includes(toState)) return;
  if (!otp.required) return;
  if (otp.verified) return;
  const err = new Error(`OTP verification required for ${toState}`);
  err.statusCode = 400;
  throw err;
}

function normalizeLegacyStatus(toState, fallbackStatus) {
  return legacyStatusFromWorkflow(toState) || fallbackStatus || "pending";
}

function getCurrentFulfillmentState(order) {
  return order?.workflowStatus || workflowFromLegacyStatus(order?.status) || WORKFLOW_STATUS.ORDER_PLACED;
}

function pushEvent(order, event) {
  if (!Array.isArray(order.fulfillmentEvents)) order.fulfillmentEvents = [];
  order.fulfillmentEvents.push(event);
}

export function getAllowedTransitions(fromState, domain = "fulfillment") {
  const map = domain === "return" ? RETURN_TRANSITIONS : FULFILLMENT_TRANSITIONS;
  return Array.from(map[fromState] || []);
}

export function transitionOrderFulfillment(order, { toState, actor = {}, reason = "", otp = {}, metadata = {} } = {}) {
  const fromState = getCurrentFulfillmentState(order);
  const allowed = FULFILLMENT_TRANSITIONS[fromState] || new Set();
  const cancellationAliasOk =
    toState === WORKFLOW_STATUS.CANCELLED &&
    allowed.has(WORKFLOW_STATUS.ORDER_CANCELLED);
  if (fromState !== toState && !allowed.has(toState) && !cancellationAliasOk) {
    const err = new Error(`Invalid transition ${fromState} -> ${toState}`);
    err.statusCode = 409;
    throw err;
  }
  assertRoleAllowed(toState, actor, "fulfillment");
  assertOtpIfRequired(toState, otp);

  order.workflowStatus = toState;
  order.status = normalizeLegacyStatus(toState, order.status);
  pushEvent(order, {
    domain: "fulfillment",
    oldState: fromState,
    newState: toState,
    actorId: actor.id || null,
    actorRole: actor.role || null,
    reason: reason || null,
    metadata: metadata || {},
    timestamp: new Date(),
  });

  return order;
}

export function transitionOrderReturn(order, { toState, actor = {}, reason = "", metadata = {} } = {}) {
  const fromState = order?.returnStatus || RETURN_WORKFLOW_STATUS.NONE;
  const allowed = RETURN_TRANSITIONS[fromState] || new Set();
  if (fromState !== toState && !allowed.has(toState)) {
    const err = new Error(`Invalid return transition ${fromState} -> ${toState}`);
    err.statusCode = 409;
    throw err;
  }

  order.returnStatus = toState;
  pushEvent(order, {
    domain: "return",
    oldState: fromState,
    newState: toState,
    actorId: actor.id || null,
    actorRole: actor.role || null,
    reason: reason || null,
    metadata: metadata || {},
    timestamp: new Date(),
  });

  return order;
}

export async function notifyWorkflowActors(order, { title, message, type = "order", targets = [] } = {}) {
  const calls = [];
  if (targets.includes("customer") && order.customer) {
    calls.push(
      createNotification({
        recipient: order.customer,
        recipientModel: "Customer",
        title,
        message,
        type,
        data: { orderId: order.orderId, mongoOrderId: order._id },
      }),
    );
  }
  if (targets.includes("seller") && order.seller) {
    calls.push(
      createNotification({
        recipient: order.seller,
        recipientModel: "Seller",
        title,
        message,
        type,
        data: { orderId: order.orderId, mongoOrderId: order._id },
      }),
    );
  }
  if (targets.includes("delivery") && order.deliveryBoy) {
    calls.push(
      createNotification({
        recipient: order.deliveryBoy,
        recipientModel: "Delivery",
        title,
        message,
        type,
        data: { orderId: order.orderId, mongoOrderId: order._id },
      }),
    );
  }
  await Promise.allSettled(calls);
}
