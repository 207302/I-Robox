"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<"confirm" | "fail" | null>(null);

  async function call(path: string) {
    setLoading(path.includes("confirm") ? "confirm" : "fail");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          accessToken: searchParams.get("access") ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Request failed");
      const confirmed = path.includes("confirm");
      toast.success(confirmed ? "Payment confirmed" : "Payment failed");
      const token = searchParams.get("access");
      const tokenQuery = token ? `?access=${encodeURIComponent(token)}` : "";
      router.push(
        confirmed ? `/orders/${orderId}/thank-you${tokenQuery}` : `/orders/${orderId}${tokenQuery}`
      );
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-xl sm:px-6">
        <div className="rounded-2xl border border-gray-3 bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-dark">Payment</h1>
          <p className="mt-2 text-sm text-meta-3">
            This is a placeholder payment screen. The important part is that confirmation happens
            on the server before the order is marked confirmed and inventory is deducted.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              disabled={loading !== null}
              onClick={() => call("/api/payment/confirm")}
              className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition disabled:opacity-60"
            >
              {loading === "confirm" ? "Confirming…" : "Simulate success"}
            </button>
            <button
              disabled={loading !== null}
              onClick={() => call("/api/payment/fail")}
              className="rounded-lg bg-dark px-4 py-2.5 text-sm font-medium text-white hover:bg-opacity-95 transition disabled:opacity-60"
            >
              {loading === "fail" ? "Failing…" : "Simulate failure"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

