import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { normalizeToTenDigits, normalizeForSmsApi, isValidIndianMobile } from '../app/utils/smsHelpers.js';

// sendSmsOtp persists the code before returning. Unmocked, that blocks on a database
// connection these unit tests do not have.
const mockOtpDeleteMany = jest.fn(async () => ({ deletedCount: 0 }));
const mockOtpCreate = jest.fn(async (doc) => doc);
jest.unstable_mockModule('../app/models/otp.js', () => ({
  default: { deleteMany: mockOtpDeleteMany, create: mockOtpCreate },
}));

const { sendSmsOtp, verifySmsOtp } = await import('../app/services/otpService.js');

describe('SMS India Hub Helper Utilities', () => {
  test('normalizeToTenDigits strips country code and non-digits', () => {
    expect(normalizeToTenDigits('+91 9876543210')).toBe('9876543210');
    expect(normalizeToTenDigits('09876543210')).toBe('9876543210');
    expect(normalizeToTenDigits('9876543210')).toBe('9876543210');
  });

  test('normalizeForSmsApi adds 91 prefix', () => {
    expect(normalizeForSmsApi('9876543210')).toBe('919876543210');
    expect(normalizeForSmsApi('+919876543210')).toBe('919876543210');
    // Crucial: 10-digit phone number that starts with 91 (e.g. 9176543210)
    expect(normalizeForSmsApi('9176543210')).toBe('919176543210');
    expect(normalizeForSmsApi('+919176543210')).toBe('919176543210');
  });

  test('isValidIndianMobile validates 10 digit Indian mobile numbers', () => {
    expect(isValidIndianMobile('9876543210')).toBe(true);
    expect(isValidIndianMobile('5876543210')).toBe(false);
    expect(isValidIndianMobile('12345')).toBe(false);
  });
});

describe('SMS India Hub OTP Service Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The developer bypass sits *after* the mock-mode branch, so mock mode has to be
    // off to reach it — with USE_MOCK_OTP=true the service returns MOCK_… instead.
    process.env.USE_MOCK_OTP = 'false';
    process.env.USE_REAL_SMS = 'true';
  });

  test('sendSmsOtp default bypass for 9630938487', async () => {
    const result = await sendSmsOtp('9630938487', 'Customer');
    expect(result.success).toBe(true);
    expect(result.sessionId).toBe('DEV_9630938487');
    expect(result.otp).toBe('1234');
    expect(mockOtpCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mobile: '9630938487', otp: '1234', userType: 'Customer' }),
    );
  });

  test('verifySmsOtp successfully validates default OTP 1234 for 9630938487', async () => {
    const isValid = await verifySmsOtp('9630938487', '1234', 'Customer');
    expect(isValid).toBe(true);
  });

  test('sendSmsOtp developer bypass for 9999999999', async () => {
    const result = await sendSmsOtp('9999999999', 'Delivery');
    expect(result.success).toBe(true);
    expect(result.sessionId).toBe('DEV_9999999999');
    expect(result.otp).toBe('1234');
    expect(mockOtpCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mobile: '9999999999', otp: '1234', userType: 'Delivery' }),
    );
  });

  test('sendSmsOtp returns a mock session when mock mode is enabled', async () => {
    process.env.USE_MOCK_OTP = 'true';
    const result = await sendSmsOtp('9876543210', 'Customer');
    expect(result.success).toBe(true);
    expect(result.sessionId).toBe('MOCK_9876543210');
  });

  test('sendSmsOtp rejects an invalid mobile number', async () => {
    await expect(sendSmsOtp('12345', 'Customer')).rejects.toThrow(/Invalid 10-digit/i);
  });
});
