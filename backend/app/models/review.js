import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        title: {
            type: String,
            trim: true,
            default: "",
        },
        comment: {
            type: String,
            required: true,
            trim: true,
        },
        images: [{
            type: String,
        }],
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        helpfulVotes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        helpfulCount: {
            type: Number,
            default: 0,
        },
        verifiedPurchase: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Prevent multiple reviews from same user for same variant
reviewSchema.index({ userId: 1, variantId: 1 }, { unique: true });

// Static method to calculate average rating and distribution for a variant
reviewSchema.statics.calculateAverageRating = async function (productId, variantId) {
    if (!productId || !variantId) return;

    try {
        const pId = new mongoose.Types.ObjectId(productId.toString());
        const vId = new mongoose.Types.ObjectId(variantId.toString());

        const stats = await this.aggregate([
            {
                $match: {
                    productId: pId,
                    variantId: vId,
                    status: "approved"
                }
            },
            {
                $group: {
                    _id: "$variantId",
                    averageRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 },
                    count1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
                    count2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
                    count3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
                    count4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
                    count5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } }
                }
            }
        ]);

        if (stats.length > 0) {
            await mongoose.model("Product").findOneAndUpdate(
                { _id: pId, "variants._id": vId },
                {
                    $set: {
                        "averageRating": stats[0].averageRating,
                        "totalReviews": stats[0].totalReviews,
                        "ratingDistribution": {
                            "1": stats[0].count1,
                            "2": stats[0].count2,
                            "3": stats[0].count3,
                            "4": stats[0].count4,
                            "5": stats[0].count5
                        },
                        "variants.$.averageRating": stats[0].averageRating,
                        "variants.$.totalReviews": stats[0].totalReviews,
                        "variants.$.ratingDistribution": {
                            "1": stats[0].count1,
                            "2": stats[0].count2,
                            "3": stats[0].count3,
                            "4": stats[0].count4,
                            "5": stats[0].count5
                        }
                    }
                }
            );
        } else {
            await mongoose.model("Product").findOneAndUpdate(
                { _id: pId, "variants._id": vId },
                {
                    $set: {
                        "averageRating": 0,
                        "totalReviews": 0,
                        "ratingDistribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
                        "variants.$.averageRating": 0,
                        "variants.$.totalReviews": 0,
                        "variants.$.ratingDistribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
                    }
                }
            );
        }
    } catch (error) {
        console.error("Error calculating average rating:", error);
    }
};

// Call calculateAverageRating after save
reviewSchema.post("save", async function () {
    await this.constructor.calculateAverageRating(this.productId, this.variantId);
});

// Call calculateAverageRating after update (e.g. approve/reject)
reviewSchema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
        await doc.constructor.calculateAverageRating(doc.productId, doc.variantId);
    }
});

// Call calculateAverageRating after delete
reviewSchema.post("findOneAndDelete", async function (doc) {
    if (doc) {
        await doc.constructor.calculateAverageRating(doc.productId, doc.variantId);
    }
});

export default mongoose.model("Review", reviewSchema);
