import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { transitionOrderFulfillment } from "./fulfillmentWorkflowEngine.js";

/**
 * Single workflow writer facade.
 * Services must transition orders through this module.
 */
export const transitionOrder = async (order, toState, options = {}) => {
  return transitionOrderFulfillment(order, toState, options);
};

export const markOrderProcurementRequired = async (order) =>
  transitionOrder(order, WORKFLOW_STATUS.PROCUREMENT_REQUIRED, {
    actor: { role: "system" },
    reason: "procurement_required",
  });

export const markOrderProcurementCompleted = async (order) =>
  transitionOrder(order, WORKFLOW_STATUS.PROCUREMENT_COMPLETED, {
    actor: { role: "system" },
    reason: "procurement_completed",
  });

export const markOrderReadyForDelivery = async (order) =>
  transitionOrder(order, WORKFLOW_STATUS.READY_FOR_DELIVERY, {
    actor: { role: "admin" },
    reason: "ready_for_delivery",
  });

export const markOrderCancelled = async (order, actor = { role: "system" }) =>
  transitionOrder(order, WORKFLOW_STATUS.ORDER_CANCELLED, {
    actor,
    reason: "order_cancelled",
  });

export const markOrderDelivered = async (order, actor = { role: "delivery" }) =>
  transitionOrder(order, WORKFLOW_STATUS.DELIVERED, {
    actor,
    reason: "delivered",
    otp: { required: true, verified: true },
  });
