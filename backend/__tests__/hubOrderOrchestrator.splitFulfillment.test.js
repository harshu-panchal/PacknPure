import { jest } from "@jest/globals";

const MASTER_ID = "507f1f77bcf86cd799439011";
const VARIANT_ID = "507f1f77bcf86cd799439012";
const SELLER_ID = "507f1f77bcf86cd799439013";
const SELLER_PRODUCT_ID = "507f1f77bcf86cd799439014";
// Must be a castable ObjectId: createAutoPurchaseRequests queries ProcurementSession
// by orderId, and a plain string fails schema casting.
const ORDER_ID = "507f1f77bcf86cd799439016";

const masterProduct = {
  _id: MASTER_ID,
  name: "Rice",
  categoryId: "cat1",
  subcategoryId: "sub1",
  ownerType: "admin",
  sellerId: null,
  purchasePrice: 70,
  price: 101,
  salePrice: 90,
  variants: [
    { _id: VARIANT_ID, name: "1 kg", stock: 100, purchasePrice: 70 },
  ],
};

const sellerListing = {
  _id: SELLER_PRODUCT_ID,
  masterProductId: MASTER_ID,
  name: "Rice",
  ownerType: "seller",
  status: "active",
  sellerId: {
    _id: SELLER_ID,
    rating: 4,
    createdAt: new Date("2024-01-01"),
    location: { coordinates: [77.2, 28.6] },
  },
  purchasePrice: 70,
  variants: [
    { _id: "507f1f77bcf86cd799439015", name: "1 kg", stock: 100, committedStock: 0 },
  ],
};

function mockFindChain(rows) {
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

/** Awaitable single-doc query stub that also supports .select()/.populate()/.lean(). */
function mockDocChain(doc) {
  const chain = Object.assign(Promise.resolve(doc), {
    select: () => chain,
    populate: () => chain,
    lean: async () => doc,
    session: () => chain,
  });
  return chain;
}

const hubRows = [
  {
    hubId: "MAIN_HUB",
    productId: MASTER_ID,
    availableQty: 100,
    reservedQty: 0,
  },
];

jest.unstable_mockModule("../app/models/hubInventory.js", () => ({
  default: {
    find: jest.fn(() => mockFindChain(hubRows)),
  },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: jest.fn((query) => {
      if (query?._id?.$in) {
        return mockFindChain([masterProduct]);
      }
      // rankSellerAllocations selects supplier candidates by `sellerId: { $ne: null }`
      // (it stopped filtering on `ownerType`), so match on that.
      if (query?.sellerId?.$ne === null || query?.ownerType === "seller") {
        return mockFindChain([sellerListing]);
      }
      return mockFindChain([]);
    }),
    // Callers use both `await Product.findById(id)` and
    // `Product.findById(id).select(...).lean()`, so this has to be awaitable *and*
    // chainable.
    findById: jest.fn((id) => {
      let doc = null;
      if (String(id) === SELLER_PRODUCT_ID) {
        doc = {
          _id: SELLER_PRODUCT_ID,
          sellerId: sellerListing.sellerId,
          variants: sellerListing.variants,
        };
      } else if (String(id) === MASTER_ID) {
        doc = masterProduct;
      }
      return mockDocChain(doc);
    }),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  },
}));

const insertedPrs = [];
jest.unstable_mockModule("../app/models/purchaseRequest.js", () => ({
  default: {
    insertMany: jest.fn(async (docs) => {
      insertedPrs.push(...docs);
      return docs.map((d, i) => ({ ...d, _id: `pr-${i}` }));
    }),
    // reserveAllocation checks for an existing PR for this vendor+item before
    // creating one. Nothing pre-exists in this scenario.
    findOne: jest.fn(() => mockDocChain(null)),
    updateOne: jest.fn(async () => ({ modifiedCount: 0 })),
    // PR writes go through purchaseRequestRepository.createPurchaseRequest, which
    // uses `create` — this is the capture point for the generated request.
    create: jest.fn(async (payload) => {
      const rows = Array.isArray(payload) ? payload : [payload];
      const created = rows.map((d, i) => ({ ...d, _id: `pr-${insertedPrs.length + i}` }));
      insertedPrs.push(...created);
      return Array.isArray(payload) ? created : created[0];
    }),
  },
}));

jest.unstable_mockModule("../app/models/setting.js", () => ({
  default: {
    findOne: jest.fn(() => ({ lean: async () => ({ sellerTimeoutMinutes: 15 }) })),
  },
}));

// createAutoPurchaseRequests looks up a prior ProcurementSession (to skip vendors it
// already tried) and then ensures one exists. Unmocked, this hits an unconnected
// mongoose model and hangs. An in-memory stand-in keeps the test hermetic.
const procurementSessions = [];
jest.unstable_mockModule("../app/models/procurementSession.js", () => ({
  default: {
    findOne: jest.fn((query) => {
      const match =
        procurementSessions.find(
          (s) => String(s.orderId) === String(query?.orderId),
        ) || null;
      const result = Object.assign(Promise.resolve(match), {
        lean: async () => match,
      });
      return result;
    }),
    findById: jest.fn((id) =>
      mockDocChain(
        procurementSessions.find((s) => String(s._id) === String(id)) || null,
      ),
    ),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    // Deliberately not stubbing findOneAndUpdate: the seller-inventory commit is a
    // best-effort step the orchestrator already swallows, and it is out of scope for
    // this test (which covers the hub/vendor split and the resulting PR).
    create: jest.fn(async (doc) => {
      // Mirror the schema defaults the service relies on (items/allocations arrays).
      const created = {
        ...doc,
        _id: `psession-${procurementSessions.length}`,
        metadata: doc.metadata || {},
        items: doc.items || [],
        allocations: doc.allocations || [],
        save: async () => created,
      };
      procurementSessions.push(created);
      return created;
    }),
  },
}));

describe("hub split fulfillment (hub 100 + seller 100, order 150)", () => {
  beforeEach(() => {
    insertedPrs.length = 0;
    procurementSessions.length = 0;
  });

  it("reserves 100 from hub and creates PR for remaining 50", async () => {
    const { planHubFulfillment, createAutoPurchaseRequests } = await import(
      "../app/services/hubOrderOrchestrator.js"
    );

    const orderItems = [
      {
        product: MASTER_ID,
        quantity: 150,
        variantId: VARIANT_ID,
      },
    ];

    const plan = await planHubFulfillment(orderItems, "MAIN_HUB");

    expect(plan.fullyAvailable).toBe(false);
    expect(plan.allocations).toEqual([
      {
        productId: MASTER_ID,
        variantId: VARIANT_ID,
        reserveQty: 100,
      },
    ]);
    expect(plan.shortages).toHaveLength(1);
    expect(plan.shortages[0].shortageQty).toBe(50);
    expect(plan.shortages[0].availableQtyAtHub).toBe(100);

    const order = { _id: ORDER_ID, orderId: "ORD-SPLIT-150" };
    const prs = await createAutoPurchaseRequests({
      order,
      shortages: plan.shortages,
      hubId: "MAIN_HUB",
    });

    expect(prs).toHaveLength(1);
    expect(insertedPrs[0].vendorId).toBe(SELLER_ID);
    expect(insertedPrs[0].items[0].shortageQty).toBe(50);
    expect(insertedPrs[0].items[0].variantId).toBe(VARIANT_ID);
    expect(insertedPrs[0].status).toBe("created");
  });
});
