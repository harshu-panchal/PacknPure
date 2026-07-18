import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clipboard } from "lucide-react";
import Lottie from "lottie-react";
import { useCart } from "../context/CartContext";
import { cartKey } from "@/shared/utils/variantHelpers";
import { BRAND_COLOR } from "../constants/brandTheme";
import CheckoutCartItemRow from "../components/checkout/CheckoutCartItemRow";
import DeliveryModeSelector from "../components/checkout/DeliveryModeSelector";
import { useDeliveryMode } from "../hooks/useDeliveryMode";
import emptyBoxAnimation from "../../../assets/lottie/Empty box.json";

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function CartPage() {
  const navigate = useNavigate();
  const { cart, cartCount, updateQuantity, removeFromCart } = useCart();
  // Delivery Mode feature: admin-controlled Express/Slot options + persisted selection
  const {
    options: deliveryModeOptions,
    selection: deliverySelection,
    selectExpress,
    selectSlot,
  } = useDeliveryMode();

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  if (cart.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Lottie animationData={emptyBoxAnimation} loop className="h-36 w-36 md:h-40 md:w-40" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-800">Your cart is empty</h2>
        <p className="mb-6 max-w-xs text-center text-sm text-slate-500">
          Add items from home — your selected pack sizes will show here.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          Browse products <ChevronRight size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 font-sans">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
            aria-label="Go back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-900">Your cart</h1>
            <p className="text-xs text-slate-500">
              {cartCount} {cartCount === 1 ? "item" : "items"} · {formatInr(cartTotal)}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="grid items-start gap-4 lg:grid-cols-5 lg:gap-6">
          <div className="space-y-4 lg:col-span-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Your items</h3>
              <div className="space-y-4">
                {cart.map((item) => {
                  const productId = item.productId || item.id || item._id;
                  const variantId = item.variantId || item.selectedVariantId || null;
                  const lineKey = cartKey(productId, variantId);
                  return (
                    <CheckoutCartItemRow
                      key={lineKey}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeFromCart}
                    />
                  );
                })}
              </div>
            </section>

            {/* Delivery Mode feature: Express / Slot selector (admin controlled) */}
            <DeliveryModeSelector
              options={deliveryModeOptions}
              selection={deliverySelection}
              onSelectExpress={selectExpress}
              onSelectSlot={selectSlot}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-20">
              <div className="mb-4 flex items-center gap-2">
                <Clipboard size={18} className="text-brand-600" />
                <h2 className="text-sm font-semibold text-slate-900">Bill details</h2>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Item total</span>
                  <span className="font-semibold text-slate-900">{formatInr(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery</span>
                  <span className="font-semibold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-slate-900">
                  <span>Grand total</span>
                  <span>{formatInr(cartTotal)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/checkout")}
                className="mt-4 w-full rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: BRAND_COLOR }}
              >
                Continue to checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
