"use client";

import { useEffect, useMemo, useState } from "react";
import "swiper/css";
import "swiper/css/pagination";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import HomeFeaturedReviewCard from "@/components/Home/HomeFeaturedReviewCard";
import { pickHomeReviewsForSession } from "@/lib/home/pickHomeReviewsForSession";
import type { HomeFeaturedReview } from "@/lib/queries/productReviews";

type Props = {
  reviews: HomeFeaturedReview[];
};

export default function HomeFeaturedReviewsCarousel({ reviews }: Props) {
  const poolKey = useMemo(() => reviews.map((review) => review.id).sort().join(","), [reviews]);
  const [sessionReviews, setSessionReviews] = useState<HomeFeaturedReview[] | null>(null);

  useEffect(() => {
    setSessionReviews(pickHomeReviewsForSession(reviews));
  }, [poolKey, reviews]);

  if (reviews.length === 0) return null;

  if (sessionReviews === null) {
    return <div className="min-h-[6rem]" aria-hidden />;
  }

  if (sessionReviews.length === 0) return null;

  if (sessionReviews.length === 1) {
    return <HomeFeaturedReviewCard review={sessionReviews[0]} />;
  }

  const orderKey = sessionReviews.map((review) => review.id).join(",");

  return (
    <div className="home-featured-reviews-carousel -mx-1 px-1">
      <Swiper
        key={orderKey}
        modules={[Autoplay, Pagination]}
        spaceBetween={16}
        slidesPerView={1}
        loop={sessionReviews.length > 2}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        pagination={{ clickable: true }}
        className="!pb-10 [&_.swiper-pagination-bullet-active]:bg-blue"
      >
        {sessionReviews.map((review) => (
          <SwiperSlide key={review.id} className="!h-auto">
            <HomeFeaturedReviewCard review={review} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
