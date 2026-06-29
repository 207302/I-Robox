import Image from "next/image";
import Link from "next/link";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import { HOME_HIGHLIGHTS_IMAGE_SIZES } from "./homeRailStyles";

export type HighlightCardItem = {
  id: string;
  href: string;
  image: string;
  label: string;
  alt: string;
  subtitle?: string | null;
};

export default function HighlightCard({ item }: { item: HighlightCardItem }) {
  return (
    <Link
      href={item.href}
      prefetch={shouldPrefetchHref(item.href)}
      className="group relative block h-full overflow-hidden rounded-xl transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] w-full md:aspect-[4/3]">
        <Image
          src={item.image}
          alt={item.alt}
          fill
          sizes={HOME_HIGHLIGHTS_IMAGE_SIZES}
          className="object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-base font-bold leading-snug sm:text-lg">{item.label}</p>
          {item.subtitle ? (
            <p className="mt-1 line-clamp-2 text-xs text-white/85 sm:text-sm">{item.subtitle}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
