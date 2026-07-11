import { Gem, Headphones, PackageCheck, ShieldCheck } from "lucide-react";
import HomeFeaturedReviewsCarousel from "@/components/Home/HomeFeaturedReviewsCarousel";
import type { HomeFeaturedReview } from "@/lib/queries/productReviews";

const WHY_ITEMS = [
  {
    Icon: Gem,
    title: "Curated Premium Collection",
    subtitle: "Carefully selected quality products",
  },
  {
    Icon: PackageCheck,
    title: "Secure Packaging",
    subtitle: "We pack with care to ensure safe delivery",
  },
  {
    Icon: ShieldCheck,
    title: "Genuine & Authentic",
    subtitle: "100% original products from trusted brands",
  },
  {
    Icon: Headphones,
    title: "Passionate Support",
    subtitle: "We are collectors too! Here to help you",
  },
] as const;

type Props = {
  featuredReviews?: HomeFeaturedReview[];
};

export default function HomeWhyChooseRow({ featuredReviews = [] }: Props) {
  const boxClassName =
    "rounded-2xl bg-gray-200/45 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.12)]";

  return (
    <section className="overflow-visible bg-white px-4 pb-0 pt-4 sm:px-8 md:pt-6 xl:px-0">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className={boxClassName}>
            <h2 className="mb-6 text-xl font-bold text-dark">Why Choose I-Robox?</h2>
            <ul className="grid grid-cols-2 gap-6">
              {WHY_ITEMS.map((item) => (
                <li key={item.title}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                    <item.Icon className="h-5 w-5 text-gray-700" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-dark">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.subtitle}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className={boxClassName}>
            <h2 className="mb-6 text-xl font-bold text-dark">What Our Customers Say</h2>
            {featuredReviews.length > 0 ? (
              <HomeFeaturedReviewsCarousel reviews={featuredReviews} />
            ) : (
              <div className="flex min-h-[6rem] flex-col items-center justify-center py-4 text-center">
                <p className="text-base font-medium text-gray-700">Leave a review 🙂</p>
                <p className="mt-2 text-sm text-gray-500">
                  Shop our collection and share your experience.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
