import Cart from "../models/cart.js";
import Product from "../models/product.js";
import handleResponse from "../utils/helper.js";

const CART_POPULATE_FIELDS =
  "name slug mainImage status categoryId subcategoryId sellerId variants ownerType masterProductId";

function findVariant(productDoc, variantId) {
  if (!variantId) return null;
  const list = productDoc?.variants;
  if (!Array.isArray(list) || list.length === 0) return null;
  return (
    list.find((v) => String(v?._id) === String(variantId)) ||
    list.find((v) => String(v?.id) === String(variantId)) ||
    null
  );
}

function getSellPrice(productDoc, variant) {
  const v = variant || productDoc?.variants?.[0];
  if (v) {
    const sale = Number(v.salePrice ?? v.price) || 0;
    const mrp = Number(v.price) || sale;
    return { sale, mrp };
  }
  return { sale: 0, mrp: 0 };
}

import { getCustomerFulfillableQty } from "../services/inventoryReadService.js";

async function getAvailableStock(productDoc, variant) {
  const variantId = variant ? (variant._id || variant.id) : null;
  const masterProductId = productDoc.masterProductId || productDoc._id;
  const view = await getCustomerFulfillableQty({
    masterProductId,
    variantId: variantId || null,
  });
  return view.totalFulfillableQty;
}

async function enrichCartStock(cartDoc) {
  if (!cartDoc || !Array.isArray(cartDoc.items)) return cartDoc;
  for (const item of cartDoc.items) {
    if (item.productId && Array.isArray(item.productId.variants)) {
      for (const v of item.productId.variants) {
        v.stock = await getAvailableStock(item.productId, v);
      }
    }
  }
  return cartDoc;
}

/* ===============================
   GET CUSTOMER CART
================================ */
export const getCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId })
      .populate("items.productId", CART_POPULATE_FIELDS)
      .lean();

    if (!cart) {
      const newCart = await Cart.create({ customerId, items: [] });
      return handleResponse(res, 200, "Cart fetched successfully", newCart);
    }

    return handleResponse(res, 200, "Cart fetched successfully", await enrichCartStock(cart));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADD TO CART
================================ */
export const addToCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity = 1, variantId = null } = req.body;
    console.log("[addToCart] received payload:", { customerId, productId, quantity, variantId });
    const qty = Math.max(1, Number(quantity) || 1);

    const product = await Product.findById(productId)
      .select(CART_POPULATE_FIELDS)
      .lean();
    if (!product) return handleResponse(res, 404, "Product not found");
    if (String(product.status || "") !== "active") {
      return handleResponse(res, 400, "Product is inactive");
    }

    let variant = variantId ? findVariant(product, variantId) : null;
    if (!variant && Array.isArray(product.variants) && product.variants.length > 0) {
      variant = product.variants[0];
    }
    
    if (!variant) {
      return handleResponse(res, 400, "Variant not found or product has no variants");
    }
    
    const actualVariantId = String(variant._id || variant.id);

    const available = await getAvailableStock(product, variant);
    if (available <= 0) {
      return handleResponse(res, 400, "Out of stock");
    }

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      cart = new Cart({ customerId, items: [] });
    }

    const normProductId = String(productId);
    const normVariantId = actualVariantId;

    // First pass: find exact match (same productId AND same variantId)
    let itemIndex = cart.items.findIndex((item) => {
      const sameProduct = String(item.productId) === normProductId;
      const itemVar = item.variantId ? String(item.variantId) : "";
      return sameProduct && itemVar === normVariantId;
    });

    // Second pass: if no exact match found, check if any item for this product
    // has a null/empty variantId — this happens when a guest cart item was saved
    // without variantId and the resolved default variant matches. Merge instead of duplicate.
    if (itemIndex === -1) {
      const nullVarIndex = cart.items.findIndex((item) => {
        const sameProduct = String(item.productId) === normProductId;
        const itemVar = item.variantId ? String(item.variantId) : "";
        return sameProduct && itemVar === "";
      });
      if (nullVarIndex > -1) {
        // Upgrade the null-variantId row to have the proper variantId and merge
        cart.items[nullVarIndex].variantId = actualVariantId;
        itemIndex = nullVarIndex;
      }
    }

    // Third pass: de-duplicate — if multiple rows exist for same product+variant, merge them
    const duplicateIndexes = [];
    cart.items.forEach((item, i) => {
      if (i === itemIndex) return;
      const sameProduct = String(item.productId) === normProductId;
      const itemVar = item.variantId ? String(item.variantId) : "";
      if (sameProduct && (itemVar === normVariantId || itemVar === "")) {
        duplicateIndexes.push(i);
      }
    });
    if (duplicateIndexes.length > 0) {
      // Merge all duplicate quantities into the primary item (if found), then remove duplicates
      const extraQty = duplicateIndexes.reduce((sum, i) => sum + Number(cart.items[i].quantity || 0), 0);
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity = Math.max(1, Number(cart.items[itemIndex].quantity || 0) + extraQty);
      }
      // Remove duplicates in reverse order to preserve indexes
      duplicateIndexes.sort((a, b) => b - a).forEach((i) => cart.items.splice(i, 1));
      // Recalculate itemIndex after splice
      itemIndex = cart.items.findIndex((item) => {
        const sameProduct = String(item.productId) === normProductId;
        const itemVar = item.variantId ? String(item.variantId) : "";
        return sameProduct && itemVar === normVariantId;
      });
    }

    if (itemIndex > -1) {
      const nextQty = Math.max(1, Number(cart.items[itemIndex].quantity || 0) + qty);
      if (nextQty > available) {
        return handleResponse(res, 400, "Insufficient stock", {
          available,
          requested: nextQty,
        });
      }
      cart.items[itemIndex].quantity = nextQty;
    } else {
      if (qty > available) {
        return handleResponse(res, 400, "Insufficient stock", {
          available,
          requested: qty,
        });
      }
      cart.items.push({
        productId,
        quantity: qty,
        variantId: actualVariantId,
      });
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id)
      .populate("items.productId", CART_POPULATE_FIELDS)
      .lean();

    return handleResponse(res, 200, "Item added to cart", await enrichCartStock(updatedCart));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE QUANTITY
