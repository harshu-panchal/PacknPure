import Bull from "bull";
import {
  getRedisOptionsForBull,
  isRedisEnabled,
  createBullRedisClient,
} from "../config/redis.js";

const redisOpts = getRedisOptionsForBull();

const queueSettings = {
  stalledInterval: 30000,
  maxStalledCount: 2,
};

function createNoopQueue() {
  return {
    add: async () => ({}),
    getJob: async () => null,
    process: () => {},
    on: () => {},
    close: async () => {},
  };
}

export const sellerTimeoutQueue = isRedisEnabled()
  ? new Bull("seller-timeout", {
      redis: redisOpts,
      createClient: createBullRedisClient,
      settings: queueSettings,
    })
  : createNoopQueue();

export const deliveryTimeoutQueue = isRedisEnabled()
  ? new Bull("delivery-timeout", {
      redis: redisOpts,
      createClient: createBullRedisClient,
      settings: queueSettings,
    })
  : createNoopQueue();

/** Delayed queue for grouped procurement retry batching.
 * Fires after a configurable wait period so all rejections in the same wave
 * settle before the re-allocation runs. One job per order per rejection wave. */
export const procurementRetryQueue = isRedisEnabled()
  ? new Bull("procurement-retry", {
      redis: redisOpts,
      createClient: createBullRedisClient,
      settings: queueSettings,
    })
  : createNoopQueue();

export const JOB_NAMES = {
  SELLER_TIMEOUT: "seller-timeout",
  DELIVERY_TIMEOUT: "delivery-timeout",
  PROCUREMENT_RETRY: "procurement-retry",
};
