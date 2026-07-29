import { jest } from "@jest/globals";

const MASTER_ID = "507f1f77bcf86cd799439011";
const VARIANT_ID = "507f1f77bcf86cd799439012";
const SELLER_ID = "507f1f77bcf86cd799439013";
const SELLER_PRODUCT_ID = "507f1f77bcf86cd799439014";
const ORDER_OID = "507f1f77bcf86cd799439099";
const SESSION_OID = "507f1f77bcf86cd799439088";

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
      if (query?.ownerType === "seller") {
        return mockFindChain([sellerListing]);
      }
      return mockFindChain([]);
    }),
    findById: jest.fn((id) => {
      const sid = String(id);
      let doc = null;
      if (sid === SELLER_PRODUCT_ID) {
        doc = {
          _id: SELLER_PRODUCT_ID,
          sellerId: SELLER_ID,
          stock: 100,
          committedStock: 0,
          variants: sellerListing.variants,
        };
      } else if (sid === MASTER_ID) {
        doc = masterProduct;
      }
      return {
        select: () => ({
          lean: async () => doc,
        }),
        lean: async () => doc,
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
    }),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  },
}));

const insertedPrs = [];
jest.unstable_mockModule("../app/models/purchaseRequest.js", () => ({
  default: {
    create: jest.fn(async (doc) => {
      const saved = { ...doc, _id: `pr-${insertedPrs.length}` };
      insertedPrs.push(saved);
      return saved;
    }),
    insertMany: jest.fn(async (docs) => {
      insertedPrs.push(...docs);
      return docs.map((d, i) => ({ ...d, _id: `pr-${i}` }));
    }),
    findOne: jest.fn(() => ({
      select: () => ({ lean: async () => null }),
      lean: async () => null,
    })),
  },
}));

jest.unstable_mockModule("../app/models/procurementSession.js", () => {
  const sessionState = {
    _id: SESSION_OID,
    orderId: ORDER_OID,
    hubId: "MAIN_HUB",
    status: "open",
    items: [],
    allocations: [],
    metadata: {},
    retryCount: 0,
    save: jest.fn(async function save() {
      return this;
    }),
  };
  return {
    default: {
      findOne: jest.fn(async () => null),
      create: jest.fn(async (doc) => {
        Object.assign(sessionState, doc);
        sessionState.items = [];
        sessionState.allocations = [];
        sessionState.metadata = doc.metadata || {};
        return sessionState;
      }),
      findById: jest.fn(() => {
        const result = Promise.resolve(sessionState);
        result.lean = async () => sessionState;
        return result;
      }),
      findOneAndUpdate: jest.fn(async (_filter, update) => {
        // Simulate atomic reservation claim used by tryClaimAllocationReservation.
        if (update?.$set) {
          Object.assign(sessionState, update.$set);
          const allocMatch = update.$set["allocations.$.reservationState"];
          if (allocMatch) {
            const alloc = sessionState.allocations?.[0];
            if (alloc) {
              alloc.reservationState = update.$set["allocations.$.reservationState"];
              alloc.reservedQty = update.$set["allocations.$.reservedQty"] ?? alloc.reservedQty;
            }
          }
        }
        return sessionState;
      }),
      findByIdAndUpdate: jest.fn(async () => sessionState),
    },
  };
});

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

jest.unstable_mockModule("../app/services/inventory/inventoryEngine.js", () => ({
  freezeSellerInventory: jest.fn(async () => ({ ok: true })),
  releaseSellerInventory: jest.fn(async () => ({ ok: true })),
}));

describe("hub split fulfillment (hub 100 + seller 100, order 150)", () => {
  beforeEach(() => {
    insertedPrs.length = 0;
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

    const order = { _id: ORDER_OID, orderId: "ORD-SPLIT-150" };
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
