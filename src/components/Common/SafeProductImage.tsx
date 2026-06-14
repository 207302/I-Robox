"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  PRODUCT_IMAGE_REMOTE_FALLBACK,
  resolveProductImageSrc,
} from "@/lib/shop/productImagePlaceholder";

type Props = Omit<ImageProps, "src" | "onError"> & {
  src?: string | null;
};

export default function SafeProductImage({ src, alt, ...props }: Props) {
  const [imgSrc, setImgSrc] = useState(() => resolveProductImageSrc(src));

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt ?? "Product at i-robox"}
      onError={() => {
        setImgSrc((current) =>
          current === PRODUCT_IMAGE_REMOTE_FALLBACK
            ? PRODUCT_IMAGE_PLACEHOLDER
            : PRODUCT_IMAGE_REMOTE_FALLBACK
        );
      }}
    />
  );
}
