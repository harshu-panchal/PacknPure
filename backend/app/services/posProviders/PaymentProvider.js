import crypto from "crypto";

export class PaymentProvider {
    validatePayment(paymentData, razorpaySecret) { throw new Error("Not implemented"); }
}

export class AdminPaymentProvider extends PaymentProvider {
    validatePayment(paymentData, razorpaySecret) {
        if (paymentData.method === "upi" || paymentData.method === "card") {
            const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentData;
            if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
                throw new Error("Razorpay payment details are missing.");
            }
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac("sha256", razorpaySecret)
                .update(body.toString())
                .digest("hex");

            if (expectedSignature !== razorpay_signature) {
                throw new Error("Payment verification failed (Invalid signature).");
            }
        }
        return true;
    }
}

export class SellerPaymentProvider extends PaymentProvider {
    validatePayment(paymentData, razorpaySecret) {
        if (paymentData.method !== "cash") {
            throw new Error("Seller POS supports only Cash payments.");
        }
        return true;
    }
}
