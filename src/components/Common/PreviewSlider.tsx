"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "swiper/css";
import { Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide, type SwiperRef } from "swiper/react";

import { usePreviewSlider } from "@/app/context/PreviewSliderContext";
import ZoomableGalleryImage from "@/components/Common/ZoomableGalleryImage";
import {
  getProductGalleryImages,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/shop/productCardImage";
import { productImageAlt } from "@/lib/seo/metadata";
import { useAppSelector } from "@/redux/store";

const PreviewSliderModal = () => {
  const {
    closePreviewModal,
    isModalPreviewOpen,
    previewStartIndex,
    previewGallery,
  } = usePreviewSlider();

  const productFromStore = useAppSelector((state) => state.productDetailsReducer.value);
  const galleryImages =
    previewGallery?.images ??
    (productFromStore?.title ? getProductGalleryImages(productFromStore) : []);
  const title =
    previewGallery?.title ?? productFromStore?.title ?? "Product image";

  const sliderRef = useRef<SwiperRef | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideZoomed, setSlideZoomed] = useState(false);

  const handlePrev = useCallback(() => {
    sliderRef.current?.swiper?.slidePrev();
  }, []);

  const handleNext = useCallback(() => {
    sliderRef.current?.swiper?.slideNext();
  }, []);

  useEffect(() => {
    if (!isModalPreviewOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreviewModal();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePreviewModal, isModalPreviewOpen]);

  useEffect(() => {
    if (!isModalPreviewOpen) return;
    setSlideZoomed(false);
    setActiveIndex(
      Math.min(previewStartIndex, Math.max(0, galleryImages.length - 1))
    );
  }, [galleryImages.length, isModalPreviewOpen, previewStartIndex]);

  if (!isModalPreviewOpen || galleryImages.length === 0) {
    return null;
  }

  const initialSlide = Math.min(
    previewStartIndex,
    Math.max(0, galleryImages.length - 1)
  );
  const showNav = galleryImages.length > 1;

  return (
    <FullscreenOverlay closePreviewModal={closePreviewModal}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          closePreviewModal();
        }}
        aria-label="Close image viewer"
        className="absolute top-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:text-meta-5 sm:top-6 sm:right-6"
      >
        <svg
          className="fill-current"
          width="36"
          height="36"
          viewBox="0 0 26 26"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M14.3108 13L19.2291 8.08167C19.5866 7.72417 19.5866 7.12833 19.2291 6.77083C19.0543 6.59895 18.8189 6.50262 18.5737 6.50262C18.3285 6.50262 18.0932 6.59895 17.9183 6.77083L13 11.6892L8.08164 6.77083C7.90679 6.59895 7.67142 6.50262 7.42623 6.50262C7.18104 6.50262 6.94566 6.59895 6.77081 6.77083C6.41331 7.12833 6.41331 7.72417 6.77081 8.08167L11.6891 13L6.77081 17.9183C6.41331 18.2758 6.41331 18.8717 6.77081 19.2292C7.12831 19.5867 7.72414 19.5867 8.08164 19.2292L13 14.3108L17.9183 19.2292C18.2758 19.5867 18.8716 19.5867 19.2291 19.2292C19.5866 18.8717 19.5866 18.2758 19.2291 17.9183L14.3108 13Z"
            fill=""
          />
        </svg>
      </button>

      {showNav ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-2 text-white transition hover:bg-white/10 sm:left-6 sm:p-3"
            onClick={(event) => {
              event.stopPropagation();
              handlePrev();
            }}
          >
            <svg
              className="rotate-180"
              width="36"
              height="36"
              viewBox="0 0 26 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M14.5918 5.92548C14.9091 5.60817 15.4236 5.60817 15.7409 5.92548L22.2409 12.4255C22.5582 12.7428 22.5582 13.2572 22.2409 13.5745L15.7409 20.0745C15.4236 20.3918 14.9091 20.3918 14.5918 20.0745C14.2745 19.7572 14.2745 19.2428 14.5918 18.9255L19.7048 13.8125H4.33301C3.88428 13.8125 3.52051 13.4487 3.52051 13C3.52051 12.5513 3.88428 12.1875 4.33301 12.1875H19.7048L14.5918 7.07452C14.2745 6.75722 14.2745 6.24278 14.5918 5.92548Z"
                fill="#FDFDFD"
              />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Next image"
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-2 text-white transition hover:bg-white/10 sm:right-6 sm:p-3"
            onClick={(event) => {
              event.stopPropagation();
              handleNext();
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 26 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M14.5918 5.92548C14.9091 5.60817 15.4236 5.60817 15.7409 5.92548L22.2409 12.4255C22.5582 12.7428 22.5582 13.2572 22.2409 13.5745L15.7409 20.0745C15.4236 20.3918 14.9091 20.3918 14.5918 20.0745C14.2745 19.7572 14.2745 19.2428 14.5918 18.9255L19.7048 13.8125H4.33301C3.88428 13.8125 3.52051 13.4487 3.52051 13C3.52051 12.5513 3.88428 12.1875 4.33301 12.1875H19.7048L14.5918 7.07452C14.2745 6.75722 14.2745 6.24278 14.5918 5.92548Z"
                fill="#FDFDFD"
              />
            </svg>
          </button>
        </>
      ) : null}

      <FullscreenOverlayContent>
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center px-4 pb-16 pt-14 sm:px-12 lg:max-w-6xl">
          <Swiper
            key={`${title}-${initialSlide}-${galleryImages.join("|")}`}
            ref={sliderRef}
            modules={[Keyboard]}
            keyboard={{ enabled: !slideZoomed }}
            allowTouchMove={!slideZoomed}
            slidesPerView={1}
            spaceBetween={20}
            initialSlide={initialSlide}
            onSlideChange={(swiper) => {
              setActiveIndex(swiper.activeIndex);
              setSlideZoomed(false);
            }}
            className="preview-slider__swiper h-full w-full"
          >
            {galleryImages.map((src, key) => (
              <SwiperSlide key={`${src}-${key}`} className="!flex items-center justify-center">
                <ZoomableGalleryImage
                  src={src || PRODUCT_IMAGE_PLACEHOLDER}
                  alt={productImageAlt(title)}
                  priority={key === initialSlide}
                  fetchPriority={key === initialSlide ? "high" : undefined}
                  loading={key === initialSlide ? undefined : "lazy"}
                  onZoomChange={key === activeIndex ? setSlideZoomed : undefined}
                />
              </SwiperSlide>
            ))}
          </Swiper>

          {showNav ? (
            <p className="mt-4 text-center text-sm text-white/80">
              {slideZoomed
                ? "Drag to pan · Click to zoom out"
                : "Click to zoom · Pinch on mobile · Swipe or arrow keys to browse"}{" "}
              · {activeIndex + 1} of {galleryImages.length}
            </p>
          ) : (
            <p className="mt-4 text-center text-sm text-white/80">
              {slideZoomed ? "Drag to pan · Click to zoom out" : "Click to zoom · Pinch on mobile"}
            </p>
          )}
        </div>
      </FullscreenOverlayContent>
    </FullscreenOverlay>
  );
};

function FullscreenOverlay({
  children,
  closePreviewModal,
}: {
  children: React.ReactNode;
  closePreviewModal: () => void;
}) {
  return (
    <div
      className="preview-slider fixed inset-0 z-999999 flex items-center justify-center bg-[#000000F2]"
      role="dialog"
      aria-modal="true"
      aria-label="Product image viewer"
      onClick={() => closePreviewModal()}
    >
      {children}
    </div>
  );
}

function FullscreenOverlayContent({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

export default PreviewSliderModal;
