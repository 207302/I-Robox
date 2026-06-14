import { SEO_SITE_URL } from "@/lib/seo/constants";
import { absoluteSeoUrl } from "@/lib/seo/metadata";

type ProductSchemaInput = {
  name: string;
  description: string;
  image: string;
  sku: string;
  brand?: string | null;
  slug: string;
  price: number;
  inStock: boolean;
};

export function buildProductJsonLd(input: ProductSchemaInput) {
  const url = absoluteSeoUrl(`/shop/${input.slug}`);
  const image = absoluteSeoUrl(input.image);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    image: [image],
    sku: input.sku || input.slug,
    brand: input.brand
      ? { "@type": "Brand", name: input.brand }
      : { "@type": "Brand", name: "i-robox" },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "INR",
      price: input.price,
      availability: input.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "i-robox", url: SEO_SITE_URL },
    },
  };
}
