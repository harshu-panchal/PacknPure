import Review from "../models/review.js";
import handleResponse from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { uploadBufferToCloudinary } from "../utils/cloudinary.js";

// Submit a review (Customer) — supports multipart/form-data with optional images
export const submitReview = async (req, res) => {
    try {
        const { productId, variantId, rating, title, comment } = req.body;
        const userId = req.user.id;

        if (!productId || !variantId || !rating || !comment?.trim()) {
            return handleResponse(res, 400, "productId, variantId, rating, and comment are required");
        }

        const parsedRating = Number(rating);
        if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return handleResponse(res, 400, "Rating must be between 1 and 5");
        }

        // Check if user already reviewed this variant
        const existingReview = await Review.findOne({ userId, variantId });
        if (existingReview) {
            return handleResponse(res, 400, "You have already reviewed this variant");
        }

        // Upload review images if any
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map((file) =>
                uploadBufferToCloudinary(file.buffer, {
                    folder: "reviews",
                    mimetype: file.mimetype,
                })
            );
            const results = await Promise.all(uploadPromises);
            imageUrls = results.map((r) => r.url);
        }

        const newReview = new Review({
            userId,
            productId,
            variantId,
            rating: parsedRating,
            title: title?.trim() || "",
            comment: comment.trim(),
            images: imageUrls,
            status: "approved",
            verifiedPurchase: false,
        });

        await newReview.save();

        // Ensure product stats are updated before responding so frontend gets fresh data
        await Review.calculateAverageRating(productId, variantId);

        // Populate user info for instant response
        await newReview.populate("userId", "name image");

        return handleResponse(res, 201, "Review submitted successfully!", newReview);
    } catch (error) {
        if (error.code === 11000) {
            return handleResponse(res, 400, "You have already reviewed this variant");
        }
        return handleResponse(res, 500, error.message);
    }
};

// Get approved reviews for a product (Public) with pagination
export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const { variantId, page = 1, limit = 10, sort = "newest" } = req.query;

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
        const skip = (pageNum - 1) * limitNum;

        const sortOptions = {
            newest: { createdAt: -1 },
            oldest: { createdAt: 1 },
            highest: { rating: -1 },
            lowest: { rating: 1 },
            helpful: { helpfulCount: -1, createdAt: -1 },
        };
        const mongoSort = sortOptions[sort] || sortOptions.newest;

        const filter = { productId, status: "approved" };
        if (variantId) {
            filter.variantId = variantId;
        }

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .populate("userId", "name image")
                .sort(mongoSort)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Review.countDocuments(filter),
        ]);

        return handleResponse(res, 200, "Reviews fetched successfully", {
            items: reviews,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Check if current user has already reviewed a variant
export const checkUserReview = async (req, res) => {
    try {
        const { productId } = req.params;
        const { variantId } = req.query;
        const userId = req.user.id;
        
        const filter = { userId, productId };
        if (variantId) {
            filter.variantId = variantId;
        }

        const review = await Review.findOne(filter).lean();
        return handleResponse(res, 200, "Check complete", { hasReviewed: !!review, review: review || null });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Get all pending reviews
export const getPendingReviews = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req, { defaultLimit: 25, maxLimit: 200 });

        const query = { status: "pending" };

        const [reviews, total] = await Promise.all([
            Review.find(query)
                .populate("userId", "name email image")
                .populate("productId", "name mainImage")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Review.countDocuments(query)
        ]);

        return handleResponse(res, 200, "Pending reviews fetched successfully", {
            items: reviews,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Admin: Update review status (Approve/Reject)
export const updateReviewStatus = async (req, res) => {
    try {
        const { status } = req.body; // approved or rejected
        const { id } = req.params;

        if (!["approved", "rejected"].includes(status)) {
            return handleResponse(res, 400, "Status must be 'approved' or 'rejected'");
        }

        const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
        if (!review) return handleResponse(res, 404, "Review not found");

        return handleResponse(res, 200, `Review ${status} successfully`, review);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
