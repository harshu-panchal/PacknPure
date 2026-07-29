import { jest } from "@jest/globals";

const MASTER_ID = "507f1f77bcf86cd799439011";
const SELLER_A = "507f1f77bcf86cd7994390a1";
const SELLER_B = "507f1f77bcf86cd7994390b2";
const ORDER_ID = "507f1f77bcf86cd7994390o1";
const SESSION_ID = "507f1f77bcf86cd7994390s1";
const PR_ID = "507f1f77bcf86cd7994390p1";
const ITEM_KEY = `${MASTER_ID}:root`;

const markProcurementExhausted = jest.fn(async () => null);
const createAutoPurchaseRequests = jest.fn(async () => []);

const sessionDoc = {
  _id: SESSION_ID,
  status: "open",
  hubId: "MAIN_HUB",
  items: [
    {
      itemKey: ITEM_KEY,
      productId: MASTER_ID,
      variantId: null,
      requiredQty: 10,
      remainingQty: 10,
      allocatedQty: 10,
      acceptedQty: 0,
    },
  ],
  allocations: [
    {
      itemKey: ITEM_KEY,
      vendorId: SELLER_A,
      retryNumber: 0,
      rankedSellers: [SELLER_B],
      status: "rejected",
      quantity: 10,
      acceptedQty: 0,
      remainingQty: 10,
    },
    {
      itemKey: ITEM_KEY,
      vendorId: SELLER_B,
      retryNumber: 1,
      rankedSellers: [],
      status: "rejected",
      quantity: 10,
      acceptedQty: 0,
      remainingQty: 10,
    },
  ],
  metadata: {
    rankedSellerIdsByItem: {
      [ITEM_KEY]: [SELLER_A, SELLER_B],
    },
  },
};

jest.unstable_mockModule("../app/services/hubOrderOrchestrator.js", () => ({
  createAutoPurchaseRequests,
  markProcurementExhausted,
}));

jest.unstable_mockModule("../app/services/procurementSessionService.js", () => ({
  getUncoveredRemainingQty: jest.fn((session, itemKey) => {
    const item = (session?.items || []).find((i) => i.itemKey === itemKey);
    if (!item) return 0;
    const accepted = Number(item.acceptedQty || 0);
    const completed = Number(item.completedQty || 0);
    // Mirror: uncovered = remaining after failed attempts still need fill
    return Math.max(0, Number(item.requiredQty || 0) - accepted - completed);
  }),
  getEligibleFallbackSellers: jest.fn(() => []),
  buildItemKey: jest.fn((productId, variantId) =>
    `${String(productId)}:${variantId ? String(variantId) : "root"}`,
  ),
}));

jest.unstable_mockModule("../app/models/procurementSession.js", () => ({
  default: {
    findById: jest.fn(async () => ({ ...sessionDoc })),
    findByIdAndUpdate: jest.fn(async () => null),
  },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: jest.fn(() => ({
      select: () => ({
        lean: async () => [
          {
            _id: MASTER_ID,
            name: "Rice",
            sellerId: null,
            ownerType: "admin",
            stock: 0,
            price: 100,
            variants: [],
          },
        ],
      }),
    })),
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {
    findById: jest.fn(() => ({
      lean: async () => ({ _id: ORDER_ID, orderId: "ORD-1" }),
    })),
  },
}));

const anchorPr = {
  _id: PR_ID,
  orderId: ORDER_ID,
  procurementSessionId: SESSION_ID,
  requestId: "PR-1",
  status: "seller_rejected",
  save: jest.fn(async () => {}),
};

jest.unstable_mockModule("../app/models/purchaseRequest.js", () => ({
  default: {
    findOne: jest.fn(() => ({
      sort: () => Promise.resolve(anchorPr),
    })),
  },
}));

jest.unstable_mockModule("../app/queues/orderQueues.js", () => ({
  procurementRetryQueue: {
    process: jest.fn(),
    add: jest.fn(),
  },
  JOB_NAMES: { PROCUREMENT_RETRY: "procurement-retry" },
}));

describe("executeRetryBatch exhaustion", () => {
  beforeEach(() => {
    createAutoPurchaseRequests.mockClear();
    markProcurementExhausted.mockClear();
    createAutoPurchaseRequests.mockResolvedValue([]);
  });

  it("invokes markProcurementExhausted when uncovered remains and no eligible sellers", async () => {
    const { executeRetryBatch } = await import("../app/jobs/procurementRetryJob.js");

    await executeRetryBatch({
      orderId: ORDER_ID,
      procurementSessionId: SESSION_ID,
    });

    expect(createAutoPurchaseRequests).toHaveBeenCalled();
    expect(markProcurementExhausted).toHaveBeenCalledTimes(1);
    expect(markProcurementExhausted.mock.calls[0][0]._id).toBe(PR_ID);
  });

  it("invokes exhaustion when create throws with uncovered shortage", async () => {
    createAutoPurchaseRequests.mockRejectedValueOnce(
      new Error("Some items are out of stock and cannot be procured right now: Rice"),
    );

    const { executeRetryBatch } = await import("../app/jobs/procurementRetryJob.js");

    await executeRetryBatch({
      orderId: ORDER_ID,
      procurementSessionId: SESSION_ID,
    });

    expect(markProcurementExhausted).toHaveBeenCalledTimes(1);
  });
});
