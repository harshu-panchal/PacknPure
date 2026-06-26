/**
 * Seed catalog products for the hub-first pricing model:
 *
 * - Admin master (ownerType: admin): price = MRP, salePrice = customer price,
 *   purchasePrice = hub procurement reference, stock = hub warehouse qty.
 * - Per-variant GST (gstEnabled + gstRate) is applied from product category/tags.
 * - Seller supply (optional --with-sellers): purchasePrice = supply price only
 *   (mirrored on price/salePrice), stock = vendor supply qty, linked via masterProductId.
 *   Seller variants inherit GST flags from the linked master catalog item.
 *
 * Images are picked automatically from product name + tags (see scripts/lib/seedProductImages.js).
 *
 * Prerequisite: run category seed first
 *   npm run seed:categories
 *
 * Usage (from backend/):
 *   npm run seed:products
 *   npm run seed:products:clear              # clear admin + seller seed rows, then re-seed admin only
 *   node scripts/seedProducts.js --with-sellers
 *   node scripts/seedProducts.js --clear --with-sellers
 *
 * Requires MONGO_URI in backend/.env
 * Seller supply seed needs at least one active Seller document in the database.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import Category from "../app/models/category.js";
import Product from "../app/models/product.js";
import HubInventory from "../app/models/hubInventory.js";
import Seller from "../app/models/seller.js";
import { ensureUniqueSlug } from "../app/utils/productSlug.js";
import {
  normalizeAdminVariants,
  normalizeSellerVariants,
  syncRootFromFirstVariant,
  totalVariantStock,
  buildVariantSignature,
} from "../app/utils/productHelpers.js";
import { buildProductImages } from "./lib/seedProductImages.js";

const DEFAULT_HUB_ID = process.env.DEFAULT_HUB_ID || "MAIN_HUB";
const SEED_TAG = "seed:catalog";
const SEED_SUPPLY_TAG = "seed:supply";

const EMPTY_ADMIN_REVIEW = {
  pending: false,
  types: [],
  updatedAt: null,
  summary: null,
  previousSupplyPrice: null,
  newSupplyPrice: null,
  previousStock: null,
  newStock: null,
};

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function subSlug(parentName, subName) {
  return `${slugify(parentName)}-${slugify(subName)}`;
}

function escapeRegex(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Realistic per-product GST for seed demos (variants can override explicitly). */
function resolveSeedGstForProduct(row = {}) {
  const tags = new Set((row.tags || []).map((t) => String(t).toLowerCase()));
  const parent = String(row.parent || "").toLowerCase();
  const sub = String(row.sub || "").toLowerCase();

  if (
    (tags.has("fresh") &&
      (tags.has("vegetables") ||
        tags.has("tomato") ||
        tags.has("onion") ||
        tags.has("herbs") ||
        tags.has("coriander") ||
        tags.has("spinach"))) ||
    (parent === "fruits & vegetables" &&
      (sub.includes("tomato") || sub.includes("onion") || sub.includes("leafy")))
  ) {
    return { gstEnabled: false, gstRate: 0 };
  }

  if (tags.has("cola") || tags.has("soft-drink") || sub.includes("soft drink")) {
    return { gstEnabled: true, gstRate: 28 };
  }
  if (tags.has("water") || sub.includes("water")) {
    return { gstEnabled: true, gstRate: 18 };
  }
  if (
    tags.has("cleaning") ||
    tags.has("detergent") ||
    parent === "cleaning & consumables" ||
    parent === "kitchenware" ||
    tags.has("kitchenware") ||
    tags.has("packaging")
  ) {
    return { gstEnabled: true, gstRate: 18 };
  }
  if (tags.has("biscuit") || tags.has("bakery")) {
    return { gstEnabled: true, gstRate: 18 };
  }
  if (tags.has("cheese") || tags.has("butter") || sub.includes("butter")) {
    return { gstEnabled: true, gstRate: 12 };
  }
  if (
    tags.has("juice") ||
    tags.has("maggi") ||
    tags.has("ketchup") ||
    tags.has("sauce") ||
    tags.has("namkeen") ||
    tags.has("snacks")
  ) {
    return { gstEnabled: true, gstRate: 12 };
  }

  return { gstEnabled: true, gstRate: 5 };
}

function enrichSeedVariantsWithGst(row = {}) {
  const defaultGst = resolveSeedGstForProduct(row);
  return (row.variants || []).map((v) => {
    const hasExplicitGst =
      v.gstEnabled !== undefined ||
      (v.gstRate !== undefined && Number(v.gstRate) > 0);
    if (hasExplicitGst) {
      const gstEnabled = Boolean(v.gstEnabled);
      return {
        ...v,
        gstEnabled,
        gstRate: gstEnabled ? Math.max(0, Number(v.gstRate) || 0) : 0,
      };
    }
    return { ...v, ...defaultGst };
  });
}

