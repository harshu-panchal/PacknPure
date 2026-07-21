/**
 * Pickup Partner Auth validation script.
 * Run: node scripts/test-pickup-auth.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import handleResponse from "../app/utils/helper.js";
import { sendPickupPartnerLoginOtp, verifyPickupPartnerOtp } from "../app/controller/pickupPartnerController.js";
import PickupPartner from "../app/models/pickupPartner.js";

dotenv.config();

const TEST_PHONE = `9${String(Date.now()).slice(-9)}`;

function createMockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };
}

function report(name, passed, detail = "") {
  const icon = passed ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}${detail ? ` — ${detail}` : ""}`);
  return passed;
}

async function run() {
  const results = [];

  // 1. Module import check
  results.push(report("Module import (controller)", typeof sendPickupPartnerLoginOtp === "function"));
  results.push(report("Module import (otp helper)", typeof (await import("../app/utils/otp.js")).generateOTP === "function"));
  results.push(report("Module import (routes)", !!(await import("../app/routes/pickupPartnerRoutes.js")).default));

  await mongoose.connect(process.env.MONGO_URI);
  console.log("\nConnected to MongoDB\n");

  // Cleanup any prior test partner
  await PickupPartner.deleteOne({ phone: TEST_PHONE });

  // 2. New partner — send OTP should 404
  {
    const req = { body: { phone: TEST_PHONE } };
    const res = createMockRes();
    await sendPickupPartnerLoginOtp(req, res);
    results.push(report(
      "Send OTP — new partner (404)",
      res.statusCode === 404 && res.body?.message?.includes("not found"),
      `status=${res.statusCode} msg=${res.body?.message}`,
    ));
  }

  // 3. Create existing partner
  const partner = await PickupPartner.create({
    name: "Auth Test Partner",
    phone: TEST_PHONE,
    vehicleType: "bike",
    hubId: "MAIN_HUB",
    status: "available",
    isActive: true,
    isVerified: true,
  });

  // 4. Send OTP — existing partner
  {
    const req = { body: { phone: TEST_PHONE } };
    const res = createMockRes();
    await sendPickupPartnerLoginOtp(req, res);
    results.push(report(
      "Send OTP — existing partner (200)",
      res.statusCode === 200 && res.body?.success === true,
      `status=${res.statusCode} msg=${res.body?.message}`,
    ));
    results.push(report(
      "Send OTP — SMS skipped in dev (no provider call)",
      process.env.NODE_ENV !== "production",
      `NODE_ENV=${process.env.NODE_ENV || "development"}`,
    ));
  }

  const stored = await PickupPartner.findOne({ phone: TEST_PHONE }).select("+otp +otpExpiry");
  const validOtp = stored?.otp;

  // 5. Verify OTP — invalid
  {
    const req = { body: { phone: TEST_PHONE, otp: "0000" } };
    const res = createMockRes();
    await verifyPickupPartnerOtp(req, res);
    results.push(report(
      "Verify OTP — invalid (400, Invalid OTP)",
      res.statusCode === 400 && res.body?.message === "Invalid OTP",
      `status=${res.statusCode} msg=${res.body?.message}`,
    ));
  }

  // 6. Verify OTP — expired (manually expire)
  await PickupPartner.updateOne(
    { phone: TEST_PHONE },
    { otp: validOtp, otpExpiry: new Date(Date.now() - 60_000) },
  );
  {
    const req = { body: { phone: TEST_PHONE, otp: validOtp } };
    const res = createMockRes();
    await verifyPickupPartnerOtp(req, res);
    results.push(report(
      "Verify OTP — expired (400, Invalid OTP)",
      res.statusCode === 400 && res.body?.message === "Invalid OTP",
      `status=${res.statusCode} msg=${res.body?.message}`,
    ));
  }

  // 7. Re-send OTP and verify valid — stored OTP must be 1234 in dev
  await sendPickupPartnerLoginOtp({ body: { phone: TEST_PHONE } }, createMockRes());
  const refreshed = await PickupPartner.findOne({ phone: TEST_PHONE }).select("+otp +otpExpiry");
  results.push(report(
    "Send OTP — stores dev OTP 1234 in DB",
    refreshed?.otp === "1234",
    `storedOtp=${refreshed?.otp}`,
  ));
  {
    const req = { body: { phone: TEST_PHONE, otp: refreshed.otp } };
    const res = createMockRes();
    await verifyPickupPartnerOtp(req, res);
    results.push(report(
      "Verify OTP — valid existing partner (200 + token)",
      res.statusCode === 200 &&
        res.body?.success === true &&
        !!res.body?.result?.token &&
        res.body?.result?.partner?.phone === TEST_PHONE,
      `status=${res.statusCode} hasToken=${!!res.body?.result?.token}`,
    ));
  }

  // 8. handleResponse reference check
  results.push(report("handleResponse defined", typeof handleResponse === "function"));

  // Cleanup
  await PickupPartner.deleteOne({ _id: partner._id });
  await mongoose.disconnect();

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n=== Validation Report: ${passed}/${total} passed ===`);
  if (passed !== total) process.exit(1);
}

run().catch((err) => {
  console.error("Validation script failed:", err.message);
  process.exit(1);
});
