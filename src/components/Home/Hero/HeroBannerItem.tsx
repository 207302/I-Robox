import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/utils/formatePrice";

export default function HeroBannerItem({ bannerItem }: { bannerItem: any }) {

  return (
    <div className="relative w-full px-6 bg-white border rounded-2xl border-gray-2">
      <div className="flex items-center justify-between gap-5">
        <div className="w-1/2">
          <div className="pt-5 mb-10">
            <h2 className="max-w-[153px] font-semibold text-dark text-xl  hover:text-blue">
              <Link href={`/shop/${bannerItem?.product?.slug}`}>
                {" "}
                {bannerItem.bannerName}{" "}
              </Link>
            </h2>
            <p className="text-sm text-dark-3">
              {bannerItem?.subtitle}
            </p>
          </div>
          <div className="pb-6">
            <p className="font-medium text-dark-4 text-xs mb-1.5 uppercase">
              limited time offer
            </p>
            <span className="flex items-center gap-2.5">
              <span className="font-bold text-heading-5 text-dark">
                {formatPrice(
                  bannerItem?.product?.discountedPrice
                    ? bannerItem?.product?.discountedPrice
                    : bannerItem?.product?.price
                )}
              </span>
              {bannerItem?.product?.discountedPrice && (
                <span className="text-2xl font-medium line-through text-dark-4">
                  {formatPrice(bannerItem?.product?.price)}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="w-1/2">
          <Image
            src={bannerItem?.bannerImage}
            alt={bannerItem?.bannerName ? `${bannerItem.bannerName} at i-robox` : "Featured banner at i-robox"}
            width={170}
            height={210}
          />
        </div>
      </div>
    </div>
  );
}
