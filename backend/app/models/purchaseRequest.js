import mongoose from "mongoose";

const purchaseRequestItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    requiredQty: {
      type: Number,
      required: true,
      min: 1,
    },
    availableQtyAtHub: {
      type: Number,
      default: 0,
      min: 0,
    },
    shortageQty: {
      type: Number,
      required: true,
      min: 1,
    },
    requestedQty: {
      type: Number,
      default: function() { return this.shortageQty; },
    },
    actualPickedQty: {
      type: Number,
      default: 0,
    },
    remainingQty: {
      type: Number,
      default: function() { return this.shortageQty; },
    },
    committedQty: {
      type: Number,
      min: 0,
      default: 0,
    },
    rejectedQty: {
      type: Number,
      min: 0,
      default: 0,
    },
    selectedSellerProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    vendorUnitCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    vendorQuotedPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    pricingStrategy: {
      type: String,
      trim: true,
      default: "",
    },
    gstRate: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    baseSupplyPrice: { type: Number, default: 0 },
    finalSupplyPrice: { type: Number, default: 0 },
    totalProcurementCost: { type: Number, default: 0 },
  },
  { _id: false },
);

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    hubId: {
      type: String,
      default: "MAIN_HUB",
      index: true,
    },
    items: {
      type: [purchaseRequestItemSchema],
      default: [],
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      index: true,
    },
    rankedSellers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
    }],
    expiresAt: {
      type: Date,
      index: true,
    },
    pickupPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PickupPartner",
    },
    pickupPartnerName: {
      type: String,
      trim: true,
      default: "",
    },
    pickupAssignedAt: Date,
    receivedAtHubAt: Date,
    verifiedAt: Date,
    status: {
      type: String,
      enum: [
        "created",
        "seller_confirmed",
        "seller_rejected",
        "expired",
        "seller_failed",
        "pickup_assigned",
        "pickup_cancelled",
        "picked",
        "hub_delivered",
        "received_at_hub",
        "verified",
        "return_requested",
        "return_pickup",
        "return_delivered",
        "seller_confirmed_return",
        "procurement_failed",
        "closed",
        "cancelled",
        "exception",
      ],
      default: "created",
      index: true,
    },
    vendorResponse: {
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "partial"],
        default: "pending",
      },
      respondedAt: Date,
      rejectionReason: String,
      notes: String,
    },
    vendorReadyAt: Date,
    vendorReadyNotes: String,
    vendorHandover: {
      confirmedAt: Date,
      otpVerifiedAt: Date,
      notes: String,
    },
    pickupOtpHash: String,
    pickupOtpCode: String,
    pickupOtpExpiresAt: Date,
    pickupOtpVerifiedAt: Date,
    pickupProof: {
      pickedAt: Date,
      pickedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PickupPartner",
      },
      vendorImageUrl: String,
      notes: String,
      location: {
        lat: Number,
        lng: Number,
      },
    },
    hubDropProof: {
      droppedAt: Date,
      droppedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PickupPartner",
      },
      hubImageUrl: String,
      notes: String,
      location: {
        lat: Number,
        lng: Number,
      },
    },
    returnDetails: {
      returnRequestedAt: Date,
      rejectedQty: {
        type: Number,
        default: 0,
        min: 0,
      },
      returnPickupPartnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PickupPartner",
      },
      returnPickedAt: Date,
      returnDeliveredAt: Date,
      sellerConfirmedReturnAt: Date,
      notes: String,
    },
    exceptionReason: String,
    eta: Date,
    notes: String,
  },
  { timestamps: true },
);

purchaseRequestSchema.index({ orderId: 1, vendorId: 1, createdAt: -1 });
purchaseRequestSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model("PurchaseRequest", purchaseRequestSchema);
