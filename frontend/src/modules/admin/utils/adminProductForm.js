import { DEFAULT_PRODUCT_UNIT } from '@shared/constants/productUnits';

/** Parse GET /products/admin/list response */
export function parseAdminProductListResponse(response) {
  const data = response?.data || {};
  if (!data.success) {
    return { items: [], total: 0, page: 1, totalPages: 1, stats: null };
  }
  const payload = data.result && typeof data.result === 'object' ? data.result : {};
  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(data.results)
      ? data.results
      : [];
  return {
    items,
    total: typeof payload.total === 'number' ? payload.total : items.length,
    page: typeof payload.page === 'number' ? payload.page : 1,
    totalPages: typeof payload.totalPages === 'number' ? payload.totalPages : 1,
    stats: payload.stats || null,
  };
}

/** Split a total qty across variant rows (keeps ratios). */
export function distributeQtyAcrossVariants(totalQty, variants = []) {
  const qty = Math.max(0, Number(totalQty) || 0);
  if (!variants.length) return variants;

  const rows = variants.map((v) => ({
    ...v,
    stock: Math.max(0, Number(v?.stock) || 0),
  }));

  if (rows.length === 1) {
    rows[0].stock = qty;
    return rows;
  }

  const sum = rows.reduce((s, v) => s + v.stock, 0);
  if (sum <= 0) {
    rows[0].stock = qty;
    for (let i = 1; i < rows.length; i++) rows[i].stock = 0;
    return rows;
  }

  let assigned = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i === rows.length - 1) {
      rows[i].stock = Math.max(0, qty - assigned);
    } else {
      const part = Math.floor((qty * rows[i].stock) / sum);
      rows[i].stock = part;
      assigned += part;
    }
  }
  return rows;
}

/**
 * Primary sellable qty for list/stats/form.
 * Admin master → hub; seller row → seller listing stock.
 */
export function primaryStockFromItem(item, activeTab = 'master') {
  if (!item) return 0;
  const isMaster = activeTab === 'master' || item.ownerType === 'admin';
  if (isMaster) {
    return Number(item.availableQtyHub ?? item.stock ?? 0) || 0;
  }
  if (item.ownerType === 'seller') {
    const variantSum = (item.variants || []).reduce(
      (sum, v) => sum + (Number(v?.stock) || 0),
      0,
    );
    if (variantSum > 0) return variantSum;
    return Number(item.availableQtySeller ?? item.catalogStock ?? item.stock) || 0;
  }
  return Number(item.stock) || 0;
}

/** Catalog stock from API row (seller listings; admin uses hub). */
export function catalogStockFromItem(item, activeTab = 'master') {
  return primaryStockFromItem(item, activeTab);
}

/** Hub (H) and seller (S) stock for admin product list. */
export function hubAndSellerStockFromItem(item, activeTab = 'master') {
  if (!item) return { hub: 0, hubReserved: 0, seller: 0, sellerCommitted: 0, catalog: 0 };
  
  const hub = Number(item.availableQtyHub ?? 0) || 0;
  const hubReserved = Number(item.reservedQtyHub ?? item.reservedQty ?? 0) || 0;
  const isMaster = activeTab === 'master' || item.ownerType === 'admin';

  if (isMaster) {
    return {
      hub,
      hubReserved,
      seller: Number(item.availableQtySeller ?? 0) || 0,
      sellerCommitted: Number(item.committedQtySeller ?? 0) || 0,
      catalog: hub,
    };
  }

  const sellerQty = primaryStockFromItem(item, 'seller');
  const sellerCommitted = Number(item.committedStock ?? item.committedQtySeller ?? 0) || 0;
  
  return {
    hub,
    hubReserved,
    seller: sellerQty,
    sellerCommitted,
    catalog: sellerQty,
  };
}

