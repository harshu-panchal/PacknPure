export const NOTIFICATION_CATEGORIES = {
  ORDER: "order",
  PAYMENT: "payment",
  SYSTEM: "system",
  MARKETING: "marketing",
  DELIVERY: "delivery",
  PROCUREMENT: "procurement",
  BROADCAST: "broadcast",
  TRANSACTIONAL: "transactional",
};

export const NOTIFICATION_CHANNELS = {
  IN_APP: "in_app",
  PUSH: "push",
  BOTH: "both",
};

export const NOTIFICATION_TYPE_MAP = {
  order: NOTIFICATION_CATEGORIES.ORDER,
  payment: NOTIFICATION_CATEGORIES.PAYMENT,
  alert: NOTIFICATION_CATEGORIES.SYSTEM,
  system: NOTIFICATION_CATEGORIES.SYSTEM,
  marketing: NOTIFICATION_CATEGORIES.MARKETING,
  procurement: NOTIFICATION_CATEGORIES.PROCUREMENT,
};

export const ROLE_MODEL_MAP = {
  customer: "User",
  user: "User",
  seller: "Seller",
  admin: "Admin",
  delivery: "Delivery",
  pickup_partner: "PickupPartner",
};

export const MODEL_ROLE_MAP = {
  User: "customer",
  Seller: "seller",
  Admin: "admin",
  Delivery: "delivery",
  PickupPartner: "pickup_partner",
};

export const ROLE_NOTIFICATION_DEFAULTS = {
  customer: {
    orderUpdates: true,
    procurement: true,
    delivery: true,
    payment: true,
    system: true,
    marketing: true,
  },
  seller: {
    orderUpdates: true,
    procurement: true,
    delivery: true,
    payment: true,
    system: true,
    marketing: false,
  },
  admin: {
    orderUpdates: true,
    procurement: true,
    delivery: true,
    payment: true,
    system: true,
    marketing: false,
  },
  delivery: {
    orderUpdates: true,
    procurement: true,
    delivery: true,
    payment: true,
    system: true,
    marketing: false,
  },
  pickup_partner: {
    orderUpdates: true,
    procurement: true,
    delivery: true,
    payment: true,
    system: true,
    marketing: false,
  },
};

export const getNotificationCategoryFromType = (type = "system") =>
  NOTIFICATION_TYPE_MAP[type] || NOTIFICATION_CATEGORIES.SYSTEM;

export const isPushCategoryEnabled = (preferences = {}, category = "system") => {
  const prefs = preferences || {};
  if (prefs.push === false) return false;
  if (prefs.inApp === false && prefs.push === false) return false;

  switch (category) {
    case NOTIFICATION_CATEGORIES.ORDER:
      return prefs.orderUpdates !== false && prefs.transactional !== false;
    case NOTIFICATION_CATEGORIES.PAYMENT:
      return prefs.payment !== false && prefs.transactional !== false;
    case NOTIFICATION_CATEGORIES.DELIVERY:
      return prefs.delivery !== false && prefs.transactional !== false;
    case NOTIFICATION_CATEGORIES.PROCUREMENT:
      return prefs.procurement !== false && prefs.transactional !== false;
    case NOTIFICATION_CATEGORIES.MARKETING:
      return prefs.marketing !== false;
    case NOTIFICATION_CATEGORIES.BROADCAST:
      return prefs.adminBroadcast !== false;
    case NOTIFICATION_CATEGORIES.SYSTEM:
    default:
      return prefs.system !== false;
  }
};

