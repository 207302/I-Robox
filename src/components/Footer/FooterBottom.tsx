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
    id: 5,
    image: "/images/payment/payment-05.svg",
    alt: "google pay",
    width: 56,
    height: 22,
    style: { width: "auto", height: "auto" },
  },
];

type Props = {
  backgroundColor?: string | null;
  textStyle?: CSSProperties;
  linkStyle?: CSSProperties;
};

export default function FooterBottom({ backgroundColor, textStyle, linkStyle }: Props) {
  const year = new Date().getFullYear();
  const bottomStyle = chromeBgStyle(backgroundColor);

  return (
    <div className={`py-5 xl:py-7.5 ${bottomStyle ? "" : "bg-gray-1"}`} style={bottomStyle}>
      <div className="px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p
              className={`text-sm font-normal ${textStyle ? "" : "text-dark"}`}
              style={textStyle}
            >
              &copy; {year} Robox. All rights reserved.
            </p>
            <p
              className={`mt-1 text-sm font-normal ${textStyle ? "" : "text-dark"}`}
              style={textStyle}
            >
              Designed by{" "}
              <a
                href="https://www.linkedin.com/in/vishakhs17/"
                target="_blank"
                rel="noopener noreferrer"
                className={`font-medium ${linkStyle ? "hover:opacity-80" : "text-blue hover:underline"}`}
                style={linkStyle}
              >
                Vishakh S
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <p className={`font-normal ${textStyle ? "" : "text-dark"}`} style={textStyle}>
              We Accept:
            </p>

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
