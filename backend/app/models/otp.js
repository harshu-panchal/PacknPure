import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^[0-9]{10}$/.test(v); // Validate 10-digit format
        },
        message: 'Mobile number must be 10 digits',
      },
    },
    otp: {
      type: String,
      required: true,
      trim: true,
    },
    userType: {
      type: String,
      required: true,
      enum: ['Admin', 'Seller', 'Customer', 'Delivery', 'PickupPartner'],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete after expiry via MongoDB TTL index
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for fast lookups by mobile and userType
OtpSchema.index({ mobile: 1, userType: 1 });

const Otp = mongoose.models.Otp || mongoose.model('Otp', OtpSchema);

export default Otp;
