import { jest } from "@jest/globals";

const mockPickupPartnerFindOne = jest.fn();
const mockPickupPartnerFindById = jest.fn();
const mockPickupPartnerCreate = jest.fn();
const mockHandleResponse = jest.fn();
const mockSendSmsOtp = jest.fn();
const mockVerifySmsOtp = jest.fn();

jest.unstable_mockModule("../app/models/pickupPartner.js", () => ({
  default: {
    findOne: mockPickupPartnerFindOne,
    findById: mockPickupPartnerFindById,
    create: mockPickupPartnerCreate,
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.unstable_mockModule("../app/models/purchaseRequest.js", () => ({
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn().mockResolvedValue([]),
  },
}));

jest.unstable_mockModule("../app/models/delivery.js", () => ({
  default: { findById: jest.fn() },
}));

jest.unstable_mockModule("../app/services/purchaseRequestService.js", () => ({
  savePurchaseRequest: jest.fn(),
  isPickupEligibleLine: jest.fn(),
  buildItemKey: jest.fn(),
  releaseAllocationSellerStock: jest.fn(),
}));

jest.unstable_mockModule("../app/utils/helper.js", () => ({
  default: mockHandleResponse,
  handleResponse: mockHandleResponse,
}));

jest.unstable_mockModule("../app/services/settingsService.js", () => ({
  getPickupOtpTimeoutMinutes: jest.fn().mockResolvedValue(10),
  getProcurementFailureAction: jest.fn().mockResolvedValue("notify_admin"),
}));

jest.unstable_mockModule("../app/services/otpService.js", () => ({
  sendSmsOtp: mockSendSmsOtp,
  verifySmsOtp: mockVerifySmsOtp,
}));

const { sendPickupPartnerLoginOtp, verifyPickupPartnerOtp } = await import(
  "../app/controller/pickupPartnerController.js"
);

describe("Pickup Partner Authentication", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHandleResponse.mockImplementation((resArg, status, message, data = {}) => {
      const success = status >= 200 && status < 300;
      return resArg.status(status).json({
        success,
        error: !success,
        message,
        result: data,
      });
    });
  });

  describe("sendPickupPartnerLoginOtp", () => {
    it("returns 400 when phone is missing", async () => {
      req.body = {};
      await sendPickupPartnerLoginOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(res, 400, "phone is required");
      expect(mockSendSmsOtp).not.toHaveBeenCalled();
    });

    it("returns 404 when partner does not exist (new partner)", async () => {
      req.body = { phone: "9999999999" };
      mockPickupPartnerFindOne.mockResolvedValue(null);
      await sendPickupPartnerLoginOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(
        res,
        404,
        "Pickup partner not found or inactive",
      );
      expect(mockSendSmsOtp).not.toHaveBeenCalled();
    });

    it("dispatches a real SMS OTP for an existing active verified partner", async () => {
      const partner = {
        phone: "9876543210",
        isActive: true,
        isVerified: true,
      };
      req.body = { phone: "9876543210" };
      mockPickupPartnerFindOne.mockResolvedValue(partner);
      mockSendSmsOtp.mockResolvedValue({
        success: true,
        message: "OTP sent successfully",
        sessionId: "SESSION123",
      });

      await sendPickupPartnerLoginOtp(req, res);

      // OTP must be dispatched via the shared SMS India Hub service — never
      // defaulted to a fixed value — using a dedicated "PickupPartner" userType.
      expect(mockSendSmsOtp).toHaveBeenCalledWith("9876543210", "PickupPartner");
      expect(mockHandleResponse).toHaveBeenCalledWith(
        res,
        200,
        "OTP sent successfully",
        expect.objectContaining({ sessionId: "SESSION123" }),
      );
    });

    it("returns 404 for inactive partner", async () => {
      req.body = { phone: "8888888888" };
      mockPickupPartnerFindOne.mockResolvedValue({
        phone: "8888888888",
        isActive: false,
        isVerified: true,
      });

      await sendPickupPartnerLoginOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(
        res,
        404,
        "Pickup partner not found or inactive",
      );
      expect(mockSendSmsOtp).not.toHaveBeenCalled();
    });

    it("propagates an SMS dispatch failure as an error response", async () => {
      req.body = { phone: "9876543210" };
      mockPickupPartnerFindOne.mockResolvedValue({
        phone: "9876543210",
        isActive: true,
        isVerified: true,
      });
      mockSendSmsOtp.mockRejectedValue(new Error("Failed to send SMS: SMS Provider Error [006]"));

      await sendPickupPartnerLoginOtp(req, res);

      expect(mockHandleResponse).toHaveBeenCalledWith(
        res,
        500,
        "Failed to send SMS: SMS Provider Error [006]",
      );
    });
  });

  describe("verifyPickupPartnerOtp", () => {
    it("returns 400 when phone or otp is missing", async () => {
      req.body = { phone: "9876543210" };
      await verifyPickupPartnerOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(
        res,
        400,
        "phone and otp are required",
      );
    });

    it("returns 400 when partner does not exist", async () => {
      req.body = { phone: "9876543210", otp: "4821" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      await verifyPickupPartnerOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(res, 400, "Invalid or expired OTP");
    });

    it("returns 400 for invalid/expired OTP", async () => {
      req.body = { phone: "9876543210", otp: "0000" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({ phone: "9876543210", otp: undefined, otpExpiry: undefined }),
      });
      mockVerifySmsOtp.mockResolvedValue(false);
      await verifyPickupPartnerOtp(req, res);
      expect(mockVerifySmsOtp).toHaveBeenCalledWith("9876543210", "0000", "PickupPartner");
      expect(mockHandleResponse).toHaveBeenCalledWith(res, 400, "Invalid or expired OTP");
    });

    it("returns 200 with token for a valid dynamically-generated OTP", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const partner = {
        _id: "partner-id-1",
        phone: "9876543210",
        name: "Test Partner",
        vehicleType: "bike",
        hubId: "MAIN_HUB",
        status: "available",
        otp: undefined,
        otpExpiry: undefined,
        save,
      };
      req.body = { phone: "9876543210", otp: "4821" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(partner),
      });
      mockVerifySmsOtp.mockResolvedValue(true);

      await verifyPickupPartnerOtp(req, res);

      expect(mockVerifySmsOtp).toHaveBeenCalledWith("9876543210", "4821", "PickupPartner");
      expect(save).toHaveBeenCalled();
      expect(mockHandleResponse).toHaveBeenCalledWith(
        res,
        200,
        "Login successful",
        expect.objectContaining({
          token: expect.any(String),
          partner: expect.objectContaining({
            _id: "partner-id-1",
            phone: "9876543210",
            role: "pickup_partner",
          }),
        }),
      );
    });
  });

  describe("module import safety", () => {
    it("otpService utility imports without ReferenceError", async () => {
      const otpService = await import("../app/services/otpService.js");
      expect(typeof otpService.sendSmsOtp).toBe("function");
      expect(typeof otpService.verifySmsOtp).toBe("function");
    });

    it("pickup partner routes import without ReferenceError", async () => {
      await expect(import("../app/routes/pickupPartnerRoutes.js")).resolves.toBeDefined();
    });
  });
});
