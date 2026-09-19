/** Order line-item variant resolution and API enrichment. */

export const ORDER_ITEM_PRODUCT_POPULATE =
  "name mainImage price salePrice variants unit purchasePrice gstRate";

export function findOrderVariant(productDoc, variantId) {
  if (!variantId) return null;
  const list = productDoc?.variants;
  if (!Array.isArray(list) || list.length === 0) return null;
  return (
    list.find((v) => String(v?._id) === String(variantId)) ||
    list.find((v) => String(v?.id) === String(variantId)) ||
    null
  );
}

export function formatOrderVariantSlot(variant, productDoc) {
  if (!variant) return undefined;
  const parts = [variant.name, variant.unit || productDoc?.unit].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export function resolveOrderItemVariantLabel(item) {
  if (item?.variantSlot) return item.variantSlot;
  const product =
    item?.product && typeof item.product === "object" ? item.product : null;
  const variantId = item?.variantId ? String(item.variantId) : "";
  if (!variantId || !product) return null;
  const variant = findOrderVariant(product, variantId);
  return formatOrderVariantSlot(variant, product) || null;
}

export function resolveOrderItemPrice(productDoc, variant, fallbackPrice) {
  if (variant) {
    const rawSale = Number(variant.salePrice ?? variant.price) || fallbackPrice || 0;
    const isGst = !!variant.gstEnabled && Number(variant.gstRate) > 0;
    const gstAmt = isGst ? Math.round((rawSale * Number(variant.gstRate)) / 100) : 0;
    return rawSale + gstAmt;
  }
  const rawSale =
    fallbackPrice ||
    Number(productDoc?.salePrice ?? productDoc?.price) ||
    0;
  const isGst = !!productDoc?.gstEnabled && Number(productDoc?.gstRate) > 0;
  const gstAmt = isGst ? Math.round((rawSale * Number(productDoc?.gstRate)) / 100) : 0;
  return rawSale + gstAmt;
}

export function enrichOrderItem(item) {
  if (!item || typeof item !== "object") return item;
  const label = resolveOrderItemVariantLabel(item);
  if (!label || item.variantSlot === label) {
    return label ? { ...item, variantSlot: label } : item;
  }
  return { ...item, variantSlot: label };
}

export function enrichOrderItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(enrichOrderItem);
}

import { legacyDeliverySnapshotFromOrder } from "../services/deliverySnapshotService.js";

export function computeFulfillmentSummary(order) {
  const displayNo = order.displayOrderNumber || order.orderId || "";
  const items = Array.isArray(order.items) ? order.items : [];
  
  if (order.orderSource === "POS") {
    const isSellerPos = Boolean(order.posDetails?.sellerId);
    return {
      type: "POS",
      label: isSellerPos ? "Seller POS" : "Hub POS",
      code: isSellerPos ? `${displayNo}-S1` : `${displayNo}-POS`,
      hubCode: null,
      sellerCodes: isSellerPos ? [`${displayNo}-S1`] : [],
      hubItemsCount: isSellerPos ? 0 : items.length,
      sellerItemsCount: isSellerPos ? items.length : 0,
      badgeVariant: "slate",
    };
  }

  if (order.hubFlowEnabled) {
    let hubCount = 0;
    let sellerCount = 0;

    for (const item of items) {
      const required = Number(item.quantity || 1);
      const hubAvailable = Number(item.hubReservedQty || 0) + Number(item.qaAcceptedQty || 0);
      const vendorNeeded = Number(item.vendorProcuredQty || 0);

      if (hubAvailable >= required && vendorNeeded === 0) {
        hubCount += 1;
      } else if (vendorNeeded > 0) {
        sellerCount += 1;
        if (hubAvailable > 0) hubCount += 1;
      } else if (order.hubStatus === "inventory_reserved" && !order.procurementRequired) {
        hubCount += 1;
      } else if (order.procurementRequired || order.hubStatus === "procurement_required") {
        sellerCount += 1;
      } else {
        hubCount += 1;
      }
    }

    if (sellerCount > 0 && hubCount > 0) {
      return {
        type: "SPLIT",
        label: "Split (Hub + Seller)",
        code: `${displayNo}-HUB + S1`,
        hubCode: `${displayNo}-HUB`,
        sellerCodes: [`${displayNo}-S1`],
        hubItemsCount: hubCount,
        sellerItemsCount: sellerCount,
        badgeVariant: "indigo",
      };
    }

    if (sellerCount > 0 && hubCount === 0) {
      return {
        type: "SELLER_PROCURED",
        label: "Seller Procured",
        code: `${displayNo}-S1`,
        hubCode: null,
        sellerCodes: [`${displayNo}-S1`],
        hubItemsCount: 0,
        sellerItemsCount: sellerCount || items.length,
        badgeVariant: "amber",
      };
    }

    return {
      type: "HUB_DIRECT",
      label: "Hub Direct",
      code: `${displayNo}-HUB`,
      hubCode: `${displayNo}-HUB`,
      sellerCodes: [],
      hubItemsCount: items.length,
      sellerItemsCount: 0,
      badgeVariant: "emerald",
    };
  }

  // Legacy direct seller
  if (order.seller) {
    return {
      type: "SELLER_DIRECT",
      label: "Seller Direct",
      code: `${displayNo}-S1`,
      hubCode: null,
      sellerCodes: [`${displayNo}-S1`],
      hubItemsCount: 0,
      sellerItemsCount: items.length,
      badgeVariant: "sky",
    };
  }

  return {
    type: "HUB_DIRECT",
    label: "Hub Direct",
    code: `${displayNo}-HUB`,
    hubCode: `${displayNo}-HUB`,
    sellerCodes: [],
    hubItemsCount: items.length,
    sellerItemsCount: 0,
    badgeVariant: "emerald",
  };
}

export function enrichOrderDoc(order) {
  if (!order || typeof order !== "object") return order;
  const next = { ...order };
  if (!next.displayOrderNumber) {
    next.displayOrderNumber = next.orderId;
  }
  if (Array.isArray(order.items)) {
    next.items = enrichOrderItems(order.items);
  }
  // Compute fulfillment metadata (Hub vs Seller breakdown)
  next.fulfillmentSummary = computeFulfillmentSummary(next);
  next.fulfillmentType = next.fulfillmentSummary.type;

  // Ensure every order response exposes a deliverySnapshot (legacy-safe)
  if (!next.deliverySnapshot?.deliveryMode) {
    next.deliverySnapshot = legacyDeliverySnapshotFromOrder(next);
  }
  return next;
}
