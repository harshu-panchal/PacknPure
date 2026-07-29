import { jest } from "@jest/globals";

const MASTER_ID = "507f1f77bcf86cd799439011";
const SELLER_A = "507f1f77bcf86cd7994390a1";
const SELLER_B = "507f1f77bcf86cd7994390b2";
const SELLER_C = "507f1f77bcf86cd7994390c3";
const PRODUCT_A = "507f1f77bcf86cd7994390aa";
const PRODUCT_B = "507f1f77bcf86cd7994390bb";
const PRODUCT_C = "507f1f77bcf86cd7994390cc";
const ORDER_ID = "507f1f77bcf86cd7994390o1";
const SESSION_ID = "507f1f77bcf86cd7994390s1";
const PR_ID = "507f1f77bcf86cd7994390p1";

const baseProduct = {
  _id: MASTER_ID,
  name: "Rice",
  categoryId: "cat1",
  subcategoryId: "sub1",
  ownerType: "admin",
  sellerId: null,
  purchasePrice: 100,
  price: 120,
  salePrice: 110,
  variants: [],
};

function sellerListing({ id, sellerId, purchasePrice, lat, lng, rating = 4 }) {
  return {
    _id: id,
    masterProductId: MASTER_ID,
    name: "Rice",
    ownerType: "seller",
    status: "active",
    sellerId: {
      _id: sellerId,
      rating,
      createdAt: new Date("2024-01-01"),
      location: { coordinates: [lng, lat] },
    },
    purchasePrice,
    stock: 50,
    committedStock: 0,
    variants: [],
  };
}

const listings = [
  sellerListing({
    id: PRODUCT_A,
    sellerId: SELLER_A,
    purchasePrice: 50,
    lat: 28.7,
    lng: 77.3,
  }),
  sellerListing({
    id: PRODUCT_B,
    sellerId: SELLER_B,
    purchasePrice: 60,
    lat: 28.61,
    lng: 77.21,
  }),
  sellerListing({
    id: PRODUCT_C,
    sellerId: SELLER_C,
    purchasePrice: 80,
    lat: 28.6,
    lng: 77.2,
  }),
];

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

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: jest.fn(() => mockFindChain(listings)),
    findById: jest.fn(async () => null),
  },
}));

describe("rankSellerAllocations excludeVendorIds", () => {
  it("skips excluded sellers and returns next cheapest-then-nearest", async () => {
    const { rankSellerAllocations } = await import("../app/services/allocationEngine.js");

    const all = await rankSellerAllocations({
      baseProduct,
      shortageQty: 10,
      hubLat: 28.6,
      hubLng: 77.2,
    });
    expect(all[0].vendorId).toBe(SELLER_A);
    expect(all.map((a) => a.vendorId)).toEqual([SELLER_A, SELLER_B, SELLER_C]);

    const withoutA = await rankSellerAllocations({
      baseProduct,
      shortageQty: 10,
      hubLat: 28.6,
      hubLng: 77.2,
      excludeVendorIds: [SELLER_A],
    });
    expect(withoutA[0].vendorId).toBe(SELLER_B);
    expect(withoutA.map((a) => a.vendorId)).toEqual([SELLER_B, SELLER_C]);
    expect(withoutA.every((a) => a.vendorId !== SELLER_A)).toBe(true);
  });

  it("returns empty when all ranked sellers are excluded", async () => {
    const { rankSellerAllocations } = await import("../app/services/allocationEngine.js");

    const result = await rankSellerAllocations({
      baseProduct,
      shortageQty: 10,
      hubLat: 28.6,
      hubLng: 77.2,
      excludeVendorIds: [SELLER_A, SELLER_B, SELLER_C],
    });
    expect(result).toEqual([]);
  });

  it("ranks by final supply cost (unit + GST) before distance", async () => {
    const { rankSellerAllocations } = await import("../app/services/allocationEngine.js");
    const Product = (await import("../app/models/product.js")).default;

    const gstListings = [
      {
        _id: PRODUCT_A,
        masterProductId: MASTER_ID,
        name: "Rice",
        ownerType: "seller",
        status: "active",
        sellerId: {
          _id: SELLER_A,
          rating: 4,
          createdAt: new Date("2024-01-01"),
          location: { coordinates: [77.3, 28.7] },
        },
        purchasePrice: 50,
        gstEnabled: true,
        gstRate: 18, // final = 59
        stock: 50,
        committedStock: 0,
        variants: [],
      },
      {
        _id: PRODUCT_B,
        masterProductId: MASTER_ID,
        name: "Rice",
        ownerType: "seller",
        status: "active",
        sellerId: {
          _id: SELLER_B,
          rating: 4,
          createdAt: new Date("2024-01-01"),
          location: { coordinates: [77.21, 28.61] },
        },
        purchasePrice: 55,
        gstEnabled: false,
        gstRate: 0, // final = 55 — cheaper than A after GST
        stock: 50,
        committedStock: 0,
        variants: [],
      },
    ];

    Product.find.mockImplementationOnce(() => ({
      select: () => ({
        populate: () => ({
          lean: async () => gstListings,
        }),
      }),
    }));

    const ranked = await rankSellerAllocations({
      baseProduct,
      shortageQty: 10,
      hubLat: 28.6,
      hubLng: 77.2,
    });
    expect(ranked[0].vendorId).toBe(SELLER_B);
    expect(ranked[0].finalSupplyCost).toBe(55);
    expect(ranked[1].vendorId).toBe(SELLER_A);
    expect(ranked[1].finalSupplyCost).toBe(59);
  });
});

