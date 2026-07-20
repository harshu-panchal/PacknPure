import mongoose from "mongoose";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    receiptNumber: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },
    invoiceNumber: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },
    orderSource: {
      type: String,
      enum: ["ONLINE", "POS", "ADMIN", "PHONE", "MARKETPLACE", "API"],
      default: "ONLINE",
      index: true,
    },
    posDetails: {
      posTerminalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PosTerminal",
      },
      posSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PosSession",
      },
      cashierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },
      sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Seller",
      },
      sellerSnapshot: {
        businessName: String,
        phone: String,
        address: String,
        gstin: String
      }
    },
    guestCustomer: {
      name: String,
      phone: String,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required validation handled in pre-save hook
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      // In a multi-seller cart, this would be complex.
      // For now, let's assume we store the primary seller or track per item.
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        purchasePrice: {
          type: Number,
          default: 0,
        },
        variantSlot: String, // Human-readable variant label (e.g. "1 kg")
        hubReservedQty: { type: Number, default: 0 },
        vendorProcuredQty: { type: Number, default: 0 },
        vendorReceivedQty: { type: Number, default: 0 },
        qaAcceptedQty: { type: Number, default: 0 },
        qaRejectedQty: { type: Number, default: 0 },
        deliveryQty: { type: Number, default: 0 },
        deliveredQty: { type: Number, default: 0 },
        returnedQty: { type: Number, default: 0 },
        sellerCommittedQty: { type: Number, default: 0 },
        sellerPickedQty: { type: Number, default: 0 },
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          required: false,
        },
        image: String,
        gstRate: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        baseCost: { type: Number, default: 0 },
        gstEnabled: { type: Boolean, default: false },
        finalCost: { type: Number, default: 0 },
        profit: { type: Number, default: 0 },
      },
    ],
    address: {
      type: {
        type: String,
        enum: ["Home", "Work", "Other"],
        default: "Home",
      },
      name: String,
      address: String,
      city: String,
      phone: String,
      landmark: String,
      // Precise coordinates from checkout map (order-only; does not mutate saved addresses)
      location: {
        lat: Number,
        lng: Number,
      },
    },
    payment: {
      method: {
        type: String,
        enum: ["cash", "online", "wallet", "card", "upi"],
        default: "cash",
      },
      // POS payment mode summary (Seller POS): CASH or ONLINE, recorded only —
      // no gateway is triggered or verified for ONLINE.
      paymentMode: {
        type: String,
        enum: ["CASH", "ONLINE"],
        default: "CASH",
      },
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },
      transactionId: String,
      paidAmount: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: 0 },
      changeReturned: { type: Number, default: 0 },
      splitPayments: [
        {
          method: {
            type: String,
            enum: ["cash", "online", "wallet", "card", "upi"],
          },
          amount: Number,
        },
      ],
    },
    pricing: {
      subtotal: Number,
      deliveryFee: Number,
      platformFee: Number,
      gst: Number,
      tip: {
        type: Number,
        default: 0,
      },
      discount: {
        type: Number,
        default: 0,
      },
      discountDetails: {
        type: {
          type: String,
          enum: ["manual", "coupon", "membership", "employee", "none"],
          default: "none",
        },
        amount: { type: Number, default: 0 },
        reason: String,
        managerOverride: { type: Boolean, default: false },
        managerId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      },
      total: Number,
    },
    promotionApplied: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "packed",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "voided",
      ],
      default: "pending",
    },
    /** v2 state machine — set when workflowVersion >= 2 */
    workflowStatus: {
      type: String,
      enum: Object.values(WORKFLOW_STATUS),
    },
    workflowVersion: {
      type: Number,
      default: 1,
    },
    sellerPendingExpiresAt: Date,
    deliverySearchExpiresAt: Date,
    sellerAcceptedAt: Date,
    assignedAt: Date,
    assignmentVersion: {
      type: Number,
      default: 0,
    },
    deliverySearchMeta: {
      radiusMeters: { type: Number, default: 5000 },
      attempt: { type: Number, default: 1 },
      lastBroadcastAt: Date,
    },
    pickupConfirmedAt: Date,
    /** Rider tapped "arrived at store" (workflow v2: PICKUP_READY) */
    pickupReadyAt: Date,
    outForDeliveryAt: Date,
    /**
     * Delivery app progress 1–4 (refresh-safe UI).
     * 1 en route to store, 2 at store, 3 en route to customer, 4 at customer / pre-OTP.
     */
    deliveryRiderStep: {
      type: Number,
      min: 1,
      max: 4,
    },
    hubId: {
      type: String,
      default: "MAIN_HUB",
      index: true,
    },
    hubFlowEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    supplyChainStatus: {
      type: String,
      enum: ["READY_FOR_DELIVERY", "WAITING_VENDOR", "VENDOR_READY", "PICKUP_ASSIGNED", "HUB_DELIVERED", "NONE"],
      default: "NONE",
      index: true,
    },
    hubStatus: {
      type: String,
      enum: [
        "none",
        "pending_inventory_check",
        "inventory_reserved",
        "procurement_required",
        "ready_for_packing",
      ],
      default: "none",
      index: true,
    },
    procurementRequired: {
      type: Boolean,
      default: false,
    },
    procurementSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProcurementSession",
      index: true,
      default: null,
    },
    slaDeadlineAt: {
      type: Date,
      index: true,
    },
    slaBreached: {
      type: Boolean,
      default: false,
      index: true,
    },
    slaBreachedAt: {
      type: Date,
    },
    timeSlot: {
      type: String,
      default: "now",
    },
    // === Delivery Mode feature (Express / Slot) — additive only ===
    // EXPRESS = deliver ASAP within the configured ETA window.
    // SLOT    = customer picked a specific date + time slot at checkout.
    deliveryMode: {
      type: String,
      enum: ["EXPRESS", "SLOT"],
      default: "EXPRESS",
    },
    // Chosen slot window, e.g. "09:00-12:00" (only set when deliveryMode = SLOT)
    selectedSlot: {
      type: String,
      default: null,
    },
    // Chosen delivery date in "YYYY-MM-DD" (only set when deliveryMode = SLOT)
    selectedDate: {
      type: String,
      default: null,
    },
    /**
     * Immutable delivery promise captured at order creation.
     * Admin ETA / slot config changes must NEVER overwrite this —
     * historical orders always display what was promised at checkout.
     */
    deliverySnapshot: {
      deliveryMode: { type: String, enum: ["EXPRESS", "SLOT"] },
      deliveryTitle: { type: String },
      estimatedMin: { type: Number, default: null },
      estimatedMax: { type: Number, default: null },
      estimatedText: { type: String, default: null }, // e.g. "30-60 mins"
      slotId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliverySlot", default: null },
      slotDate: { type: String, default: null }, // YYYY-MM-DD
      slotDay: { type: String, default: null },
      slotStartTime: { type: String, default: null },
      slotEndTime: { type: String, default: null },
      slotDisplayText: { type: String, default: null }, // e.g. "9:00 AM - 1:00 PM"
      deliveryCharges: { type: Number, default: 0 },
    },
    deliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
    },
    cancelledBy: {
      type: String,
      enum: ["customer", "seller", "admin", "system"],
    },
    cancelReason: String,
    deviceType: {
      type: String,
      enum: ["Mobile", "Desktop", "Tablet"],
      default: "Mobile",
    },
    trafficSource: {
      type: String,
      enum: ["Direct", "Search", "Social", "Referral"],
      default: "Direct",
    },
    expiresAt: {
      type: Date,
    },
    acceptedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    skippedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Delivery",
      },
    ],

    // Return / refund lifecycle (separate from main delivery status)
    returnStatus: {
      type: String,
      enum: [
        "none",
        "return_requested",
        "return_approved",
        "return_rejected",
        "return_pickup_assigned",
        "return_in_transit",
        "returned",
        "exchange_requested",
        "exchanged",
        "refund_completed",
        "partial_refund_completed"
      ],
      default: "none",
    },
    returnRequestedAt: {
      type: Date,
    },
    returnDeadline: {
      type: Date,
    },
    returnReason: {
      type: String,
    },
    returnImages: [
      {
        type: String,
      },
    ],
    returnItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        variantSlot: String,
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          required: false,
        },
        itemIndex: {
          type: Number,
        },
        status: {
          type: String,
          enum: ["requested", "approved", "rejected", "returned"],
          default: "requested",
        },
      },
    ],
    returnRejectedReason: {
      type: String,
    },
    returnDeliveryBoy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
    },
    returnDeliveryCommission: {
      type: Number,
      default: 0,
    },
    returnRefundAmount: {
      type: Number,
      default: 0,
    },
    returnPickedAt: {
      type: Date,
    },
    returnDeliveredBackAt: {
      type: Date,
    },
    // Proximity-based delivery OTP tracking
    otpValidatedAt: {
      type: Date,
      // Timestamp when delivery OTP was successfully validated
    },
    otpValidationLocation: {
      lat: Number,
      lng: Number,
      // Location where OTP validation occurred
    },
    fulfillmentEvents: [
      {
        domain: {
          type: String,
          enum: ["fulfillment", "return"],
          default: "fulfillment",
        },
        oldState: String,
        newState: String,
        actorId: {
          type: String,
          default: null,
        },
        actorRole: {
          type: String,
          default: null,
        },
        reason: {
          type: String,
          default: null,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

orderSchema.index({ status: 1, seller: 1, deliveryBoy: 1, createdAt: -1 });
orderSchema.index({ customer: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, expiresAt: 1 });
orderSchema.index({ seller: 1, returnStatus: 1, returnRequestedAt: -1 });
orderSchema.index({ workflowStatus: 1, sellerPendingExpiresAt: 1 });
orderSchema.index({ workflowStatus: 1, deliverySearchExpiresAt: 1 });
orderSchema.index({ deliveryBoy: 1, workflowStatus: 1 });

// BUGFIX: Pre-save hook to validate customer reference integrity
orderSchema.pre('save', function(next) {
  if (this.orderSource !== "POS" && this.orderSource !== "ADMIN" && !this.customer) {
    const error = new Error('Order must have a valid customer reference');
    error.name = 'ValidationError';
    console.error('[ORDER_VALIDATION] Attempted to save order without customer reference', {
      orderId: this.orderId,
      _id: this._id,
      timestamp: new Date().toISOString(),
    });
    return next(error);
  }
  next();
});

// BUGFIX: Pre-update hook to prevent customer field from being nullified
orderSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Check if update attempts to unset or nullify customer field
  if (update.$unset && update.$unset.customer) {
    const error = new Error('Cannot unset customer field from order');
    error.name = 'ValidationError';
    console.error('[ORDER_VALIDATION] Attempted to unset customer field', {
      update,
      timestamp: new Date().toISOString(),
    });
    return next(error);
  }
  
  // Check if update attempts to set customer to null
  if (update.$set && update.$set.customer === null) {
    const error = new Error('Cannot set customer field to null');
    error.name = 'ValidationError';
    console.error('[ORDER_VALIDATION] Attempted to set customer to null', {
      update,
      timestamp: new Date().toISOString(),
    });
    return next(error);
  }
  
  next();
});

export default mongoose.model("Order", orderSchema);
