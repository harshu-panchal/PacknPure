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
