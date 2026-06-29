"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { takePendingLoginWelcome } from "@/lib/auth/clientSession";
import { useSession } from "@/hooks/useSession";

export default function LoginWelcomePopup() {
  const { displayName, user, isLoading } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !user || !displayName) return;

    const fromUrl = searchParams.get("welcome") === "1";
    const fromPending = takePendingLoginWelcome();

    if (!fromUrl && !fromPending) return;

    setOpen(true);

    if (fromUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("welcome");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [isLoading, user, displayName, searchParams, pathname, router]);

  if (!open || !displayName) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative w-full max-w-md rounded-2xl border border-gray-3 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-welcome-title"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg px-2 py-1 text-sm text-meta-3 hover:bg-gray-1 hover:text-dark"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          ✕
        </button>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue">i-Robox</p>
        <h2 id="login-welcome-title" className="mt-2 pr-6 text-2xl font-bold text-dark">
          Welcome, {displayName}!
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-meta-3">
          Your world of fun starts here. Explore RC cars, diecast models, and collectibles — and
          don&apos;t forget to leave a review after your order arrives.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/shop"
            className="inline-flex rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-dark"
            onClick={() => setOpen(false)}
          >
            Start shopping
          </Link>
          <button
            type="button"
            className="inline-flex rounded-lg border border-gray-3 px-4 py-2.5 text-sm font-medium text-dark hover:bg-gray-1"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
