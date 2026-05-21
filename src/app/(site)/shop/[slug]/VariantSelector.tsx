"use client";

import SafeProductImage from "@/components/Common/SafeProductImage";
import { resolveProductImageSrc } from "@/lib/shop/productImagePlaceholder";
import { useEffect, useMemo, useState } from "react";

type VariantItem = {
  id: string;
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
  selectedId?: string;
  onSelect?: (variant: VariantItem, index: number) => void;
};

export default function VariantSelector({
  variants,
  fallbackImage,
  galleryId,
  selectedId: selectedIdProp,
  onSelect,
}: Props) {
  const normalized = useMemo(
    () =>
      variants
        .filter((v) => Boolean(v.id && (v.color || v.name)))
        .map((v, idx) => {
          const label =
            v.color && v.name && v.color !== v.name
              ? `${v.color} · ${v.name}`
              : v.color || v.name || `Variant ${idx + 1}`;
          return {
            key: v.id,
            id: v.id,
            label,
            image: v.image || fallbackImage,
            isDefault: v.isDefault,
            galleryIndex:
              typeof v.galleryIndex === "number" && Number.isFinite(v.galleryIndex)
                ? Math.max(0, v.galleryIndex)
                : idx,
            color: v.color,
            name: v.name,
          };
        }),
    [variants, fallbackImage]
  );

  const defaultIndex = Math.max(0, normalized.findIndex((v) => v.isDefault));
  const controlledIndex = selectedIdProp
    ? normalized.findIndex((v) => v.id === selectedIdProp)
    : -1;
  const [active, setActive] = useState(controlledIndex >= 0 ? controlledIndex : defaultIndex);

  useEffect(() => {
    if (controlledIndex >= 0) setActive(controlledIndex);
  }, [controlledIndex]);

  if (normalized.length === 0) return null;

  const selectAt = (idx: number) => {
    setActive(idx);
    const variant = variants.find((v) => v.id === normalized[idx]?.id);
    if (variant) onSelect?.(variant, idx);
    window.dispatchEvent(
      new CustomEvent("product-gallery-select-image", {
        detail: {
          galleryId,
          image: normalized[idx].image,
          index: normalized[idx].galleryIndex,
        },
      })
    );
  };

  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-semibold text-dark">Variants</p>
      <div className="flex flex-wrap gap-2">
        {normalized.map((variant, idx) => (
          <button
            key={variant.key}
            type="button"
            onClick={() => selectAt(idx)}
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              active === idx
                ? "border-blue bg-blue/5 text-blue"
                : "border-gray-3 bg-white text-meta-3 hover:border-blue/40"
            }`}
            title={variant.label}
          >
            <SafeProductImage
              src={resolveProductImageSrc(variant.image || fallbackImage)}
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
