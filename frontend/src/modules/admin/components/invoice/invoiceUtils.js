import { resolveOrderItemVariantLabel } from '@/shared/utils/orderItemDisplay';
import { getOrderDeliverySnapshot } from '@/shared/utils/deliverySnapshot';

export function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatStatus(status) {
  if (!status) return '—';
  return String(status).replace(/_/g, ' ').toUpperCase();
}

export function getCustomerFromOrder(order) {
  const customer = order?.customer || {};
  const guest = order?.guestCustomer || {};
  const address = order?.address || {};
  return {
    name:
      address?.name ||
      customer?.name ||
      guest?.name ||
      (order?.orderSource === 'POS' ? 'Walk-in Customer' : '—'),
    phone: address?.phone || customer?.phone || guest?.phone || '—',
    email: customer?.email || guest?.email || '—',
    addressLine: address?.address || '—',
    city: address?.city || '',
    landmark: address?.landmark || '',
    state: address?.state || '',
    pincode: address?.pincode || address?.pinCode || address?.zip || '',
  };
}

export function parseAddressParts(addressLine = '') {
  const text = String(addressLine || '');
  const pincodeMatch = text.match(/\b(\d{6})\b/);
  const pincode = pincodeMatch ? pincodeMatch[1] : '';
  return { pincode };
}

export function getInvoiceNumber(order) {
  return order?.invoiceNumber || order?.receiptNumber || `INV-${order?.orderId || 'NA'}`;
}

export function getPaymentMethodLabel(order) {
  const method = String(order?.payment?.method || order?.payment?.paymentMode || 'cash').toLowerCase();
  if (method === 'cod' || (method === 'cash' && order?.orderSource !== 'POS')) {
    // Online COD-style cash-on-delivery still stored as "cash" for many orders
  }
  const map = {
    cash: 'Cash / COD',
    online: 'Online',
    upi: 'UPI',
    card: 'Card',
    wallet: 'Wallet',
    cod: 'COD',
  };
  return map[method] || String(order?.payment?.method || 'Cash').toUpperCase();
}

export function isCodPayment(order) {
  const method = String(order?.payment?.method || '').toLowerCase();
  const mode = String(order?.payment?.paymentMode || '').toUpperCase();
  if (method === 'cod') return true;
  if (method === 'cash' && order?.orderSource !== 'POS') return true;
  if (mode === 'CASH' && order?.orderSource !== 'POS' && method !== 'online' && method !== 'upi' && method !== 'card') {
    return true;
  }
  return false;
}

export function getTrackingUrl(order) {
  if (order?.trackingUrl) return order.trackingUrl;
  if (!order?.orderId || typeof window === 'undefined') return '';
  return `${window.location.origin}/orders/${order.orderId}`;
}

export function buildLineItems(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.map((item, index) => {
    const qty = Number(item.quantity ?? item.qty ?? 0) || 0;
    const unitPrice = Number(item.price ?? 0) || 0;
    const gstRate = Number(item.gstRate ?? 0) || 0;
    const gstAmount =
      item.gstAmount != null
        ? Number(item.gstAmount) || 0
        : Number(((unitPrice * qty * gstRate) / 100).toFixed(2));
    const discount = Number(item.discount ?? 0) || 0;
    const lineTotal = unitPrice * qty + gstAmount - discount;
    const product =
      item.product && typeof item.product === 'object' ? item.product : null;
    const variantLabel = resolveOrderItemVariantLabel(item) || '—';
    const sku =
      item.sku ||
      product?.sku ||
      (item.variantId ? String(item.variantId).slice(-8).toUpperCase() : '') ||
      (product?._id ? String(product._id).slice(-8).toUpperCase() : '—');
    const hsn = item.hsn || product?.hsn || product?.hsnCode || '—';
    const image = item.image || product?.mainImage || '';

    return {
      key: item._id || `${index}-${item.name}`,
      name: item.name || product?.name || 'Item',
      variant: variantLabel,
      sku,
      hsn,
      image,
      unitPrice,
      quantity: qty,
      gstRate,
      gstAmount,
      discount,
      total: lineTotal,
      weight: item.weight || product?.weight || '',
      fragile: Boolean(item.fragile || product?.fragile),
    };
  });
}

