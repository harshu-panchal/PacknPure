import { DEFAULT_PRODUCT_UNIT, PRODUCT_UNITS } from '@shared/constants/productUnits';

export { PRODUCT_UNITS, DEFAULT_PRODUCT_UNIT };

export const EMPTY_SELLER_PRODUCT_FORM = {
  name: '',
  description: '',
  price: '',
  salePrice: '',
  stock: '',
  lowStockAlert: 5,
  unit: DEFAULT_PRODUCT_UNIT,
  category: '',
  subcategory: '',
  status: 'pending_approval',
  tags: '',
  weight: '',
  brand: '',
  shelfLife: '',
  countryOfOrigin: '',
  fssaiLicense: '',
  customerCare: '',
  masterProductId: '',
  mainImage: null,
  mainImageFile: null,
  galleryItems: [],
  variants: [
    {
      id: Date.now(),
      name: 'Default',
      unit: DEFAULT_PRODUCT_UNIT,
      supplyPrice: '',
      stock: '',
      gstEnabled: false,
      gstRate: 0,
    },
  ],
};

export function totalVariantStock(variants = []) {
  return (variants || []).reduce((sum, v) => sum + (Number(v?.stock) || 0), 0);
}

export function resolveSupplyPrice(value) {
  return (
    Number(value?.supplyPrice ?? value?.purchasePrice ?? value?.price) || 0
  );
}

export function variantPricesList(item) {
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  if (!variants.length) {
    const price = resolveSupplyPrice(item);
    return [{ name: 'Default', display: price }];
  }
  return variants.map((v, i) => ({
    name: String(v?.name || '').trim() || `Variant ${i + 1}`,
    display: resolveSupplyPrice(v),
    gstEnabled: Boolean(v?.gstEnabled),
    gstRate: Number(v?.gstRate) || 0,
  }));
}

/** True when seller listing is tied to an admin master catalog product. */
export function isCatalogLinkedListing(itemOrForm) {
  const mid = itemOrForm?.masterProductId?._id || itemOrForm?.masterProductId;
  return !!mid && String(mid).trim() !== '';
}

export function variantPriceRangeLabel(item) {
  const list = variantPricesList(item);
  const amounts = list.map((r) => r.display).filter((n) => n > 0);
  if (!amounts.length) return '—';
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const fmt = (n) => Number(n).toLocaleString('en-IN');
  if (min === max) return `₹${fmt(min)}`;
  return `₹${fmt(min)} – ₹${fmt(max)}`;
}

/** Load API product into seller edit form state. */
export function productToSellerForm(item) {
  if (!item) return { ...EMPTY_SELLER_PRODUCT_FORM, variants: [{ ...EMPTY_SELLER_PRODUCT_FORM.variants[0], id: Date.now() }] };

  const variants =
    item.variants?.length > 0
      ? item.variants.map((v, i) => ({
        id: v._id || `v-${i}-${Date.now()}`,
        name: v.name || '',
        unit: v.unit || item.unit || DEFAULT_PRODUCT_UNIT,
        supplyPrice:
          v.supplyPrice ?? v.purchasePrice ?? v.price ?? '',
        masterSalePrice: v.masterSalePrice || item.masterSalePrice || '',
        stock: Number.isFinite(Number(v.stock)) ? Number(v.stock) : '',
        gstEnabled: Boolean(v.gstEnabled),
        gstRate: Number(v.gstRate) || 0,
      }))
      : [
        {
          id: Date.now(),
          name: 'Default',
          unit: item.unit || DEFAULT_PRODUCT_UNIT,
          supplyPrice:
            item.supplyPrice ?? item.purchasePrice ?? item.price ?? '',
          masterSalePrice: item.masterSalePrice || '',
          stock: item.stock ?? '',
        },
      ];

  const totalStock = totalVariantStock(variants);

  return {
    name: item.name || '',
    description: item.description || '',
    price: resolveSupplyPrice(variants[0]) || resolveSupplyPrice(item) || '',
    salePrice: '',
    stock: totalStock,
    lowStockAlert: item.lowStockAlert ?? 5,
    unit: item.unit || DEFAULT_PRODUCT_UNIT,
    category: item.categoryId?._id || item.categoryId || '',
    subcategory: item.subcategoryId?._id || item.subcategoryId || '',
    status: item.status || 'pending_approval',
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '',
    weight: item.weight || '',
    brand: item.brand || '',
    shelfLife: item.shelfLife || '',
    countryOfOrigin: item.countryOfOrigin || '',
    fssaiLicense: item.fssaiLicense || '',
    customerCare: item.customerCare || '',
    masterProductId: item.masterProductId?._id || item.masterProductId || '',
    mainImage: item.mainImage || null,
    mainImageFile: null,
    galleryItems: (Array.isArray(item.galleryImages) ? item.galleryImages : []).map((url) => ({
      id: `existing-${url}`,
      preview: url,
      file: null,
    })),
    variants,
  };
}

