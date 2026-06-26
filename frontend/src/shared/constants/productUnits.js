/** Sell / pack units — keep in sync with backend PRODUCT_UNITS */
export const PRODUCT_UNITS = [
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

export const DEFAULT_PRODUCT_UNIT = 'Pieces';

export const getUnitLabel = (val) => {
  if (!val) return "—";
  const cleanVal = String(val).trim().toLowerCase();
  const unit = PRODUCT_UNITS.find(u => u.value.toLowerCase() === cleanVal);
  if (unit) {
    // Extract just the word "Grams" from "Grams (g)"
    return unit.label.split(' (')[0];
  }
  return val;
};
