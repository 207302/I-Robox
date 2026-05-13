"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";
import { formatPrice } from "@/utils/formatePrice";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useState } from "react";

type ProductCarouselItem = {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  discountedPrice?: number | null;
};

const ITEMS_PER_SECTION = 8;
const MAX_SECTIONS = 3;

function ProductCard({ item, imagePriority }: { item: ProductCarouselItem; imagePriority?: boolean }) {
  return (
    <Link
      href={`/shop/${item.slug}`}
      className="group block h-full overflow-hidden rounded-2xl border border-gray-3 bg-white hover:border-blue/40"
    >
      <div className="relative aspect-square bg-gray-2">
        <Image
          src={item.image}
          alt={item.title}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover"
          priority={imagePriority}
          fetchPriority={imagePriority ? "high" : undefined}
          loading={imagePriority ? undefined : "lazy"}
        />
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-dark">{item.title}</h3>
        <div className="mt-2 flex items-center gap-2">
          {item.discountedPrice != null ? (
            <>
              <span className="text-sm font-semibold text-blue">{formatPrice(item.discountedPrice)}</span>
              <span className="text-xs line-through text-meta-4">{formatPrice(item.price)}</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-dark">{formatPrice(item.price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function HomeProductCarouselSection({ items }: { items: ProductCarouselItem[] | null }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-meta-3 py-4">No new arrivals yet — add products in Admin.</p>;
  }
  const capped = items.slice(0, ITEMS_PER_SECTION * MAX_SECTIONS);
  const firstId = capped[0]?.id;
  const sections = Array.from(
    { length: Math.ceil(capped.length / ITEMS_PER_SECTION) },
    (_, idx) => capped.slice(idx * ITEMS_PER_SECTION, (idx + 1) * ITEMS_PER_SECTION)
  );
  const [activeSection, setActiveSection] = useState(0);

  const goNext = () => {
    startTransition(() => {
      setActiveSection((p) => (sections.length > 0 ? (p + 1) % sections.length : 0));
    });
  };
  const goPrev = () => {
    startTransition(() => {
      setActiveSection((p) => (sections.length > 0 ? (p - 1 + sections.length) % sections.length : 0));
    });
  };

  return (
    <>
      <div className="md:hidden">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{
              width: `${sections.length * 100}%`,
              transform: `translateX(-${activeSection * (100 / sections.length)}%)`,
            }}
          >
            {sections.map((section, idx) => (
              <div
                key={idx}
                className="shrink-0 px-0"
                style={{ width: `${100 / sections.length}%` }}
              >
                <div className="grid grid-cols-2 gap-4">
                  {section.slice(0, 4).map((item) => (
                    <ProductCard key={item.id} item={item} imagePriority={item.id === firstId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="relative">
          {sections.length > 1 ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-dark text-white shadow-lg shadow-dark/30 transition hover:bg-blue md:-left-1 lg:left-0"
                aria-label="Previous new arrivals section"
              >
                <ChevronLeftIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-dark text-white shadow-lg shadow-dark/30 transition hover:bg-blue md:-right-1 lg:right-0"
                aria-label="Next new arrivals section"
              >
                <ChevronRightIcon className="size-6 text-white [&_path]:stroke-[2.5]" />
              </button>
            </>
          ) : null}

          <div className="md:mx-11 lg:mx-12 overflow-hidden">
            <div
              className="flex transition-transform duration-600 ease-in-out"
              style={{
                width: `${sections.length * 100}%`,
                transform: `translateX(-${activeSection * (100 / sections.length)}%)`,
              }}
            >
              {sections.map((section, idx) => (
                <div key={idx} className="shrink-0" style={{ width: `${100 / sections.length}%` }}>
                  <div className="grid grid-cols-4 gap-4">
                    {section.map((item) => (
                      <ProductCard key={item.id} item={item} imagePriority={item.id === firstId} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {sections.length > 1 ? (
          <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="New arrival sections">
            {sections.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === activeSection}
                aria-label={`Section ${index + 1} of ${sections.length}`}
                onClick={() =>
                  startTransition(() => {
                    setActiveSection(index);
                  })
                }
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === activeSection ? "w-8 bg-red" : "w-2 bg-gray-3 hover:bg-gray-4"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

