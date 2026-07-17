import { AdminInventoryProvider, SellerInventoryProvider } from "./InventoryProvider.js";
import { AdminPaymentProvider, SellerPaymentProvider } from "./PaymentProvider.js";
import { AdminReportProvider, SellerReportProvider } from "./ReportProvider.js";
import { AdminReceiptProvider, SellerReceiptProvider } from "./ReceiptProvider.js";

export const getPosProviders = (role) => {
    if (role === "seller") {
        return {
            inventory: new SellerInventoryProvider(),
            payment: new SellerPaymentProvider(),
            report: new SellerReportProvider(),
            receipt: new SellerReceiptProvider(),
        };
    }
    
    // Default to Admin
    return {
        inventory: new AdminInventoryProvider(),
        payment: new AdminPaymentProvider(),
        report: new AdminReportProvider(),
        receipt: new AdminReceiptProvider(),
    };
};
