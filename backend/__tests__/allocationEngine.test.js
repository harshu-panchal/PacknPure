import { jest, describe, test, expect } from "@jest/globals";
import { rankSellerAllocations } from "../app/services/allocationEngine.js";

describe("allocationEngine rankSellerAllocations", () => {
  test("allocates shortage to candidate seller even if listed stock is 0", async () => {
    const Product = (await import("../app/models/product.js")).default;
    const baseProduct = {
      _id: "507f1f77bcf86cd799439011",
      name: "Test Tomato",
      ownerType: "admin",
    };

    const spy = jest.spyOn(Product, "find").mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: "507f1f77bcf86cd799439022",
          name: "Test Tomato",
          sellerId: {
            _id: "507f1f77bcf86cd799439033",
            location: { coordinates: [75.5, 21.0] },
            rating: 4.5,
          },
          stock: 0,
          price: 40,
          variants: [{ name: "Default", stock: 0, price: 40 }],
        },
      ]),
    }));

    const allocations = await rankSellerAllocations({
      baseProduct,
      shortageQty: 5,
      hubLat: 21.0,
      hubLng: 75.5,
    });

    expect(allocations).toHaveLength(1);
    expect(allocations[0].vendorId).toBe("507f1f77bcf86cd799439033");
    expect(allocations[0].allocatedQty).toBe(5);

    spy.mockRestore();
  });
});
