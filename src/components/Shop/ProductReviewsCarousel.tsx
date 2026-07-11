"use client";

import "swiper/css";
import "swiper/css/pagination";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import ProductReviewCard from "@/components/Shop/ProductReviewCard";
import type { ApprovedProductReview } from "@/lib/queries/productReviews";

type Props = {
  reviews: ApprovedProductReview[];
};

export default function ProductReviewsCarousel({ reviews }: Props) {
  if (reviews.length === 0) return null;

  if (reviews.length === 1) {
    return <ProductReviewCard review={reviews[0]} />;
  }

  return (
    <div className="product-reviews-carousel -mx-1 px-1">
      <Swiper
        modules={[Autoplay, Pagination]}
        spaceBetween={16}
        slidesPerView={1}
        loop
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        pagination={{ clickable: true }}
        className="!pb-10 [&_.swiper-pagination-bullet-active]:bg-blue"
      >
        {reviews.map((review) => (
          <SwiperSlide key={review.id} className="!h-auto">
            <ProductReviewCard review={review} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
