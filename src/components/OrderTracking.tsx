"use client";

import { useEffect, useState } from "react";
import {
  SHIPMOZO_TRACKING_STEPS,
  type ShipmozoTrackingStatus,
  SHIPMOZO_TRACKING_STEP_LABELS,
} from "@/lib/shipping/shipmozoTrackingConstants";
import { shipmozoPublicTrackUrl } from "@/lib/shipping/shipmozoPublicTrackUrl";

const BRAND_RED = "#E63946";

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
    <div className="mt-4 min-w-0">
      {/* Mobile: vertical timeline — avoids min-width overflow on narrow screens */}
      <ol className="space-y-0 sm:hidden">
        {SHIPMOZO_TRACKING_STEPS.map((step, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;
          const pending = index > currentIndex;
          const isLast = index === SHIPMOZO_TRACKING_STEPS.length - 1;

          return (
            <li key={step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepCircle completed={completed} current={current} pending={pending} ariaCurrent={current} />
                {!isLast ? (
                  <span
                    className="my-1 w-0.5 flex-1 min-h-[1.25rem]"
                    style={{ backgroundColor: completed ? BRAND_RED : "#d1d5db" }}
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className={`min-w-0 pb-5 pt-1.5 ${isLast ? "pb-0" : ""}`}>
                <span
                  className={`text-sm leading-tight ${
                    current ? "font-semibold text-dark" : "text-meta-3"
                  }`}
                >
                  {SHIPMOZO_TRACKING_STEP_LABELS[step]}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Tablet/desktop: horizontal stepper, scroll contained inside the card */}
      <div className="hidden w-full max-w-full min-w-0 overflow-x-auto pb-2 sm:block">
        <div className="flex min-w-[520px] items-start justify-between gap-2">
          {SHIPMOZO_TRACKING_STEPS.map((step, index) => {
            const completed = index < currentIndex;
            const current = index === currentIndex;
            const pending = index > currentIndex;

            return (
              <div key={step} className="flex min-w-0 flex-1 flex-col items-center text-center">
                <div className="relative flex w-full items-center justify-center">
                  {index > 0 ? (
                    <span
                      className="absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2"
                      style={{ backgroundColor: completed || current ? BRAND_RED : "#d1d5db" }}
                      aria-hidden
                    />
                  ) : null}
                  <StepCircle completed={completed} current={current} pending={pending} ariaCurrent={current} />
                </div>
                <span
                  className={`mt-2 text-[11px] leading-tight sm:text-xs ${
                    current ? "font-semibold text-dark" : "text-meta-3"
                  }`}
                >
                  {SHIPMOZO_TRACKING_STEP_LABELS[step]}
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

function StepCircle({
  completed,
  current,
  pending,
  ariaCurrent,
}: {
  completed: boolean;
  current: boolean;
  pending: boolean;
  ariaCurrent: boolean;
}) {
  return (
    <span
      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
        pending ? "border-gray-3 bg-white" : ""
      } ${current ? "animate-pulse" : ""}`}
      style={
        completed || current
          ? { borderColor: BRAND_RED, backgroundColor: completed ? BRAND_RED : "#fff" }
          : undefined
      }
      aria-current={ariaCurrent ? "step" : undefined}
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
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: BRAND_RED }} aria-hidden />
      ) : (
        <span className="h-2.5 w-2.5 rounded-full bg-gray-3" aria-hidden />
      )}
    </span>
  );
}