function seedGstSummary(variants = []) {
  const withGst = variants.filter((v) => v.gstEnabled && Number(v.gstRate) > 0);
  if (!withGst.length) return "no GST";
  const rates = [...new Set(withGst.map((v) => v.gstRate))].sort((a, b) => a - b);
  return rates.length === 1 ? `GST ${rates[0]}%` : `GST ${rates.join("/")}%`;
}

function hubInventoryStatus(availableQty, reorderLevel = 10) {
  const qty = Math.max(0, Number(availableQty) || 0);
  const reorder = Math.max(0, Number(reorderLevel) || 0);
  if (qty <= 0) return "out_of_stock";
  if (qty <= reorder) return "low_stock";
  return "healthy";
}

async function syncHubStock(product, lowStockAlert) {
  const hubQty = totalVariantStock(product.variants) || Math.max(0, Number(product.stock) || 0);
  const sellPrice =
    Number(product.salePrice) > 0 ? Number(product.salePrice) : Number(product.price) || 0;
  const reorderLevel = Math.max(0, Number(lowStockAlert) || 10);

  await HubInventory.findOneAndUpdate(
    { hubId: DEFAULT_HUB_ID, productId: product._id },
    {
      $set: {
        availableQty: hubQty,
        status: hubInventoryStatus(hubQty, reorderLevel),
        reorderLevel,
        sellPrice,
        priceUpdatedAt: new Date(),
      },
      $setOnInsert: { reservedQty: 0 },
    },
    { upsert: true, new: true },
  );
}

/**
 * parent + sub = exact names from seedCategories.js CATEGORY_CATALOG
 * @type {Array<object>}
 */