/** Variant rows for edit form — admin loads hub qty into variants. */
export function variantsForEditForm(item, activeTab = 'master') {
  if (!item) return [];
  const isMaster = activeTab === 'master' || item.ownerType === 'admin';
  const hubQty = Number(item.availableQtyHub ?? 0) || 0;
  const baseVariants =
    item.variants?.length > 0
      ? item.variants.map((v) => ({
        ...v,
        id: v._id || v.id || Date.now(),
        unit: v.unit || item.unit || DEFAULT_PRODUCT_UNIT,
        stock: Number.isFinite(Number(v.stock)) ? Number(v.stock) : 0,
        price: v.price ?? v.salePrice ?? '',
        salePrice: v.salePrice ?? v.price ?? '',
        purchasePrice: Number(v.purchasePrice ?? item.purchasePrice) || 0,
        gstEnabled: Boolean(v.gstEnabled),
        gstRate: Number(v.gstRate) || 0,
      }))
      : [
        {
          id: Date.now(),
          name: 'Default',
          unit: item.unit || DEFAULT_PRODUCT_UNIT,
          price: item.price || item.salePrice || '',
          salePrice: item.salePrice || item.price || '',
          purchasePrice: Number(item.purchasePrice || item.supplyPrice) || 0,
          stock: 0,
          gstEnabled: Boolean(item.gstRate > 0),
          gstRate: Number(item.gstRate) || 0,
        },
      ];

  if (isMaster) {
    return distributeQtyAcrossVariants(hubQty, baseVariants);
  }
  return baseVariants;
}

export function isSubcategoryId(categories, id) {
  if (!id) return false;
  return categories.some((p) => (p.children || []).some((sc) => String(sc._id) === String(id)));
}

export function validateAdminProductForm(formData) {
  const missing = [];
  const variants = Array.isArray(formData.variants) ? formData.variants : [];

  if (!String(formData.name || '').trim()) missing.push('Product title');

  if (!formData.categoryId) missing.push('Parent category');
  if (!formData.subcategoryId) missing.push('Subcategory');

  if (!variants.length) {
    missing.push('At least one variant');
  } else {
    variants.forEach((v, i) => {
      const label = variants.length > 1 ? `Variant ${i + 1}` : 'Variant';
      if (!String(v.name || '').trim()) missing.push(`${label} name`);
      const sale = Number(v.salePrice ?? v.price);
      if (!Number.isFinite(sale) || sale <= 0) missing.push(`${label} sell price`);
      const stock = Number(v.stock);
      if (!Number.isFinite(stock) || stock < 0) missing.push(`${label} stock`);
    });
  }

  return missing;
}

/**
 * Build multipart body for POST/PUT /api/products (admin).
 */
export function buildAdminProductFormData(formData, { editingItem, activeTab }) {
  const data = new FormData();
  const variants = formData.variants || [];
  const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  const first = variants[0] || {};
  const salePrice = Number(first.salePrice ?? first.price) || 0;
  const mrp = Number(first.price) || salePrice;
  const purchasePrice = Number(first.purchasePrice ?? formData.purchasePrice) || 0;

  const isMaster = activeTab === 'master' || editingItem?.ownerType === 'admin';
  const status = isMaster ? 'active' : formData.status || 'pending_approval';

  const fields = {
    name: String(formData.name || '').trim(),
    description: String(formData.description || '').trim(),
    price: mrp,
    salePrice,
    purchasePrice,
    stock: totalStock,
    lowStockAlert: Number(formData.lowStockAlert) || 5,
    unit: formData.unit || DEFAULT_PRODUCT_UNIT,
    categoryId: formData.categoryId,
    subcategoryId: formData.subcategoryId,
    brand: String(formData.brand || '').trim(),
    weight: String(formData.weight || '').trim(),
    status,
    isFeatured: formData.isFeatured ? 'true' : 'false',
    gstRate: first.gstEnabled ? Math.max(0, Number(first.gstRate) || 0) : 0,
  };

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      data.append(key, value);
    }
  });

  if (formData.tags && String(formData.tags).trim()) {
    data.append('tags', String(formData.tags).trim());
  }

  if (formData.masterProductId && !isMaster) {
    data.append('masterProductId', formData.masterProductId);
  }

  const cleanVariants = variants.map((v, index) => {
    const rowSale = Number(v.salePrice ?? v.price) || salePrice;
    const rowMrp = Number(v.price) || rowSale;
    const row = {
      name: String(v.name || '').trim() || `Variant ${index + 1}`,
      unit: v.unit || formData.unit || DEFAULT_PRODUCT_UNIT,
      price: Math.max(rowMrp, rowSale),
      salePrice: rowSale,
      purchasePrice: Number(v.purchasePrice ?? purchasePrice) || 0,
      stock: Number(v.stock) || 0,
      gstEnabled: Boolean(v.gstEnabled),
      gstRate: v.gstEnabled ? Math.max(0, Number(v.gstRate) || 0) : 0,
    };
    const variantId = v._id || v.id;
    if (variantId && String(variantId).length === 24) {
      row._id = String(variantId);
    }
    return row;
  });
  data.append('variants', JSON.stringify(cleanVariants));

  return { data, sellPrice: salePrice, totalStock, cleanVariants };
}

