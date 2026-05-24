"use client";
import Image from "next/image";
import Link from "next/link";
import { CountdownTimer } from "./CountdownTimer";
import { Countdown } from "@prisma/client";

interface CountdownBannerProps {
  data: Countdown & { product: { title: string } };
}

const CountdownBanner = ({ data }: CountdownBannerProps) => {
  if (!data) return null;

  return (
    <section className="py-20 overflow-hidden">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="relative overflow-hidden z-1 rounded-xl bg-gray-2 p-4 sm:p-7.5 lg:p-10 xl:p-15">
          <div className="max-w-[422px] w-full">
            <span className="block font-medium lg text-blue mb-2.5">
              {data.subtitle}
            </span>

            <h2 className="mb-3 text-xl font-semibold text-dark lg:text-heading-4 xl:text-heading-3">
              {data.title}
            </h2>
            <p className="text-base font-normal text-dark-3">
              {data?.product?.title}
            </p>

            <CountdownTimer />

            <Link
              href="/shop"
              prefetch={false}
              className="inline-flex font-medium text-custom-sm text-white bg-blue py-3 px-9.5 rounded-lg ease-out duration-200 hover:bg-blue-dark mt-8"
            >
              Check it Out!
            </Link>
          </div>

          <BackgroundImages data={data} />
        </div>
      </div>
    </section>
  );
};

const BackgroundImages = ({ data }: CountdownBannerProps) => (
  <>
    <Image
      src="/images/countdown/countdown-bg.png"
      alt="bg shapes"
      className="absolute bottom-0 right-0 hidden sm:block -z-1"
      width={737}
      height={482}
    />
    <Image
      src={data.countdownImage}
      alt="product"
      className="absolute hidden lg:block right-4 xl:right-33 bottom-4 xl:bottom-14 -z-1"
      width={316}
      height={370}
    />
  </>
);

export default CountdownBanner;
