import Setting from "../models/setting.js";

let cachedSettings = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

export const getSettings = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && cacheExpiresAt > now) {
    return cachedSettings;
  }
  cachedSettings = await Setting.findOne().lean();
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedSettings || {};
};

export const getSellerResponseTimeoutMinutes = async () => {
  const settings = await getSettings();
  return Math.max(1, Number(settings?.sellerResponseTimeout ?? 15));
};

export const getPickupTimeoutMinutes = async () => {
  const settings = await getSettings();
  return Math.max(1, Number(settings?.pickupTimeout ?? 120));
};

export const getHubReceiveTimeoutMinutes = async () => {
  const settings = await getSettings();
  return Math.max(1, Number(settings?.hubReceiveTimeout ?? 180));
};

export const getReturnConfirmationTimeoutMinutes = async () => {
  const settings = await getSettings();
  return Math.max(1, Number(settings?.returnConfirmationTimeout ?? 1440));
};

export const getDeliveryTimeoutMinutes = async () => {
  const settings = await getSettings();
  const fromSettings = Number(settings?.deliveryTimeout);
  if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
  const envMs = Number(process.env.DEFAULT_DELIVERY_TIMEOUT_MS || 900000);
  return Math.max(1, Math.round(envMs / 60000));
};

export const getPickupOtpTimeoutMinutes = async () => {
  const settings = await getSettings();
  return Math.max(1, Number(settings?.pickupOtpTimeout ?? 30));
};

export const getDeliveryOtpExpiryMinutes = async () => {
  const settings = await getSettings();
  return Math.max(1, Number(settings?.deliveryOtpExpiry ?? 5));
};

export const getSlaHours = async () => {
  const settings = await getSettings();
  const fromSettings = Number(settings?.slaHours);
  if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
  return Math.max(1, Number(process.env.HUB_SLA_HOURS || 3));
};

export const getProcurementFailureAction = async () => {
  const settings = await getSettings();
  return settings?.procurementFailureAction === "put_on_hold" ? "put_on_hold" : "auto_cancel";
};

export const isMultiSellerAllocationEnabled = async () => {
  const settings = await getSettings();
  return Boolean(settings?.enableMultiSellerAllocation);
};

export const getSellerResponseTimeoutMs = async () =>
  (await getSellerResponseTimeoutMinutes()) * 60 * 1000;

export const getPickupTimeoutMs = async () => (await getPickupTimeoutMinutes()) * 60 * 1000;

export const getHubReceiveTimeoutMs = async () =>
  (await getHubReceiveTimeoutMinutes()) * 60 * 1000;

export const getDeliveryTimeoutMs = async () =>
  (await getDeliveryTimeoutMinutes()) * 60 * 1000;

export const getPickupOtpTimeoutMs = async () =>
  (await getPickupOtpTimeoutMinutes()) * 60 * 1000;

export const getDeliveryOtpExpiryMs = async () =>
  (await getDeliveryOtpExpiryMinutes()) * 60 * 1000;

export const getReturnConfirmationTimeoutMs = async () =>
  (await getReturnConfirmationTimeoutMinutes()) * 60 * 1000;

export const getSlaDeadline = async (fromDate = new Date()) => {
  const hours = await getSlaHours();
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
};

export const getAuthOtpTtlMs = async () => {
  const settings = await getSettings();
  const minutes = Math.max(1, Number(settings?.authOtpExpiry ?? 5));
  return minutes * 60 * 1000;
};

export const getPaymentIntentExpiryMs = async () => {
  const settings = await getSettings();
  const minutes = Math.max(1, Number(settings?.paymentIntentExpiry ?? 15));
  return minutes * 60 * 1000;
};

export const getReturnWindowDays = async () => {
  const settings = await getSettings();
  return Math.max(1, Number(settings?.returnWindowDays ?? 7));
};

export const invalidateSettingsCache = () => {
  cachedSettings = null;
  cacheExpiresAt = 0;
};
