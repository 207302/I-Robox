"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type VariantItem = {
  name?: string;
  color: string;
  image: string;
  isDefault: boolean;
  galleryIndex?: number;
};

type Props = {
  variants: VariantItem[];
  fallbackImage: string;
  galleryId: string;
};

export default function VariantSelector({
  variants,
  fallbackImage,
  galleryId,
}: Props) {
  const normalized = useMemo(
    () =>
      variants
        .filter((v) => Boolean(v.color || v.name))
        .map((v, idx) => {
          const label =
            v.color && v.name && v.color !== v.name
              ? `${v.color} · ${v.name}`
              : v.color || v.name || `Variant ${idx + 1}`;
          return {
            key: `${v.color}-${v.name}-${idx}`,
            label,
            image: v.image || fallbackImage,
            isDefault: v.isDefault,
            galleryIndex:
              typeof v.galleryIndex === "number" && Number.isFinite(v.galleryIndex)
                ? Math.max(0, v.galleryIndex)
                : idx,
          };
        }),
    [variants, fallbackImage]
  );

  const defaultIndex = Math.max(0, normalized.findIndex((v) => v.isDefault));
  const [active, setActive] = useState(defaultIndex);

  if (normalized.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-semibold text-dark">Variants</p>
      <div className="flex flex-wrap gap-2">
        {normalized.map((variant, idx) => (
          <button
            key={variant.key}
            type="button"
            onClick={() => {
              setActive(idx);
              window.dispatchEvent(
                new CustomEvent("product-gallery-select-image", {
                  detail: {
                    galleryId,
                    image: variant.image,
                    index: variant.galleryIndex,
                  },
                })
              );
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              active === idx
                ? "border-blue bg-blue/5 text-blue"
                : "border-gray-3 bg-white text-meta-3 hover:border-blue/40"
            }`}
            title={variant.label}
          >
            <Image
              src={variant.image || "/images/404.svg"}
              alt={variant.label}
              width={18}
              height={18}
              className="h-[18px] w-[18px] rounded-full object-cover"
              loading="lazy"
            />
            <span className="max-w-[130px] truncate">{variant.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
