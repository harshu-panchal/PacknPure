import { jest } from "@jest/globals";

const mockPickupPartnerFindOne = jest.fn();
const mockPickupPartnerFindById = jest.fn();
const mockPickupPartnerCreate = jest.fn();
const mockHandleResponse = jest.fn();

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
}));

jest.unstable_mockModule("../app/utils/otp.js", () => ({
  generateOTP: jest.fn().mockReturnValue("1234"),
  useRealSMS: jest.fn().mockReturnValue(false),
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
    });

    it("returns 404 when partner does not exist (new partner)", async () => {
      req.body = { phone: "9999999999" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      await sendPickupPartnerLoginOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(
        res,
        404,
        "Pickup partner not found or inactive",
      );
    });

    it("sends OTP for existing active verified partner", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const partner = {
        phone: "9876543210",
        isActive: true,
        isVerified: true,
        save,
      };
      req.body = { phone: "9876543210" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(partner),
      });

      await sendPickupPartnerLoginOtp(req, res);

      expect(partner.otp).toBe("1234");
      expect(partner.otpExpiry).toBeInstanceOf(Date);
      expect(save).toHaveBeenCalled();
      expect(mockHandleResponse).toHaveBeenCalledWith(res, 200, "OTP sent successfully");
    });

    it("returns 404 for inactive partner", async () => {
      req.body = { phone: "8888888888" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          phone: "8888888888",
          isActive: false,
          isVerified: true,
        }),
      });

      await sendPickupPartnerLoginOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(
        res,
        404,
        "Pickup partner not found or inactive",
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

    it("returns 400 for invalid OTP", async () => {
      req.body = { phone: "9876543210", otp: "0000" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      await verifyPickupPartnerOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(res, 400, "Invalid or expired OTP");
    });

    it("returns 400 for expired OTP", async () => {
      req.body = { phone: "9876543210", otp: "1234" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      await verifyPickupPartnerOtp(req, res);
      expect(mockHandleResponse).toHaveBeenCalledWith(res, 400, "Invalid or expired OTP");
    });

    it("returns 200 with token for valid OTP on existing partner", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const partner = {
        _id: "partner-id-1",
        phone: "9876543210",
        name: "Test Partner",
        vehicleType: "bike",
        hubId: "MAIN_HUB",
        status: "available",
        otp: "1234",
        otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
        save,
      };
      req.body = { phone: "9876543210", otp: "1234" };
      mockPickupPartnerFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(partner),
      });

      await verifyPickupPartnerOtp(req, res);

      expect(partner.otp).toBeUndefined();
      expect(partner.otpExpiry).toBeUndefined();
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
    it("otp utility imports without ReferenceError", async () => {
      const otp = await import("../app/utils/otp.js");
      expect(typeof otp.generateOTP).toBe("function");
      expect(typeof otp.useRealSMS).toBe("function");
    });

    it("pickup partner routes import without ReferenceError", async () => {
      await expect(import("../app/routes/pickupPartnerRoutes.js")).resolves.toBeDefined();
    });
  });
});
