import PosTerminal from "../models/posTerminal.js";
import { openSession, closeSession, recordCashMovement, getActiveSession } from "../services/posSessionService.js";
import { handleResponse } from "../utils/helper.js";
import { logPosAction } from "../services/posAuditService.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import HubInventory from "../models/hubInventory.js";
import PosSession from "../models/posSession.js";
import mongoose from "mongoose";
import User from "../models/customer.js";

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

// POS Analytics & Reports
export const getPosReports = async (req, res) => {
  try {
    const { range = 'today' } = req.query;
    
    let startDate = new Date();
    if (range === 'today') {
        startDate.setHours(0, 0, 0, 0);
    } else if (range === 'week') {
        startDate.setDate(startDate.getDate() - 7);
    } else if (range === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
    } else if (range === 'year') {
        startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const posOrders = await Order.find({ 
        orderSource: "POS", 
        createdAt: { $gte: startDate } 
    }).lean();

    let grossSales = 0;
    let totalRefunds = 0;
    const uniqueCustomers = new Set();
    const paymentMethods = { cash: 0, upi: 0, card: 0 };
    const categorySales = {}; // simplified to product names for now

    for (const order of posOrders) {
        if (order.status === 'completed' || order.status === 'delivered') {
            grossSales += order.totalAmount || 0;
            
            if (order.payment?.method) {
                const method = order.payment.method.toLowerCase();
                if (paymentMethods[method] !== undefined) {
                    paymentMethods[method] += order.totalAmount;
                } else {
                    paymentMethods[method] = order.totalAmount;
                }
            }

            if (order.guestCustomer?.phone) {
                uniqueCustomers.add(order.guestCustomer.phone);
            } else if (order.customer) {
                uniqueCustomers.add(order.customer.toString());
            }

            for (const item of order.items || []) {
                categorySales[item.name] = (categorySales[item.name] || 0) + item.quantity;
            }
        }
        if (order.status === 'refunded' || order.status === 'voided') {
            totalRefunds += order.totalAmount || 0;
        }
    }

    // Sort categories
    const topCategories = Object.entries(categorySales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    return handleResponse(res, 200, "Reports fetched", {
        grossSales,
        totalOrders: posOrders.length,
        totalRefunds,
        uniqueCustomers: uniqueCustomers.size,
        paymentMethods,
        topCategories
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
      ownerType: "admin",
      status: "active"
    };

    const products = await Product.find(query)
      .limit(parseInt(limit))
      .lean();

    const productIds = products.map(p => p._id);
    
    // Fetch Hub Inventory manually since it's not a virtual on Product
    const hubStocks = await HubInventory.find({
      productId: { $in: productIds }
    }).lean();

    // Fetch all active seller listings that point to these master products
    const sellerListings = await Product.find({
      masterProductId: { $in: productIds },
      status: "active"
    }).lean();

    // Map the deep inventory details
    const formattedResults = products.map(p => {
      // Find hub stock for this product
      const hubStock = hubStocks.find(h => String(h.productId) === String(p._id));
      
      const baseResult = {
        _id: p._id,
        name: p.name,
        image: p.images?.[0]?.url || p.mainImage || "",
        gstEnabled: p.gstEnabled,
        gstRate: p.gstRate,
        hubAvailableQty: hubStock ? Math.max(0, hubStock.availableQty || hubStock.quantity - (hubStock.reservedQty || hubStock.reserved || 0)) : 0,
        hubReservedQty: hubStock?.reservedQty || hubStock?.reserved || 0,
        hubTotalQty: hubStock?.quantity || hubStock?.availableQty || 0,
      };

      if (p.variants && p.variants.length > 0) {
        // Flatten variants
        return p.variants.map(v => {
          // Find seller stock for this specific variant (match by name/sku)
          const sellerVariantStock = sellerListings
            .filter(sl => String(sl.masterProductId) === String(p._id))
            .reduce((total, sl) => {
              const matchedVariant = sl.variants?.find(sv => sv.name === v.name || sv.sku === v.sku);
              return total + (matchedVariant?.stock || 0);
            }, 0);

          return {
            ...baseResult,
            variantId: v._id,
            variantName: v.name,
            sku: v.sku,
            barcode: v.barcode,
            price: v.salePrice || v.price || 0, // This is final selling price
            mrp: v.price || v.salePrice || 0,
            purchasePrice: v.purchasePrice || 0,
            sellerQty: sellerVariantStock,
            gstEnabled: v.gstEnabled !== undefined ? v.gstEnabled : baseResult.gstEnabled,
            gstRate: v.gstEnabled !== undefined && v.gstEnabled ? v.gstRate : baseResult.gstRate
          };
        });
      } else {
        const sellerStock = sellerListings
          .filter(sl => String(sl.masterProductId) === String(p._id))
          .reduce((total, sl) => total + (sl.variants?.[0]?.stock || 0), 0);

        return [{
          ...baseResult,
          variantId: null,
          variantName: null,
          sku: p.sku,
          barcode: p.sku,
          price: p.salePrice || p.basePrice || p.price || 0,
          mrp: p.mrp || p.price || p.salePrice || 0,
          purchasePrice: p.purchasePrice || 0,
          sellerQty: sellerStock
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

// Customer Search API
export const searchCustomer = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return handleResponse(res, 400, "Phone number is required");
    }

    const customer = await User.findOne({ phone, role: "customer" }).select(
      "name phone email addresses walletBalance codBlocked"
    ).lean();

    if (!customer) {
      return handleResponse(res, 404, "Customer not found");
    }

    const recentOrders = await Order.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("orderId pricing.total status createdAt")
      .lean();

    return handleResponse(res, 200, "Customer found", {
      customer: {
        ...customer,
        recentOrders
      }
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// POS Cart Calculation
export const calculateCartTotals = async (req, res) => {
  try {
    const { items = [], manualDiscount = { amount: 0 } } = req.body;
    let subtotal = 0;
    let totalGst = 0;

    for (const item of items) {
      console.log("Processing item:", JSON.stringify(item));
      const product = await Product.findById(item.product || item.productId).lean();
      if (!product) {
        console.log("Product not found for:", item.product || item.productId);
        continue;
      }
      
      let price = product.basePrice || product.price || 0;
      let variant = null;
      let gstRate = product.gstRate || 0;
      let gstEnabled = product.gstEnabled || false;

      if (item.variantId && product.variants) {
        variant = product.variants.find(v => String(v._id) === String(item.variantId) || String(v.id) === String(item.variantId));
        if (variant) {
          price = variant.salePrice || variant.price || price;
          if (variant.gstEnabled !== undefined) gstEnabled = variant.gstEnabled;
          if (gstEnabled) gstRate = variant.gstRate || gstRate;
        }
      }

      const itemFinalTotal = price * (item.quantity || 1);
      let itemBaseTotal = itemFinalTotal;
      let itemGstTotal = 0;

      if (gstEnabled && gstRate > 0) {
        itemBaseTotal = itemFinalTotal / (1 + (gstRate / 100));
        itemGstTotal = itemFinalTotal - itemBaseTotal;
      }

      subtotal += itemBaseTotal;
      totalGst += itemGstTotal;
      console.log(`Item total: base=${itemBaseTotal}, gst=${itemGstTotal}, price=${price}`);
    }

    const discountAmount = Number(manualDiscount.amount) || 0;
    const total = Math.max(0, subtotal + totalGst - discountAmount);

    return handleResponse(res, 200, "Calculated successfully", {
      subtotal: Number(subtotal.toFixed(2)),
      totalGst: Number(totalGst.toFixed(2)),
      discount: Number(discountAmount.toFixed(2)),
      total: Number(total.toFixed(2))
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Payment Config
export const getPaymentConfig = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID) {
       return handleResponse(res, 500, "Razorpay Key ID is not configured on the server.");
    }
    return handleResponse(res, 200, "Payment config fetched", {
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Share Receipt
export const sharePosReceipt = async (req, res) => {
  try {
    const { orderId, method, contact } = req.body;
    // Real implementation would use notificationService here.
    // For now, return a successful mock response indicating the system intends to send it via backend.
    if (!orderId || !method || !contact) {
      return handleResponse(res, 400, "Missing required fields: orderId, method, contact");
    }

    // Placeholder: Send WhatsApp/Email via provider
    console.log(`[Notification Engine Mock] Sending Receipt for ${orderId} via ${method} to ${contact}`);

    return handleResponse(res, 200, `Receipt shared successfully via ${method}`);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
