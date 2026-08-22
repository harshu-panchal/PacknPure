/**
 * SMS Helpers for mobile normalization and format validation.
 */

/**
 * Normalizes a raw phone number to a clean 10-digit Indian mobile number string.
 * Removes country codes (+91, 91, 0) and non-numeric characters.
 */
export const normalizeToTenDigits = (raw) => {
  if (raw == null) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
};

/**
 * Normalizes mobile number with '91' prefix for SMS India Hub API calls (msisdn parameter).
 */
export const normalizeForSmsApi = (mobile) => {
  let clean = normalizeToTenDigits(mobile);
  if (!clean.startsWith('91')) {
    clean = '91' + clean;
  }
  return clean;
};

/**
 * Validates whether the given string is a valid 10-digit Indian mobile number starting with 6-9.
 */
export const isValidIndianMobile = (mobile) => {
  const clean = normalizeToTenDigits(mobile);
  return /^[6-9]\d{9}$/.test(clean);
};