const PRODUCT_CATALOG = [
  {
    name: "Amul Taaza Toned Milk",
    parent: "Dairy",
    sub: "Milk",
    brand: "Amul",
    isFeatured: true,
    description: "Fresh toned milk for tea, coffee, and kitchen use. Ideal for daily HoReCa consumption.",
    tags: ["milk", "dairy", "toned", "amul"],
    variants: [
      { name: "500 ml", unit: "Pack", price: 32, salePrice: 30, purchasePrice: 24, stock: 140 },
      { name: "1 Litre", unit: "L", price: 62, salePrice: 58, purchasePrice: 47, stock: 95 },
    ],
  },
  {
    name: "Amul Butter Salted",
    parent: "Dairy",
    sub: "Butter",
    brand: "Amul",
    description: "Salted table butter for baking, spreading, and commercial kitchen prep.",
    tags: ["butter", "dairy"],
    variants: [
      { name: "100 g", unit: "Pack", price: 58, salePrice: 55, purchasePrice: 44, stock: 80 },
      { name: "500 g", unit: "Pack", price: 275, salePrice: 265, purchasePrice: 210, stock: 45 },
    ],
  },
  {
    name: "Milky Mist Paneer Block",
    parent: "Dairy",
    sub: "Paneer & Cottage Cheese",
    brand: "Milky Mist",
    isFeatured: true,
    description: "Fresh paneer block for gravies, tikkas, and bulk kitchen orders.",
    tags: ["paneer", "dairy", "fresh"],
    variants: [
      { name: "200 g", unit: "Pack", price: 95, salePrice: 89, purchasePrice: 72, stock: 60 },
      { name: "1 kg", unit: "kg", price: 420, salePrice: 399, purchasePrice: 320, stock: 35 },
    ],
  },
  {
    name: "Hybrid Tomatoes (Grade A)",
    parent: "Fruits & Vegetables",
    sub: "Tomatoes & Onions",
    brand: "Farm Fresh",
    description: "Firm red tomatoes sorted for restaurant prep and retail packs.",
    tags: ["vegetables", "tomato", "fresh"],
    variants: [
      { name: "1 kg", unit: "kg", price: 42, salePrice: 38, purchasePrice: 28, stock: 200 },
      { name: "5 kg", unit: "kg", price: 195, salePrice: 180, purchasePrice: 135, stock: 70 },
    ],
  },
  {
    name: "Nasik Red Onion",
    parent: "Fruits & Vegetables",
    sub: "Tomatoes & Onions",
    brand: "Farm Fresh",
    description: "Storage onions for bulk kitchen — consistent size and low moisture.",
    tags: ["onion", "vegetables"],
    variants: [
      { name: "1 kg", unit: "kg", price: 38, salePrice: 35, purchasePrice: 26, stock: 250 },
      { name: "10 kg", unit: "kg", price: 340, salePrice: 320, purchasePrice: 240, stock: 55 },
    ],
  },
  {
    name: "Coriander Leaves Bunch",
    parent: "Fruits & Vegetables",
    sub: "Leafy Greens & Herbs",
    brand: "Farm Fresh",
    description: "Washed coriander bunches for garnish and chutney prep.",
    tags: ["herbs", "coriander", "fresh"],
    variants: [
      { name: "1 Bunch", unit: "Bundle", price: 18, salePrice: 15, purchasePrice: 10, stock: 120 },
      { name: "5 Bunch Pack", unit: "Bundle", price: 75, salePrice: 68, purchasePrice: 45, stock: 40 },
    ],
  },
  {
    name: "Organic Fuji Apple",
    parent: "Fruits & Vegetables",
    sub: "Organic Fruits",
    brand: "Organic Harvest",
    isFeatured: true,
    description: "Sweet organic apples — good for salads, desserts, and juice bars.",
    tags: ["apple", "organic", "fruit"],
    variants: [
      { name: "500 g", unit: "kg", price: 120, salePrice: 110, purchasePrice: 85, stock: 50 },
      { name: "2 kg", unit: "kg", price: 440, salePrice: 420, purchasePrice: 320, stock: 22 },
    ],
  },
  {
    name: "India Gate Basmati Rice Classic",
    parent: "Rice & Rice Products",
    sub: "Basmati Rice",
    brand: "India Gate",
    isFeatured: true,
    description: "Long-grain basmati for biryani and daily rice service.",
    tags: ["rice", "basmati", "staple"],
    variants: [
      { name: "1 kg", unit: "kg", price: 145, salePrice: 138, purchasePrice: 115, stock: 90 },
      { name: "5 kg", unit: "kg", price: 680, salePrice: 649, purchasePrice: 540, stock: 40 },
      { name: "25 kg", unit: "kg", price: 3200, salePrice: 3099, purchasePrice: 2650, stock: 12 },
    ],
  },
  {
    name: "Tata Sampann Toor Dal",
    parent: "Pulses",
    sub: "Toor Dal",
    brand: "Tata Sampann",
    description: "Unpolished toor dal for sambar, dal fry, and bulk kitchen.",
    tags: ["dal", "pulses", "toor"],
    variants: [
      { name: "1 kg", unit: "kg", price: 148, salePrice: 142, purchasePrice: 118, stock: 75 },
      { name: "5 kg", unit: "kg", price: 710, salePrice: 685, purchasePrice: 560, stock: 28 },
    ],
  },
  {
    name: "Fortune Refined Sunflower Oil",
    parent: "Edible Oils",
    sub: "Sunflower Oil",
    brand: "Fortune",
    description: "Light refined oil for frying, sautéing, and general cooking.",
    tags: ["oil", "sunflower", "cooking"],
    variants: [
      { name: "1 Litre", unit: "L", price: 165, salePrice: 158, purchasePrice: 132, stock: 65 },
      { name: "5 Litre", unit: "L", price: 780, salePrice: 749, purchasePrice: 620, stock: 25 },
    ],
  },
  {
    name: "MDH Garam Masala",
    parent: "Masala, Salt & Sugar",
    sub: "Garam Masala",
    brand: "MDH",
    description: "Aromatic garam masala blend for curries and marinades.",
    tags: ["masala", "spice", "mdh"],
    variants: [
      { name: "100 g", unit: "Pack", price: 78, salePrice: 75, purchasePrice: 58, stock: 100 },
      { name: "500 g", unit: "Pack", price: 360, salePrice: 345, purchasePrice: 270, stock: 35 },
    ],
  },
  {
    name: "Fresh Chicken Breast Boneless",
    parent: "Chicken & Eggs",
    sub: "Chicken Breast & Boneless",
    brand: "Licious",
    isFeatured: true,
    description: "Skinless breast cuts for grills, salads, and bulk prep.",
    tags: ["chicken", "protein", "fresh"],
    variants: [
      { name: "500 g", unit: "kg", price: 195, salePrice: 185, purchasePrice: 155, stock: 40 },
      { name: "1 kg", unit: "kg", price: 375, salePrice: 359, purchasePrice: 300, stock: 25 },
    ],
  },
  {
    name: "Farm Fresh Brown Eggs",
    parent: "Chicken & Eggs",
    sub: "Farm Eggs",
    brand: "Happy Hens",
    description: "Brown eggs for bakery, breakfast, and bulk trays.",
    tags: ["eggs", "protein"],
    variants: [
      { name: "6 Pieces", unit: "Pieces", price: 54, salePrice: 52, purchasePrice: 42, stock: 90 },
      { name: "30 Pieces Tray", unit: "Box", price: 255, salePrice: 245, purchasePrice: 200, stock: 30 },
    ],
  },
  {
    name: "Coca-Cola Original",
    parent: "Beverages & Mixers",
    sub: "Soft Drinks",
    brand: "Coca-Cola",
    description: "Classic cola for restaurant and cloud-kitchen beverage service.",
    tags: ["beverage", "cola", "soft-drink"],
    variants: [
      { name: "750 ml", unit: "Pack", price: 42, salePrice: 40, purchasePrice: 32, stock: 110 },
      { name: "2.25 Litre", unit: "L", price: 95, salePrice: 89, purchasePrice: 72, stock: 48 },
    ],
  },
  {
    name: "Real Fruit Power Orange Juice",
    parent: "Beverages & Mixers",
    sub: "Fruit Juices",
    brand: "Real",
    description: "Ready-to-serve orange juice for breakfast and buffet.",
    tags: ["juice", "beverage"],
    variants: [
      { name: "1 Litre", unit: "L", price: 115, salePrice: 108, purchasePrice: 88, stock: 55 },
      { name: "2 Litre", unit: "L", price: 210, salePrice: 199, purchasePrice: 165, stock: 28 },
    ],
  },
  {
    name: "Bisleri Packaged Water",
    parent: "Beverages & Mixers",
    sub: "Water & Soda",
    brand: "Bisleri",
    description: "Packaged drinking water for kitchen, staff, and customer packs.",
    tags: ["water", "beverage"],
    variants: [
      { name: "1 Litre", unit: "Pack", price: 20, salePrice: 18, purchasePrice: 14, stock: 200 },
      { name: "5 Litre", unit: "L", price: 75, salePrice: 70, purchasePrice: 55, stock: 80 },
    ],
  },
  {
    name: "Britannia Good Day Cashew Cookies",
    parent: "Bakery & Chocolates",
    sub: "Cookies & Biscuits",
    brand: "Britannia",
    description: "Cashew cookies for pantry, tea service, and add-on sales.",
    tags: ["biscuit", "bakery", "snacks"],
    variants: [
      { name: "75 g", unit: "Pack", price: 25, salePrice: 24, purchasePrice: 18, stock: 150 },
      { name: "1 kg Bulk", unit: "kg", price: 280, salePrice: 265, purchasePrice: 220, stock: 20 },
    ],
  },
  {
    name: "Amul Processed Cheese Slices",
    parent: "Dairy",
    sub: "Cheese",
    brand: "Amul",
    description: "Cheese slices for burgers, sandwiches, and melts.",
    tags: ["cheese", "dairy"],
    variants: [
      { name: "100 g (10 slices)", unit: "Pack", price: 125, salePrice: 119, purchasePrice: 95, stock: 70 },
      { name: "400 g", unit: "Pack", price: 460, salePrice: 439, purchasePrice: 360, stock: 25 },
    ],
  },
  {
    name: "Aashirvaad Select Sharbati Atta",
    parent: "Flours",
    sub: "Whole Wheat Atta",
    brand: "Aashirvaad",
    isFeatured: true,
    description: "Premium wheat atta for roti, paratha, and bakery prep.",
    tags: ["atta", "flour", "wheat"],
    variants: [
      { name: "5 kg", unit: "kg", price: 285, salePrice: 275, purchasePrice: 230, stock: 50 },
      { name: "10 kg", unit: "kg", price: 540, salePrice: 519, purchasePrice: 440, stock: 22 },
    ],
  },
  {
    name: "Happilo Premium Almonds",
    parent: "Dry Fruits & Nuts",
    sub: "Almonds",
    brand: "Happilo",
    description: "California almonds for sweets, garnishing, and bulk kitchen.",
    tags: ["dry-fruits", "almonds", "nuts"],
    variants: [
      { name: "250 g", unit: "Pack", price: 285, salePrice: 269, purchasePrice: 220, stock: 45 },
      { name: "1 kg", unit: "kg", price: 1080, salePrice: 1049, purchasePrice: 860, stock: 18 },
    ],
  },
  {
    name: "McCain Green Peas Frozen",
    parent: "Frozen & Instant Food",
    sub: "Frozen Vegetables",
    brand: "McCain",
    description: "IQF green peas for curries, fried rice, and quick prep.",
    tags: ["frozen", "peas", "vegetables"],
    variants: [
      { name: "400 g", unit: "Pack", price: 95, salePrice: 89, purchasePrice: 72, stock: 60 },
      { name: "2.5 kg", unit: "kg", price: 520, salePrice: 499, purchasePrice: 410, stock: 15 },
    ],
  },
  {
    name: "Maggi 2-Minute Masala Noodles",
    parent: "Frozen & Instant Food",
    sub: "Instant Noodles",
    brand: "Maggi",
    description: "Instant noodles for staff meals, add-ons, and quick service.",
    tags: ["maggi", "instant", "noodles"],
    variants: [
      { name: "70 g", unit: "Pack", price: 14, salePrice: 14, purchasePrice: 11, stock: 300 },
      { name: "12 Pack Box", unit: "Box", price: 155, salePrice: 148, purchasePrice: 125, stock: 45 },
    ],
  },
  {
    name: "Heinz Tomato Ketchup",
    parent: "Sauces & Seasoning",
    sub: "Tomato Ketchup",
    brand: "Heinz",
    description: "Thick tomato ketchup for fries, burgers, and condiment stations.",
    tags: ["ketchup", "sauce", "condiment"],
    variants: [
      { name: "500 g", unit: "Pack", price: 125, salePrice: 119, purchasePrice: 95, stock: 65 },
      { name: "1 kg", unit: "kg", price: 230, salePrice: 219, purchasePrice: 175, stock: 30 },
    ],
  },
  {
    name: "Medium Prawns Cleaned",
    parent: "Fish, Prawns & Seafood",
    sub: "Prawns & Shrimps",
    brand: "Sea Fresh",
    description: "Deveined medium prawns for curries, grills, and bulk orders.",
    tags: ["seafood", "prawns"],
    variants: [
      { name: "500 g", unit: "kg", price: 320, salePrice: 305, purchasePrice: 260, stock: 25 },
      { name: "1 kg", unit: "kg", price: 620, salePrice: 589, purchasePrice: 500, stock: 12 },
    ],
  },
  {
    name: "Goat Mutton Curry Cut",
    parent: "Mutton, Duck & Lamb",
    sub: "Mutton Curry Cut",
    brand: "Licious",
    description: "Curry-cut mutton pieces for biryani, curry, and slow cooking.",
    tags: ["mutton", "meat"],
    variants: [
      { name: "500 g", unit: "kg", price: 385, salePrice: 369, purchasePrice: 310, stock: 18 },
      { name: "1 kg", unit: "kg", price: 750, salePrice: 719, purchasePrice: 600, stock: 10 },
    ],
  },
  {
    name: "Harpic Power Plus Toilet Cleaner",
    parent: "Cleaning & Consumables",
    sub: "Toilet Cleaners",
    brand: "Harpic",
    description: "Toilet cleaner for outlet hygiene and housekeeping.",
    tags: ["cleaning", "hygiene"],
    variants: [
      { name: "500 ml", unit: "ml", price: 95, salePrice: 89, purchasePrice: 72, stock: 55 },
      { name: "1 Litre", unit: "L", price: 175, salePrice: 165, purchasePrice: 130, stock: 28 },
    ],
  },
  {
    name: "Surf Excel Matic Top Load",
    parent: "Cleaning & Consumables",
    sub: "Laundry Detergent",
    brand: "Surf Excel",
    description: "Laundry detergent for staff uniforms and linen.",
    tags: ["detergent", "laundry"],
    variants: [
      { name: "1 kg", unit: "kg", price: 285, salePrice: 269, purchasePrice: 220, stock: 40 },
      { name: "4 kg", unit: "kg", price: 980, salePrice: 949, purchasePrice: 780, stock: 15 },
    ],
  },
  {
    name: "Prestige Non-Stick Tawa 28cm",
    parent: "Kitchenware",
    sub: "Kadai & Tawa",
    brand: "Prestige",
    description: "Non-stick tawa for roti, dosa, and flatbread stations.",
    tags: ["kitchenware", "tawa"],
    variants: [
      { name: "28 cm", unit: "Pieces", price: 899, salePrice: 849, purchasePrice: 680, stock: 20 },
    ],
  },
  {
    name: "EcoPack Clamshell Container 750ml",
    parent: "Packaging Material",
    sub: "Clamshell & Hinged Boxes",
    brand: "EcoPack",
    description: "Food-grade clamshell boxes for takeaway and delivery.",
    tags: ["packaging", "disposable"],
    variants: [
      { name: "50 pcs", unit: "Box", price: 420, salePrice: 399, purchasePrice: 320, stock: 35 },
      { name: "200 pcs", unit: "Box", price: 1550, salePrice: 1499, purchasePrice: 1200, stock: 12 },
    ],
  },
  {
    name: "Haldiram Bhujia Sev",
    parent: "Your Menu Add-ons",
    sub: "Appetizers & Starters",
    brand: "Haldiram",
    description: "Crispy bhujia for chaat counters, sides, and snack add-ons.",
    tags: ["snacks", "namkeen", "addon"],
    variants: [
      { name: "200 g", unit: "Pack", price: 55, salePrice: 52, purchasePrice: 42, stock: 85 },
      { name: "1 kg", unit: "kg", price: 240, salePrice: 229, purchasePrice: 185, stock: 30 },
    ],
  },
  {
    name: "Tata Salt Iodized",
    parent: "Masala, Salt & Sugar",
    sub: "Salt",
    brand: "Tata",
    description: "Iodized salt for everyday cooking and bulk kitchen.",
    tags: ["salt", "staple"],
    variants: [
      { name: "1 kg", unit: "kg", price: 28, salePrice: 26, purchasePrice: 20, stock: 180 },
      { name: "5 kg", unit: "kg", price: 125, salePrice: 118, purchasePrice: 95, stock: 50 },
    ],
  },
];

