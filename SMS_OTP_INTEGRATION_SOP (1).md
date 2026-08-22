# Standard Operating Procedure (SOP): SMSindia OTP Service Integration

**Version:** 1.0
**Purpose:** To guide developers in replicating and integrating the SMSindia OTP service into a new Node.js/TypeScript project.

---

## 1. Prerequisite Environment Setup

### 1.1 System Requirements
*   **Node.js**: v18+ (LTS recommended)
*   **Database**: MongoDB (v4.4+)
*   **TypeScript**: v5+

### 1.2 Dependency Installation
Install the required core dependencies and development tools.

```bash
# Core Dependencies
npm install axios mongoose dotenv express

# Optional but Recommended (for security/validation)
npm install express-rate-limit

# Development Dependencies
npm install --save-dev typescript @types/node @types/express @types/mongoose ts-node
```

---

## 2. File Structure & Naming Conventions

Create the following directory structure to maintain separation of concerns:

```
src/
├── config/
│   └── env.ts              # Environment variable validation
├── models/
│   └── Otp.ts              # MongoDB Schema for OTP storage
├── services/
│   └── otpService.ts       # Core business logic for SMSindia integration
├── controllers/
│   └── authController.ts   # HTTP handlers for OTP endpoints
└── utils/
    └── smsHelpers.ts       # Helper functions (normalization, formatting)
```

---

## 3. Implementation Details

### 3.1 Configuration (`.env`)
Create a `.env` file in the project root.

```properties
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/your_database_name

# SMS India HUB Configuration
# Obtain these credentials from your SMS India HUB dashboard
SMS_INDIA_HUB_API_KEY=your_api_key_here
SMS_INDIA_HUB_SENDER_ID=your_sender_id_here  # e.g., SPEEUP
SMS_INDIA_HUB_DLT_TEMPLATE_ID=your_dlt_template_id_here
SMS_INDIA_HUB_URL=http://cloud.smsindiahub.in/vendorsms/pushsms.aspx

# Feature Flags
USE_MOCK_OTP=false  # Set to true for local development without sending real SMS
APP_NAME=YourAppName
```

### 3.2 Database Model (`src/models/Otp.ts`)
This schema handles OTP storage with automatic expiration (TTL).

```typescript
import mongoose, { Document, Schema } from 'mongoose';

export type UserType = 'Admin' | 'Seller' | 'Customer' | 'Delivery';

export interface IOtp extends Document {
  mobile: string;
  otp: string;
  userType: UserType;
  expiresAt: Date;
  isVerified: boolean;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v); // Validate 10-digit format
        },
        message: 'Mobile number must be 10 digits',
      },
    },
    otp: { type: String, required: true, trim: true },
    userType: {
      type: String,
      required: true,
      enum: ['Admin', 'Seller', 'Customer', 'Delivery'],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete after expiry
    },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index for faster lookups
OtpSchema.index({ mobile: 1, userType: 1 });

export default mongoose.model<IOtp>('Otp', OtpSchema);
```

### 3.3 Core Service (`src/services/otpService.ts`)
This service handles the API communication and logic.