================================ */
export const updateQuantity = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity, variantId = null } = req.body;
    const qty = Math.max(0, Number(quantity) || 0);

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      return handleResponse(res, 404, "Cart not found");
    }

    const normProductId = String(productId);
    const normVariantId = variantId ? String(variantId) : "";
    const itemIndex = cart.items.findIndex((item) => {
      const sameProduct = String(item.productId) === normProductId;
      const itemVar = item.variantId ? String(item.variantId) : "";
      return sameProduct && itemVar === normVariantId;
    });

    if (itemIndex > -1) {
      if (qty <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const product = await Product.findById(productId)
          .select(CART_POPULATE_FIELDS)
          .lean();
        if (!product) return handleResponse(res, 404, "Product not found");
        if (String(product.status || "") !== "active") {
          return handleResponse(res, 400, "Product is inactive");
        }

        let variant = variantId ? findVariant(product, variantId) : null;
        if (!variant && Array.isArray(product.variants) && product.variants.length > 0) {
          variant = product.variants[0];
        }
        
        if (!variant) {
          return handleResponse(res, 400, "Variant not found");
        }

        const available = await getAvailableStock(product, variant);
        if (available <= 0) {
          return handleResponse(res, 400, "Out of stock");
        }
        if (qty > available) {
          return handleResponse(res, 400, "Insufficient stock", {
            available,
            requested: qty,
          });
        }

        cart.items[itemIndex].quantity = qty;
      }
    } else {
      return handleResponse(res, 404, "Product not in cart");
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id)
      .populate("items.productId", CART_POPULATE_FIELDS)
      .lean();

    return handleResponse(res, 200, "Cart updated successfully", await enrichCartStock(updatedCart));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REMOVE FROM CART
================================ */
export const removeFromCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId } = req.params;
    const { variantId = null } = req.query;

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      return handleResponse(res, 404, "Cart not found");
    }

    cart.items = cart.items.filter((item) => {
      if (item.productId.toString() !== productId) return true;
      if (!variantId) return false;
      return String(item.variantId || "") !== String(variantId);
    });

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate(
      "items.productId",
      CART_POPULATE_FIELDS,
    );

    return handleResponse(res, 200, "Item removed from cart", await enrichCartStock(updatedCart));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CLEAR CART
================================ */
export const clearCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId });

    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return handleResponse(res, 200, "Cart cleared successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
