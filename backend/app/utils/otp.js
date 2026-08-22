/**
 * OTP utility module bridging SMS India Hub service and local helpers.
 */
import { sendSmsOtp, verifySmsOtp } from '../services/otpService.js';

const MOCK_OTP = "1234";

export const useRealSMS = () =>
    (process.env.USE_REAL_SMS === "true" || process.env.USE_REAL_SMS === "1") &&
    process.env.USE_MOCK_OTP !== "true";

export const generateOTP = () =>
    useRealSMS()
        ? Math.floor(1000 + Math.random() * 9000).toString()
        : MOCK_OTP;

export { MOCK_OTP, sendSmsOtp, verifySmsOtp };
