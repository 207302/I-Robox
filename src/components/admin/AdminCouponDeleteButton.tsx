"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

type Props = {
  couponId: string;
  couponCode: string;
  className?: string;
  redirectTo?: string;
};

export function AdminCouponDeleteButton({
  couponId,
  couponCode,
  className,
  redirectTo,
}: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const ok = window.confirm(`Delete coupon "${couponCode}"? This cannot be undone.`);
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete");
      toast.success("Coupon deleted");
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={() => void handleDelete()}
      className={
        className ?? "text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
      }
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
