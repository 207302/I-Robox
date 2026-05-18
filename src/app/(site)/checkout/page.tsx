"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/utils/formatePrice";
import { orderShippingInrFromLines } from "@/lib/checkout/orderShipping";
import { toRazorpayPrefillContact } from "@/lib/marketing/contactPhoneUtils";
import { useSession } from "@/hooks/useSession";
import { usePublicMarketing } from "@/hooks/usePublicMarketing";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useSession();
  const { data: marketingData } = usePublicMarketing();
  const { cartDetails, totalPrice, clearCart } = useCart();
  const items = useMemo(() => Object.values(cartDetails ?? {}), [cartDetails]);

  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponBreakdown, setCouponBreakdown] = useState<{
    code: string;
    discount: number;
    discountedSubtotal: number;
  } | null>(null);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [signedInLabel, setSignedInLabel] = useState<string | null>(null);
  const [freeShippingThresholdInr, setFreeShippingThresholdInr] = useState<number | null>(2000);

  const previewSubtotal = Number(totalPrice || 0);

  const deliveryCharge = useMemo(() => {
    return orderShippingInrFromLines({
      subtotalBeforeDiscount: previewSubtotal,
      lines: items.map((item) => ({
        quantity: Number(item.quantity || 0),
        shippingPerUnit: Math.max(0, Number(item.shippingPerUnit ?? 0)),
      })),
      freeShippingThresholdInr,
    });
  }, [items, previewSubtotal, freeShippingThresholdInr]);
  const previewDiscount = couponBreakdown?.discount ?? 0;
  const previewTotal = Math.max(0, previewSubtotal - previewDiscount) + deliveryCharge;

  useEffect(() => {
    const threshold = marketingData?.freeShippingThresholdInr;
    if (typeof threshold === "number" || threshold === null) {
      setFreeShippingThresholdInr(threshold);
    }
  }, [marketingData?.freeShippingThresholdInr]);

  useEffect(() => {
    setCouponBreakdown(null);
  }, [items, couponCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pre = sessionStorage.getItem("irobox_prefill_coupon");
    if (pre) {
      setCouponCode((prev) => (prev.trim() ? prev : pre));
      sessionStorage.removeItem("irobox_prefill_coupon");
    }
  }, []);

  const [address, setAddress] = useState({
    full_name: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
  });

  useEffect(() => {
    if (sessionLoading || !user?.id) return;
    const userEmail = user.email?.trim() ?? "";
    setSignedInLabel(userEmail || "your account");
    if (userEmail) {
      setAddress((a) => (a.email.trim() ? a : { ...a, email: userEmail }));
    }
  }, [sessionLoading, user]);

  async function ensureRazorpayScript() {
    if (typeof window === "undefined") return false;
    if (window.Razorpay) return true;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
      document.body.appendChild(script);
    });
    return Boolean(window.Razorpay);
  }

  async function handlePlaceOrder() {
    if (!items.length) {
      toast.error("Your cart is empty");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        items: items.map((i) => ({ productId: String(i.id), quantity: i.quantity })),
        address,
        couponCode: couponCode.trim() || undefined,
        isGift,
        giftMessage: giftMessage.trim() || undefined,
      };

      const ready = await ensureRazorpayScript();
      if (!ready || !window.Razorpay) throw new Error("Razorpay checkout is unavailable");

      const createRes = await fetch("/api/payment/razorpay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(createData?.error || "Could not initiate payment");
      const checkoutSeal =
        typeof createData?.checkoutSeal === "string" ? createData.checkoutSeal : "";

      const prefillEmail = address.email.trim();
      const prefillContact = toRazorpayPrefillContact(address.phone);
      const prefillName = address.full_name.trim();
      const prefill: Record<string, string> = {};
      if (prefillName) prefill.name = prefillName;
      if (prefillEmail) prefill.email = prefillEmail;
      if (prefillContact) prefill.contact = prefillContact;

      const rz = new window.Razorpay({
        key: createData.keyId,
        amount: createData.amount,
        currency: createData.currency || "INR",
        order_id: createData.razorpayOrderId,
        name: "i-Robox",
        description: "Order payment",
        ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/payment/razorpay/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                ...payload,
                checkoutSeal,
                razorpayOrderId: response?.razorpay_order_id,
                razorpayPaymentId: response?.razorpay_payment_id,
                razorpaySignature: response?.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) throw new Error(verifyData?.error || "Payment verification failed");
            if (verifyData?.passwordSetupIncluded) {
              toast.success("We emailed you a password setup link with your order details.", {
                duration: 6500,
              });
            }
            clearCart();
            const tokenQuery =
              typeof verifyData?.accessToken === "string" && verifyData.accessToken
                ? `?access=${encodeURIComponent(verifyData.accessToken)}`
                : "";
            router.replace(`/orders/${verifyData.orderId}${tokenQuery}`);
          } catch (err: any) {
            toast.error(err?.message || "Payment was received but verification failed");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.error("Payment cancelled");
          },
        },
      });
      rz.open();
    } catch (e: any) {
      toast.error(e?.message || "Checkout failed");
      setLoading(false);
    } finally {
      // Keep loading while Razorpay modal is open.
    }
  }

  async function handleApplyCoupon() {
    const code = couponCode.trim();
    if (!code) {
      toast.error("Enter a coupon code first");
      return;
    }
    if (!items.length) {
      toast.error("Your cart is empty");
      return;
    }
    setCouponApplying(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          subtotal: Number(totalPrice || 0),
          lineItems: items.map((i) => ({ productId: String(i.id), quantity: i.quantity })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Coupon is not valid for this cart");

      const discount = Number(data?.discount ?? 0);
      const discountedSubtotal = Number(data?.total ?? Math.max(0, Number(totalPrice || 0) - discount));
      setCouponBreakdown({
        code,
        discount: Math.max(0, discount),
        discountedSubtotal: Math.max(0, discountedSubtotal),
      });
      toast.success("Coupon applied");
    } catch (err: any) {
      setCouponBreakdown(null);
      toast.error(err?.message || "Could not apply coupon");
    } finally {
      setCouponApplying(false);
    }
  }

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <h1 className="text-2xl font-semibold text-dark mb-8">Checkout</h1>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,_1fr)_380px]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-3 bg-white p-5">
              <h2 className="text-lg font-semibold text-dark">Shipping address</h2>
              {signedInLabel ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-dark">
                  <p className="text-meta-3">
                    You appear signed in as <span className="font-medium text-dark">{signedInLabel}</span>.
                    Orders from this checkout are linked to your signed-in account.
                  </p>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ["full_name", "Full name"],
                    ["email", "Email"],
                    ["phone", "Phone"],
                    ["line1", "Address line 1"],
                    ["line2", "Address line 2 (optional)"],
                    ["city", "City"],
                    ["state", "State"],
                    ["postal_code", "Postal code"],
                    ["country", "Country"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className={key === "line1" || key === "line2" ? "sm:col-span-2" : ""}>
                    <span className="mb-1 block text-sm font-medium text-dark">{label}</span>
                    <input
                      value={(address as any)[key]}
                      onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                      required={key !== "line2"}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-3 bg-white p-5">
              <h2 className="text-lg font-semibold text-dark">Gift options</h2>
              <label className="mt-3 flex items-center gap-2 text-sm text-meta-3">
                <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
                Mark this order as a gift
              </label>
              {isGift ? (
                <textarea
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                  placeholder="Gift message (optional)"
                  rows={3}
                />
              ) : null}
            </div>
          </div>

          <aside className="rounded-2xl border border-gray-3 bg-white p-5 h-fit">
            <h2 className="text-lg font-semibold text-dark">Order summary</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-meta-3">Subtotal</span>
                <span className="font-medium text-dark">{formatPrice(previewSubtotal)}</span>
              </div>
              {couponBreakdown ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-meta-3">Coupon ({couponBreakdown.code.toUpperCase()})</span>
                    <span className="font-medium text-dark">−{formatPrice(couponBreakdown.discount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-meta-3">Discounted subtotal</span>
                    <span className="font-semibold text-dark">
                      {formatPrice(couponBreakdown.discountedSubtotal)}
                    </span>
                  </div>
                </>
              ) : null}
              {couponBreakdown && couponBreakdown.discount > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-meta-3">Discount</span>
                  <span className="font-medium text-dark">−{formatPrice(couponBreakdown.discount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="text-meta-3">Delivery charge</span>
                <span className="font-medium text-dark">{formatPrice(deliveryCharge)}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-gray-3 pt-3">
                <span className="font-medium text-dark">Total</span>
                <span className="text-lg font-semibold text-dark">{formatPrice(previewTotal)}</span>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-dark">Coupon</span>
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none focus:border-blue"
                  placeholder="Enter coupon code"
                />
              </label>
              <button
                type="button"
                disabled={couponApplying || !couponCode.trim() || !items.length}
                onClick={handleApplyCoupon}
                className="inline-flex rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition disabled:opacity-60"
              >
                {couponApplying ? "Applying…" : "Apply coupon"}
              </button>
            </div>

            <button
              disabled={loading}
              onClick={handlePlaceOrder}
              className="mt-6 inline-flex w-full justify-center rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
            >
              {loading ? "Starting payment…" : "Pay now"}
            </button>
            <p className="mt-3 text-xs text-meta-4">
              You will be redirected to Razorpay to complete payment securely.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