async function buildCategoryIndex() {
  const rows = await Category.find({ status: "active" }).lean();
  const bySlug = new Map();
  for (const row of rows) {
    bySlug.set(row.slug, row);
  }
  return bySlug;
}

function resolveCategoryIds(bySlug, parentName, subName) {
  const pSlug = slugify(parentName);
  const sSlug = subSlug(parentName, subName);
  const parent = bySlug.get(pSlug);
  const sub = bySlug.get(sSlug);
  if (!parent) {
    throw new Error(`Parent category not found: "${parentName}" (slug: ${pSlug})`);
  }
  if (!sub) {
    throw new Error(
      `Subcategory not found: "${subName}" under "${parentName}" (slug: ${sSlug}). Run seed:categories first.`,
    );
  }
  if (String(sub.parentId) !== String(parent._id)) {
    throw new Error(`Subcategory "${subName}" is not a child of "${parentName}"`);
  }
  return { categoryId: parent._id, subcategoryId: sub._id };
}

async function clearSeedProducts() {
  const sellerDeleted = await Product.deleteMany({
    tags: SEED_SUPPLY_TAG,
    ownerType: "seller",
  });
  if (sellerDeleted.deletedCount > 0) {
    console.log(`Cleared ${sellerDeleted.deletedCount} seller supply seed listings`);
  }

  const seedProducts = await Product.find({
    tags: SEED_TAG,
    ownerType: "admin",
    sellerId: null,
  })
    .select("_id")
    .lean();
  const ids = seedProducts.map((p) => p._id);
  if (!ids.length) {
    console.log("No previous admin seed products to clear");
    return;
  }
  await HubInventory.deleteMany({ productId: { $in: ids } });
  const deleted = await Product.deleteMany({ _id: { $in: ids } });
  console.log(`Cleared ${deleted.deletedCount} admin seed products and hub inventory rows`);
}

