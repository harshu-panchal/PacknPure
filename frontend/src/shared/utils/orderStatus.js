/**
 * Single source of truth for order status across customer, seller, delivery, and admin UIs.
 * Mirrors backend `legacyStatusFromWorkflow` (see backend/app/constants/orderWorkflow.js).
 */

export const WORKFLOW_STATUS = {
  CREATED: "CREATED",
  SELLER_PENDING: "SELLER_PENDING",
  SELLER_ACCEPTED: "SELLER_ACCEPTED",
  DELIVERY_SEARCH: "DELIVERY_SEARCH",
  DELIVERY_ASSIGNED: "DELIVERY_ASSIGNED",
  PICKUP_READY: "PICKUP_READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

const LEGACY_ENUM = new Set([
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

/**
 * Terminal failure states. The backend's legacyStatusFromWorkflow maps every one of
 * these to "cancelled"; falling through to the "pending" default here left a
 * cancelled order reading as Pending in the app forever while admin showed
 * Cancelled. Keep this list in sync with backend/app/constants/orderWorkflow.js.
 */
const FAILED_WORKFLOW_STATUSES = new Set([
  "CANCELLED",
  "ORDER_CANCELLED",
  "PAYMENT_FAILED",
  "PROCUREMENT_FAILED",
  "SELLER_REJECTED",
  "SELLER_TIMEOUT",
  "QA_FAILED",
  "PICKUP_FAILED",
  "DELIVERY_FAILED",
  "NO_SELLER_AVAILABLE",
]);

function legacyFromWorkflow(workflowStatus) {
  if (FAILED_WORKFLOW_STATUSES.has(workflowStatus)) return "cancelled";

  switch (workflowStatus) {
    case WORKFLOW_STATUS.CREATED:
    case WORKFLOW_STATUS.SELLER_PENDING:
    case "ORDER_PLACED":
    case "PENDING_SELLER_OFFER":
      return "pending";
    // Match backend legacyStatusFromWorkflow — search/accepted means confirmed.
    case WORKFLOW_STATUS.DELIVERY_SEARCH:
    case WORKFLOW_STATUS.SELLER_ACCEPTED:
    case WORKFLOW_STATUS.DELIVERY_ASSIGNED:
    case WORKFLOW_STATUS.PICKUP_READY:
    case "PAYMENT_CONFIRMED":
    case "INVENTORY_RESERVED":
    case "PROCUREMENT_REQUIRED":
    case "PROCUREMENT_COMPLETED":
    case "SELLER_OFFER_ACCEPTED":
    case "READY_FOR_PICKUP":
    case "PICKUP_ASSIGNED":
    case "SELLER_READY":
    case "PICKED_UP":
    case "IN_TRANSIT_TO_HUB":
    case "RECEIVED_AT_HUB":
    case "QA_PENDING":
    case "QA_PASSED":
    case "PACKING":
    case "READY_FOR_DELIVERY":
      return "confirmed";
    case WORKFLOW_STATUS.OUT_FOR_DELIVERY:
    case "DELIVERY_OTP_VERIFIED":
      return "out_for_delivery";
    case WORKFLOW_STATUS.DELIVERED:
      return "delivered";
    default:
      return "pending";
  }
}

/** Workflow still before / without a rider — legacy `status` may already be confirmed (Express hub auto-confirm). */
const EARLY_WORKFLOW_STATUSES = new Set([
  WORKFLOW_STATUS.CREATED,
  WORKFLOW_STATUS.SELLER_PENDING,
  WORKFLOW_STATUS.SELLER_ACCEPTED,
  WORKFLOW_STATUS.DELIVERY_SEARCH,
  "ORDER_PLACED",
  "PAYMENT_CONFIRMED",
  "INVENTORY_RESERVED",
  "PROCUREMENT_REQUIRED",
  "PROCUREMENT_COMPLETED",
  "SELLER_OFFER_ACCEPTED",
  "READY_FOR_DELIVERY",
  "PACKING",
  "QA_PENDING",
  "QA_PASSED",
]);

/**
 * Normalized legacy bucket (matches Order.status enum + v2 workflow mapping).
 * Use for filters, tabs, and comparisons across panels.
 */
export function getLegacyStatusFromOrder(order) {
  if (!order) return "pending";
  const v = Number(order.workflowVersion) || 0;
  const rawStatus = String(order.status ?? "pending").toLowerCase();

  if (v >= 2 && order.workflowStatus) {
    const workflowStatus = String(order.workflowStatus).toUpperCase();

    if (workflowStatus === WORKFLOW_STATUS.OUT_FOR_DELIVERY) {
      return "out_for_delivery";
    }
    if (workflowStatus === WORKFLOW_STATUS.DELIVERED) {
      return "delivered";
    }
    if (FAILED_WORKFLOW_STATUSES.has(workflowStatus)) {
      return "cancelled";
    }
    if (
      workflowStatus === WORKFLOW_STATUS.DELIVERY_ASSIGNED ||
      workflowStatus === WORKFLOW_STATUS.PICKUP_READY
    ) {
      return "confirmed";
    }

    // Express + hub stock auto-confirm sets status=confirmed while workflow may
    // still be CREATED and deliveryBoy remains null. Prefer explicit legacy status.
    if (rawStatus === "confirmed" && EARLY_WORKFLOW_STATUSES.has(workflowStatus)) {
      return "confirmed";
    }
    if (rawStatus === "cancelled") {
      return "cancelled";
    }

    return legacyFromWorkflow(workflowStatus);
  }

  const riderStep = Number(order.deliveryRiderStep) || 0;
  if (riderStep >= 3 || order.outForDeliveryAt || order.pickupConfirmedAt) {
    return "out_for_delivery";
  }
  if (riderStep >= 1 || order.assignedAt || order.pickupReadyAt || order.deliveryBoy) {
    return "confirmed";
  }

  if (LEGACY_ENUM.has(rawStatus)) return rawStatus;
  return "pending";
}

const DISPLAY_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Human-readable status for list/detail badges (customer-facing tone). */
export function getOrderStatusLabel(order) {
  const bucket = getLegacyStatusFromOrder(order);
  return DISPLAY_LABELS[bucket] || bucket.replace(/_/g, " ");
}

/**
 * Admin sidebar uses path segments like `processed` and `out-for-delivery`.
 * Map route param → whether an order belongs in that view.
 */
export function adminRouteMatchesOrder(routeStatus, order) {
  const legacy = getLegacyStatusFromOrder(order);
  if (routeStatus === "all") return true;
  if (routeStatus === "pending") return legacy === "pending";
  if (routeStatus === "processed") {
    return legacy === "confirmed" || legacy === "packed";
  }
  if (routeStatus === "out-for-delivery") {
    return legacy === "out_for_delivery";
  }
  if (routeStatus === "delivered") return legacy === "delivered";
  if (routeStatus === "cancelled") return legacy === "cancelled";
  if (routeStatus === "returned") {
    const rs = order?.returnStatus;
    return rs && rs !== "none";
  }
  return legacy === routeStatus;
}
