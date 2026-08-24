import mongoose from "mongoose";
import Order from "../models/order.js";
import Cart from "../models/cart.js";
import Product from "../models/product.js";
import Transaction from "../models/transaction.js";
import Admin from "../models/admin.js";
import PurchaseRequest from "../models/purchaseRequest.js";
import { createNotification, createNotificationBatch } from "./notificationService.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { startHubDeliverySearchAtomic } from "./orderWorkflowService.js";
import {
  planHubFulfillment,
  reserveHubInventory,
  createAutoPurchaseRequests,
  notifyAndEmitPurchaseRequests,
} from "./purchaseRequestService.js";
import { getSlaDeadline } from "./settingsService.js";
import {
  markOrderInventoryReserved,
  markOrderProcurementRequiredHub,
  markOrderProcurementRequired,
  setOrderLegacyStatus,
} from "./workflowFacade.js";
import ProcurementSession from "../models/procurementSession.js";
import { ensureProcurementSession } from "./procurementSessionService.js";
import { executeRollbackEvent } from "./transactionEngine.js";
import { emitToAdminOrdersRoom, emitToSeller } from "./orderSocketEmitter.js";
import User from "../models/customer.js";
import DeliverySettings from "../models/deliverySettings.js";
import { calculateDeliveryFee, applyExpressDeliveryCharge } from "../utils/deliveryFeeUtil.js";
import { 
  findOrderVariant, 
  formatOrderVariantSlot, 
  resolveOrderItemPrice 
} from "../utils/orderItemHelpers.js";
import { buildDeliverySnapshot } from "./deliverySnapshotService.js";
import { generateOrderNumber } from "./orderNumberService.js";

const ORDER_CART_POPULATE = "name mainImage price salePrice gstRate gstEnabled variants purchasePrice";

/**
 * Reusable Core Order Fulfillment Service
 * Handles unified business logic for order creation across all payment gateways (COD, Wallet, Razorpay).
 */
