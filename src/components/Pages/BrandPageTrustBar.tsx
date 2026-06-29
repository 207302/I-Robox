import { BadgeCheck, RotateCcw, Shield, Store } from "lucide-react";

const ITEMS = [
  { Icon: Shield, label: "100% Original Products" },
  { Icon: Store, label: "Official Brand Store" },
  { Icon: RotateCcw, label: "Easy Returns & Support" },
] as const;

export default function BrandPageTrustBar() {
  return (
    <section className="border-t border-gray-200 bg-gray-50 py-6" aria-label="Brand trust highlights">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 xl:px-0">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ITEMS.map((item) => (
            <li key={item.label} className="flex items-center justify-center gap-2.5 text-center sm:justify-center">
              <item.Icon className="size-5 shrink-0 text-dark" aria-hidden />
              <span className="text-sm font-medium text-dark">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export { BadgeCheck };
