const STORAGE_KEYS = {
  hubInventory: "qc_admin_hub_inventory_v1",
  vendors: "qc_admin_vendors_v1",
  purchaseRequests: "qc_admin_purchase_requests_v1",
  pickupPartners: "qc_admin_pickup_partners_v1",
  deliveryPartners: "qc_admin_delivery_partners_v1",
};

const defaults = {
  hubInventory: [
    {
      id: "HI-001",
      productName: "Aashirvaad Atta 5kg",
      category: "Staples",
      hubStockQuantity: 124,
      minimumStockAlert: 50,
      status: "Healthy",
    },
    {
      id: "HI-002",
      productName: "Amul Gold Milk 1L",
      category: "Dairy",
      hubStockQuantity: 28,
      minimumStockAlert: 40,
      status: "Low Stock",
    },
    {
      id: "HI-003",
      productName: "Tata Salt 1kg",
      category: "Essentials",
      hubStockQuantity: 92,
      minimumStockAlert: 30,
      status: "Healthy",
    },
  ],
  vendors: [
    {
      id: "VN-001",
      vendorName: "FreshKart Foods",
      phoneNumber: "+91 98765 12340",
      location: "Vijay Nagar, Indore",
      productsSupplied: "Dairy, Frozen, Bakery",
      status: "Active",
    },
    {
      id: "VN-002",
      vendorName: "GreenLeaf Agro",
      phoneNumber: "+91 98765 22341",
      location: "Palasia, Indore",
      productsSupplied: "Fruits, Vegetables",
      status: "Active",
    },
  ],
  purchaseRequests: [
    {
      id: "PR-48011",
      requestId: "PR-48011",
      vendorName: "FreshKart Foods",
      product: "Amul Gold Milk 1L",
      quantity: 350,
      status: "Pending",
    },
    {
      id: "PR-48012",
      requestId: "PR-48012",
      vendorName: "GreenLeaf Agro",
      product: "Banana Robusta",
      quantity: 210,
      status: "Assigned",
    },
  ],
  pickupPartners: [
    {
      id: "PP-001",
      partnerName: "Rapid Fleet Services",
      phone: "+91 90011 22001",
      assignedPickups: 8,
      status: "Active",
    },
    {
      id: "PP-002",
      partnerName: "Metro Pickup Ops",
      phone: "+91 90011 22002",
      assignedPickups: 5,
      status: "Available",
    },
  ],
  deliveryPartners: [
    {
      id: "DP-001",
      deliveryPartnerName: "QuickDash Riders",
      phone: "+91 91111 33001",
      activeDeliveries: 12,
      status: "Active",
    },
    {
      id: "DP-002",
      deliveryPartnerName: "HyperDrop Logistics",
      phone: "+91 91111 33002",
      activeDeliveries: 7,
      status: "Active",
    },
  ],
};

const hasStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

const clone = (value) => JSON.parse(JSON.stringify(value));

const readArray = (storageKey, fallback) => {
  if (!hasStorage()) return clone(fallback);
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      const seed = clone(fallback);
      window.localStorage.setItem(storageKey, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : clone(fallback);
  } catch {
    return clone(fallback);
  }
};

const writeArray = (storageKey, items) => {
  const safe = Array.isArray(items) ? items : [];
  if (hasStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(safe));
  }
  return safe;
};

const createId = (prefix) => `${prefix}-${Date.now().toString().slice(-6)}`;

export const supplyChainStorage = {
  createId,
  getHubInventory: () => readArray(STORAGE_KEYS.hubInventory, defaults.hubInventory),
  saveHubInventory: (items) => writeArray(STORAGE_KEYS.hubInventory, items),

  getVendors: () => readArray(STORAGE_KEYS.vendors, defaults.vendors),
  saveVendors: (items) => writeArray(STORAGE_KEYS.vendors, items),

  getPurchaseRequests: () =>
    readArray(STORAGE_KEYS.purchaseRequests, defaults.purchaseRequests),
  savePurchaseRequests: (items) => writeArray(STORAGE_KEYS.purchaseRequests, items),

  getPickupPartners: () =>
    readArray(STORAGE_KEYS.pickupPartners, defaults.pickupPartners),
  savePickupPartners: (items) => writeArray(STORAGE_KEYS.pickupPartners, items),

  getDeliveryPartners: () =>
    readArray(STORAGE_KEYS.deliveryPartners, defaults.deliveryPartners),
  saveDeliveryPartners: (items) => writeArray(STORAGE_KEYS.deliveryPartners, items),
};

export default supplyChainStorage;
