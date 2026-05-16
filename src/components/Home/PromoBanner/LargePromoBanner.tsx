import Image from "next/image";
import Link from "next/link";

interface LargePromoBannerProps {
  imageUrl: string;
  subtitle: string;
  title: string;
  description: string;
  link: string;
  buttonText: string;
}

export default function LargePromoBanner({
  imageUrl,
  subtitle,
  title,
  description,
  link,
  buttonText,
}: LargePromoBannerProps) {
  return (
    <div className="relative z-1 overflow-hidden rounded-2xl bg-gray-2 py-12.5 lg:py-17.5 xl:py-22.5 px-4 sm:px-7.5 lg:px-14 xl:px-19 mb-7.5">
      <div className="max-w-[550px] w-full">
        <span className="block mb-3 text-xl font-medium text-dark">
          {subtitle}
        </span>
        <h2 className="mb-5 text-xl font-semibold lg:text-heading-4 xl:text-heading-3 text-dark">
          {title}
        </h2>
        <p>{description}</p>
        <Link
          href={`/shop/${link}`}
          className="inline-flex font-medium text-custom-sm text-white bg-blue py-3 px-7 rounded-lg  ease-out duration-200 hover:bg-blue-dark mt-7.5"
        >
          {buttonText}
        </Link>
      </div>
      <Image
        src={imageUrl}
        alt="promo img"
        className="absolute bottom-0 right-4 lg:right-26 -z-1"
        width={420}
        height={369}
      />
    </div>
  );
}
