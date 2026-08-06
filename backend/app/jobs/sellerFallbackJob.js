/**
 * Background interval job: scans for expired PENDING_SELLER offers and
 * advances to the next seller in the queue.
 *
 * Runs every 2 seconds (same cadence as procurementMonitorJob).
 * Guarded against duplicate instantiation via a global flag.
 */

import { processSellerFallbackTimeouts } from "../services/sellerFallbackService.js";

const FALLBACK_CHECK_INTERVAL_MS = 2 * 1000;

export const startSellerFallbackJob = () => {
  if (globalThis.__SELLER_FALLBACK_JOB_STARTED__) return;
  globalThis.__SELLER_FALLBACK_JOB_STARTED__ = true;

  console.log(
    `[SellerFallbackJob] Started with interval ${FALLBACK_CHECK_INTERVAL_MS}ms`,
  );

  setInterval(() => {
    void processSellerFallbackTimeouts();
  }, FALLBACK_CHECK_INTERVAL_MS);

  // Run once immediately on startup
  void processSellerFallbackTimeouts();
};

export default startSellerFallbackJob;
