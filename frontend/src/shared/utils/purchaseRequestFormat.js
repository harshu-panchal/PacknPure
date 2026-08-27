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
 * Human-friendly PR label — "PR0195" for the same numeric sequence as the
 * order's own display number ("HUBORD0195"), so a purchase request is
 * instantly recognizable as belonging to that order, in the same short/
 * zero-padded style admin already uses for orders. Falls back to the raw
 * requestId for manual/admin-created PRs that aren't tied to any order.
 */
export const prDisplayCode = (row) => {
  const orderNumber = row?.orderNumber || row?.orderCode || "";
  const digits = String(orderNumber).replace(/^[A-Za-z]+/, "");
  if (digits) return `PR${digits}`;
  return row?.requestId || "";
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
