import PosTerminal from "../models/posTerminal.js";
import { openSession, closeSession, recordCashMovement, getActiveSession } from "../services/posSessionService.js";
import { handleResponse } from "../utils/helper.js";
import { logPosAction } from "../services/posAuditService.js";

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