async function findExistingAdminSeed(row, normalizedVariants, defaultUnit) {
  const signature = buildVariantSignature(normalizedVariants, defaultUnit);
  const candidates = await Product.find({
    ownerType: "admin",
    sellerId: null,
    masterProductId: null,
    tags: SEED_TAG,
    name: { $regex: new RegExp(`^${escapeRegex(row.name.trim())}$`, "i") },
  }).lean();

  return (
    candidates.find(
      (p) => buildVariantSignature(p.variants, p.unit) === signature,
    ) || null
  );
}

async function upsertSeedProduct(row, bySlug) {
  const { categoryId, subcategoryId } = resolveCategoryIds(bySlug, row.parent, row.sub);
  const slug = await ensureUniqueSlug(row.name);

  const defaultUnit = row.variants[0]?.unit || "Pieces";
  const first = row.variants[0] || {};
  const variantsWithGst = enrichSeedVariantsWithGst(row);
  const normalizedVariants = normalizeAdminVariants(variantsWithGst, {
    defaultUnit,
    basePrice: Number(first.price) || 0,
    baseSalePrice: Number(first.salePrice) || Number(first.price) || 0,
    basePurchasePrice: Number(first.purchasePrice) || 0,
  });

  const { mainImage, galleryImages, imageKey } = buildProductImages({
    name: row.name,
    tags: row.tags,
    imageKey: row.imageKey,
    slug,
  });

  const productData = {
    name: row.name.trim(),
    slug,
    description: row.description || "",
    brand: row.brand || "",
    weight: row.weight || row.variants[0]?.name || "",
    categoryId,
    subcategoryId,
    ownerType: "admin",
    sellerId: null,
    masterProductId: null,
    status: "active",
    isFeatured: Boolean(row.isFeatured),
    lowStockAlert: row.lowStockAlert ?? 10,
    unit: defaultUnit,
    tags: [...new Set([...(row.tags || []), SEED_TAG])],
    mainImage,
    galleryImages,
    variants: normalizedVariants,
    adminReview: { ...EMPTY_ADMIN_REVIEW },
  };

  syncRootFromFirstVariant(productData, "admin");

  const existing = await findExistingAdminSeed(row, normalizedVariants, defaultUnit);
  let product;
  if (existing) {
    productData.slug = existing.slug || productData.slug;
    product = await Product.findByIdAndUpdate(
      existing._id,
      { $set: productData },
      { new: true, runValidators: true },
    );
  } else {
    product = await Product.create(productData);
  }

  await syncHubStock(product, productData.lowStockAlert);
  return { product, imageKey };
}

