import mongoose from "mongoose";
import { PRODUCT_UNITS } from "../utils/productHelpers.js";

/**
 * Variant pricing (meaning depends on parent product ownerType):
 * - admin master: price = MRP, salePrice = customer price, purchasePrice = hub cost
 * - seller listing: purchasePrice = supply price (canonical); price/salePrice mirror supply
 */
const variantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      enum: PRODUCT_UNITS,
      default: "Pieces",
    },
    /** Admin: MRP. Seller: mirrored supply price (use purchasePrice as canonical). */
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Admin: customer selling price. Seller: mirrored supply price. */
    salePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Admin: hub procurement reference. Seller: supply price (what vendor charges hub). */
    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    committedStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** When true, gstRate applies to this variant's taxable price. */
    gstEnabled: {
      type: Boolean,
      default: false,
    },
    gstRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    adminExtraGstEnabled: {
      type: Boolean,
      default: false,
    },
    adminExtraGstRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalVendorCost: {
      type: Number,
      default: 0,
    },
    finalSupplyPrice: {
      type: Number,
      default: 0,
    },
    /** Admin master: permanent Code128 identity (immutable once set). */
    barcodeId: {
      type: String,
      trim: true,
    },
    barcodeValue: {
      type: String,
      trim: true,
    },
    barcodeGeneratedAt: {
      type: Date,
    },
    /** Seller listing: permanent seller-specific Code128 identity (immutable once set). */
    sellerBarcodeId: {
      type: String,
      trim: true,
    },
    sellerBarcodeValue: {
      type: String,
      trim: true,
    },
    sellerBarcodeGeneratedAt: {
      type: Date,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratingDistribution: {
      type: Map,
      of: Number,
      default: () => new Map([['1', 0], ['2', 0], ['3', 0], ['4', 0], ['5', 0]]),
    },
  },
  { _id: true },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    /** Admin master: MRP (list price). Seller listing: mirrored supply price. */
    // Pricing and stock moved strictly to variants array
    // price, salePrice, purchasePrice, stock, committedStock removed from root
    lowStockAlert: {
      type: Number,
      default: 5,
    },
    brand: {
      type: String,
      trim: true,
    },
    weight: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    mainImage: {
      type: String,
    },
    galleryImages: [
      {
        type: String,
      },
    ],
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    /**
     * admin = master catalog (customer-facing). One row per name + variant signature.
     * seller = supplier supply listing (procurement price + stock). Links via masterProductId.
     */
    ownerType: {
      type: String,
      enum: ["seller", "admin"],
      default: "seller",
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      default: null,
      required: function () {
        return this.ownerType !== "admin";
      },
    },
    status: {
      type: String,
      enum: ["pending_approval", "active", "inactive", "rejected"],
      default: "pending_approval",
    },
    variants: {
      type: [variantSchema],
      default: [],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    masterProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    /** Set when a live seller listing changes supply price or stock — admin should review catalog pricing. */
    adminReview: {
      pending: { type: Boolean, default: false },
      types: {
        type: [String],
        enum: ["supply_price", "stock"],
        default: [],
      },
      updatedAt: { type: Date, default: null },
      summary: { type: String, default: null },
      previousSupplyPrice: { type: Number, default: null },
      newSupplyPrice: { type: Number, default: null },
      previousStock: { type: Number, default: null },
      newStock: { type: Number, default: null },
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratingDistribution: {
      type: Map,
      of: Number,
      default: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    },
  },
  { timestamps: true },
);

productSchema.index({ "adminReview.pending": 1, ownerType: 1, status: 1 });

productSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ subcategoryId: 1, status: 1 });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ ownerType: 1, status: 1, createdAt: -1 });
productSchema.index({ ownerType: 1, name: 1, categoryId: 1 });
productSchema.index({ masterProductId: 1, sellerId: 1 });
productSchema.index({ name: "text", tags: "text" });
/** Unique only when a barcode string is present (avoids null collisions). */
productSchema.index(
  { "variants.barcodeValue": 1 },
  {
    unique: true,
    partialFilterExpression: { "variants.barcodeValue": { $type: "string" } },
    name: "variants_barcodeValue_unique",
  },
);
productSchema.index(
  { "variants.sellerBarcodeValue": 1 },
  {
    unique: true,
    partialFilterExpression: { "variants.sellerBarcodeValue": { $type: "string" } },
    name: "variants_sellerBarcodeValue_unique",
  },
);

/** Seller listings: canonical supply price (API alias for purchasePrice on variants). */
productSchema.virtual("supplyPrice").get(function supplyPriceVirtual() {
  if (this.ownerType !== "seller") return undefined;
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    return Math.max(0, Number(this.variants[0].purchasePrice ?? this.variants[0].price) || 0);
  }
  return 0;
});

productSchema.virtual("pricingMode").get(function pricingModeVirtual() {
  return this.ownerType === "seller" ? "supply" : "customer";
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

import { calculateGstCostings } from "../utils/productHelpers.js";

productSchema.pre('save', function (next) {
  calculateGstCostings(this, this.ownerType);
  next();
});

productSchema.post('init', function (doc) {
  if (doc.gstAmount === undefined || doc.finalVendorCost === undefined) {
    calculateGstCostings(doc, doc.ownerType);
  }
});

/** Drop unique indexes for removed fields (sku, etc.) after schema changes. */
productSchema.statics.syncLegacyIndexes = async function syncLegacyIndexes() {
  const collection = this.collection;
  let indexes = [];
  try {
    indexes = await collection.indexes();
  } catch {
    return;
  }

  const dropKeys = ["sku", "headerId"];
  for (const idx of indexes) {
    const name = idx.name;
    if (!name || name === "_id_") continue;
    const shouldDrop = dropKeys.some((k) => Object.prototype.hasOwnProperty.call(idx.key || {}, k));
    if (!shouldDrop) continue;
    try {
      await collection.dropIndex(name);
      console.log(`[Product] Dropped legacy index: ${name}`);
    } catch (err) {
      if (err?.code !== 27) {
        console.warn(`[Product] Could not drop index ${name}:`, err.message);
      }
    }
  }
};

export default mongoose.model("Product", productSchema);
