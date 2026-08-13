import mongoose from "mongoose";
import handleResponse from "../utils/helper.js";
import { subscribeToBackInStock } from "../services/stockNotificationService.js";

export const subscribeProductBackInStock = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, variantId } = req.body || {};

    if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
      return handleResponse(res, 400, "A valid productId is required");
    }
    if (variantId && !mongoose.Types.ObjectId.isValid(String(variantId))) {
      return handleResponse(res, 400, "variantId is invalid");
    }

    await subscribeToBackInStock({
      customerId,
      productId,
      variantId: variantId || null,
    });

    return handleResponse(
      res,
      200,
      "We'll notify you as soon as this is back in stock",
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
