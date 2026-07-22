import handleResponse from "../utils/helper.js";
import { initiateMaskedCall } from "../services/maskedCall/maskedCallService.js";
import { recordDeliveryAudit } from "../services/deliveryAuditService.js";

export async function customerInitiateMaskedCall(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id ?? req.user?._id;

    const session = await initiateMaskedCall({
      orderId,
      callerRole: "customer",
      callerUserId: userId,
    });

    await recordDeliveryAudit({
      orderId,
      deliveryBoy: null,
      event: "masked_call_initiated",
      metadata: { callerRole: "customer", sessionId: session.sessionId },
    });

    return handleResponse(res, 200, "Masked call initiated", session);
  } catch (error) {
    const code = error.statusCode || 500;
    return handleResponse(res, code, error.message);
  }
}

export async function deliveryInitiateMaskedCall(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id ?? req.user?._id;

    const session = await initiateMaskedCall({
      orderId,
      callerRole: "delivery",
      callerUserId: userId,
    });

    await recordDeliveryAudit({
      orderId,
      deliveryBoy: userId,
      event: "masked_call_initiated",
      metadata: { callerRole: "delivery", sessionId: session.sessionId },
    });

    return handleResponse(res, 200, "Masked call initiated", session);
  } catch (error) {
    const code = error.statusCode || 500;
    return handleResponse(res, code, error.message);
  }
}
