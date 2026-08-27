import mongoose from "mongoose";
import Customer from "../models/customer.js";
import Transaction from "../models/transaction.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";

const MIN_WITHDRAWAL = 100;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const hasPayoutDetails = (c) =>
    Boolean(c?.upiId?.trim()) ||
    Boolean(c?.accountHolder?.trim() && c?.accountNumber?.trim() && c?.ifsc?.trim());

const payoutDetailsPayload = (c) => ({
    bankName: c?.bankName || "",
    accountHolder: c?.accountHolder || "",
    accountNumber: c?.accountNumber || "",
    ifsc: c?.ifsc || "",
    upiId: c?.upiId || "",
    hasDetails: hasPayoutDetails(c),
});

/* ===============================
   GET MY PAYOUT DETAILS (Customer)
================================ */
export const getBankDetails = async (req, res) => {
    try {
        const customer = await Customer.findById(req.user.id).select(
            "bankName accountHolder accountNumber ifsc upiId",
        );
        if (!customer) return handleResponse(res, 404, "Customer not found");
        return handleResponse(res, 200, "Payout details fetched", payoutDetailsPayload(customer));
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   SAVE MY PAYOUT DETAILS (Customer)
================================ */
export const updateBankDetails = async (req, res) => {
    try {
        const { bankName, accountHolder, accountNumber, ifsc, upiId } = req.body || {};

        const cleanBank = String(bankName || "").trim();
        const cleanHolder = String(accountHolder || "").trim();
        const cleanNumber = String(accountNumber || "").trim();
        const cleanIfsc = String(ifsc || "").trim().toUpperCase();
        const cleanUpi = String(upiId || "").trim();

        const hasAnyBankField = cleanHolder || cleanNumber || cleanIfsc;
        if (hasAnyBankField && (!cleanHolder || !cleanNumber || !cleanIfsc)) {
            return handleResponse(
                res,
                400,
                "Account holder name, account number, and IFSC code are all required for bank transfer",
            );
        }
        if (cleanIfsc && !IFSC_PATTERN.test(cleanIfsc)) {
            return handleResponse(res, 400, "Enter a valid IFSC code");
        }
        if (!hasAnyBankField && !cleanUpi) {
            return handleResponse(res, 400, "Add either your bank account details or a UPI ID");
        }

        const customer = await Customer.findByIdAndUpdate(
            req.user.id,
            {
                $set: {
                    bankName: cleanBank,
                    accountHolder: cleanHolder,
                    accountNumber: cleanNumber,
                    ifsc: cleanIfsc,
                    upiId: cleanUpi,
                },
            },
            { new: true },
        ).select("bankName accountHolder accountNumber ifsc upiId");

        if (!customer) return handleResponse(res, 404, "Customer not found");

        return handleResponse(res, 200, "Payout details saved", payoutDetailsPayload(customer));
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   REQUEST A WALLET WITHDRAWAL (Customer)
================================ */
export const requestWithdrawal = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user?.id;
        const amount = Number(req.body?.amount);

        if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
            await session.abortTransaction();
            session.endSession();
            return handleResponse(res, 400, `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}`);
        }

        const customer = await Customer.findById(userId).session(session);
        if (!customer) {
            await session.abortTransaction();
            session.endSession();
            return handleResponse(res, 404, "Customer not found");
        }

        if (!hasPayoutDetails(customer)) {
            await session.abortTransaction();
            session.endSession();
            return handleResponse(
                res,
                400,
                "Add your bank account or UPI details before requesting a withdrawal",
                { code: "NO_PAYOUT_DETAILS" },
            );
        }

        if (Number(customer.walletBalance || 0) < amount) {
            await session.abortTransaction();
            session.endSession();
            return handleResponse(res, 400, "Insufficient wallet balance");
        }

        customer.walletBalance = Number(customer.walletBalance) - amount;
        await customer.save({ session });

        const [transaction] = await Transaction.create(
            [
                {
                    user: customer._id,
                    userModel: "User",
                    type: "Withdrawal",
                    amount: -Math.abs(amount),
                    status: "Pending",
                    reference: `WDR-${customer._id}-${Date.now()}`,
                    meta: {
                        bankSnapshot: {
                            bankName: customer.bankName || "",
                            accountHolder: customer.accountHolder || "",
                            accountNumber: customer.accountNumber || "",
                            ifsc: customer.ifsc || "",
                            upiId: customer.upiId || "",
                        },
                    },
                },
            ],
            { session },
        );

        await session.commitTransaction();
        session.endSession();

        return handleResponse(res, 200, "Withdrawal request submitted", {
            walletBalance: customer.walletBalance,
            transactionId: transaction._id,
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET MY WITHDRAWAL REQUESTS (Customer)
================================ */
export const getMyWithdrawals = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req, { defaultLimit: 20, maxLimit: 100 });
        const query = { user: req.user.id, userModel: "User", type: "Withdrawal" };
        const [items, total] = await Promise.all([
            Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Transaction.countDocuments(query),
        ]);
        return handleResponse(res, 200, "Withdrawals fetched", {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