/** Per-variant MRP / sell for display (admin viewer, tables). */
export function variantPriceDisplay(variant) {
  const mrp = Number(variant?.price) || 0;
  const sell = Number(variant?.salePrice ?? variant?.price) || 0;
  const hasDiscount = mrp > 0 && sell > 0 && sell < mrp;
  const display = hasDiscount ? sell : sell || mrp;
  return { mrp, sell, hasDiscount, display };
}

const formatInr = (n) =>
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** One row per variant with name + prices for UI lists. */
export function variantPricesList(item) {
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  if (!variants.length) {
    const row = variantPriceDisplay({
      price: item?.price,
      salePrice: item?.salePrice,
    });
    return [{
      name: item?.name || 'Default',
      ...row,
      gstEnabled: Boolean(item?.gstRate > 0),
      gstRate: Number(item?.gstRate) || 0,
    }];
  }
  return variants.map((v, i) => ({
    name: String(v?.name || '').trim() || `Variant ${i + 1}`,
    ...variantPriceDisplay(v),
    gstEnabled: Boolean(v?.gstEnabled),
    gstRate: Number(v?.gstRate) || 0,
  }));
}

export function variantGstBadgeLabel(variant) {
  if (!variant?.gstEnabled || !Number(variant?.gstRate)) return null;
  return `${variant.gstRate}% GST`;
}

/**
 * Hub margin from admin pricing only (salePrice − purchasePrice).
 * Seller supply quotes must not affect this.
 */
export function variantHubProfitRow(variant, itemFallback = null) {
  const sell =
    Number(variant?.salePrice ?? variant?.price) ||
    Number(itemFallback?.salePrice ?? itemFallback?.price) ||
    0;
  
  const baseCost = Number(variant?.purchasePrice ?? itemFallback?.purchasePrice);
  const gstEnabled = Boolean(variant?.gstEnabled ?? itemFallback?.gstEnabled);
  const gstRate = Number(variant?.gstRate ?? itemFallback?.gstRate) || 0;
  
  const hasHubCost = Number.isFinite(baseCost) && baseCost > 0;
  const gstAmt = gstEnabled ? Math.round((baseCost * gstRate) / 100) : 0;
  const cost = baseCost + gstAmt;

  if (!sell || !hasHubCost) {
    return {
      sell,
      cost: hasHubCost ? cost : 0,
      profit: null,
      marginPct: null,
      ready: false,
    };
  }
  const profit = sell - cost;
  const marginPct = (profit / cost) * 100;
  return { sell, cost, profit, marginPct, ready: true };
}

/** Per-variant hub profit rows for admin master catalog table. */
export function adminHubProfitList(item) {
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  if (!variants.length) {
    return [
      {
        name: item?.name || 'Default',
        ...variantHubProfitRow(
          {
            salePrice: item?.salePrice,
            price: item?.price,
            purchasePrice: item?.purchasePrice,
          },
          item,
        ),
        gstEnabled: Boolean(item?.gstRate > 0),
        gstRate: Number(item?.gstRate) || 0,
      },
    ];
  }
  return variants.map((v, i) => ({
    name: String(v?.name || '').trim() || `Variant ${i + 1}`,
    ...variantHubProfitRow(v, item),
  }));
}

/** Compact range label, e.g. ₹250 – ₹1,100 */
export function variantPriceRangeLabel(item) {
  const list = variantPricesList(item);
  const amounts = list.map((r) => r.display).filter((n) => n > 0);
  if (!amounts.length) return '—';
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (min === max) return `₹${formatInr(min)}`;
  return `₹${formatInr(min)} – ₹${formatInr(max)}`;
}

export const EMPTY_PRODUCT_FORM = {
  name: '',
  description: '',
  price: '',
  salePrice: '',
  purchasePrice: '',
  stock: '',
  lowStockAlert: 5,
  unit: DEFAULT_PRODUCT_UNIT,
  categoryId: '',
  subcategoryId: '',
  status: 'active',
  isFeatured: false,
  tags: '',
  weight: '',
  brand: '',
  masterProductId: '',
  mainImage: null,
  mainImageFile: null,
  galleryItems: [],
  customerPrice: '',
  variants: [
    {
      id: Date.now(),
      name: 'Default',
      unit: DEFAULT_PRODUCT_UNIT,
      price: '',
      salePrice: '',
      purchasePrice: '',
      stock: '',
      gstEnabled: false,
      gstRate: 0,
    },
  ],
};
