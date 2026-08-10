import Order from "../models/order.js";
import Delivery from "../models/delivery.js";
import DeliveryTrip from "../models/deliveryTrip.js";
import handleResponse from "../utils/helper.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { transitionOrderFulfillment } from "../services/fulfillmentWorkflowEngine.js";
import { createNotification } from "../services/notificationService.js";
import { sequenceStopsNearestFirst, generateTripId } from "../services/deliveryTripService.js";
import {
  markArrivedAtStoreAtomic,
  confirmPickupAtomic,
} from "../services/orderWorkflowService.js";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

// Same admin-advance rules as the single-order manual assign in orderController.js
// (updateOrderStatus) — replicated here rather than shared, so this new batch
// path can't regress that existing, heavily-used endpoint.
const ADMIN_ADVANCE_PATHS = {
  [WORKFLOW_STATUS.CREATED]: [WORKFLOW_STATUS.SELLER_PENDING, WORKFLOW_STATUS.DELIVERY_SEARCH],
  [WORKFLOW_STATUS.SELLER_PENDING]: [WORKFLOW_STATUS.DELIVERY_SEARCH],
  [WORKFLOW_STATUS.SELLER_ACCEPTED]: [WORKFLOW_STATUS.DELIVERY_SEARCH],
  [WORKFLOW_STATUS.PACKING]: [WORKFLOW_STATUS.READY_FOR_DELIVERY],
};

const ASSIGNABLE_STATES = new Set([
  WORKFLOW_STATUS.DELIVERY_SEARCH,
  WORKFLOW_STATUS.READY_FOR_DELIVERY,
  WORKFLOW_STATUS.DELIVERY_ASSIGNED,
]);

// Orders the picker should list: already assignable, OR in an early state that
// createDeliveryTrip below can auto-advance (same set ADMIN_ADVANCE_PATHS covers).
// Without this, the picker was hiding CREATED/SELLER_PENDING/etc. orders that
// assignment could actually handle, making the list look empty when it wasn't.
const LISTABLE_STATES = new Set([
  ...ASSIGNABLE_STATES,
  ...Object.keys(ADMIN_ADVANCE_PATHS),
]);

/**
 * GET /admin/delivery-trips/eligible-orders?hubId=&selectedDate=&selectedSlot=
 * Ready, unassigned SLOT orders for the batch-assign picker.
 */
