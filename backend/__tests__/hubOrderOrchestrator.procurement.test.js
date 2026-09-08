import { jest } from "@jest/globals";

function mockMongooseFind(rows = []) {
  // rankSellerAllocations chains .select().populate().lean(), so every link has to
  // return the chain rather than only supporting select→lean.
  const chain = {
    select: () => chain,
    populate: () => chain,
    session: () => chain,
    lean: async () => rows,
  };
  return chain;
}

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: jest.fn(() => mockMongooseFind([])),
  },
}));

jest.unstable_mockModule("../app/models/purchaseRequest.js", () => ({
  default: {
    insertMany: jest.fn(async () => []),
  },
}));

jest.unstable_mockModule("../app/models/hubInventory.js", () => ({
  default: {},
}));

// settingsService reads this before choosing vendors; unmocked it blocks on a
// database connection that does not exist in unit tests.
jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: jest.fn(() => ({ lean: async () => ({ sellerTimeoutMinutes: 15 }) })),
  },
}));

// createAutoPurchaseRequests looks up any prior ProcurementSession before deciding
// vendors. Unmocked, that query reaches an unconnected mongoose model and hangs
// before the "out of stock" guard under test is ever reached.
jest.unstable_mockModule("../app/models/procurementSession.js", () => ({
  default: {
    findOne: jest.fn(() =>
      Object.assign(Promise.resolve(null), { lean: async () => null }),
    ),
  },
}));

describe("hubOrderOrchestrator procurement", () => {
  it("throws when shortages cannot be assigned to any vendor", async () => {
    const { createAutoPurchaseRequests } = await import(
      "../app/services/hubOrderOrchestrator.js"
    );

    // Must be a castable ObjectId — the ProcurementSession lookup casts orderId.
    const order = { _id: "507f1f77bcf86cd799439016", orderId: "ORD-1" };
    const shortages = [
      {
        productId: "507f1f77bcf86cd799439011",
        requiredQty: 2,
        availableQtyAtHub: 0,
        shortageQty: 2,
        vendorId: null,
        baseProduct: { name: "Test Product", sku: "SKU-TEST", price: 10 },
      },
    ];

    await expect(
      createAutoPurchaseRequests({ order, shortages, hubId: "MAIN_HUB" }),
    ).rejects.toThrow(/out of stock/i);
  });
});
