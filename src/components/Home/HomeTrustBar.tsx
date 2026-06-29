import { Lock, RefreshCw, Shield, Star, Truck } from "lucide-react";

const ITEMS = [
  { Icon: Shield, label: "100% Genuine Products" },
  { Icon: Truck, label: "Fast Pan-India Shipping" },
  { Icon: Lock, label: "Secure Payments" },
  { Icon: RefreshCw, label: "Easy Returns" },
  { Icon: Star, label: "Rated by Thousands" },
] as const;

export default function HomeTrustBar() {
  return (
    <section className="border-b border-gray-200 bg-gray-50 py-4" aria-label="Store trust highlights">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 xl:px-0">
        <ul className="flex gap-4 overflow-x-auto no-scrollbar md:grid md:grid-cols-5 md:gap-0 md:overflow-visible">
          {ITEMS.map((item, index) => (
            <li
              key={item.label}
              className={`flex min-w-[max(9.5rem,38vw)] shrink-0 items-center gap-2.5 md:min-w-0 md:justify-center md:px-3 ${
                index > 0 ? "md:border-l md:border-gray-200" : ""
              }`}
            >
              <item.Icon className="size-5 shrink-0 text-dark" aria-hidden />
              <span className="text-xs font-medium text-dark sm:text-sm">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
