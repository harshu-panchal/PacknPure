import { jest } from "@jest/globals";

const MASTER_ID = "507f1f77bcf86cd799439021";
const VARIANT_ID = "507f1f77bcf86cd799439022";
const HUB_ID = "MAIN_HUB";

let hubState;

function resetHubState(availableQty) {
  hubState = [
    {
      _id: "hub-row-1",
      hubId: HUB_ID,
      productId: MASTER_ID,
      availableQty,
      reservedQty: 0,
    },
  ];
}

function hubFindChain(rows) {
  return {
    lean: async () => rows,
  };
}

jest.unstable_mockModule("../app/models/hubInventory.js", () => ({
  default: {
    find: jest.fn((query = {}) => {
      const ids = Array.isArray(query?.productId?.$in) ? query.productId.$in.map(String) : null;
      const rows = hubState.filter((row) => {
        if (query?.hubId && String(row.hubId) !== String(query.hubId)) return false;
        if (ids) return ids.includes(String(row.productId));
        if (query?.productId) return String(row.productId) === String(query.productId);
        return true;
      });
      return hubFindChain(rows);
    }),
    findOneAndUpdate: jest.fn(async (filter, update) => {
      const row = hubState.find(
        (item) =>
          String(item.hubId) === String(filter.hubId) &&
          String(item.productId) === String(filter.productId) &&
          (filter.availableQty?.$gte == null || Number(item.availableQty) >= Number(filter.availableQty.$gte)),
      );
      if (!row) return null;
      if (update?.$inc) {
        row.availableQty = Math.max(0, Number(row.availableQty || 0) + Number(update.$inc.availableQty || 0));
        row.reservedQty = Math.max(0, Number(row.reservedQty || 0) + Number(update.$inc.reservedQty || 0));
      }
      return { ...row };
    }),
    findByIdAndUpdate: jest.fn(async (_id, update) => {
      const row = hubState.find((item) => String(item._id) === String(_id));
      if (!row) return null;
      if (update?.$set?.status) row.status = update.$set.status;
      return { ...row };
    }),
  },
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    find: jest.fn((query = {}) => {
      const ids = Array.isArray(query?._id?.$in) ? query._id.$in.map(String) : null;
      const rows = [
        {
          _id: MASTER_ID,
          sellerId: "seller-1",
          name: "Rice",
          categoryId: "cat-1",
          subcategoryId: "sub-1",
          ownerType: "admin",
          stock: 0,
          variants: [{ _id: VARIANT_ID, name: "1 kg", stock: 0, committedStock: 0 }],
        },
      ].filter((row) => {
        if (!ids) return true;
        return ids.includes(String(row._id));
      });
      return {
        select: () => ({
          lean: async () => rows,
        }),
        lean: async () => rows,
      };
    }),
    findById: jest.fn(async (id) => {
      if (String(id) !== MASTER_ID) return null;
      return {
        _id: MASTER_ID,
        variants: [{ _id: VARIANT_ID, name: "1 kg", stock: 0, committedStock: 0 }],
      };
    }),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  },
}));

jest.unstable_mockModule("../app/models/purchaseRequest.js", () => ({
  default: {
    find: jest.fn(async () => []),
  },
}));

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    findOneAndUpdate: jest.fn(async () => null),
    create: jest.fn(async () => null),
  },
}));

describe("hub order lifecycle compliance", () => {
  beforeEach(() => {
    resetHubState(10);
  });

  it("treats full hub stock as reserve-only with no shortage", async () => {
    const { planHubFulfillment, reserveHubInventory } = await import(
      "../app/services/hubOrderOrchestrator.js"
    );

    const plan = await planHubFulfillment(
      [{ product: MASTER_ID, quantity: 6, variantId: VARIANT_ID }],
      HUB_ID,
    );

    expect(plan.fullyAvailable).toBe(true);
    expect(plan.shortages).toHaveLength(0);
    expect(plan.allocations).toEqual([
      {
        productId: MASTER_ID,
        variantId: VARIANT_ID,
        reserveQty: 6,
      },
    ]);

    const reserveResult = await reserveHubInventory(plan.allocations, HUB_ID);
    expect(reserveResult.ok).toBe(true);
    expect(hubState[0].availableQty).toBe(4);
    expect(hubState[0].reservedQty).toBe(6);
  });

  it("treats zero hub stock as full procurement shortage", async () => {
    resetHubState(0);
    const { planHubFulfillment } = await import(
      "../app/services/hubOrderOrchestrator.js"
    );

    const plan = await planHubFulfillment(
      [{ product: MASTER_ID, quantity: 6, variantId: VARIANT_ID }],
      HUB_ID,
    );

    expect(plan.fullyAvailable).toBe(false);
    expect(plan.allocations).toEqual([
      {
        productId: MASTER_ID,
        variantId: VARIANT_ID,
        reserveQty: 0,
      },
    ]);
    expect(plan.shortages).toHaveLength(1);
    expect(plan.shortages[0].shortageQty).toBe(6);
    expect(plan.shortages[0].availableQtyAtHub).toBe(0);
  });

  it("releases hub reservations on cancellation", async () => {
    hubState[0].availableQty = 4;
    hubState[0].reservedQty = 6;

    const { compensateOrderCancellation } = await import(
      "../app/services/orderCompensation.js"
    );

    const order = {
      hubFlowEnabled: true,
      orderId: "ORD-1001",
      _id: "order-1001",
      items: [
        {
          product: MASTER_ID,
          quantity: 6,
          hubReservedQty: 6,
        },
      ],
    };

    await compensateOrderCancellation(order, order.orderId);

    expect(hubState[0].availableQty).toBe(10);
    expect(hubState[0].reservedQty).toBe(0);
  });
});
