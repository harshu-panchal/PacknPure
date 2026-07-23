import {
  findVariantByBarcode,
  getVariantBarcodeValue,
  looksLikePacknPureBarcode,
  normalizeBarcodeScan,
} from "../app/services/posProviders/barcodeLookup.js";

describe("POS barcodeLookup helpers", () => {
  test("normalizeBarcodeScan trims and strips newlines", () => {
    expect(normalizeBarcodeScan("  PNP-ADM-00000001\r\n")).toBe("PNP-ADM-00000001");
  });

  test("looksLikePacknPureBarcode accepts admin and seller identities", () => {
    expect(looksLikePacknPureBarcode("PNP-ADM-00000001")).toBe(true);
    expect(looksLikePacknPureBarcode("PNP-SLR-00000099")).toBe(true);
    expect(looksLikePacknPureBarcode("rice")).toBe(false);
    expect(looksLikePacknPureBarcode("")).toBe(false);
  });

  test("findVariantByBarcode matches admin barcodeValue", () => {
    const product = {
      ownerType: "admin",
      variants: [
        { _id: "1", name: "1kg", barcodeValue: "PNP-ADM-00000001" },
        { _id: "2", name: "2kg", barcodeValue: "PNP-ADM-00000002" },
      ],
    };
    const hit = findVariantByBarcode(product, "PNP-ADM-00000002", {
      ownerType: "admin",
    });
    expect(hit?.name).toBe("2kg");
  });

  test("findVariantByBarcode matches seller sellerBarcodeValue", () => {
    const product = {
      ownerType: "seller",
      variants: [
        { _id: "1", name: "1kg", sellerBarcodeValue: "PNP-SLR-00000001" },
      ],
    };
    const hit = findVariantByBarcode(product, "PNP-SLR-00000001", {
      ownerType: "seller",
    });
    expect(hit?.name).toBe("1kg");
    expect(getVariantBarcodeValue(hit, "seller")).toBe("PNP-SLR-00000001");
  });

  test("getVariantBarcodeValue prefers Phase-1 fields", () => {
    expect(
      getVariantBarcodeValue({ barcodeValue: "PNP-ADM-1", barcode: "legacy" }, "admin"),
    ).toBe("PNP-ADM-1");
  });
});
