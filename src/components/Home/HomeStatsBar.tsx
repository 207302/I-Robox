import { RefreshCw, Star, ThumbsUp, Truck, Users } from "lucide-react";
import { chromeBgStyle, chromeTextStyle } from "@/lib/marketing/chromeColors";

const STATS = [
  { Icon: Users, value: "10,000+", label: "Happy Customers" },
  { Icon: ThumbsUp, value: "500+", label: "Premium Brands" },
  { Icon: Star, value: "4.8", label: "Average Rating" },
  { Icon: Truck, value: "Pan India", label: "Shipping" },
  { Icon: RefreshCw, value: "7 Days", label: "Easy Returns" },
] as const;

type Props = {
  footerBg?: string | null;
  footerText?: string | null;
};

export default function HomeStatsBar({ footerBg, footerText }: Props) {
  const cardBgStyle = chromeBgStyle(footerBg);
  const textStyle = chromeTextStyle(footerText);

  return (
    <section
      className="overflow-visible bg-gray-50 px-4 pb-4 pt-0 sm:px-8 md:pb-6 xl:px-0"
      aria-label="Store statistics"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`rounded-2xl px-4 py-6 text-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] sm:px-6 sm:py-7 ${
            cardBgStyle ? "" : "bg-gray-900"
          }`}
          style={cardBgStyle}
        >
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {STATS.map((stat, index) => (
              <li
                key={stat.label}
                className={`flex flex-col items-center text-center ${
                  index === STATS.length - 1 ? "col-span-2 sm:col-span-1 lg:col-span-1" : ""
                }`}
              >
                <stat.Icon className="mb-2 size-6 text-white/90" style={textStyle} aria-hidden />
                <p className="text-lg font-bold leading-tight sm:text-xl" style={textStyle}>
                  {stat.value}
                </p>
                <p
                  className="mt-1 text-xs text-white/75 sm:text-sm"
                  style={textStyle ? { ...textStyle, opacity: 0.85 } : undefined}
                >
                  {stat.label}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
