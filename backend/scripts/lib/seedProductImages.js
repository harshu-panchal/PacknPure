/**
 * Resolve product images from product name / tags for admin catalog seeding.
 * Uses stable Unsplash URLs keyed by grocery keywords.
 */

/** @type {Record<string, string>} */
export const PRODUCT_IMAGE_URLS = {
  milk: "https://images.unsplash.com/photo-1550583724-b2692b85b5f0?auto=format&fit=crop&w=600&q=80",
  butter: "https://images.unsplash.com/photo-1589985270623-96993e6fa2d7?auto=format&fit=crop&w=600&q=80",
  paneer: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
  cheese: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80",
  curd: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80",
  yogurt: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80",
  tomato: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=600&q=80",
  onion: "https://images.unsplash.com/photo-1518977956812-cd3dbadaef31?auto=format&fit=crop&w=600&q=80",
  potato: "https://images.unsplash.com/photo-1518975567842-dc934004d25c?auto=format&fit=crop&w=600&q=80",
  apple: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80",
  banana: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80",
  herbs: "https://images.unsplash.com/photo-1466692476866-aef1dfb1e735?auto=format&fit=crop&w=600&q=80",
  coriander: "https://images.unsplash.com/photo-1615485290382-f4414334d2bb?auto=format&fit=crop&w=600&q=80",
  rice: "https://images.unsplash.com/photo-1586201375767-2b74b2f508b9?auto=format&fit=crop&w=600&q=80",
  basmati: "https://images.unsplash.com/photo-1586201375767-2b74b2f508b9?auto=format&fit=crop&w=600&q=80",
  dal: "https://images.unsplash.com/photo-1584270354949-c26b0d3960b2?auto=format&fit=crop&w=600&q=80",
  pulse: "https://images.unsplash.com/photo-1584270354949-c26b0d3960b2?auto=format&fit=crop&w=600&q=80",
  oil: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
  masala: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80",
  salt: "https://images.unsplash.com/photo-1609501676725-7186f017a4b7?auto=format&fit=crop&w=600&q=80",
  sugar: "https://images.unsplash.com/photo-1581441363689-1f3e6d9e9b2e?auto=format&fit=crop&w=600&q=80",
  chicken: "https://images.unsplash.com/photo-1604503468506-440d43c0c9c1?auto=format&fit=crop&w=600&q=80",
  eggs: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80",
  mutton: "https://images.unsplash.com/photo-1603048295942-be79d75e3b9c?auto=format&fit=crop&w=600&q=80",
  fish: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b3a2?auto=format&fit=crop&w=600&q=80",
  prawns: "https://images.unsplash.com/photo-1565680018434-b698b7a50383?auto=format&fit=crop&w=600&q=80",
  seafood: "https://images.unsplash.com/photo-1565680018434-b698b7a50383?auto=format&fit=crop&w=600&q=80",
  cola: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=600&q=80",
  juice: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80",
  water: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80",
  biscuit: "https://images.unsplash.com/photo-1558961363-fa8a2d0dc638?auto=format&fit=crop&w=600&q=80",
  cookies: "https://images.unsplash.com/photo-1558961363-fa8a2d0dc638?auto=format&fit=crop&w=600&q=80",
  chocolate: "https://images.unsplash.com/photo-1548907040-4baa97d109ad?auto=format&fit=crop&w=600&q=80",
  atta: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80",
  flour: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80",
  almonds: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
  nuts: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
  frozen: "https://images.unsplash.com/photo-1574485007669-0c076e33ef2a?auto=format&fit=crop&w=600&q=80",
  noodles: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80",
  maggi: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80",
  ketchup: "https://images.unsplash.com/photo-1628191010210-a59de9c7dad2?auto=format&fit=crop&w=600&q=80",
  sauce: "https://images.unsplash.com/photo-1628191010210-a59de9c7dad2?auto=format&fit=crop&w=600&q=80",
  cleaner: "https://images.unsplash.com/photo-1585421514288-efb74c4b3776?auto=format&fit=crop&w=600&q=80",
  detergent: "https://images.unsplash.com/photo-1583947215259-38e31be8331c?auto=format&fit=crop&w=600&q=80",
  cookware: "https://images.unsplash.com/photo-1584990342419-2e0c8e40b849?auto=format&fit=crop&w=600&q=80",
  packaging: "https://images.unsplash.com/photo-1607083206869-4caa2a3f0e0a?auto=format&fit=crop&w=600&q=80",
  snacks: "https://images.unsplash.com/photo-1613919113640-25732cd5a954?auto=format&fit=crop&w=600&q=80",
  namkeen: "https://images.unsplash.com/photo-1613919113640-25732cd5a954?auto=format&fit=crop&w=600&q=80",
  bhujia: "https://images.unsplash.com/photo-1613919113640-25732cd5a954?auto=format&fit=crop&w=600&q=80",
  bread: "https://images.unsplash.com/photo-1549931319-a545aca3a9ad?auto=format&fit=crop&w=600&q=80",
  grocery: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
};

