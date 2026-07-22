/**
 * Strip personal phone numbers from order payloads based on viewer role.
 * Admin and seller views are unchanged.
 */

function stripPhone(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const next = { ...obj };
  delete next.phone;
  return next;
}

export function sanitizeOrderForRole(order, role) {
  if (!order || typeof order !== "object") return order;
  const roleNorm = String(role || "").toLowerCase();
  const next = { ...order };

  if (roleNorm === "customer" || roleNorm === "user") {
    if (next.deliveryBoy && typeof next.deliveryBoy === "object") {
      next.deliveryBoy = stripPhone(next.deliveryBoy);
      next.deliveryBoy.maskedCallingReady = true;
    }
    if (next.returnDeliveryBoy && typeof next.returnDeliveryBoy === "object") {
      next.returnDeliveryBoy = stripPhone(next.returnDeliveryBoy);
    }
  }

  if (roleNorm === "delivery") {
    if (next.customer && typeof next.customer === "object") {
      next.customer = stripPhone(next.customer);
    }
    if (next.address && typeof next.address === "object") {
      next.address = { ...next.address };
      delete next.address.phone;
    }
    next.maskedCallingReady = true;
  }

  return next;
}

export function enrichDeliveryPartnerPublicProfile(deliveryBoy) {
  if (!deliveryBoy || typeof deliveryBoy !== "object") return deliveryBoy;
  const vehicleLabels = {
    bike: "Motorcycle",
    cycle: "Bicycle",
    scooter: "Scooter",
  };
  return {
    ...deliveryBoy,
    vehicleTypeLabel:
      vehicleLabels[deliveryBoy.vehicleType] || deliveryBoy.vehicleType || "Motorcycle",
    profileImage: deliveryBoy.documents?.profileImage || null,
    rating: deliveryBoy.averageRating ?? deliveryBoy.rating ?? 4.8,
    maskedCallingReady: true,
    phone: undefined,
  };
}
