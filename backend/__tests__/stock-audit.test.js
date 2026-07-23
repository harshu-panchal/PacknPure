import {
  buildAuditReportRows,
} from "../app/services/stockAudit/stockAuditService.js";

describe("stockAuditService helpers", () => {
  test("buildAuditReportRows computes Matched / Short / Over", () => {
    const rows = buildAuditReportRows({
      lines: [
        {
          productName: "Rice",
          variantName: "1kg",
          barcodeValue: "PNP-ADM-1",
          expectedQty: 10,
          countedQty: 10,
        },
        {
          productName: "Rice",
          variantName: "2kg",
          barcodeValue: "PNP-ADM-2",
          expectedQty: 10,
          countedQty: 7,
        },
        {
          productName: "Sugar",
          variantName: "1kg",
          barcodeValue: "PNP-ADM-3",
          expectedQty: 5,
          countedQty: 8,
        },
      ],
    });

    expect(rows[0].status).toBe("Matched");
    expect(rows[0].difference).toBe(0);
    expect(rows[1].status).toBe("Short");
    expect(rows[1].difference).toBe(-3);
    expect(rows[2].status).toBe("Over");
    expect(rows[2].difference).toBe(3);
  });
});