export function validateSellerProductForm(formData) {
  const missing = [];
  if (!String(formData.name || '').trim()) missing.push('Product title');
  if (!formData.category) missing.push('Parent category');
  if (!formData.subcategory) missing.push('Subcategory');

  const variants = formData.variants || [];
  if (!variants.length) {
    missing.push('At least one variant');
  } else {
    variants.forEach((v, i) => {
      const label = variants.length > 1 ? `Variant ${i + 1}` : 'Variant';
      if (!String(v.name || '').trim()) missing.push(`${label} name`);
      const price = Number(v.supplyPrice ?? v.price);
      if (!Number.isFinite(price) || price <= 0) missing.push(`${label} supply price`);
      const stock = Number(v.stock);
      if (!Number.isFinite(stock) || stock < 0) missing.push(`${label} stock`);

      if (v.masterSalePrice) {
        const gstRate = v.gstEnabled ? (Number(v.gstRate) || 0) : 0;
        const finalSupply = price + (price * (gstRate / 100));
        if (finalSupply > Number(v.masterSalePrice)) {
          missing.push(`Supply price + GST for ${label} cannot exceed ₹${v.masterSalePrice}`);
        }
      }
    });
  }
  return missing;
}

/** Validate hub-catalog listing edits (supply price + stock only). */
export function validateCatalogLinkedSellerForm(formData) {
  const missing = [];
  const variants = formData.variants || [];
  if (!variants.length) {
    missing.push('At least one variant');
    return missing;
  }
  variants.forEach((v, i) => {
    const label = variants.length > 1 ? `Variant ${i + 1}` : 'Variant';
    const price = Number(v.supplyPrice ?? v.price);
    if (!Number.isFinite(price) || price <= 0) missing.push(`${label} supply price`);
    const stock = Number(v.stock);
    if (!Number.isFinite(stock) || stock < 0) missing.push(`${label} stock`);
    
    if (v.masterSalePrice) {
      const gstRate = v.gstEnabled ? (Number(v.gstRate) || 0) : 0;
      const finalSupply = price + (price * (gstRate / 100));
      if (finalSupply > Number(v.masterSalePrice)) {
        missing.push(`Supply price + GST for ${label} cannot exceed ₹${v.masterSalePrice}`);
      }
    }
  });
  return missing;
}

/** FormData for updating a hub-catalog listing (price/stock only). */
export function buildCatalogLinkedSellerUpdateData(formData, editingItem) {
  const existingVariants = editingItem?.variants || [];
  const formVariants = formData.variants || [];

  const cleanVariants = formVariants.map((v, index) => {
    const existing = existingVariants[index] || {};
    const supply = Number(v.supplyPrice ?? v.price) || 0;
    return {
      ...(existing._id ? { _id: existing._id } : {}),
      name: String(existing.name || v.name || '').trim() || `Variant ${index + 1}`,
      unit: existing.unit || v.unit || editingItem?.unit || DEFAULT_PRODUCT_UNIT,
      supplyPrice: supply,
      purchasePrice: supply,
      price: supply,
      stock: Number(v.stock) || 0,
      gstEnabled: Boolean(v.gstEnabled ?? existing.gstEnabled),
      gstRate:
        (v.gstEnabled ?? existing.gstEnabled)
          ? Math.max(0, Number(v.gstRate ?? existing.gstRate) || 0)
          : 0,
    };
  });

  const totalStock = totalVariantStock(cleanVariants);
  const first = cleanVariants[0] || {};
  const resolvedPrice = Number(first.price) || 0;

  const data = new FormData();
  data.append('supplyPrice', String(resolvedPrice));
  data.append('purchasePrice', String(resolvedPrice));
  data.append('supplyPrice', String(resolvedPrice));
  data.append('purchasePrice', String(resolvedPrice));
  data.append('price', String(resolvedPrice));
  data.append('stock', String(totalStock));
  data.append('variants', JSON.stringify(cleanVariants));

  return { data, cleanVariants, totalStock, resolvedPrice };
}

