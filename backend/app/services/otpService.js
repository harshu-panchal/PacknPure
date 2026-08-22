import axios from 'axios';
import Otp from '../models/otp.js';
import { normalizeToTenDigits, normalizeForSmsApi, isValidIndianMobile } from '../utils/smsHelpers.js';

const getApiKey = () => process.env.SMS_INDIA_HUB_API_KEY;
const getSenderId = () => process.env.SMS_INDIA_HUB_SENDER_ID;
const getApiUrl = () => process.env.SMS_INDIA_HUB_URL || 'http://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
const getDltTemplateId = () => process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID;

const isMockMode = () => {
  if (process.env.USE_MOCK_OTP === 'true' || process.env.USE_MOCK_OTP === '1') return true;
  if (process.env.USE_REAL_SMS === 'false' || process.env.USE_REAL_SMS === '0') return true;
  return false;
};

// Generate 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

/**
 * Saves OTP record to Database with 5-minute TTL expiration.
 */
async function saveOtpToDb(mobile, otp, userType) {
  const cleanMobile = normalizeToTenDigits(mobile);
  // Clear any existing active OTPs for this (mobile, userType) combo
  await Otp.deleteMany({ mobile: cleanMobile, userType });
  return await Otp.create({
    mobile: cleanMobile,
    otp,
    userType,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes validity
  });
}

/**
 * Sends SMS OTP using SMS India Hub API or mock mode.
 * @param {string} mobile - 10-digit Indian mobile number
 * @param {'Admin' | 'Seller' | 'Customer' | 'Delivery'} userType - Role of the user requesting OTP
 */
export const sendSmsOtp = async (mobile, userType) => {
  const cleanMobile = normalizeToTenDigits(mobile);
  if (!isValidIndianMobile(cleanMobile)) {
    throw new Error('Invalid 10-digit mobile number');
  }

  const otp = generateOTP();

  // 1. Mock Mode Check
  if (isMockMode()) {
    await saveOtpToDb(cleanMobile, otp, userType);
    console.log(`[MOCK SMS] OTP for ${cleanMobile} (${userType}): ${otp}`);
    return {
      success: true,
      message: 'OTP sent (Mock Mode)',
      sessionId: `MOCK_${cleanMobile}`,
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  // 2. Developer Bypass (Fixed test mobile number)
  if (cleanMobile === '9999999999') {
    await saveOtpToDb(cleanMobile, '1234', userType);
    console.log(`[DEV BYPASS] Fixed OTP (1234) generated for ${cleanMobile}`);
    return {
      success: true,
      message: 'OTP sent',
      sessionId: `DEV_${cleanMobile}`,
      otp: '1234',
    };
  }

  // 3. Real SMS Sending via SMS India Hub
  try {
    const apiKey = getApiKey();
    const senderId = getSenderId();
    const apiUrl = getApiUrl();
    const dltTemplateId = getDltTemplateId();

    if (!apiKey || !senderId) {
      console.warn('[SMS India Hub] Warning: API Key or Sender ID missing in environment variables. Falling back to mock save.');
      await saveOtpToDb(cleanMobile, otp, userType);
      return { success: true, message: 'OTP sent (Fallback Mock)', otp };
    }

    const appName = process.env.APP_NAME || 'PacknPure';
    // DLT-approved template requires the Sender ID appended as a literal trailing
    // signature in the message body (confirmed via SMS India Hub delivery report:
    // only messages ending in ".{SenderID}" show status "Delivered" — every
    // message missing this suffix is silently rejected at the carrier level).
    const messageText = `Welcome to the ${appName} powered by Appzeto.Your OTP for registration is ${otp}.${senderId}`;

    const params = {
      APIKey: apiKey,
      msisdn: normalizeForSmsApi(cleanMobile),
      sid: senderId,
      msg: messageText,
      fl: '0',
      gwid: '2',
      route: '2',
      channel: '2',
      DCS: '0',
    };

    if (dltTemplateId) {
      params.templateid = dltTemplateId;
      params.DLT_TE_ID = dltTemplateId;
    }

    if (process.env.SMS_INDIA_HUB_PE_ID) {
      params.peid = process.env.SMS_INDIA_HUB_PE_ID;
      params.PE_ID = process.env.SMS_INDIA_HUB_PE_ID;
      params.entityid = process.env.SMS_INDIA_HUB_PE_ID;
    }

    const response = await axios.get(apiUrl, { params });

    // Check for specific SMS India HUB error codes (SMS India HUB returns 200 OK even for errors in body)
    if (response.data && response.data.ErrorCode && response.data.ErrorCode !== '000') {
      throw new Error(`SMS Provider Error [${response.data.ErrorCode}]: ${response.data.ErrorMessage || 'Failed to dispatch SMS'}`);
    }

    console.log(`--------------------------------------------------`);
    console.log(`[SMS India Hub] Dispatched OTP [ ${otp} ] to ${normalizeForSmsApi(cleanMobile)} | JobId: ${response.data?.JobId || 'N/A'}`);
    console.log(`--------------------------------------------------`);

    await saveOtpToDb(cleanMobile, otp, userType);
    return {
      success: true,
      message: 'OTP sent successfully',
      jobId: response.data?.JobId,
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  } catch (error) {
    console.error(`[SMS India Hub Error] ${error.message}`);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/**
 * Verifies SMS OTP against database records.
 * @param {string} mobile - 10-digit Indian mobile number
 * @param {string} otp - OTP code entered by user
 * @param {'Admin' | 'Seller' | 'Customer' | 'Delivery'} userType - Role of the user
 * @returns {Promise<boolean>} - Returns true if valid, false otherwise.
 */
export const verifySmsOtp = async (mobile, otp, userType) => {
  const cleanMobile = normalizeToTenDigits(mobile);
  const cleanOtp = String(otp || '').trim();

  if (!cleanMobile || !cleanOtp) return false;

  // Developer Backdoor for testing environments
  if (cleanOtp === '999999' && process.env.NODE_ENV !== 'production') {
    return true;
  }

  const record = await Otp.findOne({ mobile: cleanMobile, userType, otp: cleanOtp });

  if (!record) {
    return false;
  }

  // Check if expired
  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: record._id });
    return false;
  }

  // Consume OTP (one-time use)
  await Otp.deleteOne({ _id: record._id });
  return true;
};