export function buildInvoiceSummary(order, lineItems) {
  const pricing = order?.pricing || order?.bill || {};
  const payment = order?.payment || {};

  const computedSubtotal = lineItems.reduce(
    (sum, row) => sum + row.unitPrice * row.quantity,
    0,
  );
  const computedGst = lineItems.reduce((sum, row) => sum + row.gstAmount, 0);
  const computedItemDiscount = lineItems.reduce((sum, row) => sum + row.discount, 0);

  const subtotal = Number(pricing.subtotal ?? computedSubtotal) || 0;
  const discountType = pricing.discountDetails?.type || 'none';
  const discountAmount =
    Number(pricing.discount ?? pricing.discountDetails?.amount ?? computedItemDiscount) || 0;
  const couponDiscount =
    discountType === 'coupon'
      ? discountAmount
      : Number(pricing.couponDiscount ?? 0) || 0;
  const discount = discountType === 'coupon' ? 0 : discountAmount;
  const deliveryCharges = Number(pricing.deliveryFee ?? 0) || 0;
  const packingCharges = Number(pricing.packingFee ?? pricing.packingCharges ?? 0) || 0;
  const platformCharges = Number(pricing.platformFee ?? 0) || 0;
  const tax = Number(pricing.gst ?? computedGst) || 0;
  const tip = Number(pricing.tip ?? 0) || 0;
  const grandTotal = Number(pricing.total ?? 0) || 0;

  const paidAmount =
    payment.paidAmount != null
      ? Number(payment.paidAmount) || 0
      : String(payment.status || '').toLowerCase() === 'completed'
        ? grandTotal
        : 0;
  const remainingAmount =
    payment.remainingAmount != null
      ? Number(payment.remainingAmount) || 0
      : Math.max(0, grandTotal - paidAmount);

  return {
    subtotal,
    discount,
    couponDiscount,
    deliveryCharges,
    packingCharges,
    platformCharges,
    tax,
    tip,
    grandTotal,
    paidAmount,
    remainingAmount,
  };
}

export function buildInvoiceViewModel(order, settings = {}, systemUser = '') {
  const lineItems = buildLineItems(order);
  const summary = buildInvoiceSummary(order, lineItems);
  const customer = getCustomerFromOrder(order);
  const parsed = parseAddressParts(customer.addressLine);
  if (!customer.pincode && parsed.pincode) customer.pincode = parsed.pincode;

  const snap = getOrderDeliverySnapshot(order);
  const deliveryZone =
    snap?.zoneName ||
    snap?.deliveryZone ||
    order?.deliveryZone ||
    customer.city ||
    '—';

  const itemCount = lineItems.reduce((sum, row) => sum + row.quantity, 0);
  const fragile = lineItems.some((row) => row.fragile);
  const weights = lineItems.map((row) => row.weight).filter(Boolean);
  const parcelWeight = order?.parcelWeight || order?.weight || (weights.length ? weights.join(', ') : '');

  const deliveryMode = String(snap?.deliveryMode || order?.deliveryMode || 'EXPRESS').toUpperCase();
  const expressBadge = deliveryMode !== 'SLOT';

  const companyName =
    settings.companyName ||
    order?.posDetails?.sellerSnapshot?.businessName ||
    settings.appName ||
    'Packnpure Pvt Ltd';

  const website =
    settings.website ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  return {
    orderId: order?._id || order?.id || '',
    orderNumber: order?.orderId || '—',
    invoiceNumber: getInvoiceNumber(order),
    invoiceDate: order?.invoiceDate || order?.updatedAt || order?.createdAt,
    orderDate: order?.createdAt,
    packingDate:
      order?.packedAt ||
      (['packed', 'delivered', 'out_for_delivery'].includes(String(order?.status || '').toLowerCase())
        ? order?.updatedAt
        : null),
    paymentStatus: formatStatus(order?.payment?.status),
    orderStatus: formatStatus(order?.status),
    company: {
      name: companyName,
      address: settings.address || order?.posDetails?.sellerSnapshot?.address || '—',
      gst: settings.taxId || order?.posDetails?.sellerSnapshot?.gstin || '—',
      email: settings.supportEmail || '—',
      phone: settings.supportPhone || '—',
      website: website || '—',
      logoUrl: settings.logoUrl || '/packnpure-icon.svg',
      appName: settings.appName || 'PACKNPURE',
    },
    customer,
    lineItems,
    summary,
    payment: {
      method: getPaymentMethodLabel(order),
      rawMethod: String(order?.payment?.method || '').toLowerCase(),
      paymentMode: order?.payment?.paymentMode || '',
      isCash: ['cash', 'cod'].includes(String(order?.payment?.method || '').toLowerCase()),
      isOnline: ['online', 'card', 'wallet'].includes(String(order?.payment?.method || '').toLowerCase()),
      isUpi: String(order?.payment?.method || '').toLowerCase() === 'upi',
      isCod: isCodPayment(order),
      transactionId: order?.payment?.transactionId || '—',
      paymentTime: order?.payment?.paidAt || order?.updatedAt || order?.createdAt,
      status: formatStatus(order?.payment?.status),
      codAmount: isCodPayment(order) ? summary.remainingAmount || summary.grandTotal : 0,
    },
    parcel: {
      deliveryZone,
      itemCount,
      fragile,
      parcelWeight,
      expressBadge,
      deliveryMode,
    },
    trackingUrl: getTrackingUrl(order),
    generatedAt: new Date(),
    systemUser: systemUser || 'Admin',
    sellerName: order?.seller?.shopName || order?.seller?.name || '',
  };
}
