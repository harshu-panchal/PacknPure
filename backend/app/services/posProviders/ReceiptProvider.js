import Seller from "../../models/seller.js";

export class ReceiptProvider {
    async getSnapshot(reqUser) { throw new Error("Not implemented"); }
}

export class AdminReceiptProvider extends ReceiptProvider {
    async getSnapshot(reqUser) {
        return null;
    }
}

export class SellerReceiptProvider extends ReceiptProvider {
    async getSnapshot(reqUser) {
        const seller = await Seller.findById(reqUser.id).select("shopName name phone registeredAddress gstin").lean();
        if (!seller) return null;
        return {
            businessName: seller.shopName || seller.name,
            phone: seller.phone,
            address: seller.registeredAddress?.address || "",
            gstin: seller.gstin || ""
        };
    }
}
