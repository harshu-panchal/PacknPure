import {
  buildBarcodeCatalogFilter,
  flattenProductsToStickerRows,
} from "../app/services/barcode/barcodeCatalogService.js";

describe("barcodeCatalogService (management)", () => {
  test("seller filter always scopes to own sellerId", () => {
    const filter = buildBarcodeCatalogFilter(
      { role: "seller", id: "seller123" },
      { search: "rice" },
    );
    expect(filter.ownerType).toBe("seller");
    expect(filter.sellerId).toBe("seller123");
    expect(filter.$or?.length).toBeGreaterThan(0);
  });

  test("admin filter defaults to master catalog", () => {
    const filter = buildBarcodeCatalogFilter({ role: "admin", id: "a1" }, {});
    expect(filter.ownerType).toBe("admin");
    expect(filter.sellerId).toBeUndefined();
  });

  test("flattenProductsToStickerRows maps admin and seller barcode fields", () => {
    const rows = flattenProductsToStickerRows([
      {
        _id: "p1",
        name: "Rice",
        brand: "PNP",
        ownerType: "admin",
        variants: [
          {
            _id: "v1",
            name: "1kg",
            barcodeValue: "PNP-ADM-00000001",
            barcodeId: "PNP-ADM-00000001",
          },
          { _id: "v2", name: "2kg" },
        ],
      },
      {
        _id: "p2",
        name: "Sugar",
        ownerType: "seller",
        sellerId: "s1",
        variants: [
          {
            _id: "v3",
            name: "1kg",
            sellerBarcodeValue: "PNP-SLR-00000001",
          },
        ],
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0].hasBarcode).toBe(true);
    expect(rows[0].barcodeValue).toBe("PNP-ADM-00000001");
    expect(rows[1].hasBarcode).toBe(false);
    expect(rows[2].barcodeValue).toBe("PNP-SLR-00000001");
  });
});
