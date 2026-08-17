import { distanceMeters } from "./geoUtils.js";
import { getSettings } from "../services/settingsService.js";

/**
 * Calculates delivery fee based on distance between hub and customer.
 * @param {Object} customerCoords - { lat, lng }
 * @returns {Promise<Object>} { distanceKm, deliveryFee, isFree }
 */
export async function calculateDeliveryFee(customerCoords) {
  try {
    const settings = await getSettings();
    
    // Default values if settings not found
    const hubCoords = settings?.hubLocation?.coordinates || [75.8975, 22.7533]; // [lng, lat]
    const [hubLng, hubLat] = hubCoords;
    const { lat: custLat, lng: custLng } = customerCoords;

    if (!Number.isFinite(custLat) || !Number.isFinite(custLng)) {
      return { 
        distanceKm: 0, 
        deliveryFee: settings?.baseDeliveryFee ?? 20, 
        platformFee: settings?.platformFee ?? 3,
        gstPercentage: 0,
        isOutOfRange: false 
      };
    }

    // 1. Calculate straight line distance (Haversine)
    const distanceM = distanceMeters(hubLat, hubLng, custLat, custLng);
    const distanceKm = Number((distanceM / 1000).toFixed(2));

    // 2. Calculate fee: Base + (Dist > baseFreeKm ? extra * PerKm : 0)
    const baseDeliveryFee = settings?.baseDeliveryFee ?? 20;
    const baseFreeKm = settings?.baseFreeKm ?? 1;
    const perKmCharge = settings?.perKmDeliveryCharge ?? 10;
    const freeDeliveryThreshold = settings?.freeDeliveryThreshold ?? 500;
    const platformFee = settings?.platformFee ?? 3;
    const gstPercentage = 0; // Shifted to item-level taxation
    const maxServiceRadius = settings?.maxServiceRadius ?? 15;

    let deliveryFee = baseDeliveryFee;
    if (distanceKm > baseFreeKm) {
      deliveryFee += (distanceKm - baseFreeKm) * perKmCharge;
    }

    const isOutOfRange = distanceKm > maxServiceRadius;

    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      deliveryFee: Math.round(deliveryFee),
      baseDeliveryFee,
      baseFreeKm,
      perKmCharge,
      freeDeliveryThreshold,
      platformFee,
      gstPercentage,
      maxServiceRadius,
      isOutOfRange
    };
  } catch (error) {
    console.error("Delivery fee calculation error:", error);
    return {
      distanceKm: 0,
      deliveryFee: 20,
      platformFee: 3,
      gstPercentage: 0,
      isOutOfRange: false
    };
  }
}

/**
 * Applies Express delivery pricing rules to a pricing object in place.
 *
 * Express charge always applies once Express mode is selected (no minimum
 * distance). Delivery fee is waived only when the customer's distance is
 * within the admin-configured `expressFreeDeliveryMaxDistanceKm` (or when
 * that limit is unset, meaning always free). Outside that range, the
 * already-computed distance-based delivery fee is kept, so both charges apply.
 *
 * @param {Object} pricing - Must have `deliveryFee` and `distanceKm` set already.
 * @param {string} deliveryMode - "EXPRESS" | "SLOT"
 * @param {Object} delSettings - DeliverySettings document (or plain object with same shape)
 * @returns {Object} the same pricing object, mutated
 */
export function applyExpressDeliveryCharge(pricing, deliveryMode, delSettings) {
  if (deliveryMode !== "EXPRESS") {
    pricing.expressCharge = 0;
    return pricing;
  }

  pricing.expressCharge = Number(delSettings?.expressCharge || 0);

  const maxKm = delSettings?.expressFreeDeliveryMaxDistanceKm;
  const distanceKm = Number(pricing.distanceKm);
  const withinFreeRange =
    maxKm === null || maxKm === undefined || !Number.isFinite(distanceKm) || distanceKm <= maxKm;

  if (withinFreeRange) {
    pricing.deliveryFee = 0;
  }
  // else: keep the already-computed distance-based deliveryFee — both charges apply.

  return pricing;
}
