import PosSession from "../models/posSession.js";
import PosCashTransaction from "../models/posCashTransaction.js";
import PosTerminal from "../models/posTerminal.js";
import { logPosAction } from "./posAuditService.js";

/**
 * Validates if the cashier currently has an open session on the terminal.
 */
export const getActiveSession = async (cashierId) => {
  return await PosSession.findOne({ cashierId, status: "OPEN" });
};

/**
 * Opens a new POS Session for a cashier on a specific terminal.
 */
export const openSession = async (cashierId, terminalId, openingCash) => {
  // Check if cashier already has an open session
  const existingSession = await getActiveSession(cashierId);
  if (existingSession) {
    throw new Error("Cashier already has an open session.");
  }

  // Create the session
  const session = new PosSession({
    terminalId,
    cashierId,
    openingCash: openingCash || 0,
    expectedCash: openingCash || 0,
    status: "OPEN",
  });

  await session.save();
  await PosTerminal.findByIdAndUpdate(terminalId, { currentSessionId: session._id });

  // Log the initial cash into the drawer
  if (openingCash > 0) {
    await PosCashTransaction.create({
      sessionId: session._id,
      cashierId,
      type: "OPENING",
      amount: openingCash,
      remarks: "Session opened with initial float",
    });
  }

  await logPosAction({
    action: "OPEN_SESSION",
    cashierId,
    sessionId: session._id,
    details: { openingCash, terminalId }
  });

  return session;
};

/**
 * Closes an active POS Session and tallies all metrics.
 */
export const closeSession = async (sessionId, cashierId, actualCash) => {
  const session = await PosSession.findOne({ _id: sessionId, cashierId, status: "OPEN" });
  if (!session) {
    throw new Error("Active session not found or already closed.");
  }

  session.status = "CLOSED";
  session.closedAt = new Date();
  session.actualCash = actualCash;
  session.cashDifference = actualCash - session.expectedCash;

  await session.save();
  await PosTerminal.findByIdAndUpdate(session.terminalId, { currentSessionId: null });

  // Log the closing cash movement
  await PosCashTransaction.create({
    sessionId: session._id,
    cashierId,
    type: "CLOSING",
    amount: actualCash,
    remarks: `Session closed. Expected: ${session.expectedCash}, Actual: ${actualCash}, Difference: ${session.cashDifference}`,
  });

  await logPosAction({
    action: "CLOSE_SESSION",
    cashierId,
    sessionId: session._id,
    details: { expectedCash: session.expectedCash, actualCash, cashDifference: session.cashDifference }
  });

  return session;
};

/**
 * Logs a cash transaction and updates the session's expected cash.
 */
export const recordCashMovement = async (sessionId, cashierId, type, amount, remarks, orderId = null, dbSession = null) => {
  const session = await PosSession.findById(sessionId);
  if (!session || session.status !== "OPEN") {
    throw new Error("Invalid or closed session.");
  }

  const transactionData = {
    sessionId,
    cashierId,
    type, // "SALES", "REFUND", "DEPOSIT", "WITHDRAWAL"
    amount, // should be positive for IN, negative for OUT
    remarks,
    orderId,
  };

  if (dbSession) {
    await PosCashTransaction.create([transactionData], { session: dbSession });
    session.expectedCash += amount;
    
    // Update specific metrics based on type
    if (type === "SALES") session.totalCashSales += amount;
    if (type === "REFUND") session.totalRefunds += Math.abs(amount);
    
    await session.save({ session: dbSession });
  } else {
    await PosCashTransaction.create(transactionData);
    session.expectedCash += amount;
    if (type === "SALES") session.totalCashSales += amount;
    if (type === "REFUND") session.totalRefunds += Math.abs(amount);
    await session.save();
  }

  return session;
};
