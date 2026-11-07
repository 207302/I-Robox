"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderHref: string;
};

/** Payment-link returns can beat the webhook. Refresh until the order is paid. */
export default function ThankYouAwaiting({ orderHref }: Props) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      if (attempts >= 16) {
        window.clearInterval(id);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, 2500);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <section className="bg-gray-1 pb-20">
      <div className="relative overflow-hidden bg-dark px-4 pb-16 pt-[220px] text-white sm:px-8 sm:pt-[232px]">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(196,30,58,0.55), transparent 36%), radial-gradient(circle at 90% 10%, rgba(255,255,255,0.08), transparent 28%)",
          }}
        />
        <div className="relative mx-auto max-w-xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
            Payment received
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
            Confirming your order
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
            {gaveUp
              ? "The bank has your payment. We’re still writing it onto the order — this usually takes a moment."
              : "Both sides of the payment are checking in. This page will open your receipt as soon as the order is confirmed."}
          </p>
          <div className="mx-auto mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-blue" />
          </div>
          <Link
            href={orderHref}
            className="mt-8 inline-flex rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Open order details
          </Link>
        </div>
      </div>
    </section>
  );
}