/** Extra phrases → image bucket (checked before single-word keys). */
const NAME_ALIASES = [
  ["basmati", "basmati"],
  ["soft drink", "cola"],
  ["coca-cola", "cola"],
  ["coke", "cola"],
  ["toor dal", "dal"],
  ["toor", "dal"],
  ["sunflower", "oil"],
  ["refined oil", "oil"],
  ["cooking oil", "oil"],
  ["garam masala", "masala"],
  ["spice", "masala"],
  ["paneer", "paneer"],
  ["cottage cheese", "paneer"],
  ["brown egg", "eggs"],
  ["farm egg", "eggs"],
  ["orange juice", "juice"],
  ["fruit juice", "juice"],
  ["packaged water", "water"],
  ["mineral water", "water"],
  ["toilet cleaner", "cleaner"],
  ["harpic", "cleaner"],
  ["laundry", "detergent"],
  ["surf excel", "detergent"],
  ["non-stick", "cookware"],
  ["tawa", "cookware"],
  ["kadai", "cookware"],
  ["clamshell", "packaging"],
  ["container", "packaging"],
  ["curry cut", "mutton"],
  ["goat", "mutton"],
  ["shrimp", "prawns"],
  ["green peas", "frozen"],
  ["instant noodle", "noodles"],
  ["whole wheat", "atta"],
  ["wheat atta", "atta"],
  ["iodized salt", "salt"],
  ["tomato ketchup", "ketchup"],
  ["cookie", "biscuit"],
  ["biscuit", "biscuit"],
  ["sev", "bhujia"],
  ["bhujia", "bhujia"],
  ["coriander", "coriander"],
  ["herb", "herbs"],
  ["leafy", "herbs"],
];

const SORTED_KEYS = Object.keys(PRODUCT_IMAGE_URLS).sort((a, b) => b.length - a.length);

function normalizeHaystack(name, tags = []) {
  return `${String(name || "")} ${(tags || []).join(" ")}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
}

/**
 * Pick the best image bucket from product name + tags.
 * @returns {string} key into PRODUCT_IMAGE_URLS
 */
export function resolveImageKeyFromName(name, tags = [], explicitKey = null) {
  if (explicitKey && PRODUCT_IMAGE_URLS[explicitKey]) {
    return explicitKey;
  }

  const haystack = normalizeHaystack(name, tags);

  for (const [phrase, key] of NAME_ALIASES) {
    if (haystack.includes(phrase) && PRODUCT_IMAGE_URLS[key]) {
      return key;
    }
  }

  for (const key of SORTED_KEYS) {
    if (haystack.includes(key)) {
      return key;
    }
  }

  return "grocery";
}

export function imageUrlForKey(key) {
  return PRODUCT_IMAGE_URLS[key] || PRODUCT_IMAGE_URLS.grocery;
}

/**
 * Build mainImage + galleryImages for a catalog row.
 * Gallery second image uses a stable picsum seed from product slug.
 */
export function buildProductImages({ name, tags = [], imageKey, slug }) {
  const key = resolveImageKeyFromName(name, tags, imageKey);
  const mainImage = imageUrlForKey(key);
  const seed = String(slug || name || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const galleryImages = [
    mainImage,
    `https://picsum.photos/seed/${seed}-gallery/600/600`,
  ];
  return { mainImage, galleryImages, imageKey: key };
}
