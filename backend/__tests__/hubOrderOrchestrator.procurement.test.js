import { jest } from "@jest/globals";

function mockMongooseFind(rows = []) {
  return {
    select: () => ({
      populate: () => ({
        lean: async () => rows,
      }),
      lean: async () => rows,
    }),
    populate: () => ({
      lean: async () => rows,
    }),
    lean: async () => rows,
  };
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

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: jest.fn(() => ({
      lean: async () => ({
        sellerResponseTimeout: 15,
        enableMultiSellerAllocation: false,
      }),
    })),
  },
}));

jest.unstable_mockModule("../app/models/procurementSession.js", () => ({
  default: {
    findOne: jest.fn(async () => null),
    create: jest.fn(async (doc) => ({
      _id: "507f1f77bcf86cd799439088",
      ...doc,
      items: [],
      allocations: [],
      metadata: {},
      save: jest.fn(async function save() {
        return this;
      }),
    })),
    findById: jest.fn(async () => null),
  },
}));

describe("hubOrderOrchestrator procurement", () => {
  it("throws when shortages cannot be assigned to any vendor", async () => {
    const { createAutoPurchaseRequests } = await import(
      "../app/services/hubOrderOrchestrator.js"
    );

    const order = { _id: "507f1f77bcf86cd799439001", orderId: "ORD-1" };
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
