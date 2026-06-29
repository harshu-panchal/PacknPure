import { jest } from "@jest/globals";

jest.setTimeout(15000);

const ORDER_ID = "order-timeout-1";

jest.unstable_mockModule("../app/models/purchaseRequest.js", () => ({
  default: {
    findById: jest.fn(async () => ({
      _id: "pr-1",
      requestId: "PR-1",
      orderId: ORDER_ID,
      hubId: "MAIN_HUB",
      rankedSellers: ["seller-2"],
      items: [
        {
          productId: "prod-1",
          requiredQty: 100,
          availableQtyAtHub: 0,
          shortageQty: 100,
          requestedQty: 100,
          remainingQty: 100,
          committedQty: 0,
          vendorUnitCost: 10,
          vendorQuotedPrice: 10,
          gstRate: 0,
          gstAmount: 0,
          baseSupplyPrice: 10,
          finalSupplyPrice: 10,
        },
      ],
      save: jest.fn(async () => undefined),
    })),
    create: jest.fn(async (doc) => doc),
  },
}));

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: jest.fn(() => ({ lean: async () => ({ sellerTimeoutMinutes: 42 }) })),
  },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: jest.fn(async () => ({
      select: () => ({
        populate: () => ({
          lean: async () => [],
        }),
      }),
    })),
  },
}));

describe("hubOrderOrchestrator dynamic timeout", () => {
  it("uses the configured seller timeout for fallback PRs", async () => {
    const before = Date.now();
    const { fallbackPurchaseRequest } = await import(
      "../app/services/hubOrderOrchestrator.js"
    );

    const newPr = await fallbackPurchaseRequest("pr-1", 60);

    expect(newPr).toBeTruthy();
    const deltaMinutes = Math.round((new Date(newPr.expiresAt).getTime() - before) / 60000);
    expect(deltaMinutes).toBeGreaterThanOrEqual(41);
    expect(deltaMinutes).toBeLessThanOrEqual(43);
  });
});
