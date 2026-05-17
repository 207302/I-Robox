import Image from "next/image";
import type { CSSProperties } from "react";
import { chromeBgStyle } from "@/lib/marketing/chromeColors";

type PaymentIcon = {
  id: number;
  image: string;
  alt: string;
  width: number;
  height: number;
  style?: CSSProperties;
};

const paymentsData: PaymentIcon[] = [
  {
    id: 1,
    image: "/images/payment/payment-01.svg",
    alt: "visa card",
    width: 66,
    height: 22,
    style: { width: "auto", height: "auto" },
  },
  {
    id: 2,
    image: "/images/payment/payment-02.svg",
    alt: "paypal",
    width: 18,
    height: 21,
    style: { width: "auto", height: "auto" },
  },
  {
    id: 3,
    image: "/images/payment/payment-03.svg",
    alt: "master card",
    width: 33,
    height: 24,
    style: { width: "auto", height: "auto" },
  },
  {
    id: 4,
    image: "/images/payment/payment-04.svg",
    alt: "apple pay",
    width: 52.94,
    height: 22,
  },
  {
    id: 5,
    image: "/images/payment/payment-05.svg",
    alt: "google pay",
    width: 56,
    height: 22,
    style: { width: "auto", height: "auto" },
  },
];

export default function FooterBottom({ backgroundColor }: { backgroundColor?: string | null }) {
  const year = new Date().getFullYear();
  const bottomStyle = chromeBgStyle(backgroundColor);

  return (
    <div className={`py-5 xl:py-7.5 ${bottomStyle ? "" : "bg-gray-1"}`} style={bottomStyle}>
      <div className="px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-sm font-normal text-dark">
              &copy; {year} Robox. All rights reserved.
            </p>
            <p className="text-sm font-normal text-dark mt-1">
              Designed by{" "}
              <a
                href="https://www.linkedin.com/in/vishakhs17/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue hover:underline font-medium"
              >
                Vishakh S
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <p className="font-normal">We Accept:</p>

            <div className="flex flex-wrap items-center gap-5">
              {paymentsData.map((payment) => (
                <Image
                  className="h-5"
                  key={payment?.id}
                  src={payment.image}
                  alt={payment.alt}
                  width={payment.width}
                  height={payment.height}
                  style={payment.style}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
