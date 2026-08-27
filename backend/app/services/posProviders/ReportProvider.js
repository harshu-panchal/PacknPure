import Order from "../../models/order.js";
import PosSession from "../../models/posSession.js";
import HubInventory from "../../models/hubInventory.js";
import Product from "../../models/product.js";

export class ReportProvider {
    async getDashboardStats(today, reqUser) { throw new Error("Not implemented"); }
    async getReports(startDate, reqUser) { throw new Error("Not implemented"); }
    async getSessions(search, reqUser) { throw new Error("Not implemented"); }
    async getOrders(reqUser) { throw new Error("Not implemented"); }
}

export class AdminReportProvider extends ReportProvider {
    async getDashboardStats(today, reqUser) {
        // Order.status has no "completed" value (see order.js enum) — the
        // terminal successful state is "delivered", which is what POS
        // take-away orders and fulfilled online orders actually end up as.
        const posOrders = await Order.find({ orderSource: "POS", createdAt: { $gte: today }, status: "delivered" });
        const posSales = posOrders.reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);
        // "Online Sales" here means payment method (UPI/Card/online), not order
        // channel — a POS sale paid by UPI/Card is still an online sale, and this
        // dashboard is POS-scoped, so it's the online-paid subset of posOrders,
        // not orders placed through the separate marketplace/app channel.
        const onlineOrders = posOrders.filter((order) => order.payment?.method !== "cash");
        const onlineSales = onlineOrders.reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);
        // POS orders only ever land on "pending" (home delivery, not yet
        // delivered) or "delivered" (take-away) — "processing" is not a real status.
        const pendingPosOrders = await Order.countDocuments({ orderSource: "POS", status: "pending" });
        const pendingOnlineOrders = await Order.countDocuments({ orderSource: { $ne: "POS" }, status: { $in: ["pending", "confirmed", "packed", "out_for_delivery"] } });
        const lowStockCount = await HubInventory.countDocuments({ $expr: { $lte: ["$availableQty", "$reorderLevel"] } });
        const activeSessions = await PosSession.countDocuments({ status: "OPEN" });

        return {
            // online is now a subset of pos (same POS channel, filtered by payment
            // method), so total is just posSales — adding online again would
            // double-count it.
            sales: { pos: posSales, online: onlineSales, total: posSales },
            orders: { totalPosToday: posOrders.length, totalOnlineToday: onlineOrders.length, pendingPos: pendingPosOrders, pendingOnline: pendingOnlineOrders },
            inventory: { lowStockAlerts: lowStockCount },
            system: { activeSessions }
        };
    }

    async getReports(startDate, reqUser) {
        return await Order.find({ orderSource: "POS", createdAt: { $gte: startDate } }).lean();
    }

    async getSessions(search, reqUser) {
        return await PosSession.find().populate("cashierId", "name email").populate("terminalId", "name").sort({ createdAt: -1 }).lean();
    }

    async getOrders(reqUser) {
        return await Order.find({ orderSource: "POS" }).sort({ createdAt: -1 }).limit(50).populate("guestCustomer").lean();
    }
}

export class SellerReportProvider extends ReportProvider {
    async getDashboardStats(today, reqUser) {
        // Order.status has no "completed" value (see order.js enum) — the
        // terminal successful state is "delivered".
        const query = { orderSource: "POS", createdAt: { $gte: today }, status: "delivered", "posDetails.sellerId": reqUser.id };
        const posOrders = await Order.find(query);
        const posSales = posOrders.reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);

        // "Online Sales" here means payment method (UPI/Card/online), not order
        // channel — a POS sale paid by UPI/Card is still an online sale, and this
        // dashboard is POS-scoped, so it's the online-paid subset of posOrders,
        // not orders placed through the separate marketplace/app channel.
        const onlineOrders = posOrders.filter((order) => order.payment?.method !== "cash");
        const onlineSales = onlineOrders.reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);

        // POS orders only ever land on "pending" (home delivery, not yet
        // delivered) or "delivered" (take-away) — "processing" is not a real status.
        const pendingPosOrders = await Order.countDocuments({ orderSource: "POS", status: "pending", "posDetails.sellerId": reqUser.id });
        const pendingOnlineOrders = await Order.countDocuments({ orderSource: { $ne: "POS" }, status: { $in: ["pending", "confirmed", "packed", "out_for_delivery"] }, seller: reqUser.id });
        
        // Low stock alerts for seller
        const lowStockCount = await Product.countDocuments({ ownerType: "seller", sellerId: reqUser.id, stock: { $lte: 5 } }); // simplistic reorder logic
        const activeSessions = await PosSession.countDocuments({ status: "OPEN", cashierId: reqUser.id });

        return {
            // online is now a subset of pos (same POS channel, filtered by payment
            // method), so total is just posSales — adding online again would
            // double-count it.
            sales: { pos: posSales, online: onlineSales, total: posSales },
            orders: { totalPosToday: posOrders.length, totalOnlineToday: onlineOrders.length, pendingPos: pendingPosOrders, pendingOnline: pendingOnlineOrders },
            inventory: { lowStockAlerts: lowStockCount },
            system: { activeSessions }
        };
    }

    async getReports(startDate, reqUser) {
        return await Order.find({ orderSource: "POS", createdAt: { $gte: startDate }, "posDetails.sellerId": reqUser.id }).lean();
    }

    async getSessions(search, reqUser) {
        return await PosSession.find({ cashierId: reqUser.id }).populate("cashierId", "name email").populate("terminalId", "name").sort({ createdAt: -1 }).lean();
    }

    async getOrders(reqUser) {
        return await Order.find({ orderSource: "POS", "posDetails.sellerId": reqUser.id }).sort({ createdAt: -1 }).limit(50).populate("guestCustomer").lean();
    }
}
