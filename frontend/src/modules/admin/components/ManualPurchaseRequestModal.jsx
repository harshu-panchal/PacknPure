import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import Modal from "@shared/components/ui/Modal";
import ManualPurchaseRequestTable from "./ManualPurchaseRequestTable";
import { adminApi } from "../services/adminApi";

export const ManualPurchaseRequestModal = ({ isOpen, onClose, supplier, onSuccess }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && supplier?._id) {
      setProducts([]);
      setFormValues({});
      fetchProducts();
    }
  }, [isOpen, supplier]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getProducts({
        page: 1,
        limit: 150,
        ownerType: "seller",
        sellerId: supplier._id,
      });
      const payload = res?.data?.result || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      // Filter only active listed products
      setProducts(items.filter((p) => String(p.status).toLowerCase() === "active"));
    } catch (err) {
      toast.error("Failed to load seller products list");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const items = [];
    Object.entries(formValues).forEach(([key, val]) => {
      if (val.quantity > 0) {
        // Prefer explicit ids stored on the row value (avoids fragile key parsing).
        let productId = val.productId;
        let variantId = val.variantId;
        if (!productId) {
          const sep = key.indexOf("_");
          productId = sep >= 0 ? key.slice(0, sep) : key;
          const rest = sep >= 0 ? key.slice(sep + 1) : "";
          variantId = !rest || rest === "no_variant" ? null : rest;
        }

        items.push({
          productId,
          variantId: variantId || undefined,
          quantity: val.quantity,
          notes: val.notes || "",
        });
      }
    });

    if (items.length === 0) {
      toast.error("Please specify a quantity greater than 0 for at least one item");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Creating manual purchase request...");
    try {
      await adminApi.createManualPR({
        vendorId: supplier._id,
        items,
      });
      toast.success("Manual purchase request sent successfully!", { id: toastId });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create manual purchase request", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Send Manual Purchase Request · ${supplier?.shopName || supplier?.name || "Vendor"}`}
      size="xl"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-150 disabled:opacity-50"
            disabled={submitting || loading || products.length === 0}
          >
            {submitting ? "Sending..." : "Send Request"}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4" />
          Loading supplier listing and stock data...
        </div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-slate-500">
            Select products and enter quantities to send a standalone manual purchase request to the seller. Committed stock will be locked immediately.
          </p>
          <ManualPurchaseRequestTable
            products={products}
            values={formValues}
            onChange={setFormValues}
          />
        </div>
      )}
    </Modal>
  );
};

export default ManualPurchaseRequestModal;
