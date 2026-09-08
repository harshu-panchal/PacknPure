import { jest } from "@jest/globals";

/**
 * Regression tests for refund-on-cancellation.
 *
 * Cancelling a prepaid order used to release stock and fail the seller transaction
 * but never return the customer's money — so an online/wallet order auto-cancelled
 * because no rider was found simply lost the payment.
 */

const mockUserFindById = jest.fn();
const mockTransactionFindOne = jest.fn();
const mockTransactionCreate = jest.fn(async (doc) => doc);
const mockOrderUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));
const mockCreateNotification = jest.fn(async () => ({}));

jest.unstable_mockModule("../app/models/customer.js", () => ({
  default: { findById: mockUserFindById },
}));

jest.unstable_mockModule("../app/models/transaction.js", () => ({
  default: {
    findOne: mockTransactionFindOne,
    create: mockTransactionCreate,
    findOneAndUpdate: jest.fn(async () => ({})),
  },
}));

jest.unstable_mockModule("../app/models/order.js", () => ({
  default: { updateOne: mockOrderUpdateOne },
}));

jest.unstable_mockModule("../app/models/stockHistory.js", () => ({
  default: { create: jest.fn(async () => ({})) },
}));

jest.unstable_mockModule("../app/services/transactionEngine.js", () => ({
  executeRollbackEvent: jest.fn(async () => []),
}));

jest.unstable_mockModule("../app/services/notificationService.js", () => ({
  createNotification: mockCreateNotification,
  createNotificationBatch: jest.fn(async () => []),
}));

const { refundCancelledOrder, compensateOrderCancellation } = await import(
  "../app/services/orderCompensation.js"
);

function makeCustomer(balance = 0) {
  const customer = {
    _id: "customer-1",
    walletBalance: balance,
    save: jest.fn(async () => customer),
  };
  return customer;
}

function makeOrder(overrides = {}) {
  return {
    _id: "order-mongo-1",
    orderId: "ORD-REFUND-1",
    customer: "customer-1",
    items: [],
    cancelReason: "No delivery partner (timeout)",
    pricing: { total: 450 },
    payment: { method: "online", status: "completed", paidAmount: 450 },
    ...overrides,
  };
}

describe("refundCancelledOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionFindOne.mockReturnValue({ lean: async () => null });
  });

  it("credits the wallet when a prepaid online order is cancelled", async () => {
    const customer = makeCustomer(100);
    mockUserFindById.mockResolvedValue(customer);

    const amount = await refundCancelledOrder(makeOrder(), "ORD-REFUND-1");

    expect(amount).toBe(450);
    expect(customer.walletBalance).toBe(550);
    expect(customer.save).toHaveBeenCalled();
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Refund",
        amount: 450,
        status: "Settled",
        reference: "REFUND-ORD-REFUND-1",
      }),
    );
    expect(mockOrderUpdateOne).toHaveBeenCalledWith(
      { _id: "order-mongo-1" },
      { $set: { "payment.status": "refunded" } },
    );
    expect(mockCreateNotification).toHaveBeenCalled();
  });

  it("refunds wallet-paid orders too", async () => {
    const customer = makeCustomer(0);
    mockUserFindById.mockResolvedValue(customer);

    const amount = await refundCancelledOrder(
      makeOrder({
        payment: { method: "wallet", status: "completed", paidAmount: 220 },
      }),
      "ORD-REFUND-1",
    );

    expect(amount).toBe(220);
    expect(customer.walletBalance).toBe(220);
  });

  it("falls back to the order total when paidAmount is missing", async () => {
    const customer = makeCustomer(0);
    mockUserFindById.mockResolvedValue(customer);

    const amount = await refundCancelledOrder(
      makeOrder({
        pricing: { total: 310 },
        payment: { method: "upi", status: "completed" },
      }),
      "ORD-REFUND-1",
    );

    expect(amount).toBe(310);
  });

  it("does not refund a COD order — no money changed hands", async () => {
    const customer = makeCustomer(0);
    mockUserFindById.mockResolvedValue(customer);

    const amount = await refundCancelledOrder(
      makeOrder({ payment: { method: "cash", status: "completed", paidAmount: 450 } }),
      "ORD-REFUND-1",
    );

    expect(amount).toBeNull();
    expect(mockTransactionCreate).not.toHaveBeenCalled();
    expect(customer.walletBalance).toBe(0);
  });

  it("does not refund when payment never completed", async () => {
    mockUserFindById.mockResolvedValue(makeCustomer(0));

    const amount = await refundCancelledOrder(
      makeOrder({ payment: { method: "online", status: "pending", paidAmount: 0 } }),
      "ORD-REFUND-1",
    );

    expect(amount).toBeNull();
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });

  it("is idempotent — a second cancellation does not pay out twice", async () => {
    const customer = makeCustomer(100);
    mockUserFindById.mockResolvedValue(customer);
    mockTransactionFindOne.mockReturnValue({
      lean: async () => ({ reference: "REFUND-ORD-REFUND-1" }),
    });

    const amount = await refundCancelledOrder(makeOrder(), "ORD-REFUND-1");

    expect(amount).toBeNull();
    expect(customer.walletBalance).toBe(100);
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });
});

describe("compensateOrderCancellation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionFindOne.mockReturnValue({ lean: async () => null });
  });

  it("refunds as part of the standard cancellation compensation", async () => {
    const customer = makeCustomer(0);
    mockUserFindById.mockResolvedValue(customer);

    await compensateOrderCancellation(makeOrder(), "ORD-REFUND-1");

    expect(customer.walletBalance).toBe(450);
  });

  it("still completes the cancellation when the refund throws", async () => {
    mockUserFindById.mockRejectedValue(new Error("db down"));

    await expect(
      compensateOrderCancellation(makeOrder(), "ORD-REFUND-1"),
    ).resolves.toBeUndefined();
  });
});
