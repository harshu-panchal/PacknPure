import { jest } from "@jest/globals";

jest.setTimeout(15000);

const PR_ID = "pr-qa-1";
const PRODUCT_ID = "prod-1";
const SELLER_PRODUCT_ID = "seller-prod-1";
const SELLER_ID = "seller-1";

const prDoc = {
  _id: PR_ID,
  requestId: "PR-QA-1",
  vendorId: SELLER_ID,
  status: "return_delivered",
  items: [
    {
      productId: PRODUCT_ID,
      selectedSellerProductId: SELLER_PRODUCT_ID,
      actualPickedQty: 100,
      rejectedQty: 20,
    },
  ],
  returnDetails: {
    rejectedQty: 20,
  },
  save: jest.fn(async () => undefined),
};

const sellerProduct = {
  _id: SELLER_PRODUCT_ID,
  stock: 40,
  committedStock: 0,
  save: jest.fn(async function save() {
    sellerProduct.stock = this.stock;
    sellerProduct.committedStock = this.committedStock;
  }),
};

const pendingTxn = {
  _id: "txn-1",
  status: "Pending",
  meta: {},
  save: jest.fn(async function save() {
    pendingTxn.status = this.status;
    pendingTxn.meta = { ...this.meta };
  }),
};

jest.unstable_mockModule("../app/models/purchaseRequest.js", () => ({
  default: {
    findById: jest.fn(async () => prDoc),
  },
}));

jest.unstable_mockModule("../app/models/hubInward.js", () => ({
  default: {
    findOne: jest.fn(() => ({
      sort: () => ({
        lean: async () => ({
          receivedItems: [
            {
              acceptedQty: 80,
              purchaseUnitCost: 10,
            },
          ],
        }),
      }),
    })),
  },
}));

jest.unstable_mockModule("../app/models/hubInventory.js", () => ({
  default: {},
}));

jest.unstable_mockModule("../app/models/product.js", () => ({
  default: {
    findOne: jest.fn(() => ({
      select: () => sellerProduct,
    })),
    findById: jest.fn(() => ({
      select: () => ({
        lean: async () => ({
          variants: [{ _id: "variant-1", name: "1 kg" }],
        }),
      }),
    })),
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: {},
}));

jest.unstable_mockModule("../app/models/seller.js", () => ({
  default: {},
}));

jest.unstable_mockModule("../app/models/pickupPartner.js", () => ({
  default: {},
}));

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    findOne: jest.fn(async () => pendingTxn),
    create: jest.fn(async () => undefined),
  },
}));

jest.unstable_mockModule("../app/constants/orderWorkflow.js", () => ({
  WORKFLOW_STATUS: { SELLER_ACCEPTED: "SELLER_ACCEPTED" },
}));

jest.unstable_mockModule("../app/services/orderWorkflowService.js", () => ({
  startHubDeliverySearchAtomic: jest.fn(async () => undefined),
}));

jest.unstable_mockModule("../app/utils/helper.js", () => ({
  default: (res, status, message, result) => ({ status, message, result }),
}));

jest.unstable_mockModule("../app/utils/pagination.js", () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule("../app/utils/purchaseRequestHelpers.js", () => ({
  mapPrItemsDetailed: jest.fn((items) => items),
  summarizePrPricing: jest.fn(() => ({ grandTotal: 0, subtotal: 0, gstTotal: 0 })),
  mapPrKeyDates: jest.fn(() => ({})),
  buildPrTimeline: jest.fn(() => []),
}));

jest.unstable_mockModule("../app/utils/productHelpers.js", () => ({
  resolveVariantIndex: jest.fn(() => 0),
  setVariantStockAtIndex: jest.fn((variants, index, stock) =>
    variants.map((v, i) => ({ ...v, stock: i === index ? stock : v.stock })),
  ),
  totalVariantStock: jest.fn((variants) => variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)),
}));

describe("purchase request return settlement", () => {
  beforeEach(() => {
    sellerProduct.stock = 40;
    sellerProduct.committedStock = 0;
    pendingTxn.status = "Pending";
    pendingTxn.meta = {};
    prDoc.status = "return_delivered";
    prDoc.returnDetails = { rejectedQty: 20 };
    prDoc.items[0].rejectedQty = 20;
    prDoc.items[0].actualPickedQty = 100;
  });

  it("restores only rejected qty and settles the pending supply earning after return confirmation", async () => {
    const controller = await import("../app/controller/purchaseRequestController.js");

    const res = {};
    const req = { params: { id: PR_ID } };

    const result = await controller.confirmVendorReturn(req, res);

    expect(result.status).toBe(200);
    expect(sellerProduct.stock).toBe(60);
    expect(pendingTxn.status).toBe("Settled");
    expect(pendingTxn.meta.rejectedQty).toBe(20);
    expect(pendingTxn.meta.acceptedQty).toBe(80);
  });
});
