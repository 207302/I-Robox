import { notFound } from "next/navigation";
import type { Metadata } from "next";
import LcpImagePrelink from "@/components/Common/LcpImagePrelink";
import ProductDetailView from "@/components/Shop/ProductDetailView";
import { cache } from "react";
import { getProductBySlug } from "@/get-api-data/product";
import { getApprovedReviewsForProduct } from "@/lib/queries/productReviews";
import { getFreeShippingThresholdInr } from "@/lib/marketing/freeShipping";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/shop/productImagePlaceholder";
import { getProductSlugsForStaticGeneration } from "@/lib/shop/productStaticParams";
import { JsonLdScript } from "@/lib/seo/jsonLd";
import {
  buildSocialMetadata,
  truncateMetaDescription,
} from "@/lib/seo/metadata";
import { buildProductJsonLd } from "@/lib/seo/productSchema";

/** ISR: keep in sync with `PRODUCT_PAGE_REVALIDATE_SECONDS` in cache/constants.ts */
export const revalidate = 300;

/** Uncached slugs render on first request, then enter the 300s ISR cache. */
export const dynamicParams = true;

/** Build: top 10 PDPs only (see `productStaticParams.ts`). Runtime ISR covers the catalog. */
export async function generateStaticParams() {
  return getProductSlugsForStaticGeneration();
}

const getProductBySlugCached = cache(getProductBySlug);

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlugCached(slug);
  if (!product) return { title: "Product Not Found | i-robox" };

  const title = `${product.title} | i-robox`;
  const description =
    truncateMetaDescription(product.description || product.shortDescription) ||
    `Buy ${product.title} online at i-robox — RC toys, diecast models, and collectibles with delivery across India.`;
  const image =
    product.product_images?.slice().sort((a, b) => a.sort_order - b.sort_order)[0]?.url ??
    PRODUCT_IMAGE_PLACEHOLDER;

  return {
    title,
    description,
    ...buildSocialMetadata({
      title,
      description,
      path: `/shop/${product.slug}`,
      image,
    }),
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlugCached(slug);
  if (!product) notFound();

  const [approvedReviews, freeShippingThresholdInr] = await Promise.all([
    getApprovedReviewsForProduct(product.id),
    getFreeShippingThresholdInr(),
  ]);
  const averageRating =
    approvedReviews.length > 0
      ? approvedReviews.reduce((sum, review) => sum + review.rating, 0) /
        approvedReviews.length
      : null;

  const sortedProductLevelImages = (product.product_images ?? [])
    .filter((i) => i.product_variant_id == null)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.url)
    .filter(Boolean);

  const variantImagesInOrder = product.productVariants.flatMap((v) => v.images ?? []);
  const galleryImages = [...sortedProductLevelImages, ...variantImagesInOrder];
  const galleryImagesSafe =
    galleryImages.length > 0 ? galleryImages : [PRODUCT_IMAGE_PLACEHOLDER];
  const variantsForSelector = product.productVariants.map((variant) => {
    const first = variant.images?.[0];
    const galleryIndex =
      first != null && first !== "" ? galleryImages.indexOf(first) : 0;
    return {
      ...variant,
      galleryIndex: galleryIndex >= 0 ? galleryIndex : 0,
    };
  });
  const galleryId = `product-gallery-${product.id}`;
  const primaryImage = galleryImagesSafe[0] || PRODUCT_IMAGE_PLACEHOLDER;
  const productDescription =
    truncateMetaDescription(product.description || product.shortDescription) ||
    `Buy ${product.title} online at i-robox.`;
  const offerPrice = product.discountedPrice ?? product.price;
  const productJsonLd = buildProductJsonLd({
    name: product.title,
    description: productDescription,
    image: primaryImage,
    sku: product.sku || product.slug,
    brand: product.brand?.name ?? null,
    slug: product.slug,
    price: offerPrice,
    inStock: product.quantity > 0,
  });


  return (
    <>
      <JsonLdScript id="product-jsonld" data={productJsonLd} />
      <LcpImagePrelink
        variant="product"
        imageUrl={galleryImagesSafe[0]}
        sizes="(max-width: 1024px) 100vw, 50vw"
        width={828}
        height={828}
      />
      <section className="overflow-x-hidden overflow-y-visible py-6 pb-14 sm:py-10 sm:pb-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 xl:px-0">
          <ProductDetailView
            product={{
              id: product.id,
              title: product.title,
              slug: product.slug,
              shortDescription: product.shortDescription,
              description: product.description,
              price: product.price,
              discountedPrice: product.discountedPrice,
              flashSaleTag: product.flashSaleTag ?? null,
              flashSalePurchaseLimit: product.flashSalePurchaseLimit ?? 0,
              flashSaleId: product.flashSaleId ?? null,
              quantity: product.quantity,
              shippingPerUnit: product.shippingPerUnit ?? 0,
              brandId: product.brandId ?? null,
              maxOrderQuantity: product.maxOrderQuantity,
              category: product.category,
              brand: product.brand
                ? { name: product.brand.name, slug: product.brand.slug }
                : null,
            }}
            galleryImages={galleryImagesSafe}
            galleryId={galleryId}
            variantsForSelector={variantsForSelector}
            approvedReviews={approvedReviews}
            averageRating={averageRating}
            freeShippingThresholdInr={freeShippingThresholdInr}
          />
        </div>
      </section>
    </>
  );
}
