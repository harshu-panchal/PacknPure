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
        const posOrders = await Order.find({ orderSource: "POS", createdAt: { $gte: today }, status: "completed" });
        const onlineOrders = await Order.find({ orderSource: { $ne: "POS" }, createdAt: { $gte: today }, status: "completed" });
        const posSales = posOrders.reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);
        const onlineSales = onlineOrders.reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);
        const pendingPosOrders = await Order.countDocuments({ orderSource: "POS", status: { $in: ["pending", "processing"] } });
        const pendingOnlineOrders = await Order.countDocuments({ orderSource: { $ne: "POS" }, status: { $in: ["pending", "processing"] } });
        const lowStockCount = await HubInventory.countDocuments({ $expr: { $lte: ["$availableQty", "$reorderLevel"] } });
        const activeSessions = await PosSession.countDocuments({ status: "open" });

        return {
            sales: { pos: posSales, online: onlineSales, total: posSales + onlineSales },
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
        const query = { orderSource: "POS", createdAt: { $gte: today }, status: "completed", "posDetails.sellerId": reqUser.id };
        const posOrders = await Order.find(query);
        const posSales = posOrders.reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);
        
        // Online orders for seller
        const onlineQuery = { orderSource: { $ne: "POS" }, createdAt: { $gte: today }, status: "completed", seller: reqUser.id };
        const onlineOrders = await Order.find(onlineQuery);
        const onlineSales = onlineOrders.reduce((acc, order) => acc + (order.pricing?.total || order.totalAmount || 0), 0);

        const pendingPosOrders = await Order.countDocuments({ orderSource: "POS", status: { $in: ["pending", "processing"] }, "posDetails.sellerId": reqUser.id });
        const pendingOnlineOrders = await Order.countDocuments({ orderSource: { $ne: "POS" }, status: { $in: ["pending", "processing"] }, seller: reqUser.id });
        
        // Low stock alerts for seller
        const lowStockCount = await Product.countDocuments({ ownerType: "seller", sellerId: reqUser.id, stock: { $lte: 5 } }); // simplistic reorder logic
        const activeSessions = await PosSession.countDocuments({ status: "open", sellerId: reqUser.id });

        return {
            sales: { pos: posSales, online: onlineSales, total: posSales + onlineSales },
            orders: { totalPosToday: posOrders.length, totalOnlineToday: onlineOrders.length, pendingPos: pendingPosOrders, pendingOnline: pendingOnlineOrders },
            inventory: { lowStockAlerts: lowStockCount },
            system: { activeSessions }
        };
    }

    async getReports(startDate, reqUser) {
        return await Order.find({ orderSource: "POS", createdAt: { $gte: startDate }, "posDetails.sellerId": reqUser.id }).lean();
    }

    async getSessions(search, reqUser) {
        return await PosSession.find({ sellerId: reqUser.id }).populate("cashierId", "name email").populate("terminalId", "name").sort({ createdAt: -1 }).lean();
    }

    async getOrders(reqUser) {
        return await Order.find({ orderSource: "POS", "posDetails.sellerId": reqUser.id }).sort({ createdAt: -1 }).limit(50).populate("guestCustomer").lean();
    }
}
