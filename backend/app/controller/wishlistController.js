import Wishlist from "../models/wishlist.js";
import handleResponse from "../utils/helper.js";
import { enrichCustomerProduct } from "../utils/productHelpers.js";
import {
  buildCanonicalStockContext,
  applyCanonicalStockToMasterProduct,
  applyCanonicalStockToSellerListing,
} from "../services/inventoryReadService.js";

const WISHLIST_PRODUCT_POPULATE = {
  path: "products",
  select:
    "name slug description price salePrice purchasePrice stock brand weight unit mainImage galleryImages status variants categoryId subcategoryId ownerType masterProductId",
  populate: [
    { path: "categoryId", select: "name" },
    { path: "subcategoryId", select: "name" },
  ],
};

/**
 * Attach the same combined hub+seller availability (totalAvailableQty) that
 * category/search listings use. Without this, wishlist products carried no
 * stock data at all (totalAvailableQty is a computed field, never stored on
 * Product), so enrichCustomerProduct always saw 0 and every item showed as
 * out of stock regardless of real hub or seller inventory.
 */
async function attachStockContext(products = []) {
  const masterIds = [
    ...new Set(
      products
        .map((p) => (p?.ownerType === "admin" ? p._id : p?.masterProductId))
        .filter(Boolean)
        .map(String),
    ),
  ];

  let productViews = new Map();
  if (masterIds.length > 0) {
    try {
      const canonicalCtx = await buildCanonicalStockContext(masterIds);
      productViews = canonicalCtx.productViews;
    } catch (err) {
      console.error("[wishlist] stock context error:", err.message);
    }
  }

  return products.map((p) => {
    if (!p || typeof p !== "object" || !p._id) return p;
    const masterIdStr =
      p.ownerType === "admin" ? String(p._id) : String(p.masterProductId || "");
    const canonicalView = productViews.get(masterIdStr);
    if (!canonicalView) return p;

    return p.ownerType === "admin"
      ? applyCanonicalStockToMasterProduct(p, canonicalView)
      : applyCanonicalStockToSellerListing(p, canonicalView);
  });
}

async function mapWishlistProducts(products = []) {
  const stocked = await attachStockContext(
    (products || []).filter((p) => typeof p === "object" && p !== null && p._id),
  );
  const byId = new Map(stocked.map((p) => [String(p._id), p]));

  return (products || []).map((p) => {
    if (typeof p !== "object" || p === null || !p._id) return p;
    const withStock = byId.get(String(p._id)) || p;
    return enrichCustomerProduct(
      typeof withStock.toObject === "function" ? withStock.toObject() : { ...withStock },
    );
  });
}

async function populateWishlist(query) {
  return query.populate(WISHLIST_PRODUCT_POPULATE).lean();
}

/* ===============================
   GET CUSTOMER WISHLIST
================================ */
export const getWishlist = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { idsOnly } = req.query;

    let query = Wishlist.findOne({ customerId });

    if (idsOnly === "true") {
      // Only select the products array (which contains IDs)
      const wishlist = await query.select("products").lean();
      return handleResponse(
        res,
        200,
        "Wishlist IDs fetched",
        wishlist || { products: [] },
      );
    }

    const wishlist = await populateWishlist(query);

    if (!wishlist) {
      const newWishlist = await Wishlist.create({ customerId, products: [] });
      return handleResponse(
        res,
        200,
        "Wishlist fetched successfully",
        { ...newWishlist.toObject(), products: [] },
      );
    }

    return handleResponse(res, 200, "Wishlist fetched successfully", {
      ...wishlist,
      products: await mapWishlistProducts(wishlist.products),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADD TO WISHLIST
================================ */
export const addToWishlist = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId } = req.body;

    let wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      wishlist = new Wishlist({ customerId, products: [] });
    }

    if (!wishlist.products.includes(productId)) {
      wishlist.products.push(productId);
    }

    await wishlist.save();
    const updatedWishlist = await populateWishlist(
      Wishlist.findById(wishlist._id),
    );

    return handleResponse(
      res,
      200,
      "Product added to wishlist",
      {
        ...updatedWishlist,
        products: await mapWishlistProducts(updatedWishlist?.products),
      },
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REMOVE FROM WISHLIST
================================ */
export const removeFromWishlist = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId } = req.params;

    let wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      return handleResponse(res, 404, "Wishlist not found");
    }

    wishlist.products = wishlist.products.filter(
      (id) => id.toString() !== productId,
    );

    await wishlist.save();
    const updatedWishlist = await populateWishlist(
      Wishlist.findById(wishlist._id),
    );

    return handleResponse(
      res,
      200,
      "Product removed from wishlist",
      {
        ...updatedWishlist,
        products: await mapWishlistProducts(updatedWishlist?.products),
      },
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   TOGGLE WISHLIST
================================ */
export const toggleWishlist = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId } = req.body;

    let wishlist = await Wishlist.findOne({ customerId });

    if (!wishlist) {
      wishlist = new Wishlist({ customerId, products: [] });
    }

    const index = wishlist.products.indexOf(productId);
    let message = "";

    if (index > -1) {
      wishlist.products.splice(index, 1);
      message = "Product removed from wishlist";
    } else {
      wishlist.products.push(productId);
      message = "Product added to wishlist";
    }

    await wishlist.save();
    const updatedWishlist = await populateWishlist(
      Wishlist.findById(wishlist._id),
    );

    return handleResponse(res, 200, message, {
      ...updatedWishlist,
      products: await mapWishlistProducts(updatedWishlist?.products),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
