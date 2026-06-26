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
    image:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600',
    bgFrom: '#FFF1F2',
    bgTo: '#ffffff',
    accent: '#E23744',
    ctaBg: '#E23744',
  },
  {
    id: 'hero-2',
    layout: 'fullBleed',
    image:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&q=80&w=1200&h=500',
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
    image:
      'https://images.unsplash.com/photo-1556910096-6f5e66d2f8c5?auto=format&fit=crop&q=80&w=600',
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
  image:
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&q=80&w=400&h=400',
  gradientFrom: '#FFF1F2',
  gradientTo: '#ffffff',
};

export const STATIC_HOME_CATEGORIES = [
  { id: 'fruits-veg', name: 'Fruits & Vegetables', image: 'https://images.unsplash.com/photo-1540420773420-3366772e4aaf?w=200&h=200&fit=crop' },
  { id: 'masala', name: 'Masala, Salt & Sugar', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&h=200&fit=crop' },
  { id: 'dairy', name: 'Dairy', image: 'https://images.unsplash.com/photo-1628088062854-d187426aef3e?w=200&h=200&fit=crop' },
  { id: 'flours', name: 'Flours', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200&h=200&fit=crop' },
  { id: 'canned', name: 'Canned & Imported', image: 'https://images.unsplash.com/photo-1586201375767-2b1e3d2e6c3b?w=200&h=200&fit=crop' },
  { id: 'sauces', name: 'Sauces & Seasoning', image: 'https://images.unsplash.com/photo-1472474306169-61c38367472f?w=200&h=200&fit=crop' },
  { id: 'rice', name: 'Rice & Rice Products', image: 'https://images.unsplash.com/photo-1586201375767-2b1e3d2e6c3b?w=200&h=200&fit=crop' },
  { id: 'cleaning', name: 'Cleaning & Consumables', image: 'https://images.unsplash.com/photo-1585421514288-efb74c4b2456?w=200&h=200&fit=crop' },
  { id: 'packaging', name: 'Packaging Material', image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=200&h=200&fit=crop' },
  { id: 'kitchenware', name: 'Kitchenware', image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=200&h=200&fit=crop' },
  { id: 'pulses', name: 'Pulses', image: 'https://images.unsplash.com/photo-1586201375767-2b1e3d2e6c3b?w=200&h=200&fit=crop' },
  { id: 'frozen', name: 'Frozen & Instant Food', image: 'https://images.unsplash.com/photo-1574481283086-0df72b6c92f0?w=200&h=200&fit=crop' },
  { id: 'beverages', name: 'Beverages', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&h=200&fit=crop' },
  { id: 'snacks', name: 'Snacks', image: 'https://images.unsplash.com/photo-1599490659633-2d0405010a0e?w=200&h=200&fit=crop' },
  { id: 'appliances', name: 'Appliances', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop' },
];

export const STATIC_FEATURED_PRODUCTS = [
  {
    id: 'p1',
    name: 'V4 - Pizza Sauce/ Squeeze Bottle, 15 oz, 450 ml',
    weight: '1 pc',
    price: 52,
    originalPrice: 58,
    image: 'https://images.unsplash.com/photo-1622484217850-47290b421f9d?w=400&h=400&fit=crop',
    bulkLabel: '₹50/pc for 3 pcs+',
    inStock: true,
  },
  {
    id: 'p2',
    name: 'AP Spoon, 1 pc',
    weight: '12 pc',
    price: 577,
    originalPrice: 620,
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop',
    unitPrice: '₹48.08/pc',
    inStock: false,
  },
  {
    id: 'p3',
    name: 'Amul Butter, 500 g',
    weight: '1 pc',
    price: 285,
    originalPrice: 310,
    image: 'https://images.unsplash.com/photo-1589985270583-46e0ae1caa1e?w=400&h=400&fit=crop',
    inStock: true,
  },
  {
    id: 'p4',
    name: 'Basmati Rice Premium, 5 kg',
    weight: '1 bag',
    price: 649,
    originalPrice: 699,
    image: 'https://images.unsplash.com/photo-1586201375767-2b1e3d2e6c3b?w=400&h=400&fit=crop',
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
