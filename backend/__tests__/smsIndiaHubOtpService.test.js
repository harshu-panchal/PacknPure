import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { normalizeToTenDigits, normalizeForSmsApi, isValidIndianMobile } from '../app/utils/smsHelpers.js';
import { sendSmsOtp, verifySmsOtp } from '../app/services/otpService.js';

describe('SMS India Hub Helper Utilities', () => {
  test('normalizeToTenDigits strips country code and non-digits', () => {
    expect(normalizeToTenDigits('+91 9876543210')).toBe('9876543210');
    expect(normalizeToTenDigits('09876543210')).toBe('9876543210');
    expect(normalizeToTenDigits('9876543210')).toBe('9876543210');
  });

  test('normalizeForSmsApi adds 91 prefix', () => {
    expect(normalizeForSmsApi('9876543210')).toBe('919876543210');
    expect(normalizeForSmsApi('+919876543210')).toBe('919876543210');
  });

  test('isValidIndianMobile validates 10 digit Indian mobile numbers', () => {
    expect(isValidIndianMobile('9876543210')).toBe(true);
    expect(isValidIndianMobile('5876543210')).toBe(false);
    expect(isValidIndianMobile('12345')).toBe(false);
  });
});

describe('SMS India Hub OTP Service Logic', () => {
  beforeEach(() => {
    process.env.USE_MOCK_OTP = 'true';
  });

  test('sendSmsOtp developer bypass for 9999999999', async () => {
    const result = await sendSmsOtp('9999999999', 'Delivery');
    expect(result.success).toBe(true);
    expect(result.sessionId).toBe('DEV_9999999999');
    expect(result.otp).toBe('1234');
  });
});