export function buildSellerProductFormData(formData, { editingItem } = {}) {
  const data = new FormData();
  const variants = formData.variants || [];
  const totalStock = totalVariantStock(variants);
  const first = variants[0] || {};
  const resolvedPrice = Number(first.supplyPrice ?? first.price) || 0;

  const cleanVariants = variants.map((v, index) => {
    const supply = Number(v.supplyPrice ?? v.price) || resolvedPrice;
    return {
      name: String(v.name || '').trim() || `Variant ${index + 1}`,
      unit: v.unit || formData.unit || DEFAULT_PRODUCT_UNIT,
      supplyPrice: supply,
      purchasePrice: supply,
      price: supply,
      stock: Number(v.stock) || 0,
      gstEnabled: Boolean(v.gstEnabled),
      gstRate: v.gstEnabled ? Math.max(0, Number(v.gstRate) || 0) : 0,
    };
  });

  const fields = {
    name: String(formData.name || '').trim(),
    description: String(formData.description || '').trim(),
    supplyPrice: resolvedPrice,
    purchasePrice: resolvedPrice,
    price: resolvedPrice,
    stock: totalStock,
    lowStockAlert: Number(formData.lowStockAlert) || 5,
    unit: formData.unit || DEFAULT_PRODUCT_UNIT,
    tags: String(formData.tags || '').trim(),
    weight: String(formData.weight || '').trim(),
    brand: String(formData.brand || '').trim(),
    shelfLife: formData.shelfLife,
    countryOfOrigin: formData.countryOfOrigin,
    fssaiLicense: formData.fssaiLicense,
    customerCare: formData.customerCare,
    masterProductId: formData.masterProductId,
  };

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      data.append(key, value);
    }
  });

  data.append('categoryId', formData.category);
  data.append('subcategoryId', formData.subcategory);
  data.append('variants', JSON.stringify(cleanVariants));

  if (editingItem) {
    const keepGalleryImages = (formData.galleryItems || [])
      .filter((it) => !it?.file && typeof it?.preview === 'string' && it.preview)
      .map((it) => it.preview);
    data.append('keepGalleryImages', JSON.stringify(keepGalleryImages));
  }

  return { data, cleanVariants, totalStock, resolvedPrice };
}

/** Build variant rows for catalog picker (master + optional existing seller listing). */
export function catalogVariantRowsFromMaster(master, existingListing = null) {
  const masterVariants =
    Array.isArray(master?.variants) && master.variants.length > 0
      ? master.variants
      : null;
  const existingVariants = existingListing?.variants || [];

  if (masterVariants) {
    return masterVariants.map((mv, index) => {
      const match =
        existingVariants.find(
          (ev) =>
            String(ev?.name || '').trim().toLowerCase() ===
            String(mv?.name || '').trim().toLowerCase(),
        ) || existingVariants[index];
      return {
        name: String(mv?.name || '').trim() || `Variant ${index + 1}`,
        unit: mv?.unit || master?.unit || DEFAULT_PRODUCT_UNIT,
        supplyPrice:
          match?.supplyPrice ?? match?.purchasePrice ?? match?.price ?? '',
        stock: Number.isFinite(Number(match?.stock)) ? Number(match.stock) : '',
        gstEnabled: Boolean(match?.gstEnabled ?? mv?.gstEnabled),
        gstRate: Number(match?.gstRate ?? mv?.gstRate) || 0,
      };
    });
  }

  return [
    {
      name: 'Default',
      unit: master?.unit || DEFAULT_PRODUCT_UNIT,
      supplyPrice:
        existingListing?.supplyPrice ??
        existingListing?.purchasePrice ??
        existingListing?.price ??
        '',
      stock: Number.isFinite(Number(existingListing?.stock))
        ? Number(existingListing.stock)
        : '',
    },
  ];
}