```typescript
import axios from 'axios';
import Otp, { UserType } from '../models/Otp';

const API_KEY = process.env.SMS_INDIA_HUB_API_KEY;
const SENDER_ID = process.env.SMS_INDIA_HUB_SENDER_ID;
const API_URL = process.env.SMS_INDIA_HUB_URL || 'http://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
const DLT_TEMPLATE_ID = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID;

// Helper: Normalize Mobile Number (ensure 91 prefix)
const normalizeMobile = (mobile: string) => {
  let clean = mobile.replace(/\D/g, '');
  if (!clean.startsWith('91')) clean = '91' + clean;
  return clean;
};

// Helper: Generate 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

export const sendSmsOtp = async (mobile: string, userType: UserType) => {
  const otp = generateOTP();
  
  // 1. Mock Mode Check
  if (process.env.USE_MOCK_OTP === 'true') {
    await saveOtpToDb(mobile, otp, userType);
    console.log(`[MOCK] OTP for ${mobile}: ${otp}`);
    return { success: true, message: 'OTP sent (Mock)', sessionId: `MOCK_${mobile}` };
  }

  // 2. Developer Bypass (Fixed OTP for testing)
  if (mobile === '9999999999') {
     await saveOtpToDb(mobile, '1234', userType);
     return { success: true, message: 'OTP sent', sessionId: `DEV_${mobile}` };
  }

  // 3. Real SMS Sending
  try {
    const params: any = {
      APIKey: API_KEY,
      msisdn: normalizeMobile(mobile),
      sid: SENDER_ID,
      msg: `Your OTP is ${otp}. Valid for 5 minutes.`,
      fl: '0',
      gwid: '2',
    };
    
    if (DLT_TEMPLATE_ID) {
        params.DLT_TE_ID = DLT_TEMPLATE_ID;
    }

    const response = await axios.get(API_URL, { params });
    
    // Check for specific SMS India HUB error codes
    // Note: SMS India HUB often returns 200 OK even for errors, so check response body
    if (response.data.ErrorCode && response.data.ErrorCode !== '000') {
       throw new Error(`SMS Provider Error: ${response.data.ErrorMessage || response.data.ErrorCode}`);
    }

    await saveOtpToDb(mobile, otp, userType);
    return { success: true, message: 'OTP sent successfully' };
  } catch (error: any) {
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

async function saveOtpToDb(mobile: string, otp: string, userType: UserType) {
  const normalizedMobile = mobile.replace(/\D/g, '');
  await Otp.deleteMany({ mobile: normalizedMobile, userType }); // Clear old OTPs
  await Otp.create({
    mobile: normalizedMobile,
    otp,
    userType,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });
}

export const verifySmsOtp = async (mobile: string, otp: string, userType: UserType) => {
  // Developer Backdoor
  if (otp === '999999' && process.env.NODE_ENV !== 'production') return true;

  const normalizedMobile = mobile.replace(/\D/g, '');
  const record = await Otp.findOne({ mobile: normalizedMobile, userType, otp });

  if (!record) return false;
  
  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: record._id });
    return false; // Expired
  }

  await Otp.deleteOne({ _id: record._id }); // Consume OTP
  return true;
};
```

---

## 4. Security Best Practices

1.  **Environment Variables**: NEVER hardcode `SMS_INDIA_HUB_API_KEY` or `SENDER_ID` in the code. Always use `dotenv`.
2.  **Rate Limiting**: Implement `express-rate-limit` on the OTP generation endpoint to prevent SMS flooding/spamming.
    ```typescript
    import rateLimit from 'express-rate-limit';
    export const otpLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Limit each IP to 5 OTP requests per window
      message: 'Too many OTP requests, please try again later.'
    });
    ```
3.  **OTP Expiration**: Ensure the database (MongoDB) handles cleanup via the `expiresAt` TTL index.
4.  **One-Time Use**: Delete the OTP record immediately after successful verification to prevent replay attacks.
5.  **Input Validation**: Strictly validate that `mobile` is 10 digits and `otp` is 4 digits before processing.

---

## 5. Error Handling & Retry Logic

The SMS India HUB API returns error codes in the response body.

| Error Code | Meaning | Action |
| :--- | :--- | :--- |
| `000` | Success | Proceed. |
| `001` | Account details blank | Check API Key/Sender ID configuration. |
| `006` | Invalid DLT Template | Verify the message content matches the DLT template exactly. |
| `007` | Invalid API Key | Rotate or check API Key. |
| `021` | Insufficient Credits | Alert admin/monitoring system to recharge. |

**Retry Logic**:
*   Do **not** automatically retry on `006` (Template Error) or `007` (Auth Error) as these are configuration issues.
*   For network timeouts (Axios error), implement a max of 1 retry with exponential backoff.

---

## 6. Testing Strategy

### 6.1 Unit Test Cases
1.  **Generate OTP**: Verify OTP is 4 digits.
2.  **Mock Mode**: Verify `sendSmsOtp` returns success without making network calls when `USE_MOCK_OTP=true`.
3.  **Expiry**: Create an OTP with `expiresAt` in the past, verify `verifySmsOtp` returns `false`.

### 6.2 Integration Test Cases
1.  **Full Flow**: Call `sendSmsOtp` -> Fetch OTP from DB -> Call `verifySmsOtp` -> Expect `true`.
2.  **Invalid OTP**: Call `sendSmsOtp` -> Call `verifySmsOtp` with wrong code -> Expect `false`.
3.  **Rate Limit**: Hit the endpoint 6 times in 1 minute -> Expect HTTP 429.

---

## 7. Final Validation Checklist

- [ ] **Environment**: `.env` file exists with all SMS India HUB keys.
- [ ] **Database**: MongoDB is running and `Otp` collection is created.
- [ ] **Dependencies**: `axios` and `mongoose` installed.
- [ ] **DLT Compliance**: Message content in `otpService.ts` matches the approved DLT template exactly.
- [ ] **Connectivity**: `curl` request to SMS India HUB URL succeeds from the server.
- [ ] **Mock Mode**: Set `USE_MOCK_OTP=true` and verified logs show the OTP.
- [ ] **Production**: Set `USE_MOCK_OTP=false` and verified a real SMS is received on a phone.
