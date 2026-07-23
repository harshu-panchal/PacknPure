/**
 * Unit tests for isolated barcode identity generation & preservation.
 * Does not touch order/inventory/POS flows.
 */
import {
  preserveVariantBarcodes,
  stripClientBarcodeFields,
  collectBarcodeLabelRows,
  hasAdminBarcode,
  hasSellerBarcode,
} from "../app/services/barcode/barcodeService.js";
import { BARCODE_PREFIXES } from "../app/services/barcode/barcodeGenerator.js";

describe("barcodeService (isolated)", () => {
  test("stripClientBarcodeFields removes barcode identities from client payload", () => {
    const stripped = stripClientBarcodeFields([
      {
        name: "1kg",
        stock: 5,
        barcodeValue: "PNP-ADM-00000001",
        sellerBarcodeValue: "PNP-SLR-00000001",
      },
    ]);
    expect(stripped[0].name).toBe("1kg");
    expect(stripped[0].barcodeValue).toBeUndefined();
    expect(stripped[0].sellerBarcodeValue).toBeUndefined();
  });

  test("preserveVariantBarcodes keeps existing barcodes on matching variants", () => {
    const previous = [
      {
        _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
        name: "1kg",
        barcodeId: "PNP-ADM-00000001",
        barcodeValue: "PNP-ADM-00000001",
        barcodeGeneratedAt: new Date("2026-01-01"),
      },
    ];
    const next = [{ _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "1kg", stock: 10 }];
    const preserved = preserveVariantBarcodes(previous, next);
    expect(preserved[0].barcodeValue).toBe("PNP-ADM-00000001");
    expect(preserved[0].stock).toBe(10);
  });

  test("preserveVariantBarcodes does not invent barcodes for new variants", () => {
    const previous = [
      {
        _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
        name: "1kg",
        barcodeValue: "PNP-ADM-00000001",
      },
    ];
    const next = [
      { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "1kg" },
      { name: "2kg", stock: 3 },
    ];
    const preserved = preserveVariantBarcodes(previous, next);
    expect(hasAdminBarcode(preserved[0])).toBe(true);
    expect(hasAdminBarcode(preserved[1])).toBe(false);
  });

  test("collectBarcodeLabelRows returns admin barcodes only for admin products", () => {
    const product = {
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      name: "Rice",
      ownerType: "admin",
      variants: [
        {
          _id: "cccccccccccccccccccccccc",
          name: "1kg",
          barcodeValue: "PNP-ADM-00000002",
          barcodeId: "PNP-ADM-00000002",
          sellerBarcodeValue: "PNP-SLR-SHOULD-IGNORE",
        },
      ],
    };
    const rows = collectBarcodeLabelRows(product);
    expect(rows).toHaveLength(1);
    expect(rows[0].barcodeValue).toBe("PNP-ADM-00000002");
    expect(rows[0].variantName).toBe("1kg");
  });

  test("collectBarcodeLabelRows returns seller barcodes only for seller products", () => {
    const product = {
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      name: "Rice",
      ownerType: "seller",
      variants: [
        {
          _id: "cccccccccccccccccccccccc",
          name: "2kg",
          barcodeValue: "PNP-ADM-SHOULD-IGNORE",
          sellerBarcodeValue: "PNP-SLR-00000009",
          sellerBarcodeId: "PNP-SLR-00000009",
        },
      ],
    };
    const rows = collectBarcodeLabelRows(product);
    expect(rows).toHaveLength(1);
    expect(rows[0].barcodeValue).toBe("PNP-SLR-00000009");
  });

  test("barcode prefixes match required format", () => {
    expect(BARCODE_PREFIXES.ADMIN).toBe("PNP-ADM-");
    expect(BARCODE_PREFIXES.SELLER).toBe("PNP-SLR-");
  });

  test("hasSellerBarcode detects seller identity", () => {
    expect(hasSellerBarcode({ sellerBarcodeValue: "PNP-SLR-1" })).toBe(true);
    expect(hasSellerBarcode({})).toBe(false);
  });
});
