"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { PAYMENT_RETRY_MAX_ATTEMPTS } from "@/lib/orders/paymentRetry";
import { trackPurchase, type PurchaseAnalyticsPayload } from "@/lib/analytics/trackPurchase";
import { toRazorpayPrefillContact } from "@/lib/marketing/contactPhoneUtils";

type RazorpayCtor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

type Props = {
  orderId: string;
  accessToken?: string | null;
  paymentRetryAttempts: number;
  canRetry: boolean;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  className?: string;
};

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

export default function RetryPaymentButton({
  orderId,
  accessToken,
  paymentRetryAttempts,
  canRetry,
  customerName,
  customerEmail,
  customerPhone,
  className,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const retriesRemaining = Math.max(0, PAYMENT_RETRY_MAX_ATTEMPTS - paymentRetryAttempts);

  async function recordRetryFailure() {
    await fetch("/api/payment/razorpay/record-failure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId,
        ...(accessToken ? { accessToken } : {}),
      }),
    });
  }

  async function handleRetry() {
    if (!canRetry || loading) return;
    setLoading(true);
    try {
      const ready = await ensureRazorpayScript();
      if (!ready || !window.Razorpay) throw new Error("Razorpay checkout is unavailable");

      const retryRes = await fetch("/api/payment/razorpay/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          ...(accessToken ? { accessToken } : {}),
        }),
      });
      const retryData = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) throw new Error(retryData?.error || "Could not start payment retry");

      const checkoutSeal =
        typeof retryData?.checkoutSeal === "string" ? retryData.checkoutSeal : "";
      const razorpayOrderId =
        typeof retryData?.razorpayOrderId === "string" ? retryData.razorpayOrderId : "";

      const prefill: Record<string, string> = {};
      if (customerName?.trim()) prefill.name = customerName.trim();
      if (customerEmail?.trim()) prefill.email = customerEmail.trim();
      const contact = toRazorpayPrefillContact(customerPhone ?? "");
      if (contact) prefill.contact = contact;

      const rz = new window.Razorpay({
        key: retryData.keyId,
        amount: retryData.amount,
        currency: retryData.currency || "INR",
        order_id: razorpayOrderId,
        name: "i-Robox",
        description: "Retry order payment",
        ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
        handler: async (response: Record<string, string | undefined>) => {
          try {
            const verifyRes = await fetch("/api/payment/razorpay/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                retryOrderId: orderId,
                checkoutSeal,
                razorpayOrderId: response?.razorpay_order_id,
                razorpayPaymentId: response?.razorpay_payment_id,
                razorpaySignature: response?.razorpay_signature,
                ...(accessToken ? { accessToken } : {}),
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) throw new Error(verifyData?.error || "Payment verification failed");
            if (
              verifyData?.purchase &&
              typeof (verifyData.purchase as PurchaseAnalyticsPayload).transaction_id === "string"
            ) {
              trackPurchase(verifyData.purchase as PurchaseAnalyticsPayload);
            }
            toast.success("Payment successful!");
            const tokenQuery =
              typeof verifyData?.accessToken === "string" && verifyData.accessToken
                ? `?access=${encodeURIComponent(verifyData.accessToken)}`
                : accessToken
                  ? `?access=${encodeURIComponent(accessToken)}`
                  : "";
            router.replace(`/orders/${orderId}${tokenQuery}`);
            router.refresh();
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Payment verification failed";
            toast.error(message, { duration: 8000 });
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: async () => {
            setLoading(false);
            try {
              const res = await fetch("/api/payment/razorpay/record-failure", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  orderId,
                  ...(accessToken ? { accessToken } : {}),
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (data?.exhausted) {
                toast.error("Payment retries used up. Check your email for next steps.");
              } else {
                toast.error("Payment cancelled. You can try again from your orders.");
              }
              router.refresh();
            } catch {
              await recordRetryFailure().catch(() => undefined);
              router.refresh();
            }
          },
        },
      });

      rz.on("payment.failed", async () => {
        setLoading(false);
        try {
          await recordRetryFailure();
          router.refresh();
        } catch {
          /* ignore */
        }
        toast.error("Payment failed. Try again from your orders.");
      });

      rz.open();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not retry payment";
      toast.error(message);
      setLoading(false);
    }
  }

  if (!canRetry) {
    return (
      <p className="text-sm text-meta-3">
        Payment retry limit reached ({PAYMENT_RETRY_MAX_ATTEMPTS} attempts). Please contact support
        if you need help.
      </p>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleRetry()}
        className="inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
      >
        {loading ? "Opening payment…" : "Retry payment"}
      </button>
      <p className="mt-2 text-xs text-meta-3">
        {retriesRemaining} retry attempt{retriesRemaining === 1 ? "" : "s"} remaining
      </p>
    </div>
  );
}
