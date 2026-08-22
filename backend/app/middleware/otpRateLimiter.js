import rateLimit from 'express-rate-limit';

/**
 * Rate limiter middleware for OTP endpoints.
 * Limits each IP address to 5 OTP requests per 15-minute window to prevent SMS flooding/spamming.
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per 15-minute window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many OTP requests from this IP. Please try again after 15 minutes.',
  },
});