export const executeCoreOrderFulfillment = async ({
  customerId,
  customer,
  items,
  address,
  payment,
  pricing,
  timeSlot,
  // Delivery Mode feature (optional, additive): "EXPRESS" | "SLOT" + slot details
  deliveryMode,
  selectedSlot,
  selectedDate,
  // Optional pre-built snapshot (e.g. frozen on PaymentIntent at create time)
  deliverySnapshot: existingDeliverySnapshot = null,
  promotionId,
  session = null
}) => {
    // Validate slot expiration if deliveryMode is SLOT
    if (deliveryMode === "SLOT") {
      if (!selectedDate || !selectedSlot) {
        throw new Error("Please select a date and slot for scheduled delivery");
      }
      
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const slotRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
      if (!dateRegex.test(selectedDate) || !slotRegex.test(selectedSlot)) {
        throw new Error("Select appropriate slot");
      }

      const [year, month, day] = selectedDate.split("-").map(Number);
      const [startTimeStr] = selectedSlot.split("-");
      const [startHour, startMin] = startTimeStr.split(":").map(Number);

      const now = new Date();
      const slotStart = new Date(year, month - 1, day, startHour, startMin, 0, 0);

      if (now.getTime() > slotStart.getTime()) {
        throw new Error("The selected slot has already expired. Please select a valid slot.");
      }
    }

    // 1. Generate unique Order ID
    const orderId = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Short, sequential, source-prefixed display number (e.g. HUBORD0001).
    // Every order created through this core fulfillment path (COD + online
    // payment checkout) is a "hub" order for numbering purposes.
    const { displayOrderNumber, sequenceNumber, orderNumberSource } =
      await generateOrderNumber("hub", session);

    // 2. Map items if provided, or fetch from cart if not
    let orderItems = items;
    if (!orderItems || orderItems.length === 0) {
      let query = Cart.findOne({ customerId }).populate("items.productId", ORDER_CART_POPULATE);
      if (session) query = query.session(session);
      const cart = await query;
      
      if (!cart || cart.items.length === 0) {
        throw new Error("Cannot place order with empty cart");
      }
      orderItems = cart.items.map((item) => {
        const product = item.productId || item.product;
        const variant = item.variantId ? findOrderVariant(product, item.variantId) : null;
        return {
          product: product._id,
          name: product.name,
          quantity: item.quantity,
          price: resolveOrderItemPrice(product, variant),
          purchasePrice: variant?.purchasePrice || product.purchasePrice || 0,
          image: product.mainImage,
          variantId: item.variantId || undefined,
          variantSlot: formatOrderVariantSlot(variant, product),
        };
      });
    }

    // 3. Normalize address.location and address.type
    let normalizedAddress = { ...address };
    if (address?.location) {
      const { lat, lng } = address.location;
      if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        normalizedAddress.location = undefined;
      }
    }
    if (normalizedAddress.type) {
      const typeStr = String(normalizedAddress.type).trim().toLowerCase();
      if (typeStr === "home") {
        normalizedAddress.type = "Home";
      } else if (typeStr === "work") {
        normalizedAddress.type = "Work";
      } else {
        normalizedAddress.type = "Other";
      }
    } else {
      normalizedAddress.type = "Home";
    }

    // 4. Resolve raw items against database
    if (Array.isArray(orderItems) && orderItems.length > 0) {
      // 4a. Resolve each item's product id, running any needed fallback
      // (sku/slug/name) lookups in parallel instead of one-at-a-time.
      const resolvedIds = await Promise.all(
        orderItems.map(async (item) => {
          let candidate = item?.product?._id || item?.productId?._id || item?.product || item?.productId || item?._id || item?.id;
          if (candidate && typeof candidate === "object" && candidate._id) candidate = candidate._id;
          let resolvedProductId = candidate && mongoose.Types.ObjectId.isValid(String(candidate)) ? String(candidate) : null;

          if (!resolvedProductId) {
            const fallbackQuery = [];
            if (item?.sku && typeof item.sku === "string") fallbackQuery.push({ sku: item.sku.trim() });
            if (item?.slug && typeof item.slug === "string") fallbackQuery.push({ slug: item.slug.trim().toLowerCase() });
            if (item?.name && typeof item.name === "string") fallbackQuery.push({ name: item.name.trim() });

            if (fallbackQuery.length) {
              let pQuery = Product.findOne({ $or: fallbackQuery }).select("_id").lean();
              if (session) pQuery = pQuery.session(session);
              const found = await pQuery;
              if (found?._id) resolvedProductId = String(found._id);
            }
          }

          if (!resolvedProductId) {
            throw new Error(`Invalid product reference in checkout item: ${item?.name || "Unknown item"}`);
          }
          return resolvedProductId;
        })
      );

      // 4b. Batch-fetch all products in a single query instead of one
      // findById per cart line.
      const uniqueIds = [...new Set(resolvedIds)];
      let productsQuery = Product.find({ _id: { $in: uniqueIds } })
        .select("_id purchasePrice salePrice price gstRate gstEnabled variants unit mainImage name")
        .lean();
      if (session) productsQuery = productsQuery.session(session);
      const products = await productsQuery;
      const productsById = new Map(products.map((p) => [String(p._id), p]));

      const normalizedItems = orderItems.map((item, idx) => {
        const resolvedProductId = resolvedIds[idx];
        const productData = productsById.get(resolvedProductId);

        if (!productData) {
          throw new Error(`Product not found: ${item?.name || resolvedProductId}`);
        }

        const variantId = item.variantId || null;
        const variant = variantId ? findOrderVariant(productData, variantId) : null;

        return {
          ...item,
          product: String(productData._id),
          name: item.name || productData.name,
          purchasePrice: variant?.purchasePrice || productData.purchasePrice || 0,
          price: resolveOrderItemPrice(productData, variant, item.price),
          gstRate: (variant?.gstEnabled !== undefined ? variant.gstEnabled : productData.gstEnabled) ? (variant?.gstRate || productData.gstRate || 0) : 0,
          gstEnabled: variant?.gstEnabled !== undefined ? variant.gstEnabled : (productData.gstEnabled || false),
          image: item.image || productData.mainImage,
          variantId: variantId || undefined,
          variantSlot: item.variantSlot || formatOrderVariantSlot(variant, productData),
        };
      });
      orderItems = normalizedItems;
    }

    const slaDeadlineAt = await getSlaDeadline();

    // 5. Pricing and GST calculation
    let validatedPricing = { ...pricing };
    if (normalizedAddress?.location) {
      const calc = await calculateDeliveryFee(normalizedAddress.location);
      if (calc.isOutOfRange) {
        throw new Error(`Address is outside our delivery range (${calc.maxServiceRadius}km)`);
      }

      validatedPricing.deliveryFee = calc.deliveryFee;
      validatedPricing.distanceKm = calc.distanceKm;
      validatedPricing.platformFee = calc.platformFee;
      
      if ((validatedPricing.subtotal || 0) >= calc.freeDeliveryThreshold) {
        validatedPricing.deliveryFee = 0;
      }

      if (deliveryMode === "EXPRESS") {
        const delSettings = await DeliverySettings.getSingleton();
        // Express charge always applies; delivery fee is only waived when the
        // customer is within the admin-configured free-delivery distance.
        applyExpressDeliveryCharge(validatedPricing, deliveryMode, delSettings);
      } else {
        validatedPricing.expressCharge = 0;
      }

      let totalItemGst = 0;
      let trueSubtotal = 0;
      
      orderItems = orderItems.map(item => {
        const itemSellingTotal = (item.price || 0) * (item.quantity || 0);
        const rate = Number(item.gstRate || 0);
        
        let itemGstAmount = 0;
        let itemBasePrice = itemSellingTotal;

        if (item.gstEnabled && rate > 0) {
           itemBasePrice = itemSellingTotal / (1 + (rate / 100));
           itemGstAmount = itemSellingTotal - itemBasePrice;
        }

        totalItemGst += itemGstAmount;
        trueSubtotal += itemBasePrice;

        const baseCost = item.purchasePrice || 0;
        const costTotal = baseCost * (item.quantity || 0);
        const vendorGstAmount = item.gstEnabled ? Number((costTotal * (rate / 100)).toFixed(2)) : 0;
        const finalCost = Number((costTotal + vendorGstAmount).toFixed(2));
        const profit = Number((itemSellingTotal - finalCost).toFixed(2));

        return { 
          ...item, 
          baseCost,
          gstEnabled: Boolean(item.gstEnabled),
          gstRate: rate, 
          gstAmount: Number(itemGstAmount.toFixed(2)),
          finalCost,
          profit
        };
      });

      const serviceGst = 0;
      validatedPricing.subtotal = Number(trueSubtotal.toFixed(2));
      validatedPricing.gst = Number((totalItemGst + serviceGst).toFixed(2));
      validatedPricing.total = Number((validatedPricing.subtotal 
        + validatedPricing.gst
        - (validatedPricing.discount || 0)
        + validatedPricing.deliveryFee 
        + (validatedPricing.expressCharge || 0)
        + validatedPricing.platformFee
        + (validatedPricing.tip || 0)).toFixed(2));
    }

    // 6. Hub Fulfillment Planning
    const hubPlan = await planHubFulfillment(orderItems);
    console.info(`[HUB_DEBUG] orderId=${orderId} paymentMethod=${payment?.method} fullyAvailable=${hubPlan.fullyAvailable} shortages=${hubPlan.shortages.length} shortageVendors=${JSON.stringify(hubPlan.shortages.map(s => s.vendorId))}`);

    const itemAllocations = new Map();
    for (const alloc of hubPlan.allocations) {
       itemAllocations.set(alloc.productId + (alloc.variantId || ""), alloc.reserveQty);
    }
    const itemShortages = new Map();
    for (const short of hubPlan.shortages) {
       itemShortages.set(short.productId + (short.variantId || ""), short.shortageQty);
    }

    orderItems = orderItems.map(item => {
       const key = String(item.product) + (item.variantId ? String(item.variantId) : "");
       return {
         ...item,
         hubReservedQty: itemAllocations.get(key) || 0,
         vendorProcuredQty: itemShortages.get(key) || 0
       };
    });

    // 7. Delivery Mode snapshot — frozen at order creation (never rewrite later)
    const resolvedMode = deliveryMode === "SLOT" ? "SLOT" : "EXPRESS";
    const deliverySnapshot =
      existingDeliverySnapshot && existingDeliverySnapshot.deliveryMode
        ? existingDeliverySnapshot
        : await buildDeliverySnapshot({
            deliveryMode: resolvedMode,
            selectedSlot: resolvedMode === "SLOT" ? (selectedSlot || null) : null,
            selectedDate: resolvedMode === "SLOT" ? (selectedDate || null) : null,
            deliveryCharges: validatedPricing?.deliveryFee ?? pricing?.deliveryFee ?? 0,
          });

    // 8. Create Order Document
    const newOrder = new Order({
      orderId,
      displayOrderNumber,
      orderSequenceNumber: sequenceNumber,
      orderNumberSource,
      customer: customerId,
      seller: null,
      items: orderItems,
      address: normalizedAddress,
      payment,
      pricing: validatedPricing,
      timeSlot: timeSlot || "now",
      // Delivery Mode feature: default EXPRESS keeps legacy behavior unchanged
      deliveryMode: resolvedMode,
      selectedSlot: resolvedMode === "SLOT" ? (selectedSlot || null) : null,
      selectedDate: resolvedMode === "SLOT" ? (selectedDate || null) : null,
      deliverySnapshot,
      status: "pending",
      workflowVersion: 2,
      workflowStatus: WORKFLOW_STATUS.CREATED,
      supplyChainStatus: hubPlan.fullyAvailable ? "READY_FOR_DELIVERY" : "WAITING_VENDOR",
      hubFlowEnabled: true,
      hubId: hubPlan.hubId,
      procurementRequired: !hubPlan.fullyAvailable,
      slaDeadlineAt,
      promotionApplied: promotionId || null,
    });
    if (hubPlan.fullyAvailable) {
      markOrderInventoryReserved(newOrder);
    } else {
      markOrderProcurementRequiredHub(newOrder);
    }
    await newOrder.save({ session });
    const procurementSession = await ensureProcurementSession({
      order: newOrder,
      shortages: hubPlan.shortages,
      hubId: hubPlan.hubId,
    });
    if (procurementSession?._id) {
      newOrder.procurementSessionId = procurementSession._id;
      await newOrder.save({ session });
    }

    if (promotionId) {
      const PromotionModel = mongoose.model("Promotion");
      await PromotionModel.findByIdAndUpdate(promotionId, { $inc: { usedCount: 1 } }, { session });
    }

    // 8. Inventory Reservation
    const reserveResult = await reserveHubInventory(hubPlan.allocations, hubPlan.hubId, newOrder._id);
    if (!reserveResult.ok) {
      if (session) await session.abortTransaction(); // Ensure rollback if in trans
      throw new Error("Stock unavailable: inventory was updated by another request. Please refresh and try again.");
    }

    // 9. Auto Purchase Requests
    let purchaseRequests = [];
    try {
      purchaseRequests = hubPlan.shortages.length
        ? await createAutoPurchaseRequests({
            order: newOrder,
            shortages: hubPlan.shortages,
            hubId: hubPlan.hubId,
          })
        : [];
    } catch (procurementErr) {
      await executeRollbackEvent({
        eventType: "SYSTEM_COMPENSATION",
        transactionId: `procurement_create_failed:${String(newOrder._id)}`,
        orderId: newOrder._id,
        reason: "procurement_creation_failed_after_reserve",
        actor: { type: "system" },
      });
      if (session) await session.abortTransaction();
      throw new Error(procurementErr.message || "Unable to procure items for this order.");
    }

    console.info(`[HUB_DEBUG] orderId=${orderId} paymentMethod=${payment?.method} purchaseRequestsCreated=${purchaseRequests.length} prVendorIds=${JSON.stringify(purchaseRequests.map(pr => pr?.vendorId?.toString?.() || pr?.vendorId || null))}`);
    if (purchaseRequests.length > 0) {
      const sessionIdFromPr = purchaseRequests.find((pr) => pr?.procurementSessionId)?.procurementSessionId || null;
      if (sessionIdFromPr) {
        newOrder.procurementSessionId = sessionIdFromPr;
      }
      await notifyAndEmitPurchaseRequests(purchaseRequests, orderId);
      console.info(`[HUB_DEBUG] orderId=${orderId} notifyAndEmitPurchaseRequests completed`);
    }

    if (hubPlan.shortages.length > 0) {
      markOrderProcurementRequiredHub(newOrder);
      // hubStatus above only drives internal hub dashboards — workflowStatus
      // (and the legacy `status` it stays synced to) is what the customer
      // and admin actually see, so it must also leave CREATED here or this
      // order shows "Pending" forever no matter how far the linked
      // PurchaseRequest progresses.
      if (newOrder.workflowVersion >= 2) {
        try {
          markOrderProcurementRequired(newOrder, { actor: { role: "system" } });
        } catch (err) {
          console.warn("[createOrder] workflow transition to PROCUREMENT_REQUIRED failed:", err.message);
        }
      }
    } else {
      markOrderInventoryReserved(newOrder);
    }
    newOrder.procurementRequired = hubPlan.shortages.length > 0;
    if (!newOrder.procurementSessionId && hubPlan.shortages.length > 0) {
      const existingSession = await ProcurementSession.findOne({ orderId: newOrder._id }).select("_id").lean();
      if (existingSession?._id) newOrder.procurementSessionId = existingSession._id;
    }

    // EXPRESS + 100% hub stock: confirm immediately after reserve.
    // Rider stays unassigned; SLOT / procurement / mixed orders unchanged.
    const hubFullyFulfilled =
      hubPlan.shortages.length === 0 &&
      purchaseRequests.length === 0 &&
      !newOrder.procurementRequired;
    const procurementSessionIdle =
      !procurementSession ||
      !Array.isArray(procurementSession.items) ||
      procurementSession.items.length === 0 ||
      !procurementSession.items.some((i) => Number(i.requiredQty || 0) > 0);
    if (
      (resolvedMode === "EXPRESS" || resolvedMode === "SLOT") &&
      hubFullyFulfilled &&
      procurementSessionIdle &&
      String(newOrder.status || "").toLowerCase() === "pending"
    ) {
      setOrderLegacyStatus(newOrder, "confirmed", {
        actor: { role: "system" },
        reason: "hub_stock_auto_confirm",
      });
    }

    await newOrder.save({ session });

    await createNotification({
      recipient: customerId,
      recipientModel: "Customer",
      title: "Order Placed",
      message: `Your order #${orderId} has been placed successfully.`,
      type: "order",
      data: { orderId, mongoOrderId: newOrder._id },
    });

    // 10. Wallet Deductions
    const walletUsed = payment.walletUsed || (payment.method === "wallet" ? Number(validatedPricing?.total || pricing?.total || 0) : 0);
    
    if (walletUsed > 0) {
      customer.walletBalance = Math.max(0, Number(customer.walletBalance || 0) - walletUsed);
      await customer.save({ session });
      
      const tx = new Transaction({
        user: customer._id,
        userModel: "User",
        order: newOrder._id,
        type: "Order Payment",
        amount: -Math.abs(walletUsed),
        status: "Settled",
        reference: payment.transactionId || `WALLET-DEBIT-${orderId}`,
        meta: { gateway: payment.gateway || "wallet", orderId: newOrder.orderId },
      });
      await tx.save({ session });
    }

    // 11. Hub Meta and Dispatch Response
    const hubMeta = {
      mode: "hub_first",
      hubStatus: newOrder.hubStatus,
      purchaseRequestsCreated: purchaseRequests.length,
      unassignedProcurementItems: hubPlan.shortages.filter((s) => !s.vendorId).length,
    };

    let orderForResponse = newOrder;
    // EXPRESS + hub stock: start rider search so online delivery partners receive the task.
    // SLOT / procurement orders stay unchanged (admin assigns later / after procurement).
    const shouldStartDeliverySearch =
      resolvedMode === "EXPRESS" &&
      hubPlan.shortages.length === 0 &&
      purchaseRequests.length === 0 &&
      !newOrder.procurementRequired;
    console.info(`[HUB_DEBUG] orderId=${orderId} paymentMethod=${payment?.method} resolvedMode=${resolvedMode} shortages=${hubPlan.shortages.length} purchaseRequests=${purchaseRequests.length} procurementRequired=${newOrder.procurementRequired} shouldStartDeliverySearch=${shouldStartDeliverySearch}`);
    if (shouldStartDeliverySearch) {
      try {
        const dispatched = await startHubDeliverySearchAtomic(newOrder.orderId, {
          session: session || null,
        });
        if (dispatched) {
          orderForResponse = dispatched;
          hubMeta.autoDispatched = true;
          hubMeta.dispatchWorkflowStatus = dispatched.workflowStatus;
        } else {
          hubMeta.autoDispatched = false;
        }
      } catch (dispatchErr) {
        console.warn(`[executeCoreOrderFulfillment] auto dispatch failed for ${newOrder.orderId}:`, dispatchErr.message);
        hubMeta.autoDispatched = false;
        hubMeta.dispatchError = dispatchErr.message;
      }
    } else {
      hubMeta.autoDispatched = false;
    }

    // 12. Admin Notifications
    try {
      let aQuery = Admin.find({}).select("_id").lean();
      if (session) aQuery = aQuery.session(session);
      const admins = await aQuery;
      
      const adminIds = admins.map((a) => a?._id).filter(Boolean);
      if (adminIds.length) {
        await createNotificationBatch(
          adminIds.map((adminId) => ({
            recipient: adminId,
            recipientModel: "Admin",
            title: "New Order Received",
            message: `Order #${orderId} received and routed to hub workflow.`,
            type: "order",
            data: {
              orderId: orderForResponse.orderId,
              mongoOrderId: orderForResponse._id,
              hubStatus: orderForResponse.hubStatus,
              procurementRequired: orderForResponse.procurementRequired,
              totalAmount: validatedPricing?.total ?? 0,
              autoDispatched: hubMeta.autoDispatched,
            },
          }))
        );
      }
      emitToAdminOrdersRoom({
        event: "order:new:admin",
        payload: {
          orderId: orderForResponse.orderId,
          mongoOrderId: orderForResponse._id,
          hubStatus: orderForResponse.hubStatus,
          procurementRequired: orderForResponse.procurementRequired,
          totalAmount: validatedPricing?.total ?? 0,
          autoDispatched: hubMeta.autoDispatched,
        },
      });
    } catch (notifyErr) {
      console.warn("[executeCoreOrderFulfillment] admin notify failed:", notifyErr.message);
    }

    // 13. Clear Cart
    let cQuery = Cart.findOneAndUpdate({ customerId }, { items: [] });
    if (session) cQuery = cQuery.session(session);
    await cQuery;

    return {
      orderForResponse,
      hubMeta
    };
};
