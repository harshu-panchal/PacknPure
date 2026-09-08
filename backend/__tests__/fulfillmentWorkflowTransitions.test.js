import { jest } from "@jest/globals";
import { WORKFLOW_STATUS } from "../app/constants/orderWorkflow.js";

jest.unstable_mockModule("../app/services/notificationService.js", () => ({
  createNotification: jest.fn(async () => ({})),
}));

const { transitionOrderFulfillment, getAllowedTransitions } = await import(
  "../app/services/fulfillmentWorkflowEngine.js"
);

const orderAt = (workflowStatus) => ({
  workflowStatus,
  status: "pending",
  fulfillmentEvents: [],
});

const move = (from, to, role = "system") => {
  const order = orderAt(from);
  transitionOrderFulfillment(order, { toState: to, actor: { role } });
  return order;
};

describe("hub orders reach dispatch once their stock is secured", () => {
  // Regression: SELLER_ACCEPTED (the hub's pre-dispatch state) had no inbound edge
  // from any hub state, so markOrderReadyForPacking threw and every order with a
  // stock shortage froze permanently the moment procurement finished.
  it.each([
    WORKFLOW_STATUS.CREATED,
    WORKFLOW_STATUS.INVENTORY_RESERVED,
    WORKFLOW_STATUS.PROCUREMENT_REQUIRED,
    WORKFLOW_STATUS.PROCUREMENT_COMPLETED,
  ])("%s -> SELLER_ACCEPTED is allowed", (from) => {
    const order = move(from, WORKFLOW_STATUS.SELLER_ACCEPTED);
    expect(order.workflowStatus).toBe(WORKFLOW_STATUS.SELLER_ACCEPTED);
    expect(order.status).toBe("confirmed");
  });

  it.each([
    WORKFLOW_STATUS.SELLER_PENDING,
    WORKFLOW_STATUS.SELLER_ACCEPTED,
    WORKFLOW_STATUS.READY_FOR_DELIVERY,
    WORKFLOW_STATUS.PROCUREMENT_COMPLETED,
  ])("%s -> DELIVERY_SEARCH is allowed", (from) => {
    expect(move(from, WORKFLOW_STATUS.DELIVERY_SEARCH).workflowStatus).toBe(
      WORKFLOW_STATUS.DELIVERY_SEARCH,
    );
  });
});

describe("failure states are recoverable rather than dead ends", () => {
  // Regression: these had no key in the transition map, so the lookup fell through
  // to an empty set and the order could not even be cancelled.
  it.each([
    WORKFLOW_STATUS.DELIVERY_FAILED,
    WORKFLOW_STATUS.PICKUP_FAILED,
    WORKFLOW_STATUS.QA_FAILED,
    WORKFLOW_STATUS.SELLER_REJECTED,
    WORKFLOW_STATUS.SELLER_TIMEOUT,
    WORKFLOW_STATUS.PAYMENT_FAILED,
    WORKFLOW_STATUS.PENDING_SELLER_OFFER,
    WORKFLOW_STATUS.NO_SELLER_AVAILABLE,
  ])("%s can always still be cancelled", (from) => {
    expect(getAllowedTransitions(from).length).toBeGreaterThan(0);
    expect(move(from, WORKFLOW_STATUS.ORDER_CANCELLED, "admin").status).toBe(
      "cancelled",
    );
  });

  it("a failed delivery can be re-broadcast to riders", () => {
    expect(
      move(WORKFLOW_STATUS.DELIVERY_FAILED, WORKFLOW_STATUS.DELIVERY_SEARCH)
        .workflowStatus,
    ).toBe(WORKFLOW_STATUS.DELIVERY_SEARCH);
  });
});

describe("who may complete a delivery", () => {
  it.each(["delivery", "admin", "system"])("%s can mark an order delivered", (role) => {
    const order = move(
      WORKFLOW_STATUS.OUT_FOR_DELIVERY,
      WORKFLOW_STATUS.DELIVERED,
      role,
    );
    expect(order.status).toBe("delivered");
  });

  it.each(["seller", "customer", "pickup"])("%s cannot", (role) => {
    expect(() =>
      move(WORKFLOW_STATUS.OUT_FOR_DELIVERY, WORKFLOW_STATUS.DELIVERED, role),
    ).toThrow(/delivery partner or admin/i);
  });
});

describe("terminal states stay terminal", () => {
  it("a delivered order cannot go back out for delivery", () => {
    expect(() =>
      move(WORKFLOW_STATUS.DELIVERED, WORKFLOW_STATUS.OUT_FOR_DELIVERY, "admin"),
    ).toThrow(/Invalid transition/);
  });

  it("a cancelled order cannot be resurrected", () => {
    expect(() =>
      move(WORKFLOW_STATUS.ORDER_CANCELLED, WORKFLOW_STATUS.DELIVERY_SEARCH, "admin"),
    ).toThrow(/Invalid transition/);
  });

  it("only a return may follow delivery", () => {
    expect(getAllowedTransitions(WORKFLOW_STATUS.DELIVERED)).toEqual([
      WORKFLOW_STATUS.RETURN_REQUESTED,
    ]);
  });
});

describe("every reachable state has an entry in the transition map", () => {
  // Guards against the original class of bug: a state added to WORKFLOW_STATUS but
  // never given a row, which silently becomes an unescapable dead end.
  const TERMINAL = new Set([
    WORKFLOW_STATUS.CANCELLED,
    WORKFLOW_STATUS.ORDER_CANCELLED,
  ]);
  const RETURN_DOMAIN = new Set(
    Object.values(WORKFLOW_STATUS).filter((s) => s.startsWith("RETURN_") || s.startsWith("REFUND_")),
  );

  it("no fulfillment state is a dead end except the cancellation terminals", () => {
    const deadEnds = Object.values(WORKFLOW_STATUS).filter(
      (state) =>
        !TERMINAL.has(state) &&
        !RETURN_DOMAIN.has(state) &&
        getAllowedTransitions(state).length === 0,
    );
    expect(deadEnds).toEqual([]);
  });
});