describe("getEligibleFallbackSellers / getAttemptedVendorIds", () => {
  it("excludes already-attempted vendors from the eligible fallback list", async () => {
    const {
      getAttemptedVendorIds,
      getEligibleFallbackSellers,
      buildItemKey,
    } = await import("../app/services/procurementSessionService.js");

    const itemKey = buildItemKey(MASTER_ID, null);
    const session = {
      allocations: [
        {
          itemKey,
          vendorId: SELLER_A,
          retryNumber: 0,
          rankedSellers: [SELLER_B, SELLER_C],
        },
      ],
      metadata: {
        rankedSellerIdsByItem: {
          [itemKey]: [SELLER_A, SELLER_B, SELLER_C],
        },
      },
    };

    const attempted = getAttemptedVendorIds(session, itemKey);
    expect([...attempted]).toEqual([SELLER_A]);

    const eligible = getEligibleFallbackSellers(session, itemKey, {
      rankedSellers: [SELLER_B, SELLER_C],
    });
    expect(eligible).toEqual([SELLER_B, SELLER_C]);
  });

  it("returns empty eligible list when all sellers were attempted", async () => {
    const {
      getEligibleFallbackSellers,
      buildItemKey,
    } = await import("../app/services/procurementSessionService.js");

    const itemKey = buildItemKey(MASTER_ID, null);
    const session = {
      allocations: [
        { itemKey, vendorId: SELLER_A, retryNumber: 0, rankedSellers: [SELLER_B, SELLER_C] },
        { itemKey, vendorId: SELLER_B, retryNumber: 1, rankedSellers: [SELLER_C] },
        { itemKey, vendorId: SELLER_C, retryNumber: 2, rankedSellers: [] },
      ],
      metadata: {
        rankedSellerIdsByItem: {
          [itemKey]: [SELLER_A, SELLER_B, SELLER_C],
        },
      },
    };

    expect(getEligibleFallbackSellers(session, itemKey, null)).toEqual([]);
  });
});

describe("getNextRetryNumber", () => {
  it("counts prior vendor attempts for the item", async () => {
    const { getNextRetryNumber } = await import("../app/services/hubOrderOrchestrator.js");
    const { buildItemKey } = await import("../app/services/procurementSessionService.js");

    const itemKey = buildItemKey(MASTER_ID, null);
    expect(getNextRetryNumber(null, itemKey)).toBe(0);
    expect(getNextRetryNumber({ allocations: [] }, itemKey)).toBe(0);
    expect(
      getNextRetryNumber(
        {
          allocations: [
            { itemKey, vendorId: SELLER_A },
            { itemKey, vendorId: SELLER_B },
            { itemKey: "other", vendorId: SELLER_C },
          ],
        },
        itemKey,
      ),
    ).toBe(2);
  });
});

describe("buildItemKey with populated productId", () => {
  it("does not produce [object Object] keys for populated product docs", async () => {
    const { buildItemKey } = await import("../app/services/procurementSessionService.js");

    const populated = { _id: MASTER_ID, name: "milk" };
    expect(buildItemKey(populated, null)).toBe(`${MASTER_ID}::root`);
    expect(buildItemKey(MASTER_ID, null)).toBe(`${MASTER_ID}::root`);
    expect(buildItemKey(populated, null)).not.toContain("object Object");
  });
});

describe("cascade ranking after seller A attempted", () => {
  it("selects seller B as next PR target when A is excluded", async () => {
    const { rankSellerAllocations } = await import("../app/services/allocationEngine.js");
    const {
      getAttemptedVendorIds,
      buildItemKey,
    } = await import("../app/services/procurementSessionService.js");

    const itemKey = buildItemKey(MASTER_ID, null);
    const session = {
      allocations: [
        {
          itemKey,
          vendorId: SELLER_A,
          retryNumber: 0,
          rankedSellers: [SELLER_B, SELLER_C],
        },
      ],
    };

    const excludeVendorIds = [...getAttemptedVendorIds(session, itemKey)];
    const next = await rankSellerAllocations({
      baseProduct,
      shortageQty: 10,
      hubLat: 28.6,
      hubLng: 77.2,
      excludeVendorIds,
    });

    expect(excludeVendorIds).toEqual([SELLER_A]);
    expect(next[0].vendorId).toBe(SELLER_B);
    expect(next[0].allocatedQty).toBe(10);
  });
});
