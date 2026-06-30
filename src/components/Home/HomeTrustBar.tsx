import { Lock, RefreshCw, Shield, Star, Truck } from "lucide-react";
import type { CSSProperties } from "react";

const ITEMS = [
  { Icon: Shield, label: "100% Genuine Products" },
  { Icon: Truck, label: "Fast Pan-India Shipping" },
  { Icon: Lock, label: "Secure Payments" },
  { Icon: RefreshCw, label: "Easy Returns" },
  { Icon: Star, label: "Trusted by Many" },
] as const;

const MARQUEE_DURATION_SEC = Math.max(
  28,
  Math.min(
    90,
    ITEMS.length * 10 + ITEMS.reduce((sum, item) => sum + item.label.length, 0) * 0.15
  )
);

function TrustItem({
  item,
  className = "",
}: {
  item: (typeof ITEMS)[number];
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2.5 px-2.5 ${className}`}
    >
      <item.Icon className="size-5 shrink-0 text-dark" aria-hidden />
      <span className="text-xs font-medium text-dark sm:text-sm">{item.label}</span>
    </span>
  );
}

export default function HomeTrustBar() {
  return (
    <section className="border-b border-gray-200 bg-gray-50 py-4" aria-label="Store trust highlights">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 xl:px-0">
        <div
          className="overflow-hidden md:hidden"
          aria-live="off"
        >
          <div
            className="marquee-track py-0.5"
            style={{ "--marquee-duration": `${MARQUEE_DURATION_SEC}s` } as CSSProperties}
          >
            {[0, 1].map((copyIdx) => (
              <div
                key={copyIdx}
                className="marquee-group"
                aria-hidden={copyIdx === 1}
              >
                {ITEMS.map((item) => (
                  <TrustItem key={`${copyIdx}-${item.label}`} item={item} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <ul className="hidden gap-0 md:grid md:grid-cols-5">
          {ITEMS.map((item, index) => (
            <li
              key={item.label}
              className={`flex items-center justify-center ${
                index > 0 ? "border-l border-gray-200" : ""
              }`}
            >
              <TrustItem item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
