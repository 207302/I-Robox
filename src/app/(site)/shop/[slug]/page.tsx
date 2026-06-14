import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import LcpImagePrelink from "@/components/Common/LcpImagePrelink";
import DemoProductGallery from "./DemoProductGallery";
import VariantSelector from "./VariantSelector";
import { cache } from "react";
import { getProductBySlug } from "@/get-api-data/product";
import { formatPrice } from "@/utils/formatePrice";
import ProductVariantPurchase from "@/components/Shop/ProductVariantPurchase";
import ReviewStar from "@/components/Shop/ReviewStar";
import ProductReviewComposer from "@/components/Shop/ProductReviewComposer";
import { getApprovedReviewsForProduct } from "@/lib/queries/productReviews";
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

  const approvedReviews = await getApprovedReviewsForProduct(product.id);

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
        imageUrl={galleryImagesSafe[0]}
        sizes="(max-width: 1024px) 100vw, 50vw"
        width={1200}
        height={1200}
      />
    <section className="overflow-x-hidden overflow-y-visible py-6 pb-14 sm:py-10 sm:pb-20">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <Link href="/shop" prefetch={false} className="text-sm font-medium text-blue hover:underline">
          Back to shop
        </Link>

        <div className="mt-5 grid min-w-0 items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <DemoProductGallery
            title={product.title}
            images={galleryImagesSafe}
            galleryId={galleryId}
          />

          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-dark sm:text-3xl">{product.title}</h1>
            <div className="mt-2 flex items-baseline gap-3">
              {product.discountedPrice ? (
                <>
                  <span className="text-2xl font-bold text-blue">
                    {formatPrice(product.discountedPrice)}
                  </span>
                  <span className="text-base font-medium text-meta-4 line-through">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-sm font-semibold text-green rounded-full bg-green-light-6 px-2 py-0.5">
                    {Math.round((1 - product.discountedPrice / product.price) * 100)}% off
                  </span>
                </>
              ) : (
                <span className="text-2xl font-bold text-dark">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>
            {product.shortDescription ? (
              <p className="mt-4 text-base text-meta-3">{product.shortDescription}</p>
            ) : null}
            {product.ageGroup ||
            product.diecastScale ||
            product.brand ||
            product.category ||
            product.subcategory ||
            product.collection ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {product.ageGroup ? (
                  <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-3 py-1 text-xs font-medium text-meta-3">
                    Recommended age: {product.ageGroup}
                  </span>
                ) : null}
                {product.diecastScale ? (
                  <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-3 py-1 text-xs font-medium text-meta-3">
                    Scale: {product.diecastScale}
                  </span>
                ) : null}
                {product.brand ? (
                  <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-3 py-1 text-xs font-medium text-meta-3">
                    Brand: {product.brand.name}
                  </span>
                ) : null}
                {product.category ? (
                  <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-3 py-1 text-xs font-medium text-meta-3">
                    Category: {product.category.title}
                  </span>
                ) : null}
                {product.subcategory ? (
                  <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-3 py-1 text-xs font-medium text-meta-3">
                    Sub category: {product.subcategory.name}
                  </span>
                ) : null}
                {product.collection ? (
                  <span className="inline-flex rounded-full border border-gray-3 bg-gray-1 px-3 py-1 text-xs font-medium text-meta-3">
                    Collection: {product.collection.name}
                  </span>
                ) : null}
              </div>
            ) : null}

            {product.description ? (
              <>
                <h2 className="mt-6 text-lg font-semibold text-dark">Description</h2>
                <p className="mt-3 text-sm text-meta-3 whitespace-pre-line">
                  {product.description}
                </p>
              </>
            ) : null}
            <ProductVariantPurchase
              productId={product.id}
              title={product.title}
              slug={product.slug}
              price={product.price}
              discountedPrice={product.discountedPrice}
              quantity={product.quantity}
              shippingPerUnit={product.shippingPerUnit ?? 0}
              brandId={product.brandId ?? null}
              maxOrderQuantity={product.maxOrderQuantity}
              variants={variantsForSelector}
              fallbackImage={galleryImagesSafe[0] || PRODUCT_IMAGE_PLACEHOLDER}
              galleryId={galleryId}
            />

            <div className="mt-10 border-t border-gray-3 pt-8">
              <h2 className="text-lg font-semibold text-dark">Reviews</h2>
              {approvedReviews.length === 0 ? (
                <p className="mt-3 text-sm text-meta-3">No approved reviews yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {approvedReviews.map((r) => (
                    <div key={r.id} className="rounded-xl border border-gray-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ReviewStar avgRating={r.rating} />
                          <span className="text-xs font-medium text-meta-3">({r.rating}/5)</span>
                        </div>
                        {r.is_verified_purchase ? (
                          <span className="text-xs rounded-full bg-gray-1 border border-gray-3 px-3 py-1 text-dark">
                            Verified purchase
                          </span>
                        ) : null}
                      </div>
                      {r.title ? (
                        <div className="mt-2 text-sm font-semibold text-dark">{r.title}</div>
                      ) : null}
                      <p className="mt-2 text-sm text-meta-3 whitespace-pre-line">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              <ProductReviewComposer productId={product.id} />
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}