/** Seller supply variants: same names/units as master, supply price only. */
function buildSellerSupplyVariantsFromMaster(master, stockScale = 1) {
  const masterRows =
    Array.isArray(master.variants) && master.variants.length > 0
      ? master.variants
      : [
          {
            name: "Default",
            unit: master.unit,
            purchasePrice: master.purchasePrice,
            stock: master.stock,
          },
        ];

  return masterRows.map((v, index) => {
    const hubCost = Number(v.purchasePrice) || Math.round(Number(v.salePrice || v.price) * 0.78);
    const supply = Math.max(1, hubCost);
    const baseStock = Math.max(10, Math.round((Number(v.stock) || 40) * Number(stockScale || 1)));
    const stock = baseStock + index * 5;
    return {
      name: v.name,
      unit: v.unit || master.unit,
      price: supply,
      salePrice: supply,
      purchasePrice: supply,
      stock,
      gstEnabled: Boolean(v.gstEnabled),
      gstRate: v.gstEnabled ? Math.max(0, Number(v.gstRate) || 0) : 0,
    };
  });
}

async function upsertSellerSupplyListing(master, seller, opts = {}) {
  const {
    status = "active",
    masterProductId = master._id,
    pendingReview = false,
    reviewTypes = ["supply_price"],
    reviewSummary = null,
  } = opts;

  const existing = await Product.findOne({
    sellerId: seller._id,
    masterProductId,
    tags: SEED_SUPPLY_TAG,
  });

  const supplyVariants = buildSellerSupplyVariantsFromMaster(master, seller._id ? 0.85 : 1);
  const defaultUnit = supplyVariants[0]?.unit || master.unit || "Pieces";
  const baseSupply = Number(supplyVariants[0]?.purchasePrice) || 0;
  const normalizedVariants = normalizeSellerVariants(supplyVariants, {
    defaultUnit,
    baseSupply,
  });

  const slug = await ensureUniqueSlug(
    `${master.slug || master.name}-${seller.shopName || seller.name}`,
    existing?._id,
  );

  const productData = {
    name: master.name,
    slug,
    description: master.description || "",
    brand: master.brand || "",
    weight: master.weight || supplyVariants[0]?.name || "",
    categoryId: master.categoryId,
    subcategoryId: master.subcategoryId,
    ownerType: "seller",
    sellerId: seller._id,
    masterProductId: status === "active" ? masterProductId : null,
    status,
    unit: defaultUnit,
    mainImage: master.mainImage,
    galleryImages: master.galleryImages || [],
    lowStockAlert: master.lowStockAlert ?? 10,
    tags: [...new Set([...(master.tags || []).filter((t) => t !== SEED_TAG), SEED_SUPPLY_TAG])],
    variants: normalizedVariants,
    adminReview: { ...EMPTY_ADMIN_REVIEW },
  };

  syncRootFromFirstVariant(productData, "seller");

  let product;
  if (existing) {
    product = await Product.findByIdAndUpdate(
      existing._id,
      { $set: productData },
      { new: true, runValidators: true },
    );
  } else {
    product = await Product.create(productData);
  }

  if (pendingReview && status === "active" && masterProductId) {
    const prevSupply = Math.max(1, baseSupply - 3);
    await Product.findByIdAndUpdate(product._id, {
      $set: {
        adminReview: {
          pending: true,
          types: reviewTypes,
          updatedAt: new Date(),
          summary:
            reviewSummary ||
            `${master.name}: supply ₹${prevSupply} → ₹${baseSupply} · ${seller.shopName || seller.name}`,
          previousSupplyPrice: prevSupply,
          newSupplyPrice: baseSupply,
          previousStock: Math.max(0, Number(productData.stock) - 15),
          newStock: Number(productData.stock),
        },
      },
    });
  }

  return product;
}

