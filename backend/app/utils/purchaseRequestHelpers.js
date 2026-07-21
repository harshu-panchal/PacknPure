const toMoney = (value) => Math.max(0, Number(Number(value || 0).toFixed(2)));

export function mapPrItemsDetailed(items = []) {
  return (items || []).map((row) => {
    const qty = Number(row.shortageQty || row.requiredQty || 0);
    const unitCost = Number(row.vendorUnitCost || 0);
    const gstAmount = Number(row.gstAmount || 0);
    const lineSubtotal = toMoney(unitCost * qty);
    return {
      productId: row.productId?._id || row.productId || null,
      productName: row.productId?.name || "Product",
      mainImage: row.productId?.mainImage || null,
      unit: row.productId?.unit || "Unit",
      requiredQty: Number(row.requiredQty || 0),
      shortageQty: Number(row.shortageQty || 0),
      requestedQty: Number(row.requestedQty || row.shortageQty || 0),
      remainingQty: Number(row.remainingQty ?? row.shortageQty ?? 0),
      committedQty: Number(row.committedQty || 0),
      rejectedQty: Number(row.rejectedQty || 0),
      lineStatus: row.lineStatus || "pending",
      variantId: row.variantId || null,
      itemKey: row.itemKey || null,
      unitCost,
      vendorQuotedPrice: Number(row.vendorQuotedPrice || unitCost),
      pricingStrategy: row.pricingStrategy || "",
      gstRate: Number(row.gstRate || 0),
      gstAmount,
      quantity: qty,
      lineSubtotal,
      totalCost: toMoney(lineSubtotal + gstAmount),
    };
  });
}

export function summarizePrPricing(items = []) {
  const mapped = mapPrItemsDetailed(items);
  const subtotal = mapped.reduce((sum, row) => sum + row.lineSubtotal, 0);
  const gstTotal = mapped.reduce((sum, row) => sum + row.gstAmount, 0);
  return {
    subtotal: toMoney(subtotal),
    gstTotal: toMoney(gstTotal),
    grandTotal: toMoney(subtotal + gstTotal),
    itemCount: mapped.length,
  };
}

export function mapPrKeyDates(doc = {}, extras = {}) {
  const vendorStatus = String(doc.vendorResponse?.status || "pending");
  return {
    requestedAt: doc.createdAt || null,
    confirmedAt:
      vendorStatus === "accepted" || vendorStatus === "partial"
        ? doc.vendorResponse?.respondedAt || null
        : null,
    vendorRespondedAt: doc.vendorResponse?.respondedAt || null,
    vendorReadyAt: doc.vendorReadyAt || null,
    pickupAssignedAt: doc.pickupAssignedAt || null,
    handoverAt:
      doc.vendorHandover?.otpVerifiedAt || doc.vendorHandover?.confirmedAt || null,
    pickedAt: doc.pickupProof?.pickedAt || null,
    hubDeliveredAt: doc.hubDropProof?.droppedAt || null,
    receivedAtHub: doc.receivedAtHubAt || extras.receivedAtHub || null,
    verifiedAt: doc.verifiedAt || extras.verifiedAt || null,
    updatedAt: doc.updatedAt || null,
    eta: doc.eta || null,
  };
}

export function buildPrTimeline(doc = {}, extras = {}) {
  const events = [];
  const push = (key, label, at, meta = {}) => {
    if (!at) return;
    events.push({
      key,
      label,
      at: new Date(at).toISOString(),
      ...meta,
    });
  };

  push("created", "Request created", doc.createdAt, { status: "created" });

  if (doc.vendorResponse?.respondedAt) {
    const vr = String(doc.vendorResponse.status || "pending");
    const label =
      vr === "accepted"
        ? "Vendor confirmed"
        : vr === "rejected"
          ? "Vendor rejected"
          : vr === "partial"
            ? "Vendor partially accepted"
            : "Vendor responded";
    push("vendor_response", label, doc.vendorResponse.respondedAt, {
      status: vr,
      notes: doc.vendorResponse.notes || doc.vendorResponse.rejectionReason || "",
    });
  }

  push("vendor_ready", "Marked ready for pickup", doc.vendorReadyAt, {
    notes: doc.vendorReadyNotes || "",
  });

  push(
    "pickup_assigned",
    "Pickup partner assigned",
    doc.pickupAssignedAt ||
      (doc.pickupPartnerId && !["created"].includes(String(doc.status))
        ? doc.updatedAt
        : null),
    {
      partner:
        doc.pickupPartnerId?.name ||
        doc.pickupPartnerName ||
        extras.pickupPartnerName ||
        "",
    },
  );

  push(
    "handover",
    "Seller handover (OTP verified)",
    doc.vendorHandover?.otpVerifiedAt || doc.vendorHandover?.confirmedAt,
    { notes: doc.vendorHandover?.notes || "" },
  );

  push("picked", "Picked up from vendor", doc.pickupProof?.pickedAt, {
    notes: doc.pickupProof?.notes || "",
    imageUrl: doc.pickupProof?.vendorImageUrl || "",
  });

  push("hub_delivered", "Delivered to hub gate", doc.hubDropProof?.droppedAt, {
    notes: doc.hubDropProof?.notes || "",
    imageUrl: doc.hubDropProof?.hubImageUrl || "",
  });

  push(
    "received_at_hub",
    "Received at hub (inward)",
    doc.receivedAtHubAt || extras.receivedAtHub,
  );

  push("verified", "Verified & stocked", doc.verifiedAt || extras.verifiedAt);

  if (String(doc.status) === "cancelled") {
    push("cancelled", "Request cancelled", doc.updatedAt);
  }
  if (String(doc.status) === "exception") {
    push("exception", "Exception raised", doc.vendorResponse?.respondedAt || doc.updatedAt, {
      reason: doc.exceptionReason || "",
    });
  }

  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  return events;
}

export { toMoney as prToMoney };
