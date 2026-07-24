import React, { useMemo } from "react";
import Input from "@shared/components/ui/Input";

export const ManualPurchaseRequestTable = ({ products, values = {}, onChange }) => {
  const tableRows = useMemo(() => {
    const list = [];
    if (!Array.isArray(products)) return list;

    for (const product of products) {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length > 0) {
        for (const variant of variants) {
          list.push({
            key: `${product._id}_${variant._id}`,
            productId: product._id,
            variantId: variant._id,
            name: product.name,
            variantName: variant.name,
            image: product.mainImage,
            sku: variant.sellerBarcodeId || variant.barcodeId || product.sellerBarcodeId || product.barcodeId || "—",
            unit: variant.unit || product.unit || "Pieces",
            stock: Math.max(0, Number(variant.stock) || 0),
            sellingPrice: variant.price || variant.salePrice || product.price || product.salePrice || 0,
            procurementPrice: variant.purchasePrice || product.purchasePrice || 0,
          });
        }
      } else {
        list.push({
          key: `${product._id}_no_variant`,
          productId: product._id,
          variantId: null,
          name: product.name,
          variantName: "—",
          image: product.mainImage,
          sku: product.sellerBarcodeId || product.barcodeId || "—",
          unit: product.unit || "Pieces",
          stock: Math.max(0, Number(product.stock) || 0),
          sellingPrice: product.price || product.salePrice || 0,
          procurementPrice: product.purchasePrice || 0,
        });
      }
    }
    return list;
  }, [products]);

  const handleQtyChange = (key, maxStock, valString) => {
    let val = parseInt(valString, 10);
    if (isNaN(val) || val < 0) val = 0;

    if (val > maxStock) {
      // Limit to max stock
      val = maxStock;
    }

    const current = values[key] || { quantity: 0, notes: "" };
    onChange({
      ...values,
      [key]: {
        ...current,
        quantity: val,
      },
    });
  };

  const handleNotesChange = (key, notes) => {
    const current = values[key] || { quantity: 0, notes: "" };
    onChange({
      ...values,
      [key]: {
        ...current,
        notes,
      },
    });
  };

  if (tableRows.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 rounded-2xl bg-slate-50">
        No active products or stock found for this seller.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
      <table className="w-full text-left border-collapse text-xs sm:text-sm bg-white">
        <thead>
          <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider">
            <th className="px-4 py-3 shrink-0">Product</th>
            <th className="px-4 py-3">Variant</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3 text-right">Stock</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Procurement</th>
            <th className="px-4 py-3 w-28">PR Qty</th>
            <th className="px-4 py-3 min-w-[150px]">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tableRows.map((row) => {
            const rowVal = values[row.key] || { quantity: 0, notes: "" };
            const isSelected = rowVal.quantity > 0;

            return (
              <tr key={row.key} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? "bg-indigo-50/10" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-150 bg-slate-50">
                      {row.image ? (
                        <img src={row.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-400 bg-slate-100">N/A</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate max-w-[150px] sm:max-w-[200px]" title={row.name}>
                        {row.name}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tight font-semibold mt-0.5">{row.unit}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 font-medium">{row.variantName}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{row.sku}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">
                  {row.stock > 0 ? (
                    <span className="text-slate-800">{row.stock}</span>
                  ) : (
                    <span className="text-rose-500 font-bold uppercase text-[10px]">Out of stock</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">₹{row.sellingPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-slate-500 font-medium">
                  {row.procurementPrice > 0 ? `₹${row.procurementPrice.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    max={row.stock}
                    value={rowVal.quantity || ""}
                    placeholder="0"
                    onChange={(e) => handleQtyChange(row.key, row.stock, e.target.value)}
                    disabled={row.stock <= 0}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 font-bold text-slate-800 focus:border-indigo-400 outline-none text-center bg-slate-50/50 focus:bg-white transition-all disabled:opacity-50 disabled:bg-slate-100"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={rowVal.notes || ""}
                    placeholder="Optional details..."
                    onChange={(e) => handleNotesChange(row.key, e.target.value)}
                    disabled={row.stock <= 0}
                    className="w-full h-8 px-3.5 rounded-lg border border-slate-200 text-xs focus:border-indigo-400 outline-none bg-slate-50/50 focus:bg-white transition-all disabled:opacity-50 disabled:bg-slate-100"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ManualPurchaseRequestTable;
