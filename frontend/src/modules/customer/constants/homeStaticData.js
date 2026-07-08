/**
 * Static home data for client UI review (Hyperpure / B2B grocery style).
 * Toggle live APIs: VITE_ENABLE_HOME_API=true in .env
 */

export const STATIC_DELIVERY_LABEL = 'Delivery tomorrow';
export const STATIC_OUTLET = { name: 'Guest Outlet', city: 'Indore' };

/** Hero carousel slides (Pack & Pure–style: split promo + full-bleed image) */
export const STATIC_HERO_SLIDES = [
  {
    id: 'hero-1',
    layout: 'promo',
    headline: 'Get',
    headlineAccent: 'products',
    badge: '₹0',
    badgeSuffix: 'delivery fee',
    sub: 'Restaurant & kitchen supplies delivered fast',
    cta: 'Order now',
    image: '',
    bgFrom: '#FFF1F2',
    bgTo: '#ffffff',
    accent: '#E23744',
    ctaBg: '#E23744',
  },
  {
    id: 'hero-2',
    layout: 'fullBleed',
    image: '',
    alt: 'Packaging & supplies',
  },
  {
    id: 'hero-3',
    layout: 'promo',
    headline: 'Bulk',
    headlineAccent: 'savings',
    badge: '5%',
    badgeSuffix: 'extra off',
    sub: 'On orders above ₹2,500 this week',
    cta: 'View offers',
    image: '',
    bgFrom: '#FFF1F2',
    bgTo: '#ffffff',
    accent: '#E23744',
    ctaBg: '#E23744',
  },
];

/** Wide promotion card below “Shop by category” */
export const STATIC_PROMO_BELOW_CATEGORIES = {
  id: 'promo-main',
  eyebrow: 'Limited time',
  title: 'Weekend stock-up sale',
  subtitle: 'Extra 5% off on kitchenware & packaging — auto-applied at checkout.',
  cta: 'Explore deals',
  image: '',
  gradientFrom: '#FFF1F2',
  gradientTo: '#ffffff',
};

export const STATIC_HOME_CATEGORIES = [
  { id: 'fruits-veg', name: 'Fruits & Vegetables', image: '' },
  { id: 'masala', name: 'Masala, Salt & Sugar', image: '' },
  { id: 'dairy', name: 'Dairy', image: '' },
  { id: 'flours', name: 'Flours', image: '' },
  { id: 'canned', name: 'Canned & Imported', image: '' },
  { id: 'sauces', name: 'Sauces & Seasoning', image: '' },
  { id: 'rice', name: 'Rice & Rice Products', image: '' },
  { id: 'cleaning', name: 'Cleaning & Consumables', image: '' },
  { id: 'packaging', name: 'Packaging Material', image: '' },
  { id: 'kitchenware', name: 'Kitchenware', image: '' },
  { id: 'pulses', name: 'Pulses', image: '' },
  { id: 'frozen', name: 'Frozen & Instant Food', image: '' },
  { id: 'beverages', name: 'Beverages', image: '' },
  { id: 'snacks', name: 'Snacks', image: '' },
  { id: 'appliances', name: 'Appliances', image: '' },
];

export const STATIC_FEATURED_PRODUCTS = [
  {
    id: 'p1',
    name: 'V4 - Pizza Sauce/ Squeeze Bottle, 15 oz, 450 ml',
    weight: '1 pc',
    price: 52,
    originalPrice: 58,
    image: '',
    bulkLabel: '₹50/pc for 3 pcs+',
    inStock: true,
  },
  {
    id: 'p2',
    name: 'AP Spoon, 1 pc',
    weight: '12 pc',
    price: 577,
    originalPrice: 620,
    image: '',
    unitPrice: '₹48.08/pc',
    inStock: false,
  },
  {
    id: 'p3',
    name: 'Amul Butter, 500 g',
    weight: '1 pc',
    price: 285,
    originalPrice: 310,
    image: '',
    inStock: true,
  },
  {
    id: 'p4',
    name: 'Basmati Rice Premium, 5 kg',
    weight: '1 bag',
    price: 649,
    originalPrice: 699,
    image: '',
    inStock: true,
  },
];

/** Single-section fallback when API tree is off — same shape as `buildHomeCategorySections` */
export const STATIC_CATEGORY_SECTIONS = [
  {
    id: 'static-shop',
    title: 'Shop by category',
    items: STATIC_HOME_CATEGORIES,
  },
];

export const STATIC_HOME_REVIEW = {
  deliveryLabel: STATIC_DELIVERY_LABEL,
  outlet: STATIC_OUTLET,
  heroSlides: STATIC_HERO_SLIDES,
  promoBelowCategories: STATIC_PROMO_BELOW_CATEGORIES,
  /** @deprecated use categorySections — kept for imports/tests */
  categories: STATIC_HOME_CATEGORIES,
  categorySections: STATIC_CATEGORY_SECTIONS,
  featuredProducts: STATIC_FEATURED_PRODUCTS,
  setupBanner: {
    title: 'Complete your restaurant setup to start placing orders',
    cta: 'Start',
  },
};