export const getEligibleOrdersForTrip = async (req, res) => {
  try {
    const { hubId = DEFAULT_HUB_ID, selectedDate, selectedSlot } = req.query || {};
    if (!selectedDate || !selectedSlot) {
      return handleResponse(res, 400, "selectedDate and selectedSlot are required");
    }

    const orders = await Order.find({
      hubId,
      selectedDate,
      selectedSlot,
      deliveryMode: "SLOT",
      workflowVersion: { $gte: 2 },
      deliveryBoy: null,
      tripId: null,
      status: { $nin: ["cancelled", "delivered"] },
    })
      .select("orderId address totalAmount items workflowStatus createdAt")
      .populate("customer", "name phone")
      .sort({ createdAt: 1 })
      .lean();

    const eligible = orders.filter((o) => LISTABLE_STATES.has(o.workflowStatus));

    return handleResponse(res, 200, "Eligible orders fetched", { items: eligible });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * POST /admin/delivery-trips
 * Body: { orderIds: [...], deliveryBoyId }
 * Assigns one rider to every listed order, sequenced nearest-first from the hub.
 */
export const createDeliveryTrip = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { orderIds, deliveryBoyId } = req.body || {};

    if (!Array.isArray(orderIds) || orderIds.length < 2) {
      return handleResponse(res, 400, "orderIds must include at least 2 orders");
    }
    if (!deliveryBoyId) {
      return handleResponse(res, 400, "deliveryBoyId is required");
    }

    const partner = await Delivery.findById(deliveryBoyId).select("_id name");
    if (!partner) {
      return handleResponse(res, 404, "Delivery partner not found");
    }

    const orders = await Order.find({ _id: { $in: orderIds } });
    if (orders.length !== orderIds.length) {
      return handleResponse(res, 404, "One or more orders were not found");
    }

    const first = orders[0];
    for (const order of orders) {
      if (order.hubId !== first.hubId || order.selectedDate !== first.selectedDate || order.selectedSlot !== first.selectedSlot) {
        return handleResponse(res, 400, "All orders must share the same hub, date, and slot");
      }
      if (order.workflowVersion < 2) {
        return handleResponse(res, 400, `Order ${order.orderId} is not on the hub-flow workflow`);
      }
      if (String(order.status || "").toLowerCase() === "cancelled") {
        return handleResponse(res, 400, `Order ${order.orderId} is cancelled`);
      }
      if (String(order.status || "").toLowerCase() === "delivered") {
        return handleResponse(res, 400, `Order ${order.orderId} is already delivered`);
      }
      if (order.deliveryBoy) {
        return handleResponse(res, 400, `Order ${order.orderId} already has a delivery partner`);
      }
    }

    const points = orders.map((order) => ({
      orderId: String(order._id),
      lat: order.address?.location?.lat,
      lng: order.address?.location?.lng,
    }));
    const sequencedStops = sequenceStopsNearestFirst(points);
    const sequenceByOrderId = new Map(sequencedStops.map((s) => [s.orderId, s.sequence]));

    const adminActor = { id: userId, role: "admin" };
    const advanceReason = "Admin batch-assigning delivery trip";

    for (const order of orders) {
      const currentWf = order.workflowStatus || WORKFLOW_STATUS.CREATED;
      if (!ASSIGNABLE_STATES.has(currentWf)) {
        const steps = ADMIN_ADVANCE_PATHS[currentWf];
        if (!steps) {
          return handleResponse(
            res,
            400,
            `Order ${order.orderId} cannot be assigned while in ${currentWf}`,
          );
        }
        for (const toState of steps) {
          transitionOrderFulfillment(order, { toState, actor: adminActor, reason: advanceReason });
        }
      }

      order.deliveryBoy = deliveryBoyId;
      order.tripId = null; // set after trip doc is created below
      transitionOrderFulfillment(order, {
        toState: WORKFLOW_STATUS.DELIVERY_ASSIGNED,
        actor: adminActor,
        reason: "Batch delivery trip assignment",
        metadata: { deliveryBoyId: String(deliveryBoyId) },
      });
      order.assignedAt = new Date();
      order.deliveryRiderStep = order.deliveryRiderStep || 1;

      if (String(order.status || "").toLowerCase() === "pending") {
        order.status = "confirmed";
      }
    }

    const tripId = generateTripId();
    const trip = await DeliveryTrip.create({
      tripId,
      deliveryBoy: deliveryBoyId,
      hubId: first.hubId,
      selectedDate: first.selectedDate,
      selectedSlot: first.selectedSlot,
      stops: orders.map((order) => ({
        order: order._id,
        orderCode: order.orderId,
        sequence: sequenceByOrderId.get(String(order._id)),
        lat: order.address?.location?.lat,
        lng: order.address?.location?.lng,
      })).sort((a, b) => a.sequence - b.sequence),
      currentStopSequence: 1,
    });

    await Promise.all(
      orders.map((order) => {
        order.tripId = trip._id;
        return order.save();
      })
    );

    await createNotification({
      recipient: deliveryBoyId,
      recipientModel: "Delivery",
      title: "New Delivery Trip Assigned",
      message: `You've been assigned ${orders.length} orders to collect from the hub — see your stops in order.`,
      type: "order",
      data: { tripId: trip.tripId, mongoTripId: trip._id.toString() },
    });

    return handleResponse(res, 200, "Delivery trip created", trip);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /delivery/trips/active — the logged-in rider's current in-progress trip.
 */
export const getActiveTripForRider = async (req, res) => {
  try {
    const { id: deliveryBoyId } = req.user;
    const trip = await DeliveryTrip.findOne({ deliveryBoy: deliveryBoyId, status: "active" })
      .populate({
        path: "stops.order",
        select: "orderId address customer totalAmount items",
        populate: { path: "customer", select: "name phone" },
      })
      .lean();

    if (!trip) {
      return handleResponse(res, 200, "No active trip", { trip: null });
    }

    return handleResponse(res, 200, "Active trip fetched", { trip });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/**
 * POST /delivery/trips/:tripId/reached-hub
 * One tap for the whole trip: rider is physically at the hub once, this
 * collects every stop's order in the same step — each runs through the same
 * arrived-at-store -> picked-up transition (and customer notification) the
 * single-order flow already uses, just looped instead of repeated by hand.
 */
export const markTripHubReached = async (req, res) => {
  try {
    const { id: deliveryBoyId } = req.user;
    const { tripId } = req.params;
    const { lat, lng } = req.body || {};

    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return handleResponse(res, 400, "Valid lat/lng required");
    }

    const trip = await DeliveryTrip.findById(tripId);
    if (!trip) {
      return handleResponse(res, 404, "Trip not found");
    }
    if (String(trip.deliveryBoy) !== String(deliveryBoyId)) {
      return handleResponse(res, 403, "This trip is not assigned to you");
    }
    if (trip.status !== "active") {
      return handleResponse(res, 400, "Trip is not active");
    }
    if (trip.hubReachedAt) {
      return handleResponse(res, 200, "Already collected from hub", { trip });
    }

    const results = [];
    for (const stop of trip.stops) {
      try {
        await markArrivedAtStoreAtomic(deliveryBoyId, stop.orderCode, lat, lng);
        await confirmPickupAtomic(deliveryBoyId, stop.orderCode, lat, lng);
        results.push({ orderCode: stop.orderCode, ok: true });
      } catch (e) {
        results.push({ orderCode: stop.orderCode, ok: false, error: e.message });
      }
    }

    const failed = results.filter((r) => !r.ok);
    // Only lock in "collected" once every stop actually made it through —
    // a partial failure should let the rider retry the ones that didn't.
    if (failed.length === 0) {
      trip.hubReachedAt = new Date();
      await trip.save();
    }

    // Keep this a 200 even on partial failure — axios treats non-2xx as a
    // thrown error by default, and the frontend needs the `results` array
    // (not a caught exception) to know which specific orders to retry.
    return handleResponse(
      res,
      200,
      failed.length
        ? `Collected ${results.length - failed.length}/${results.length} orders — retry the rest`
        : "All orders collected from hub",
      { trip, results, partial: failed.length > 0 },
    );
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
