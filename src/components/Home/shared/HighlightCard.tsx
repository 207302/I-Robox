import Image from "next/image";
import Link from "next/link";

export type HighlightCardItem = {
  id: string;
  href: string;
  image: string;
  label: string;
  alt: string;
  subtitle?: string | null;
};

const cardHoverClass =
  "md:hover:-translate-y-1 md:hover:shadow-xl md:hover:ring-2 md:hover:ring-red/40";

export default function HighlightCard({ item }: { item: HighlightCardItem }) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={`group relative block h-full overflow-hidden rounded-2xl border border-gray-3 bg-white shadow-md shadow-black/10 transition-[transform,box-shadow,border-color,ring-color] duration-300 active:scale-[0.98] active:translate-y-0 text-left ${cardHoverClass}`}
    >
      <div className="relative aspect-[4/3] w-full md:aspect-[5/4]">
        <Image
          src={item.image}
          alt={item.alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
          className="object-cover"
          loading="lazy"
        />
        <div className="absolute inset-x-3 bottom-3 rounded-lg bg-red/90 px-3 py-2 shadow-md shadow-red/30 transition-[background-color,box-shadow] duration-300 group-hover:bg-red group-hover:shadow-lg group-hover:shadow-red/40">
          <p className="text-sm font-bold text-white tracking-wide">{item.label}</p>
          {item.subtitle ? (
            <p className="mt-0.5 text-[11px] font-medium text-white/90 line-clamp-2">
              {item.subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
