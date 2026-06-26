import { getUnitLabel } from "@shared/constants/productUnits";

/** Resolve variant label for order line items (customer, admin, seller, delivery UI). */

export function resolveOrderItemVariantLabel(item) {
  if (!item) return null;
  if (item.variantSlot) return item.variantSlot;

  const variantId = item.variantId ? String(item.variantId) : "";
  const product =
    item.product && typeof item.product === "object" ? item.product : null;
  const variants = product?.variants;
  const unit = product?.unit || item.unit;

  if (variantId && Array.isArray(variants)) {
    const match = variants.find(
      (v) => String(v?._id || v?.id) === variantId,
    );
    if (match) {
      const matchUnit = match.unit || unit;
      return [match.name, matchUnit ? getUnitLabel(matchUnit) : null].filter(Boolean).join(" · ");
    }
  }

  return null;
}

export function formatOrderItemNameWithVariant(item) {
  const label = resolveOrderItemVariantLabel(item);
  if (!label) return item?.name || "";
  return `${item.name} (${label})`;
}
