import { Lock, RefreshCw, ShieldCheck, Truck } from "lucide-react";

const ITEMS = [
  {
    Icon: ShieldCheck,
    title: "100% Genuine Products",
    subtitle: "Original Brands",
  },
  {
    Icon: Lock,
    title: "Secure Payments",
    subtitle: "100% Safe & Secure",
  },
  {
    Icon: Truck,
    title: "Fast Shipping",
    subtitle: "Across India",
  },
  {
    Icon: RefreshCw,
    title: "Easy Returns",
    subtitle: "Hassle-free Returns",
  },
] as const;

export default function HomeBottomTrustBar() {
  return (
    <section
      className="border-t border-gray-100 bg-white py-6 md:py-8"
      aria-label="Store guarantees"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 xl:px-0">
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ITEMS.map((item) => (
            <li key={item.title} className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 p-1">
                <item.Icon className="h-5 w-5 text-gray-600" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-dark">{item.title}</p>
                <p className="text-xs text-gray-500">{item.subtitle}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
