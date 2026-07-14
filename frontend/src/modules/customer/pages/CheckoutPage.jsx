import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate, useLocation as useRouteLocation } from "react-router-dom";
import Lottie from "lottie-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../../../core/context/AuthContext";
import { customerApi } from "../services/customerApi";
import { useLocation as useAppLocation } from "../context/LocationContext";
import {
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  ChevronRight,
  ChevronLeft,
  Share2,
  ChevronDown,
  Tag,
  Trash2,
  Plus,
  Search,
  X,
  Clipboard,
  Check,
  AlertCircle,
  Contact2,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import SlideToPay from "../components/shared/SlideToPay";
import { useCustomerLogin } from "../context/CustomerLoginContext";
import {
  getOrderSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onOrderStatusUpdate,
} from "@/core/services/orderSocket";
import CheckoutCollapsible from "../components/checkout/CheckoutCollapsible";
import CheckoutCartItemRow from "../components/checkout/CheckoutCartItemRow";
import { BRAND_COLOR } from "../constants/brandTheme";
import { cartKey } from "@/shared/utils/variantHelpers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import emptyBoxAnimation from "../../../assets/lottie/Empty box.json";
import MapPicker from "@/shared/components/MapPicker";

const CheckoutPage = () => {
  const {
    cart,
    cartTotal,
    cartCount,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();

  const appName = settings?.appName || "App";
  const { savedAddresses: locationSavedAddresses, currentLocation, refreshLocation, isFetchingLocation: isLocationFetching } =
    useAppLocation();
  const navigate = useNavigate();
  const routeLocation = useRouteLocation();

  // State management
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("now");
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [couponsExpanded, setCouponsExpanded] = useState(false);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [autoPromos, setAutoPromos] = useState([]); // Stores automatic promos for background evaluation
  const postOrderNavigateRef = useRef(null);
  const [currentAddress, setCurrentAddress] = useState({
    type: "Home",
    name: user?.name || "",
    address: "",
    landmark: "",
    city: "",
    phone: user?.phone || "",
    location: null,
  });
  const [deliveryFee, setDeliveryFee] = useState(20); // actual fee shown (0 when free)
  const [rawDeliveryFee, setRawDeliveryFee] = useState(20); // distance-based fee before threshold
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(500);
  const [distanceKm, setDistanceKm] = useState(0);
  const [platformFee, setPlatformFee] = useState(3);
  const [gstPercentage, setGstPercentage] = useState(5);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);

  // Dynamic delivery time calculation: 8m base + 3m per KM
  const deliveryTimeBase = 8 + Math.round(distanceKm * 3);
  const deliveryTimeRange = `${deliveryTimeBase}-${deliveryTimeBase + 5}`;

  const fetchDeliveryFee = async (location) => {
    if (!location?.lat || !location?.lng) return;
    if (!isAuthenticated) return;
    setIsCalculatingFee(true);
    try {
      const { data } = await customerApi.getDeliveryFee(location.lat, location.lng);
      const res = data.result;
      setDistanceKm(res.distanceKm || 0);
      setPlatformFee(res.platformFee ?? 3);
      setGstPercentage(res.gstPercentage ?? 5);
      setIsOutOfRange(res.isOutOfRange || false);
      setFreeDeliveryThreshold(res.freeDeliveryThreshold ?? 500);
      setRawDeliveryFee(res.deliveryFee ?? 20);
    } catch (error) {
      console.error("Failed to fetch delivery fee:", error);
      // Keep existing base fee fallback on failure
    } finally {
      setIsCalculatingFee(false);
    }
  };

  // Free delivery: if cart total >= threshold, delivery is free
  useEffect(() => {
    if (cartTotal >= freeDeliveryThreshold) {
      setDeliveryFee(0);
    } else {
      setDeliveryFee(rawDeliveryFee);
    }
  }, [cartTotal, freeDeliveryThreshold, rawDeliveryFee]);
  // Trigger fee calculation when address or GPS changes
  useEffect(() => {
    const loc = currentAddress.location || (currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null);
    if (loc) {
      fetchDeliveryFee(loc);
    }
  }, [currentAddress.location, currentLocation]);

  // Sync currentAddress with the first saved address when they load
  useEffect(() => {
    if (locationSavedAddresses.length > 0 && !currentAddress.address) {
      const addr = locationSavedAddresses[0];
      setCurrentAddress({
        type: addr.label || "Home",
        name: user?.name || addr.name || "Customer",
        address: addr.address || "",
        landmark: addr.landmark || "",
        city: addr.city || "",
        phone: user?.phone || addr.phone || "",
        location: addr.location || null,
      });
    }
  }, [locationSavedAddresses, user]);

  // Auto-refresh real GPS on mount for accurate distance calculation
  // Works silently if permission already granted; user can also tap the refresh button
  useEffect(() => {
    refreshLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [editAddressForm, setEditAddressForm] = useState({
    type: "Home",
    name: user?.name || "",
    address: "",
    landmark: "",
    city: "",
    phone: user?.phone || "",
  });
  const [showRecipientForm, setShowRecipientForm] = useState(false);
  const [recipientData, setRecipientData] = useState({
    // city: 'Select city',
    completeAddress: "",
    landmark: "",
    pincode: "",
    name: "",
    phone: "",
  });
  const [savedRecipient, setSavedRecipient] = useState(null);

  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapPickerMode, setMapPickerMode] = useState("recipient"); // 'recipient' or 'edit'

  const [manualCode, setManualCode] = useState("");

  const allPaymentMethods = useMemo(
    () => [
      {
        id: "cash",
        label: "Cash on Delivery",
        icon: Banknote,
        sublabel: "Pay after delivery",
      },
      {
        id: "online",
        label: "Pay Online (UPI/Card)",
        icon: Smartphone,
        sublabel: "Secure online payment",
      },
      {
        id: "wallet",
        label: "Wallet",
        icon: CreditCard,
        sublabel: "Use wallet balance",
      },
    ],
    [],
  );

  const paymentMethods = useMemo(
    () =>
      isAuthenticated
        ? allPaymentMethods
        : allPaymentMethods.filter((m) => m.id !== "wallet"),
    [allPaymentMethods, isAuthenticated],
  );

  useEffect(() => {
    if (!isAuthenticated && selectedPayment === "wallet") {
      setSelectedPayment("cash");
    }
  }, [isAuthenticated, selectedPayment]);

  // const deliveryFee = 0; // Now handled by state
  // const platformFee = 3; // Now handled by state

  const discountAmount = selectedCoupon
    ? selectedCoupon.discountAmount || selectedCoupon.discount || 0
    : 0;

  const totalAmount =
    cartTotal - discountAmount + deliveryFee + platformFee;

  const selectedPaymentLabel =
    paymentMethods.find((m) => m.id === selectedPayment)?.label ?? "Cash on Delivery";

  const RECIPIENT_STORAGE_KEY = "appzeto_checkout_recipient_v1";

  // Derived display values for primary delivery card
  const displayName = savedRecipient?.name || currentAddress.name || user?.name || "Select Address";
  const displayPhone =
    savedRecipient?.phone || currentAddress.phone || user?.phone || "";
  const displayAddress = savedRecipient
    ? `${savedRecipient.completeAddress}${savedRecipient.landmark ? `, ${savedRecipient.landmark}` : ""}${savedRecipient.pincode ? ` - ${savedRecipient.pincode}` : ""}`
    : currentAddress.address
      ? `${currentAddress.address}${currentAddress.landmark ? `, ${currentAddress.landmark}` : ""}${currentAddress.city ? `, ${currentAddress.city}` : ""}`
      : "Please select or add a delivery address";

  const handleSaveRecipient = () => {
    if (
      !recipientData.completeAddress ||
      !recipientData.name ||
      recipientData.phone.length !== 10
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSavedRecipient(recipientData);
    setShowRecipientForm(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          RECIPIENT_STORAGE_KEY,
          JSON.stringify(recipientData),
        );
      }
    } catch {
      // ignore storage errors
    }
    showToast("Recipient details saved!", "success");
  };

  const handleOpenEditAddress = () => {
    setEditAddressForm(currentAddress);
    setIsEditAddressOpen(true);
  };

  const handleSaveEditedAddress = () => {
    if (
      !editAddressForm.address?.trim() ||
      !editAddressForm.city?.trim()
    ) {
      showToast("Please fill address and city", "error");
      return;
    }
    setCurrentAddress(editAddressForm);
    setIsEditAddressOpen(false);
    showToast("Delivery address updated", "success");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${appName} Checkout`,
          text: `Hey! I'm ordering some goodies from ${appName}. Total: ₹${totalAmount}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard!", "success");
    }
  };

  const handleApplyCoupon = async (coupon) => {
    try {
      const payload = {
        code: coupon.code,
        cartTotal,
        items: cart,
        customerId: user?._id,
      };
      const res = await customerApi.validatePromotion(payload);
      if (res.data.success) {
        const data = res.data.result;
        setSelectedCoupon({
          ...coupon,
          ...data,
        });
        setIsCouponModalOpen(false);
        showToast(`Coupon ${coupon.code} applied!`, "success");
      } else {
        showToast(res.data.message || "Unable to apply coupon", "error");
      }
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to apply coupon",
        "error",
      );
    }
  };

  useEffect(() => {
    // Hydrate "order for someone else" address from localStorage, if present
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(RECIPIENT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.completeAddress && parsed.name && parsed.phone) {
            setRecipientData(parsed);
            setSavedRecipient(parsed);
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Fetch coupons whenever user changes (so new users get their eligible coupons)
  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const res = await customerApi.getActivePromotions({ customerId: user?._id }, { forceRefresh: true });
        if (res.data.success) {
          const list = res.data.result || res.data.results || [];

          // Separate automatic and manual promos
          const manualPromos = list.filter(p => p.promotionType !== 'automatic');
          setCoupons(manualPromos);

          const autoList = list.filter(p => p.promotionType === 'automatic' && p.autoApply);
          setAutoPromos(autoList);
        }
      } catch {
        // silently ignore
      }
    };
    fetchCoupons();
  }, [user?._id]);

  // Amazon-Style Dynamic Coupon Evaluation
  useEffect(() => {
    let isMounted = true;
    const evaluateCoupons = async () => {
      if (cartTotal <= 0) {
        setSelectedCoupon(null);
        return;
      }

      // If a manual coupon is applied, just re-validate it
      if (selectedCoupon && selectedCoupon.promotionType !== 'automatic') {
        if (!selectedCoupon.code) return;
        try {
          const res = await customerApi.validatePromotion({
            code: selectedCoupon.code,
            cartTotal,
            items: cart,
            customerId: user?._id,
          });
          if (isMounted) {
            if (res.data.success) {
              setSelectedCoupon(prev => ({ ...prev, ...res.data.result }));
            } else {
              // Manual coupon became invalid (e.g. cart total dropped below min threshold)
              setSelectedCoupon(null);
              showToast(res.data.message || `Coupon ${selectedCoupon.code} is no longer valid`, "error");
            }
          }
        } catch (e) {
          if (isMounted) setSelectedCoupon(null);
        }
        return; // Don't run automatic logic if a manual coupon is active
      }

      // Evaluate best automatic coupon
      if (autoPromos.length > 0) {
        let bestPromo = null;
        let maxDiscount = -1;
        for (const promo of autoPromos) {
          if (!promo.code) continue;
          try {
            const validationRes = await customerApi.validatePromotion({
              code: promo.code,
              cartTotal,
              items: cart,
              customerId: user?._id,
            });
            if (validationRes.data.success) {
              const discount = validationRes.data.result.discountAmount || 0;
              if (discount > maxDiscount) {
                maxDiscount = discount;
                bestPromo = { ...promo, ...validationRes.data.result };
              }
            }
          } catch (e) {
            // Ignore validation errors for silent auto-apply
          }
        }

        if (isMounted) {
          if (bestPromo) {
            setSelectedCoupon(bestPromo);
          } else if (selectedCoupon && selectedCoupon.promotionType === 'automatic') {
            // The previously applied automatic coupon is no longer valid
            setSelectedCoupon(null);
          }
        }
      }
    };

    evaluateCoupons();

    return () => {
      isMounted = false;
    };
  }, [cartTotal, cart, user, autoPromos, showToast]);

  const executePlaceOrder = useCallback(async () => {
    setIsPlacingOrder(true);
    try {
      const addressForOrder = savedRecipient
        ? {
          type: "Other",
          name: savedRecipient.name,
          address: savedRecipient.completeAddress,
          landmark: savedRecipient.landmark || "",
          city: savedRecipient.pincode ? `${savedRecipient.pincode}` : "",
          phone: savedRecipient.phone,
          location: savedRecipient.location || undefined,
        }
        : {
          ...currentAddress,
          location: currentAddress.location || undefined,
        };

      const rawLoc = addressForOrder.location || (currentLocation?.latitude ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null);
      const deliveryLoc = rawLoc ? { lat: Number(rawLoc.lat), lng: Number(rawLoc.lng) } : null;

      const checkoutPayload = {
        address: addressForOrder,
        deliveryCoords: deliveryLoc,
        couponCode: selectedCoupon ? selectedCoupon.code : null,
        walletToUse: 0, // Wallet integration is not fully active in online yet or handles its own
        deliverySlot: selectedTimeSlot,
        pricing: {
          subtotal: cartTotal,
          deliveryFee,
          platformFee,
          gst: 0,
          tip: 0,
          discount: selectedCoupon ? (selectedCoupon.discountAmount || selectedCoupon.discount || 0) : 0,
          total: totalAmount,
        },
        promotionId: selectedCoupon ? (selectedCoupon._id || selectedCoupon.promotionId) : null,
        timeSlot: selectedTimeSlot,
        items: cart.map((item) => ({
          product: item._id || item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
          variantId: item.variantId || item.selectedVariantId || undefined,
          variantSlot: [item.variantLabel || item.weight, item.unit].filter(Boolean).join(" · ") || undefined,
        })),
      };

      if (selectedPayment === "online") {
        // Online flow: ask backend to create Razorpay order + payment intent
        const res = await customerApi.createPaymentOrder({ checkout: checkoutPayload });
        if (!res.data.success) throw new Error(res.data.message || "Failed to create payment order");

        const data = res.data.result;
        // Load Razorpay SDK
        if (typeof window !== "undefined") {
          if (!window.Razorpay) {
            await new Promise((resolve, reject) => {
              const s = document.createElement("script");
              s.src = "https://checkout.razorpay.com/v1/checkout.js";
              s.onload = resolve;
              s.onerror = reject;
              document.body.appendChild(s);
            });
          }

          const options = {
            key: data.key,
            amount: data.amount,
            currency: data.currency,
            name: settings?.appName || "PacknPure",
            description: "Order Payment",
            order_id: data.razorpayOrderId,
            handler: async function (response) {
              // Verify on backend
              try {
                const verifyRes = await customerApi.verifyPayment({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  intentId: data.intentId,
                });

                if (verifyRes.data.success) {
                  const order = verifyRes.data.result?.order;
                  clearCart();
                  showToast("Payment successful — order confirmed", "success");
                  setOrderId(order.orderId);
                  setShowSuccess(true);
                  setTimeout(() => navigate(`/orders/${order.orderId}`), 2000);
                } else {
                  showToast(verifyRes.data.message || "Verification failed", "error");
                }
              } catch (err) {
                console.error("Verification error", err);
                showToast("Verification failed. Contact support.", "error");
              } finally {
                setIsPlacingOrder(false);
              }
            },
            modal: {
              ondismiss: function () {
                setIsPlacingOrder(false);
                showToast("Payment cancelled", "error");
              },
            },
            prefill: {
              name: user?.name,
              email: user?.email,
              contact: user?.phone,
            },
            theme: { color: BRAND_COLOR },
          };

          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      } else {
        // Non-online (wallet/cash) - keep existing behavior: place order immediately
        const orderData = {
          address: addressForOrder,
          payment: {
            method: selectedPayment,
            status: selectedPayment === "wallet" ? "completed" : "pending",
          },
          pricing: checkoutPayload.pricing,
          promotionId: checkoutPayload.promotionId,
          timeSlot: checkoutPayload.timeSlot,
          items: checkoutPayload.items,
        };

        const response = await customerApi.placeOrder(orderData);

        if (response.data.success) {
          const order = response.data.result;

          clearCart();
          showToast(`Order placed — processing at hub.`, "success");
          setOrderId(order.orderId);
          setShowSuccess(true);

          if (postOrderNavigateRef.current) {
            clearTimeout(postOrderNavigateRef.current);
          }
          postOrderNavigateRef.current = setTimeout(() => {
            postOrderNavigateRef.current = null;
            navigate(`/orders/${order.orderId}`);
          }, 3000);
        }
      }
    } catch (error) {
      console.error("Failed to place order:", error);
      showToast(
        error.response?.data?.message ||
        "Failed to place order. Please try again.",
        "error",
      );
      setIsPlacingOrder(false);
    }
  }, [
    savedRecipient,
    currentAddress,
    currentLocation,
    selectedPayment,
    cartTotal,
    deliveryFee,
    platformFee,
    discountAmount,
    totalAmount,
    selectedTimeSlot,
    cart,
    clearCart,
    showToast,
    navigate,
    settings,
    user,
  ]);

  const handlePlaceOrder = useCallback(() => {
    const hasAddress = savedRecipient?.completeAddress || currentAddress.address;
    if (!hasAddress) {
      showToast("Please add address then slide to pay", "error");
      return;
    }

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    executePlaceOrder();
  }, [isAuthenticated, navigate, executePlaceOrder, savedRecipient, currentAddress, showToast]);



  // After place order: listen for seller timeout / rejection (customer room + order room) and poll as fallback
  useEffect(() => {
    if (!orderId || !showSuccess) return undefined;

    const getToken = () => localStorage.getItem("auth_customer");
    getOrderSocket(getToken);
    joinOrderRoom(orderId, getToken);

    let pollId = null;

    const applyCancelled = (o) => {
      if (o.workflowStatus === "CANCELLED" || o.status === "cancelled") {
        if (postOrderNavigateRef.current) {
          clearTimeout(postOrderNavigateRef.current);
          postOrderNavigateRef.current = null;
        }
        if (pollId != null) clearInterval(pollId);
        setShowSuccess(false);
        showToast(
          "Order cancelled — seller did not accept in time.",
          "error",
        );
        navigate(`/orders/${orderId}`, { replace: true });
        return true;
      }
      return false;
    };

    const tick = () => {
      customerApi
        .getOrderDetails(orderId)
        .then((r) => {
          if (r.data?.result) applyCancelled(r.data.result);
        })
        .catch(() => { });
    };

    const off = onOrderStatusUpdate(getToken, tick);

    tick();
    pollId = setInterval(tick, 4000);

    return () => {
      off();
      if (pollId != null) clearInterval(pollId);
      leaveOrderRoom(orderId, getToken);
    };
  }, [orderId, showSuccess, navigate, showToast]);

  // Map-based precise location has been removed; manual addresses are used instead.

  if (cart.length === 0 && !showSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Lottie
            animationData={emptyBoxAnimation}
            loop
            className="h-36 w-36 md:h-40 md:w-40"
          />
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-800">
          Your cart is empty
        </h2>
        <p className="mb-6 max-w-xs text-center text-sm text-slate-500">
          Add items from home to checkout here.
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
            aria-label="Go back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="text-center">
            <h1 className="text-base font-bold text-slate-900">Checkout</h1>
            <p className="text-xs text-slate-500">
              {cartCount} {cartCount === 1 ? "item" : "items"} · ₹{totalAmount}
            </p>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
            aria-label="Share cart"
          >
            <Share2 size={18} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="grid items-start gap-4 lg:grid-cols-5 lg:gap-6">
          <div className="space-y-4 lg:col-span-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Delivery in {deliveryTimeRange} min
                  </p>
                  <p className="text-xs text-slate-500">
                    {cartCount} items in this order
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-slate-500 font-medium">
                  Ordering for someone else?
                </span>
                <button
                  onClick={() => setShowRecipientForm(!showRecipientForm)}
                  className="text-[#E23744] text-xs font-bold hover:underline">
                  {showRecipientForm
                    ? "Close"
                    : savedRecipient
                      ? "Change details"
                      : "Add details"}
                </button>
              </div>

              {savedRecipient && !showRecipientForm && (
                <div className="mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-[#E23744] flex-shrink-0">
                      <Contact2 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {savedRecipient.name}
                      </p>
                      <p className="text-xs text-[#E23744] font-bold mb-1">
                        {savedRecipient.phone}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">
                        {savedRecipient.completeAddress}
                        {savedRecipient.landmark &&
                          `, ${savedRecipient.landmark}`}
                        {savedRecipient.pincode &&
                          ` - ${savedRecipient.pincode}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSavedRecipient(null)}
                    className="text-red-500 text-xs font-bold hover:underline">
                    Remove
                  </button>
                </div>
              )}

              <AnimatePresence>
                {showRecipientForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden mb-4">
                    <div className="bg-[#f8f9fb] rounded-2xl p-4 border border-slate-100 space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-3">
                          Enter delivery address details
                        </h4>
                        <div className="space-y-3">
                          <div className="relative">
                            <Input
                              placeholder="Enter complete address*"
                              value={recipientData.completeAddress}
                              onChange={(e) =>
                                setRecipientData({
                                  ...recipientData,
                                  completeAddress: e.target.value,
                                })
                              }
                              className="h-12 rounded-xl border-slate-200 focus:ring-[#E23744] focus:border-[#E23744] text-sm pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setMapPickerMode("recipient");
                                setIsMapPickerOpen(true);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[#E23744] hover:text-[#c22e3a] transition-colors"
                            >
                              <MapPin size={16} />
                              <span className="text-xs font-bold">Map</span>
                            </button>
                          </div>

                          {/* Fetch location error handling was removed since we use MapPicker now */}
                          <Input
                            placeholder="Find landmark (optional)"
                            value={recipientData.landmark}
                            onChange={(e) =>
                              setRecipientData({
                                ...recipientData,
                                landmark: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl border-slate-200 focus:ring-[#E23744] focus:border-[#E23744] text-sm"
                          />
                          <Input
                            placeholder="Enter pin code (optional)"
                            value={recipientData.pincode}
                            onChange={(e) =>
                              setRecipientData({
                                ...recipientData,
                                pincode: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl border-slate-200 focus:ring-[#E23744] focus:border-[#E23744] text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-1">
                          Enter receiver details
                        </h4>
                        <p className="text-[10px] text-slate-400 mb-3 font-medium">
                          We'll contact receiver to get the exact delivery
                          address
                        </p>
                        <div className="space-y-3">
                          <Input
                            placeholder="Receiver's name*"
                            value={recipientData.name}
                            onChange={(e) =>
                              setRecipientData({
                                ...recipientData,
                                name: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl border-slate-200 focus:ring-[#E23744] focus:border-[#E23744] text-sm"
                          />
                          <div className="relative">
                            <Input
                              placeholder="Receiver's phone number*"
                              value={recipientData.phone}
                              onChange={(e) =>
                                setRecipientData({
                                  ...recipientData,
                                  phone: e.target.value,
                                })
                              }
                              className="h-12 rounded-xl border-slate-200 focus:ring-[#E23744] focus:border-[#E23744] text-sm pr-10"
                            />
                            <Contact2
                              size={18}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveRecipient}
                        className="h-12 w-full rounded-xl bg-brand-600 font-semibold text-white hover:bg-brand-700">
                        Save address
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <MapPicker
                isOpen={isMapPickerOpen}
                onClose={() => setIsMapPickerOpen(false)}
                onConfirm={(loc) => {
                  if (mapPickerMode === "recipient") {
                    setRecipientData(prev => ({
                      ...prev,
                      completeAddress: loc.address || prev.completeAddress,
                    }));
                  } else {
                    setEditAddressForm(prev => ({
                      ...prev,
                      address: loc.address || prev.address,
                      location: { lat: loc.lat, lng: loc.lng }
                    }));
                  }
                  setIsMapPickerOpen(false);
                  showToast("Location updated from map", "success");
                }}
                initialAddress={
                  mapPickerMode === "recipient"
                    ? recipientData.completeAddress
                    : editAddressForm.address
                }
                title={mapPickerMode === "recipient" ? "Select Delivery Location" : "Edit Delivery Location"}
                showRadius={false}
              />
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Delivery address
                </h3>
              </div>

              <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
                <div className="flex items-start gap-3">
                  {/* Radio/Check Button */}
                  <div className="mt-1">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600">
                      <Check size={12} className="stroke-[4] text-white" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-800 text-sm">
                        {displayName}
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditAddress();
                          }}
                          className="text-slate-500 text-xs font-bold hover:underline">
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAddressModalOpen(true);
                          }}
                          className="text-xs font-semibold text-brand-600 hover:underline">
                          Change
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {displayPhone}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {displayAddress}
                    </p>
                  </div>
                </div>
              </div>

              {/* Use current location button */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    showToast("Detecting your exact location...", "info");
                    const loc = await refreshLocation();
                    if (loc) {
                      setCurrentAddress((prev) => ({
                        ...prev,
                        address: loc.name,
                        landmark: "",
                        city: [loc.city, loc.state, loc.pincode].filter(Boolean).join(", "),
                        location: { lat: loc.latitude, lng: loc.longitude }
                      }));
                      setSavedRecipient(null); // Clear recipient to ensure UI shows the GPS location
                      showToast("Location updated successfully", "success");
                    }
                  } catch (err) {
                    showToast(err.message || "Failed to fetch GPS location", "error");
                  }
                }}
                className="mt-3 w-full py-2.5 rounded-2xl border border-dashed border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Use current location (from GPS)
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Your items
              </h3>
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
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-20">
              <div className="mb-4 flex items-center gap-2">
                <Clipboard size={18} className="text-brand-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Order summary
                </h2>
              </div>

              {isOutOfRange && (
                <div className="mb-4 flex gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <p className="text-xs text-brand-800">
                    This address is outside our delivery area. Choose a closer address.
                  </p>
                </div>
              )}

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Item total</span>
                  <span className="font-semibold text-slate-900">₹{cartTotal}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex flex-col">
                    <span>Delivery</span>
                    <button
                      type="button"
                      onClick={refreshLocation}
                      disabled={isCalculatingFee || isLocationFetching}
                      className="mt-0.5 flex w-fit items-center gap-1 text-[10px] font-medium text-brand-600 disabled:opacity-50"
                    >
                      {(isCalculatingFee || isLocationFetching) ? (
                        <span className="inline-block h-2 w-2 animate-spin rounded-full border border-brand-500 border-t-transparent" />
                      ) : (
                        <MapPin size={10} />
                      )}
                      {distanceKm > 0 ? `${distanceKm} km · ` : ""}
                      {isLocationFetching || isCalculatingFee ? "Updating…" : "Refresh"}
                    </button>
                  </span>
                  <span className="font-semibold text-slate-900">
                    {deliveryFee === 0 ? (
                      <span className="text-brand-600">FREE</span>
                    ) : isCalculatingFee || isLocationFetching ? (
                      "…"
                    ) : (
                      `₹${deliveryFee}`
                    )}
                  </span>
                </div>
                {deliveryFee > 0 && freeDeliveryThreshold > 0 && cartTotal < freeDeliveryThreshold && (
                  <p className="text-[11px] font-medium text-brand-700">
                    Add ₹{freeDeliveryThreshold - cartTotal} more for free delivery
                  </p>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Platform fee</span>
                  <span className="font-semibold text-slate-900">₹{platformFee}</span>
                </div>
                {selectedCoupon && (
                  <div className="flex justify-between text-brand-600">
                    <span className="flex items-center gap-1">
                      <Tag size={14} /> {selectedCoupon.code}
                    </span>
                    <span className="font-semibold">
                      -₹{selectedCoupon.discountAmount ?? selectedCoupon.discount ?? discountAmount}
                    </span>
                  </div>
                )}
              </div>

              <CheckoutCollapsible
                title="Coupons"
                subtitle={
                  selectedCoupon
                    ? `${selectedCoupon.code} applied`
                    : coupons.length
                      ? `${coupons.length} manual available`
                      : "No manual coupons"
                }
                icon={Tag}
                open={couponsExpanded}
                onToggle={() => setCouponsExpanded((v) => !v)}
              >
                {selectedCoupon ? (
                  <>
                    {selectedCoupon.promotionType !== 'automatic' && (
                      <button
                        type="button"
                        onClick={() => setSelectedCoupon(null)}
                        className="w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 mb-3"
                      >
                        Remove {selectedCoupon.code}
                      </button>
                    )}
                  </>
                ) : null}
                <div className="relative mb-3">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <Input
                    placeholder="Enter coupon code manually"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    className="pl-10 h-12 rounded-xl focus-visible:ring-[#E23744]"
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#E23744] font-bold text-xs"
                    onClick={async () => {
                      if (!manualCode.trim()) {
                        showToast("Please enter a coupon code", "error");
                        return;
                      }
                      try {
                        const res = await customerApi.validatePromotion({
                          code: manualCode.trim(),
                          cartTotal,
                          items: cart,
                          customerId: user?._id,
                        });
                        if (res.data.success) {
                          const data = res.data.result;
                          setSelectedCoupon({
                            code: manualCode.trim(),
                            description: "Applied manually",
                            ...data,
                          });
                          setManualCode(""); // clear after success
                          showToast(
                            `Coupon ${manualCode.trim()} applied!`,
                            "success",
                          );
                        } else {
                          showToast(res.data.message || "Invalid coupon", "error");
                        }
                      } catch (error) {
                        showToast(
                          error.response?.data?.message || "Invalid coupon",
                          "error",
                        );
                      }
                    }}>
                    CHECK
                  </button>
                </div>

                {coupons.slice(0, 2).map((coupon) => (
                  <div
                    key={coupon.code}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">{coupon.code}</p>
                      <p className="truncate text-[10px] text-slate-500">{coupon.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon(coupon)}
                      disabled={selectedCoupon?.code === coupon.code}
                      className="shrink-0 rounded-md bg-brand-600 px-2.5 py-1 text-[10px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </CheckoutCollapsible>

              <CheckoutCollapsible
                title="Payment"
                subtitle={selectedPaymentLabel}
                icon={CreditCard}
                open={paymentExpanded}
                onToggle={() => setPaymentExpanded((v) => !v)}
              >
                <div className="space-y-2">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const active = selectedPayment === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedPayment(method.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                          active
                            ? "border-[#E23744] bg-rose-50"
                            : "border-slate-200 hover:border-slate-300",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full",
                            active ? "bg-rose-100 text-[#E23744]" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-semibold", active ? "text-[#E23744]" : "text-slate-800")}>
                            {method.label}
                          </p>
                          <p className="text-xs text-slate-500">{method.sublabel}</p>
                        </div>
                        <span
                          className={cn(
                            "h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                            active ? "border-[#E23744]" : "border-slate-300",
                          )}
                        >
                          {active && <span className="h-2 w-2 rounded-full bg-[#E23744]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CheckoutCollapsible>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">To pay</span>
                  <span className="text-xl font-bold text-[#E23744]">₹{totalAmount}</span>
                </div>

                {!isAuthenticated && (
                  <p className="mb-3 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-center text-xs text-brand-800">
                    OTP login when you slide to pay — browse as guest until then.
                  </p>
                )}

                <div className="hidden lg:block">
                  <SlideToPay
                    amount={totalAmount}
                    onSuccess={handlePlaceOrder}
                    isLoading={isPlacingOrder}
                    disabled={isOutOfRange}
                    text="Slide to pay"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer - Mobile Only */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 py-3 shadow-lg lg:hidden">
        <div className="max-w-4xl mx-auto">
          <SlideToPay
            amount={totalAmount}
            onSuccess={handlePlaceOrder}
            isLoading={isPlacingOrder}
            disabled={isOutOfRange}
            text="Slide to Pay"
          />
        </div>
      </div>

      {/* Address Selection Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Delivery Address</DialogTitle>
            <DialogDescription>
              Choose where you want your order delivered.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {locationSavedAddresses.map((addr) => (
              <button
                key={addr.id}
                onClick={() => {
                  setCurrentAddress({
                    type: addr.label,
                    name: user?.name || currentAddress.name,
                    address: addr.address,
                    city: "", // already part of addr.address string
                    phone: addr.phone || currentAddress.phone,
                    landmark: "", // already baked into addr.address if present
                    location: addr.location,
                  });
                  setIsAddressModalOpen(false);
                }}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${currentAddress.id === addr.id
                  ? "border-[#E23744] bg-rose-50 shadow-sm"
                  : "border-slate-100 bg-white hover:border-slate-200"
                  }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`p-2 rounded-full ${currentAddress.id === addr.id ? "bg-[#E23744] text-white" : "bg-slate-100 text-slate-500"}`}>
                    <MapPin size={16} />
                  </div>
                  <span className="font-black text-slate-800 uppercase tracking-widest text-[10px]">
                    {addr.label}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {user?.name || currentAddress.name}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mb-1">
                  {addr.address}
                </p>
                {addr.phone && (
                  <p className="text-[11px] text-slate-400 font-medium">
                    Phone: {addr.phone}
                  </p>
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full border-rose-600 text-rose-600 hover:bg-rose-50"
              onClick={() => navigate("/addresses")}>
              <Plus size={16} className="mr-2" /> Add New Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Current Address Modal - slides up from bottom */}
      <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
        <DialogContent className="sm:max-w-[425px] overflow-hidden p-0">
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="p-6">
            <DialogHeader>
              <DialogTitle>Edit Delivery Address</DialogTitle>
              <DialogDescription>
                Update the details of your current delivery address.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label
                  htmlFor="edit-address"
                  className="text-xs font-semibold text-slate-700">
                  Address
                </Label>
                <div className="relative">
                  <Input
                    id="edit-address"
                    value={editAddressForm.address}
                    onChange={(e) =>
                      setEditAddressForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    className="h-10 pr-10"
                    placeholder="House, street, area"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMapPickerMode("edit");
                      setIsMapPickerOpen(true);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[#E23744] hover:text-[#c22e3a] transition-colors"
                  >
                    <MapPin size={16} />
                    <span className="text-xs font-bold">Map</span>
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="edit-landmark"
                  className="text-xs font-semibold text-slate-700">
                  Nearest Landmark (optional)
                </Label>
                <Input
                  id="edit-landmark"
                  value={editAddressForm.landmark || ""}
                  onChange={(e) =>
                    setEditAddressForm((prev) => ({
                      ...prev,
                      landmark: e.target.value,
                    }))
                  }
                  className="h-10"
                  placeholder="e.g. Near City Mall, Opp. Temple"
                />
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="edit-city"
                  className="text-xs font-semibold text-slate-700">
                  City / Pincode
                </Label>
                <Input
                  id="edit-city"
                  value={editAddressForm.city}
                  onChange={(e) =>
                    setEditAddressForm((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  className="h-10"
                  placeholder="City - Pincode"
                />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                onClick={() => setIsEditAddressOpen(false)}
                className="border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </Button>
              <Button
                onClick={handleSaveEditedAddress}
                className="bg-[#E23744] hover:bg-[#C41E35] text-white font-bold">
                Save changes
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center text-[#E23744] mb-6">
              <Check size={48} strokeWidth={4} />
            </motion.div>
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-black text-slate-800 mb-2">
              Order placed
            </motion.h2>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-slate-500 font-medium mb-8">
              #{orderId?.slice(-6)} — waiting for the seller to accept (60s). If
              they don&apos;t, the order will cancel automatically.
              <br />
              Redirecting to order details…
            </motion.p>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.5, ease: "linear" }}
              className="w-48 h-1.5 bg-rose-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#E23744]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style
        dangerouslySetInnerHTML={{
          __html: `
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `,
        }}
      />
    </div>
  );
};

export default CheckoutPage;
