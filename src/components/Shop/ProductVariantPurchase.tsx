"use client";

import ProductActions from "@/components/Shop/ProductActions";
import VariantSelector from "@/app/(site)/shop/[slug]/VariantSelector";
import {
  buildCartLineId,
  formatVariantLabel,
  pickDefaultVariant,
} from "@/lib/cart/cartLine";
import { useMemo, useState } from "react";

type VariantRow = {
  id: string;
  name?: string;
  color: string;
  image: string;
  size: string;
  isDefault: boolean;
  galleryIndex?: number;
};

type Props = {
  productId: string;
  title: string;
  slug: string;
  price: number;
  discountedPrice?: number | null;
  quantity: number;
  shippingPerUnit?: number;
  brandId?: string | null;
  maxOrderQuantity?: number;
  variants: VariantRow[];
  fallbackImage: string;
  galleryId: string;
};

export default function ProductVariantPurchase({
  productId,
  title,
  slug,
  price,
  discountedPrice,
  quantity,
  shippingPerUnit = 0,
  brandId = null,
  maxOrderQuantity,
  variants,
  fallbackImage,
  galleryId,
}: Props) {
  const normalized = useMemo(
    () => variants.filter((v) => Boolean(v.id && (v.color || v.name))),
    [variants]
  );
  const defaultVariant = pickDefaultVariant(normalized);
  const [selectedId, setSelectedId] = useState(defaultVariant?.id ?? "");

  const selected =
    normalized.find((v) => v.id === selectedId) ?? defaultVariant ?? normalized[0];

  const hasVariants = normalized.length > 0;
  const lineId = buildCartLineId(productId, selected?.id, hasVariants);
  const variantLabel = formatVariantLabel(selected);
  const displayImage = selected?.image || fallbackImage;

  return (
    <>
      {normalized.length > 0 ? (
        <VariantSelector
          variants={normalized}
          fallbackImage={fallbackImage}
          galleryId={galleryId}
          selectedId={selected?.id}
          onSelect={(variant) => setSelectedId(variant.id)}
        />
      ) : null}

      <ProductActions
        lineId={lineId}
        productId={productId}
        variantId={selected?.id ?? null}
        variantLabel={variantLabel}
        title={title}
        slug={slug}
        image={displayImage}
        price={price}
        discountedPrice={discountedPrice}
        quantity={quantity}
        shippingPerUnit={shippingPerUnit}
        brandId={brandId}
        maxOrderQuantity={maxOrderQuantity}
        color={selected?.color ?? ""}
        size={selected?.size ?? ""}
      />
    </>
  );
}