/** Pending seller submission (no master yet) — admin must Go Live. */
async function upsertPendingSellerSubmission(row, seller, bySlug) {
  const { categoryId, subcategoryId } = resolveCategoryIds(bySlug, row.parent, row.sub);
  const slug = await ensureUniqueSlug(`${row.name}-${seller.shopName || seller.name}`);

  const defaultUnit = row.variants[0]?.unit || "Pieces";
  const supply = Number(row.variants[0]?.purchasePrice) || Number(row.variants[0]?.price) || 0;
  const variantsWithGst = enrichSeedVariantsWithGst(row);
  const normalizedVariants = normalizeSellerVariants(variantsWithGst, {
    defaultUnit,
    baseSupply: supply,
  });

  const { mainImage, galleryImages } = buildProductImages({
    name: row.name,
    tags: row.tags,
    slug,
  });

  const productData = {
    name: row.name.trim(),
    slug,
    description: row.description || "",
    brand: row.brand || "",
    weight: row.variants[0]?.name || "",
    categoryId,
    subcategoryId,
    ownerType: "seller",
    sellerId: seller._id,
    masterProductId: null,
    status: "pending_approval",
    unit: defaultUnit,
    mainImage,
    galleryImages,
    lowStockAlert: 10,
    tags: [...new Set([...(row.tags || []), SEED_SUPPLY_TAG])],
    variants: normalizedVariants,
    adminReview: { ...EMPTY_ADMIN_REVIEW },
  };

  syncRootFromFirstVariant(productData, "seller");

  const existing = await Product.findOne({
    sellerId: seller._id,
    name: { $regex: new RegExp(`^${escapeRegex(row.name.trim())}$`, "i") },
    tags: SEED_SUPPLY_TAG,
    status: "pending_approval",
  });

  if (existing) {
    return Product.findByIdAndUpdate(existing._id, { $set: productData }, { new: true });
  }
  return Product.create(productData);
}

