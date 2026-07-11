import PosTerminal from "../models/posTerminal.js";
import { openSession, closeSession, recordCashMovement, getActiveSession } from "../services/posSessionService.js";
import { handleResponse } from "../utils/helper.js";
import { logPosAction } from "../services/posAuditService.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import HubInventory from "../models/hubInventory.js";
import PosSession from "../models/posSession.js";
import mongoose from "mongoose";

// Terminals
export const createTerminal = async (req, res) => {
  try {
    const { name, storeLocation, deviceIdentifiers } = req.body;
    const terminal = await PosTerminal.create({ name, storeLocation, deviceIdentifiers });
    return handleResponse(res, 201, "POS Terminal created successfully", terminal);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getTerminals = async (req, res) => {
  try {
    const terminals = await PosTerminal.find();
    return handleResponse(res, 200, "POS Terminals fetched", terminals);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Sessions
export const startSession = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { terminalId, openingCash } = req.body;

    const session = await openSession(cashierId, terminalId, openingCash);
    return handleResponse(res, 200, "POS Session started successfully", session);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

export const endSession = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { sessionId, actualCash } = req.body;

    const session = await closeSession(sessionId, cashierId, actualCash);
    return handleResponse(res, 200, "POS Session closed successfully", session);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

export const getCurrentSession = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const session = await getActiveSession(cashierId);
    if (!session) {
      return handleResponse(res, 404, "No active POS session found");
    }
    return handleResponse(res, 200, "Active session fetched", session);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Cash Drawer
export const addCashMovement = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { sessionId, type, amount, remarks } = req.body; // type: "DEPOSIT" or "WITHDRAWAL"

    if (!["DEPOSIT", "WITHDRAWAL"].includes(type)) {
      return handleResponse(res, 400, "Invalid cash movement type. Use DEPOSIT or WITHDRAWAL.");
    }
    
    // For DEPOSIT amount should be positive, for WITHDRAWAL it should be negative
    const finalAmount = type === "WITHDRAWAL" ? -Math.abs(amount) : Math.abs(amount);

    const session = await recordCashMovement(sessionId, cashierId, type, finalAmount, remarks);
    return handleResponse(res, 200, `Cash ${type.toLowerCase()} logged successfully`, session);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

// General Audit / Void Bill (Non-Checkout)
export const voidBill = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { orderId, reason, sessionId } = req.body;
    
    // Since void bill cancels a non-completed order, we import Order model
    const Order = (await import("../models/order.js")).default;
    const order = await Order.findOne({ orderId, orderSource: "POS", status: { $ne: "completed" } });
    
    if (!order) {
      return handleResponse(res, 404, "Order not found or already completed/voided.");
    }

    order.status = "voided";
    order.cancelReason = reason;
    await order.save();

    await logPosAction({
      action: "VOID_BILL",
      cashierId,
      sessionId,
      orderId,
      details: { reason }
    });

    return handleResponse(res, 200, "Bill voided successfully.");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Return & Refund API
export const returnPosOrder = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { orderId, items, reason, sessionId } = req.body;
    
    const order = await Order.findOne({ orderId, orderSource: "POS" });
    if (!order) {
      return handleResponse(res, 404, "POS order not found.");
    }
    
    let refundAmount = 0;
    // Process items to return
    for (const returnItem of items) {
      const orderItem = order.items.find(i => String(i.product) === returnItem.productId && String(i.variantId || "") === returnItem.variantId);
      if (orderItem) {
        orderItem.returnedQty += returnItem.qty;
        refundAmount += (orderItem.price * returnItem.qty);
        
        // Sync Inventory back if it was delivered
        if (order.status === "delivered" || order.status === "completed") {
          const { incrementHubInventory } = await import("../services/inventoryLifecycleService.js");
          // Reusing exact backend inventory orchestration
          await incrementHubInventory(orderItem.product, orderItem.variantId, returnItem.qty);
        }
      }
    }
    
    // Update order status if fully returned
    const allReturned = order.items.every(i => i.returnedQty === i.quantity);
    if (allReturned) {
      order.status = "refunded";
      order.workflowStatus = "REFUNDED";
    }
    
    await order.save();
    
    // Log Cash Refund if it was a cash order
    if (order.payment.method === "cash" && sessionId) {
      await recordCashMovement(
        sessionId,
        cashierId,
        "REFUND",
        -Math.abs(refundAmount),
        `Refund for Order: ${orderId}`,
        orderId
      );
    }
    
    await logPosAction({
      action: "RETURN_ORDER",
      cashierId,
      sessionId,
      orderId,
      details: { refundAmount, reason }
    });
    
    return handleResponse(res, 200, "Return processed successfully.", { refundAmount });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Get POS Orders
export const getPosOrders = async (req, res) => {
  try {
    const orders = await Order.find({ orderSource: "POS" })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("guestCustomer")
      .lean();
    
    return handleResponse(res, 200, "POS Orders fetched", orders);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Unified Dashboard API
export const getPosDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Sales Data
    const posOrders = await Order.find({ orderSource: "POS", createdAt: { $gte: today }, status: "completed" });
    const onlineOrders = await Order.find({ orderSource: { $ne: "POS" }, createdAt: { $gte: today }, status: "completed" });

    const posSales = posOrders.reduce((acc, order) => acc + order.totalAmount, 0);
    const onlineSales = onlineOrders.reduce((acc, order) => acc + order.totalAmount, 0);

    // 2. Pending Orders (POS vs Online)
    const pendingPosOrders = await Order.countDocuments({ orderSource: "POS", status: { $in: ["pending", "processing"] } });
    const pendingOnlineOrders = await Order.countDocuments({ orderSource: { $ne: "POS" }, status: { $in: ["pending", "processing"] } });

    // 3. Low Stock Items (HubStock where qty <= lowStockThreshold)
    const lowStockCount = await HubInventory.countDocuments({ 
        $expr: { $lte: ["$availableQty", "$reorderLevel"] } 
    });

    // 4. Active Sessions Count
    const activeSessions = await PosSession.countDocuments({ status: "open" });

    return handleResponse(res, 200, "Dashboard stats fetched", {
      sales: {
        pos: posSales,
        online: onlineSales,
        total: posSales + onlineSales
      },
      orders: {
        totalPosToday: posOrders.length,
        totalOnlineToday: onlineOrders.length,
        pendingPos: pendingPosOrders,
        pendingOnline: pendingOnlineOrders
      },
      inventory: {
        lowStockAlerts: lowStockCount
      },
      system: {
        activeSessions
      }
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Deep Product Search API
export const searchPosProducts = async (req, res) => {
  try {
    const { search, limit = 10 } = req.query;
    
    if (!search) {
      return handleResponse(res, 400, "Search term is required.");
    }

    const query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { "variants.sku": { $regex: search, $options: "i" } },
        { "variants.barcode": search } // exact barcode search
      ],
      isDeleted: false
    };

    const products = await Product.find(query)
      .populate("hubStocks", "quantity reserved lowStockThreshold")
      .limit(parseInt(limit))
      .lean();

    // Map the deep inventory details
    const formattedResults = products.map(p => {
      // Find default hub stock
      const hubStock = p.hubStocks && p.hubStocks.length > 0 ? p.hubStocks[0] : null;
      
      const baseResult = {
        _id: p._id,
        name: p.name,
        image: p.images?.[0]?.url || "",
        gstEnabled: p.gstEnabled,
        gstRate: p.gstRate,
        hubAvailableQty: hubStock ? Math.max(0, hubStock.quantity - (hubStock.reserved || 0)) : 0,
        hubReservedQty: hubStock?.reserved || 0,
        sellerQty: "N/A", // This requires complex agg from SellerStock, keeping simple for fast POS
      };

      if (p.hasVariants && p.variants?.length > 0) {
        // Flatten variants
        return p.variants.map(v => ({
          ...baseResult,
          variantId: v._id,
          variantName: v.name,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          mrp: v.mrp,
          purchasePrice: v.purchasePrice || 0
        }));
      } else {
        return [{
          ...baseResult,
          variantId: null,
          variantName: null,
          sku: p.sku,
          barcode: p.sku, // No barcode field for base product in schema, use sku
          price: p.basePrice,
          mrp: p.mrp || p.basePrice,
          purchasePrice: p.purchasePrice || 0
        }];
      }
    }).flat();

    // If search term is exact barcode, try to filter exact match first
    const exactMatch = formattedResults.find(r => r.barcode === search);
    
    return handleResponse(res, 200, "Products fetched", exactMatch ? [exactMatch] : formattedResults.slice(0, parseInt(limit)));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
