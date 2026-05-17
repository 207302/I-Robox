"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AUTH_CHANGED_EVENT } from "@/lib/auth/clientSession";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to log out");

      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not log out");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="inline-flex rounded-lg border border-gray-3 px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition disabled:opacity-60"
    >
      {busy ? "Logging out..." : "Log out"}
    </button>
  );
}

