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
  deriveLineResponseStatus,
  isOrderInventoryReadyForDelivery,
  isProcurementSessionFullyComplete,
} from "./multiProductProcurementService.js";

export {
  ensureProcurementSession,
  reserveAllocation,
  attachPurchaseRequestAllocation,
  markAllocationFromSellerResponse,
  markAllocationTimeout,
  markAllocationCompletedFromInward,
  getEligibleFallbackSellers,
  getUncoveredRemainingQty,
  buildItemKey,
} from "./procurementSessionService.js";