const PENDING_SELLER_PRODUCT = {
  name: "Farm Fresh Baby Spinach",
  parent: "Fruits & Vegetables",
  sub: "Leafy Greens & Herbs",
  brand: "Farm Fresh",
  description: "Tender baby spinach — seller submission awaiting admin go-live.",
  tags: ["spinach", "vegetables", "fresh"],
  variants: [
    { name: "250 g", unit: "Pack", price: 35, salePrice: 35, purchasePrice: 35, stock: 45 },
    { name: "1 kg", unit: "kg", price: 120, salePrice: 120, purchasePrice: 120, stock: 20 },
  ],
};

async function seedSellerSupplyListings() {
  const sellers = await Seller.find({ isActive: { $ne: false } })
    .limit(3)
    .select("_id shopName name")
    .lean();

  if (!sellers.length) {
    console.log("\nSeller supply seed skipped — register at least one active seller first.");
    return { linked: 0, pending: 0, reviewDemo: 0 };
  }

  const masters = await Product.find({
    tags: SEED_TAG,
    ownerType: "admin",
    status: "active",
  })
    .sort({ createdAt: 1 })
    .limit(8)
    .lean();

  if (!masters.length) {
    console.log("\nSeller supply seed skipped — no admin catalog products found.");
    return { linked: 0, pending: 0, reviewDemo: 0 };
  }

  const bySlug = await buildCategoryIndex();
  let linked = 0;
  let reviewDemo = 0;

  const primary = sellers[0];
  const secondary = sellers[1] || sellers[0];

  for (let i = 0; i < Math.min(4, masters.length); i++) {
    const master = masters[i];
    const seller = i % 2 === 0 ? primary : secondary;
    const pendingReview = i === 2;
    await upsertSellerSupplyListing(master, seller, {
      pendingReview,
      reviewTypes: pendingReview ? ["supply_price", "stock"] : [],
    });
    console.log(
      `  ↳ supply: ${master.name} → ${seller.shopName || seller.name}${pendingReview ? " [demo: price updated]" : ""}`,
    );
    linked += 1;
    if (pendingReview) reviewDemo += 1;
  }

  await upsertPendingSellerSubmission(PENDING_SELLER_PRODUCT, primary, bySlug);
  console.log(`  ↳ pending: ${PENDING_SELLER_PRODUCT.name} → ${primary.shopName || primary.name}`);
  const pending = 1;

  return { linked, pending, reviewDemo };
}

async function seed() {
  const clearFirst = process.argv.includes("--clear");
  const withSellers = process.argv.includes("--with-sellers");
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is missing in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  try {
    await Product.syncLegacyIndexes?.();
  } catch (err) {
    console.warn("[seedProducts] syncLegacyIndexes:", err.message);
  }

  if (clearFirst) {
    await clearSeedProducts();
  }

  const bySlug = await buildCategoryIndex();
  const parentCount = [...bySlug.values()].filter((c) => c.type === "category").length;
  const subCount = [...bySlug.values()].filter((c) => c.type === "subcategory").length;
  console.log(`Categories in DB: ${parentCount} parents, ${subCount} subcategories`);

  if (parentCount === 0) {
    console.error("No categories found. Run: npm run seed:categories");
    process.exit(1);
  }

  let created = 0;
  let failed = 0;

  for (const row of PRODUCT_CATALOG) {
    try {
      const { product, imageKey } = await upsertSeedProduct(row, bySlug);
      const variantCount = product.variants?.length || 0;
      const stock = totalVariantStock(product.variants) || product.stock;
      console.log(
        `✓ ${product.name} [img:${imageKey}] (${variantCount} variants, hub stock ${stock}, ${seedGstSummary(product.variants)})`,
      );
      created += 1;
    } catch (err) {
      failed += 1;
      console.error(`✗ ${row.name}: ${err.message}`);
    }
  }

  let sellerStats = { linked: 0, pending: 0, reviewDemo: 0 };
  if (withSellers) {
    console.log("\n--- Seller supply seed (linked listings + pending submission) ---");
    sellerStats = await seedSellerSupplyListings();
  }

  console.log("\n--- Product seed complete ---");
  console.log(`Admin masters seeded: ${created}`);
  console.log(`Admin failed:         ${failed}`);
  console.log(`Admin catalog size:   ${PRODUCT_CATALOG.length}`);
  if (withSellers) {
    console.log(`Seller linked:        ${sellerStats.linked}`);
    console.log(`Seller pending:       ${sellerStats.pending}`);
    console.log(`Seller review demo:   ${sellerStats.reviewDemo}`);
  }
  console.log(`Hub:                  ${DEFAULT_HUB_ID}`);
  console.log(`Tags:                 ${SEED_TAG}, ${SEED_SUPPLY_TAG} (use --clear to replace)`);
  if (!withSellers) {
    console.log(`Tip:                  node scripts/seedProducts.js --with-sellers`);
  }

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
