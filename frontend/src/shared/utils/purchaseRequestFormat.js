export const formatPrDate = (value, opts = {}) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...opts,
    });
  } catch {
    return "—";
  }
};

export const formatPrDateShort = (value) =>
  formatPrDate(value, { hour: undefined, minute: undefined });

export const formatInr = (n) =>
  Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Human-friendly PR label — e.g. "PNP-ORD0042-S1" for the purchase request
 * tied to master order "PNP-ORD0042".
 */
export const prDisplayCode = (row) => {
  if (row?.displayCode) return row.displayCode;
  if (row?.requestId && (row.requestId.startsWith("PNP-ORD") || row.requestId.startsWith("ORD") || row.requestId.startsWith("HUBORD") || row.requestId.startsWith("SLRORD"))) {
    return row.requestId;
  }
  const orderNumber = row?.orderNumber || row?.orderCode || "";
  if (orderNumber) {
    return `${orderNumber}-S1`;
  }
  return row?.requestId || "—";
};

export const prStatusLabel = (status) => {
  const map = {
    created: "Pending vendor",
    seller_confirmed: "Seller confirmed",
    vendor_confirmed: "Vendor confirmed",
    pickup_assigned: "Pickup assigned",
    picked: "In transit",
    hub_delivered: "At hub gate",
    received_at_hub: "Received at hub",
    verified: "Verified & stocked",
    seller_rejected: "Seller rejected",
    expired: "Expired",
    closed: "Closed",
    cancelled: "Cancelled",
    exception: "Exception",
  };
  return map[String(status || "")] || String(status || "—");
};
