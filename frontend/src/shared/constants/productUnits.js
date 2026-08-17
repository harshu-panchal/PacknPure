/** Sell / pack units — keep in sync with backend PRODUCT_UNITS */
export const DEFAULT_PRODUCT_UNITS = [
  { value: 'Pieces', label: 'Pieces' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'L', label: 'Liters (L)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'Pack', label: 'Pack' },
  { value: 'Box', label: 'Box' },
  { value: 'Jar', label: 'Jar' },
  { value: 'Bundle', label: 'Bundle' },
];

const LOCAL_STORAGE_KEY = 'custom_product_units';
let memoryCustomUnits = [];

export const getCustomUnits = () => {
  if (typeof window === 'undefined') return memoryCustomUnits;
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return memoryCustomUnits;
  }
};

export const addCustomUnit = (newUnitName) => {
  if (!newUnitName || !newUnitName.trim()) return null;
  const cleanName = newUnitName.trim();
  const custom = getCustomUnits();
  const exists = [...DEFAULT_PRODUCT_UNITS, ...custom].some(
    (u) => u.value.toLowerCase() === cleanName.toLowerCase()
  );
  const unitObj = { value: cleanName, label: cleanName };
  if (!exists) {
    const updated = [...custom, unitObj];
    memoryCustomUnits = updated;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save custom unit", e);
      }
    }
  }
  return unitObj;
};

export const getAllUnits = () => {
  const custom = getCustomUnits();
  const combined = [...DEFAULT_PRODUCT_UNITS];
  for (const c of custom) {
    if (!combined.some((u) => u.value.toLowerCase() === c.value.toLowerCase())) {
      combined.push(c);
    }
  }
  return combined;
};

export const PRODUCT_UNITS = getAllUnits();

export const DEFAULT_PRODUCT_UNIT = 'Pieces';

export const getUnitLabel = (val) => {
  if (!val) return "—";
  const cleanVal = String(val).trim().toLowerCase();
  const all = getAllUnits();
  const unit = all.find((u) => u.value.toLowerCase() === cleanVal);
  if (unit) {
    return unit.label.split(' (')[0];
  }
  return val;
};
