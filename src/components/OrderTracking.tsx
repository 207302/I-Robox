"use client";

import { useEffect, useState } from "react";
import {
  SHIPMOZO_TRACKING_STEPS,
  type ShipmozoTrackingStatus,
} from "@/lib/shipping/shipmozoTrackingConstants";
import { shipmozoPublicTrackUrl } from "@/lib/shipping/shipmozoPublicTrackUrl";

const BRAND_RED = "#E63946";

const STEP_LABELS: Record<ShipmozoTrackingStatus, string> = {
  ORDER_PLACED: "Order Placed",
  PICKUP_GENERATED: "Pickup Generated",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
};

type Props = {
  status: ShipmozoTrackingStatus;
  awb_number: string | null;
  carrier: string | null;
  shipment_updated_at: string | null;
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function OrderTracking({
  status,
  awb_number,
  carrier,
  shipment_updated_at,
}: Props) {
  const [relativeUpdated, setRelativeUpdated] = useState<string | null>(null);
  const currentIndex = Math.max(0, SHIPMOZO_TRACKING_STEPS.indexOf(status));

  useEffect(() => {
    if (!shipment_updated_at) {
      setRelativeUpdated(null);
      return;
    }
    const update = () => setRelativeUpdated(formatRelativeTime(shipment_updated_at));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [shipment_updated_at]);

  return (
    <div className="mt-4">
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="min-w-[520px] flex items-start justify-between gap-2">
          {SHIPMOZO_TRACKING_STEPS.map((step, index) => {
            const completed = index < currentIndex;
            const current = index === currentIndex;
            const pending = index > currentIndex;

            return (
              <div key={step} className="flex-1 min-w-0 flex flex-col items-center text-center">
                <div className="relative flex items-center justify-center w-full">
                  {index > 0 ? (
                    <span
                      className="absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2"
                      style={{ backgroundColor: completed || current ? BRAND_RED : "#d1d5db" }}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                      pending ? "border-gray-3 bg-white" : ""
                    } ${current ? "animate-pulse" : ""}`}
                    style={
                      completed || current
                        ? { borderColor: BRAND_RED, backgroundColor: completed ? BRAND_RED : "#fff" }
                        : undefined
                    }
                    aria-current={current ? "step" : undefined}
                  >
                    {completed ? (
                      <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="currentColor" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : current ? (
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: BRAND_RED }}
                        aria-hidden
                      />
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-3" aria-hidden />
                    )}
                  </span>
                </div>
                <span
                  className={`mt-2 text-[11px] sm:text-xs leading-tight ${
                    current ? "font-semibold text-dark" : "text-meta-3"
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-meta-3">
        {shipment_updated_at ? (
          <p>
            Last updated: <span className="text-dark">{relativeUpdated ?? "—"}</span>
          </p>
        ) : null}
        {carrier || awb_number ? (
          <p>
            {carrier ? (
              <>
                Carrier: <span className="font-medium text-dark">{carrier}</span>
              </>
            ) : null}
            {carrier && awb_number ? " | " : null}
            {awb_number ? (
              <>
                AWB: <span className="font-medium text-dark">{awb_number}</span>
              </>
            ) : null}
          </p>
        ) : null}
        {awb_number ? (
          <a
            href={shipmozoPublicTrackUrl(awb_number)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-medium hover:underline"
            style={{ color: BRAND_RED }}
          >
            Track on ShipMozo →
          </a>
        ) : null}
      </div>
    </div>
  );
}
