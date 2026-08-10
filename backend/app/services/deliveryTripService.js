import { distanceMeters } from "../utils/geoUtils.js";
import DeliveryTrip from "../models/deliveryTrip.js";

const HUB_LAT = () => Number(process.env.HUB_LOCATION_LAT || process.env.DEFAULT_HUB_LAT || 0);
const HUB_LNG = () => Number(process.env.HUB_LOCATION_LNG || process.env.DEFAULT_HUB_LNG || 0);

/**
 * Greedy nearest-neighbor stop ordering: start at the hub, repeatedly pick
 * the closest unvisited order to the current point, move there, repeat.
 * Not full TSP — appropriate for the small per-slot batch sizes here, and it
 * directly implements "closest customer first, then the next closest from there."
 *
 * @param {Array<{orderId: string, lat: number, lng: number}>} points
 * @returns {Array<{orderId: string, lat: number, lng: number, sequence: number}>}
 */
export function sequenceStopsNearestFirst(points = []) {
  const remaining = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  const skipped = points.filter((p) => !remaining.includes(p));

  const sequenced = [];
  let currentLat = HUB_LAT();
  let currentLng = HUB_LNG();

  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = distanceMeters(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = i;
      }
    }
    const [next] = remaining.splice(nearestIndex, 1);
    currentLat = next.lat;
    currentLng = next.lng;
    sequenced.push(next);
  }

  // Orders with no usable coordinates go last, in original order — never dropped.
  return [...sequenced, ...skipped].map((point, index) => ({
    ...point,
    sequence: index + 1,
  }));
}

export const generateTripId = () =>
  `TRIP-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

/**
 * Call this from every place an order gets marked DELIVERED. Marks that
 * order's stop done on its DeliveryTrip (if it has one), advances
 * currentStopSequence to the next nearest-first pending stop, and closes
 * the trip out once every stop is delivered. No-op for non-trip orders.
 *
 * @param {import("mongoose").Document} order - the just-delivered order
 * @returns {Promise<{orderId: string, sequence: number} | null>} the suggested next stop, or null if the trip is done/there wasn't one
 */
export async function advanceTripOnOrderDelivered(order) {
  if (!order?.tripId) return null;

  const trip = await DeliveryTrip.findById(order.tripId);
  if (!trip) return null;

  const stop = trip.stops.find((s) => String(s.order) === String(order._id));
  if (stop && stop.status !== "delivered") {
    stop.status = "delivered";
    stop.deliveredAt = new Date();
  }

  const pendingStops = trip.stops
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.sequence - b.sequence);

  let nextStop = null;
  if (pendingStops.length) {
    trip.currentStopSequence = pendingStops[0].sequence;
    nextStop = { orderId: pendingStops[0].orderCode, sequence: pendingStops[0].sequence };
  } else {
    trip.status = "completed";
  }

  await trip.save();
  return nextStop;
}