function catalogRowLabel(row, index, multi) {
  if (row?.name) return String(row.name).trim();
  return multi ? `Variant ${index + 1}` : 'Variant';
}

function catalogRowHasAnyInput(row) {
  const priceRaw = row?.supplyPrice ?? row?.price;
  const stockRaw = row?.stock;
  const hasPrice =
    priceRaw !== '' && priceRaw !== null && priceRaw !== undefined;
  const hasStock =
    stockRaw !== '' && stockRaw !== null && stockRaw !== undefined;
  return hasPrice || hasStock;
}

/** Row is offered when supply price > 0 and stock is a valid number (0 allowed). */
export function isCatalogVariantRowComplete(row) {
  const price = Number(row?.supplyPrice ?? row?.price);
  if (!Number.isFinite(price) || price <= 0) return false;
  const stock = Number(row?.stock);
  return Number.isFinite(stock) && stock >= 0;
}

export function validateCatalogListingRows(rows = []) {
  const missing = [];
  const multi = rows.length > 1;
  if (!rows.length) missing.push('At least one variant');

  const completeRows = rows.filter(isCatalogVariantRowComplete);
  if (completeRows.length === 0) {
    missing.push('At least one variant with supply price and stock');
  }

  rows.forEach((row, index) => {
    if (!catalogRowHasAnyInput(row)) return;
    const label = catalogRowLabel(row, index, multi);
    if (!isCatalogVariantRowComplete(row)) {
      const price = Number(row.supplyPrice ?? row.price);
      if (!Number.isFinite(price) || price <= 0) {
        missing.push(`${label} supply price`);
      }
      const stock = Number(row.stock);
      if (!Number.isFinite(stock) || stock < 0) {
        missing.push(`${label} stock`);
      }
    }
  });

  return missing;
}

/** FormData for listing/updating a seller offer from hub master catalog. */
export function buildCatalogListingFormData(master, variantRows, { existingListing } = {}) {
  const data = new FormData();
  const categoryId = master?.categoryId?._id || master?.categoryId || '';
  const subcategoryId = master?.subcategoryId?._id || master?.subcategoryId || '';

  const offeredRows = variantRows.filter(isCatalogVariantRowComplete);
  const totalStock = totalVariantStock(offeredRows);
  const first = offeredRows[0] || {};
  const resolvedPrice = Number(first.supplyPrice ?? first.price) || 0;

  const cleanVariants = offeredRows.map((v, index) => {
    const supply = Number(v.supplyPrice ?? v.price) || resolvedPrice;
    const row = {
      name: String(v.name || '').trim() || `Variant ${index + 1}`,
      unit: v.unit || master?.unit || DEFAULT_PRODUCT_UNIT,
      supplyPrice: supply,
      purchasePrice: supply,
      price: supply,
      stock: Math.max(0, Number(v.stock) || 0),
      gstEnabled: Boolean(v.gstEnabled),
      gstRate: v.gstEnabled ? Math.max(0, Number(v.gstRate) || 0) : 0,
    };
    if (v._id || v.id) row._id = v._id || v.id;
    return row;
  });

  data.append('name', String(master?.name || '').trim());
  data.append('description', String(master?.description || '').trim());
  data.append('masterProductId', String(master?._id || master?.id || ''));
  data.append('categoryId', String(categoryId));
  data.append('subcategoryId', String(subcategoryId));
  data.append('unit', master?.unit || DEFAULT_PRODUCT_UNIT);
  data.append('brand', String(master?.brand || '').trim());
  data.append('weight', String(master?.weight || '').trim());
  data.append('supplyPrice', String(resolvedPrice));
  data.append('purchasePrice', String(resolvedPrice));
  data.append('price', String(resolvedPrice));
  data.append('stock', String(totalStock));
  data.append('lowStockAlert', '5');
  data.append('variants', JSON.stringify(cleanVariants));

  if (existingListing) {
    const keepGalleryImages = Array.isArray(existingListing.galleryImages)
      ? existingListing.galleryImages
      : [];
    if (keepGalleryImages.length) {
      data.append('keepGalleryImages', JSON.stringify(keepGalleryImages));
    }
  }

  return { data, cleanVariants, totalStock, resolvedPrice };
}
