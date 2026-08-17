import mongoose from "mongoose";
import Transaction from "../models/transaction.js";

/**
 * Financial side effects when order becomes delivered (mirrors orderController).
 *
 * Idempotent + atomic: the presence of the "Order Sale" transaction is the
 * anchor that marks this order as already settled, checked before any writes
 * happen. All transactions for a single order are created inside one Mongo
 * transaction, so a crash mid-way can never leave partial settlement (e.g.
 * delivery earning credited but cash collection missing).
 */
export async function applyDeliveredSettlement(order, orderIdString) {
  const anchorRef = `ADM-SALE-${orderIdString}`;
  const alreadySettled = await Transaction.exists({ reference: anchorRef });
  if (alreadySettled) {
    console.log(`[Settlement] Order ${orderIdString} already settled — skipping (idempotent).`);
    return;
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // In Hub-First flow, customer payments belong to the Admin/Hub.
    // Sellers are paid separately through Purchase Request settlements.
    console.log(`[Settlement] Order ${orderIdString} delivered. Product amount belongs to Hub Admin.`);

    await Transaction.create(
      [
        {
          user: null, // Admin/Platform
          userModel: "Admin",
          order: order._id,
          type: "Order Sale",
          amount: (order.pricing?.total || 0) - (order.pricing?.deliveryFee || 0),
          status: "Settled",
          reference: anchorRef,
        },
      ],
      { session },
    );

    // 2. Seller Earnings (Supply Cost)
    const supplyCost = order.items.reduce((acc, item) => {
      return acc + (item.purchasePrice || item.price) * item.quantity;
    }, 0);

    if (order.seller) {
      await Transaction.create(
        [
          {
            user: order.seller,
            userModel: "Seller",
            order: order._id,
            type: "Supply Earning",
            amount: supplyCost,
            status: "Settled",
            reference: `SUP-ERN-${orderIdString}`,
          },
        ],
        { session },
      );
    }

    // 3. Delivery Partner Earnings & Cash Collection
    if (order.deliveryBoy) {
      const deliveryEarning = Math.max(order.pricing?.deliveryFee || 0, 25); // Min payout ₹25 even if free delivery
      await Transaction.create(
        [
          {
            user: order.deliveryBoy,
            userModel: "Delivery",
            order: order._id,
            type: "Delivery Earning",
            amount: deliveryEarning,
            status: "Settled",
            reference: `DEL-ERN-${orderIdString}`,
          },
        ],
        { session },
      );

      const method = (order.payment?.method || "").toLowerCase();
      if (method === "cash" || method === "cod") {
        await Transaction.create(
          [
            {
              user: order.deliveryBoy,
              userModel: "Delivery",
              order: order._id,
              type: "Cash Collection",
              amount: order.pricing.total,
              status: "Settled",
              reference: `CASH-COL-${orderIdString}`,
            },
          ],
          { session },
        );
      }
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    // Duplicate-key race (two concurrent calls both passed the pre-check) means
    // another call already settled this order — safe to treat as success.
    if (err?.code === 11000) {
      console.log(`[Settlement] Order ${orderIdString} settled concurrently — skipping.`);
      return;
    }
    throw err;
  } finally {
    session.endSession();
  }
}
