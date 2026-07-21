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

export const invalidateSettingsCache = () => {
  cachedSettings = null;
  cacheExpiresAt = 0;
};
