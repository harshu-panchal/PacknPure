/**
 * Single entry point for Purchase Request lifecycle writes.
 * Controllers and jobs must use this service — not PurchaseRequest model directly.
 */
export {
  createPurchaseRequest,
  findPurchaseRequestById,
  findOnePurchaseRequest,
  findPurchaseRequests,
  savePurchaseRequest,
  updatePurchaseRequestById,
  updateOnePurchaseRequest,
  updateManyPurchaseRequests,
} from "./purchaseRequestRepository.js";

export {
  createAutoPurchaseRequests,
  fallbackPurchaseRequest,
  fallbackPurchaseRequestLine,
  releasePurchaseRequestCommitments,
  planHubFulfillment,
  reserveHubInventory,
} from "./hubOrderOrchestrator.js";

export {
  createSellerGroupedPurchaseRequests,
  isMultiProductProcurementOrder,
  processRejectedLinesForFallback,
  releaseLineAndRetry,
  deriveLineResponseStatus,
  isOrderInventoryReadyForDelivery,
  isProcurementSessionFullyComplete,
  buildPrLineKey,
  normalizePrLine,
  isRetryEligibleLineStatus,
  isPickupEligibleLine,
  applyLineSellerQuantities,
  syncPrAggregateStatus,
} from "./multiProductProcurementService.js";

export {
  ensureProcurementSession,
  reserveAllocation,
  attachPurchaseRequestAllocation,
  markAllocationFromSellerResponse,
  markAllocationTimeout,
  markAllocationCompletedFromInward,
  evaluateProcurementSessionCompletion,
  releaseAllocationSellerStock,
  releaseAllReservedAllocations,
  tryClaimAllocationReservation,
  revertAllocationReservationClaim,
  markAllocationReservationCompleted,
  RESERVATION_STATE,
  isAllocationStockReserved,
  getEligibleFallbackSellers,
  getUncoveredRemainingQty,
  buildItemKey,
} from "./procurementSessionService.js";
