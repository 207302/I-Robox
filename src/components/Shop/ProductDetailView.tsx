"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Lock, RefreshCw, Star, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import ProductVariantPurchase from "@/components/Shop/ProductVariantPurchase";
import ProductReviewComposer from "@/components/Shop/ProductReviewComposer";
import ProductReviewsCarousel from "@/components/Shop/ProductReviewsCarousel";
import ReviewStar from "@/components/Shop/ReviewStar";
import DemoProductGallery from "@/app/(site)/shop/[slug]/DemoProductGallery";
import { formatPrice } from "@/utils/formatePrice";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";
import type { ApprovedProductReview } from "@/lib/queries/productReviews";
import { prepareQuickLinkContentForHtml } from "@/lib/marketing/prepareQuickLinkContentHtml";

type VariantRow = {
  id: string;
  name?: string;
  color: string;
  image: string;
  size: string;
  isDefault: boolean;
  galleryIndex?: number;
};

export type ProductDetailViewProps = {
  product: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    price: number;
    discountedPrice: number | null;
    quantity: number;
    shippingPerUnit: number;
    brandId: string | null;
    maxOrderQuantity: number;
    category: { title: string; slug: string } | null;
    brand: { name: string; slug: string } | null;
    showNewBadge?: boolean;
  };
  galleryImages: string[];
  galleryId: string;
  variantsForSelector: VariantRow[];
  approvedReviews: ApprovedProductReview[];
  averageRating: number | null;
  freeShippingThresholdInr: number | null;
};

function ProductRatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star;
        const half = !filled && rating >= star - 0.5;
        return (
          <Star
            key={star}
            size={16}
            className={
              filled
                ? "fill-amber-400 text-amber-400"
                : half
                  ? "fill-amber-400/50 text-amber-400"
                  : "text-gray-300"
            }
          />
        );
      })}
    </div>
  );
}

type AccordionKey = "description" | "reviews";

