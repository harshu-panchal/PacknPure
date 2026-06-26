/**
 * Customer storefront brand — always #E23744.
 * Ignores API `settings.primaryColor` (e.g. admin green #0de79f) on user-facing UI.
 */
import brandLogoImage from '@/assets/brand_logo.png';
import brandLogoWhiteImage from '@/assets/brand_logo_white1.png';

export const BRAND_COLOR = '#E23744';
export const BRAND_COLOR_DARK = '#C41E35';
export const BRAND_COLOR_DEEP = '#9A1829';
export const BRAND_COLOR_LIGHT = '#FFF1F2';
export const BRAND_COLOR_MID = '#FFD6DB';

/** Fixed storefront logo — ignores API `settings.logoUrl` on customer UI. */
export const BRAND_LOGO = brandLogoImage;
export const BRAND_LOGO_WHITE = brandLogoWhiteImage;

export function brandLogo(_settings) {
  return BRAND_LOGO;
}

/** Shared class for header / navbar logos (h-13 = 52px in tailwind.config). */
export const NAVBAR_LOGO_CLASS =
  "h-13 w-auto max-w-[180px] object-contain object-left";

/** For dark/brand backgrounds (footer, hero strips). */
export function brandLogoOnColor(_settings) {
  return BRAND_LOGO_WHITE;
}

/** Customer CSS variables (override /settings API theme on storefront routes). */
const CUSTOMER_CSS_VARS = {
  '--primary': BRAND_COLOR,
  '--primary-color': BRAND_COLOR,
  '--primary-dark': BRAND_COLOR_DARK,
  '--customer-mini-cart-color': BRAND_COLOR,
};

/**
 * Always returns fixed storefront brand — never API primaryColor.
 */
export function brandColor(_settings) {
  return BRAND_COLOR;
}

export function brandColorDark(_settings) {
  return BRAND_COLOR_DARK;
}

/** Apply brand CSS vars while customer layout is mounted. */
export function applyCustomerThemeVariables() {
  const root = document.documentElement;
  Object.entries(CUSTOMER_CSS_VARS).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

/** Restore theme from admin settings when leaving customer routes. */
export function restoreThemeFromSettings(settings) {
  if (!settings) return;
  const root = document.documentElement;
  const primary = settings.primaryColor || BRAND_COLOR;
  const secondary = settings.secondaryColor || '#64748b';
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--secondary', secondary);
  root.style.setProperty('--secondary-color', secondary);
  root.style.setProperty('--customer-mini-cart-color', BRAND_COLOR);
}

export function brandFooterGradient(_settings) {
  return `linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 45%, ${BRAND_COLOR_DEEP} 100%)`;
}

export function brandSoftGradient(_settings) {
  return `linear-gradient(135deg, ${BRAND_COLOR_LIGHT} 0%, ${BRAND_COLOR}14 48%, #ffffff 100%)`;
}

export function brandPromoStripGradient(_settings) {
  return `linear-gradient(105deg, ${BRAND_COLOR}1a 0%, ${BRAND_COLOR_MID}99 42%, #ffffff 100%)`;
}

export function brandButtonGradient(_settings) {
  return `linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 100%)`;
}

export function brandTint(alphaHex = '14') {
  return `${BRAND_COLOR}${alphaHex}`;
}
