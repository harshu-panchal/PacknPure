import Product from "../../models/product.js";
import HubInventory from "../../models/hubInventory.js";

export const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";

export class InventoryError extends Error {
  constructor(message, code = "INVENTORY_ERROR", details = {}) {
    super(message);
    this.name = "InventoryError";
    this.code = code;
    this.details = details;
  }
}

export const assertPositiveQuantity = (quantity, fieldName = "quantity") => {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new InventoryError(`${fieldName} must be a positive number`, "INVALID_QUANTITY", {
      [fieldName]: quantity,
    });
  }
  return qty;
};

export const assertNonNegativeQuantity = (quantity, fieldName = "quantity") => {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    throw new InventoryError(`${fieldName} cannot be negative`, "INVALID_QUANTITY", {
      [fieldName]: quantity,
    });
  }
  return qty;
};

export const loadProduct = async (productId, session = null) => {
  const product = await Product.findById(productId).session(session);
  if (!product) {
    throw new InventoryError("Product not found", "PRODUCT_NOT_FOUND", { productId });
  }
  return product;
};

export const loadVariantStock = (product, variantId) => {
  if (!variantId) {
    return {
      stock: Math.max(0, Number(product.stock) || 0),
      committedStock: Math.max(0, Number(product.committedStock) || 0),
    };
  }

  const variant = product.variants?.find(
    (v) => String(v._id) === String(variantId) || String(v.id) === String(variantId),
  );
  if (!variant) {
    throw new InventoryError("Variant not found", "VARIANT_NOT_FOUND", {
      productId: product._id,
      variantId,
    });
  }

  return {
    stock: Math.max(0, Number(variant.stock) || 0),
    committedStock: Math.max(0, Number(variant.committedStock) || 0),
    variant,
  };
};

export const validateVariantExists = async (productId, variantId, session = null) => {
  const product = await loadProduct(productId, session);
  if (variantId) {
    loadVariantStock(product, variantId);
  }
  return product;
};

export const validateHubInventoryExists = async (
  productId,
  hubId = DEFAULT_HUB_ID,
  session = null,
  { createIfMissing = false } = {},
) => {
  let hubInventory = await HubInventory.findOne({ productId, hubId }).session(session);
  if (!hubInventory && createIfMissing) {
    return null;
  }
  if (!hubInventory) {
    throw new InventoryError("Hub inventory not found", "HUB_INVENTORY_NOT_FOUND", {
      productId,
      hubId,
    });
  }
  return hubInventory;
};

export const validateSellerInventoryExists = async (productId, variantId = null, session = null) => {
  return validateVariantExists(productId, variantId, session);
};

export const validateSufficientHubAvailable = (hubInventory, quantity) => {
  const availableQty = Math.max(0, Number(hubInventory.availableQty) || 0);
  if (availableQty < quantity) {
    throw new InventoryError("Insufficient hub available stock", "INSUFFICIENT_HUB_STOCK", {
      availableQty,
      requestedQty: quantity,
    });
  }
  return availableQty;
};

export const validateSufficientHubReserved = (hubInventory, quantity) => {
  const reservedQty = Math.max(0, Number(hubInventory.reservedQty) || 0);
  if (reservedQty < quantity) {
    return { valid: false, reservedQty };
  }
  return { valid: true, reservedQty };
};

export const validateSufficientSellerAvailable = (product, variantId, quantity) => {
  const { stock } = loadVariantStock(product, variantId);
  if (stock < quantity) {
    throw new InventoryError("Insufficient seller stock", "INSUFFICIENT_SELLER_STOCK", {
      availableQty: stock,
      requestedQty: quantity,
    });
  }
  return stock;
};

export const validateSufficientSellerCommitted = (product, variantId, quantity) => {
  const { committedStock } = loadVariantStock(product, variantId);
  if (committedStock < quantity) {
    return { valid: false, committedStock };
  }
  return { valid: true, committedStock };
};

export const validateInventory = async ({
  productId,
  variantId = null,
  hubId = DEFAULT_HUB_ID,
  quantity = 0,
  scope = "hub_available",
  session = null,
}) => {
  const qty = assertNonNegativeQuantity(quantity);

  if (scope === "hub_available" || scope === "hub_reserved") {
    const hubInventory = await validateHubInventoryExists(productId, hubId, session);
    if (scope === "hub_available") {
      validateSufficientHubAvailable(hubInventory, qty);
    } else {
      const check = validateSufficientHubReserved(hubInventory, qty);
      if (!check.valid) {
        throw new InventoryError("Insufficient hub reserved stock", "INSUFFICIENT_HUB_RESERVED", {
          reservedQty: check.reservedQty,
          requestedQty: qty,
        });
      }
    }
    return { hubInventory };
  }

  const product = await validateSellerInventoryExists(productId, variantId, session);
  if (scope === "seller_available") {
    validateSufficientSellerAvailable(product, variantId, qty);
  } else if (scope === "seller_committed") {
    const check = validateSufficientSellerCommitted(product, variantId, qty);
    if (!check.valid) {
      throw new InventoryError("Insufficient seller committed stock", "INSUFFICIENT_SELLER_COMMITTED", {
        committedStock: check.committedStock,
        requestedQty: qty,
      });
    }
  }

  return { product };
};