export default function ProductDetailView({
  product,
  galleryImages,
  galleryId,
  variantsForSelector,
  approvedReviews,
  averageRating,
  freeShippingThresholdInr,
}: ProductDetailViewProps) {
  const [openSection, setOpenSection] = useState<AccordionKey | null>(null);

  const summaryHtml = useMemo(() => {
    const raw = product.shortDescription.trim() || product.description.trim();
    return raw ? prepareQuickLinkContentForHtml(raw) : "";
  }, [product.shortDescription, product.description]);

  const descriptionHtml = useMemo(() => {
    const raw = product.description.trim() || product.shortDescription.trim();
    return raw ? prepareQuickLinkContentForHtml(raw) : "";
  }, [product.description, product.shortDescription]);

  const onSale =
    product.discountedPrice != null && product.discountedPrice < product.price;
  const salePrice = onSale ? product.discountedPrice! : product.price;
  const discountPct =
    onSale && product.price > 0
      ? Math.round(((product.price - salePrice) / product.price) * 100)
      : 0;

  const reviewCount = approvedReviews.length;
  const categoryLabel = product.category?.title ?? "Shop";
  const categoryHref = product.category
    ? `/category/${encodeURIComponent(product.category.slug)}`
    : "/shop";
  const brandHref = product.brand
    ? `/brand/${encodeURIComponent(product.brand.slug)}`
    : null;

  function toggleSection(key: AccordionKey) {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  return (
    <>
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
        <div className="w-full md:w-1/2">
          <DemoProductGallery
            title={product.title}
            images={galleryImages}
            galleryId={galleryId}
            wishlist={{
              productId: product.id,
              slug: product.slug,
              title: product.title,
              image: galleryImages[0] ?? "",
              price: salePrice,
            }}
          />
        </div>

        <div className="w-full md:w-1/2">
          <nav className="text-sm text-gray-500" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" prefetch={shouldPrefetchHref("/")} className="hover:text-blue">
                  Home
                </Link>
              </li>
              <li aria-hidden>&gt;</li>
              <li>
                <Link
                  href={categoryHref}
                  prefetch={shouldPrefetchHref(categoryHref)}
                  className="hover:text-blue"
                >
                  {categoryLabel}
                </Link>
              </li>
              {product.brand && brandHref ? (
                <>
                  <li aria-hidden>&gt;</li>
                  <li>
                    <Link
                      href={brandHref}
                      prefetch={shouldPrefetchHref(brandHref)}
                      className="hover:text-blue"
                    >
                      {product.brand.name}
                    </Link>
                  </li>
                </>
              ) : null}
              <li aria-hidden>&gt;</li>
              <li className="text-gray-700">{product.title}</li>
            </ol>
          </nav>

          {product.showNewBadge ? (
            <span className="mt-4 inline-flex rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              New
            </span>
          ) : null}

          {product.brand && brandHref ? (
            <Link
              href={brandHref}
              prefetch={shouldPrefetchHref(brandHref)}
              className={`${product.showNewBadge ? "mt-3" : "mt-4"} inline-block text-sm font-semibold text-blue hover:underline`}
            >
              {product.brand.name}
            </Link>
          ) : null}

          <h1
            className={`${
              product.brand || product.showNewBadge ? "mt-2" : "mt-3"
            } text-2xl font-bold text-dark`}
          >
            {product.title}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {reviewCount > 0 && averageRating != null ? (
              <>
                <ProductRatingStars rating={averageRating} />
                <span className="text-sm font-semibold text-dark">
                  {averageRating.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500">
                  ({reviewCount} Review{reviewCount === 1 ? "" : "s"})
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-500">No reviews yet</span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold text-dark">{formatPrice(salePrice)}</span>
            {onSale ? (
              <>
                <span className="text-lg text-gray-400 line-through">
                  {formatPrice(product.price)}
                </span>
                <span className="text-sm font-semibold text-green-600">-{discountPct}%</span>
              </>
            ) : null}
          </div>

          {summaryHtml ? (
            <div
              className="prose prose-neutral mt-5 max-w-none text-sm leading-relaxed text-gray-700 prose-headings:font-semibold prose-headings:text-dark prose-p:text-gray-700 prose-li:text-gray-700 prose-a:text-blue"
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          ) : null}

          <p
            className={`mt-5 text-sm font-medium ${
              product.quantity > 0 ? "text-green-600" : "text-red"
            }`}
          >
            {product.quantity > 0 ? "In Stock" : "Out of Stock"}
          </p>

          <ProductVariantPurchase
            productId={product.id}
            title={product.title}
            slug={product.slug}
            price={product.price}
            discountedPrice={product.discountedPrice}
            quantity={product.quantity}
            shippingPerUnit={product.shippingPerUnit}
            brandId={product.brandId}
            maxOrderQuantity={product.maxOrderQuantity}
            variants={variantsForSelector}
            fallbackImage={galleryImages[0] ?? ""}
            galleryId={galleryId}
          />

          <ul className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
            <li className="flex items-start gap-2.5 text-sm text-gray-600">
              <Truck size={18} className="mt-0.5 shrink-0 text-dark" aria-hidden />
              <span>
                <span className="block font-medium text-dark">Free Shipping</span>
                {freeShippingThresholdInr != null
                  ? `on orders above ₹${freeShippingThresholdInr.toLocaleString("en-IN")}`
                  : "not available on this order"}
              </span>
            </li>
            <li className="flex items-start gap-2.5 text-sm text-gray-600">
              <Lock size={18} className="mt-0.5 shrink-0 text-dark" aria-hidden />
              <span>
                <span className="block font-medium text-dark">Secure Payment</span>
                100% safe &amp; secure
              </span>
            </li>
            <li className="flex items-start gap-2.5 text-sm text-gray-600">
              <RefreshCw size={18} className="mt-0.5 shrink-0 text-dark" aria-hidden />
              <span>
                <span className="block font-medium text-dark">7 Days Returns</span>
                Hassle-free returns
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 border-t border-gray-200">
        <div className="border-b border-gray-200">
          <button
            type="button"
            onClick={() => toggleSection("description")}
            className="flex w-full items-center justify-between py-4 text-left"
            aria-expanded={openSection === "description"}
          >
            <span className="text-base font-semibold text-dark">Product Description</span>
            <ChevronDown
              size={20}
              className={`shrink-0 text-gray-500 transition-transform ${
                openSection === "description" ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
          <AnimatePresence initial={false}>
            {openSection === "description" ? (
              <motion.div
                key="description"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pb-6 text-sm leading-relaxed text-gray-700">
                  {descriptionHtml ? (
                    <div
                      className="prose prose-neutral max-w-none prose-headings:font-semibold prose-headings:text-dark prose-p:text-gray-700 prose-li:text-gray-700 prose-a:text-blue"
                      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                    />
                  ) : (
                    <p>No description available for this product.</p>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div>
          <button
            type="button"
            onClick={() => toggleSection("reviews")}
            className="flex w-full items-center justify-between py-4 text-left"
            aria-expanded={openSection === "reviews"}
          >
            <span className="text-base font-semibold text-dark">
              Reviews ({reviewCount})
            </span>
            <ChevronDown
              size={20}
              className={`shrink-0 text-gray-500 transition-transform ${
                openSection === "reviews" ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
          <AnimatePresence initial={false}>
            {openSection === "reviews" ? (
              <motion.div
                key="reviews"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pb-6">
                  {reviewCount > 0 && averageRating != null ? (
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                      <span className="text-4xl font-bold text-dark">
                        {averageRating.toFixed(1)}
                      </span>
                      <div>
                        <ReviewStar avgRating={averageRating} />
                        <p className="mt-1 text-sm text-gray-500">
                          Based on {reviewCount} review{reviewCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mb-6 text-sm text-gray-600">
                      No reviews yet. Be the first to review this product.
                    </p>
                  )}

                  {reviewCount > 0 ? <ProductReviewsCarousel reviews={approvedReviews} /> : null}

                  <ProductReviewComposer productId={product.id} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
