import LargePromoBanner from "./LargePromoBanner";
import SmallPromoBanner from "./SmallPromoBanner";

const PromoBanner = () => {
  return (
    <section className="py-20 overflow-hidden">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <LargePromoBanner
          imageUrl="/images/promo/promo-01.png"
          subtitle="Apple iPhone 14 Plus"
          title="UP TO 30% OFF"
          description="iPhone 14 has the same superspeedy chip that's in iPhone 13 Pro, A15 Bionic, with a 5‑core GPU, powers all the latest features."
          link="iphone-14-plus--6128gb"
          buttonText="Purchase Now"
        />
        <div className="grid gap-7.5 grid-cols-1 lg:grid-cols-2">
          <SmallPromoBanner
            imageUrl="/images/promo/promo-02.png"
            subtitle="Foldable Motorised Treadmill"
            title="Workout At Home"
            discount="Flat 20% off"
            link="iphone-14-plus--6128gb"
            buttonText="Grab the deal"
          />

          <SmallPromoBanner
            imageUrl="/images/promo/promo-03.png"
            subtitle="Apple Watch Ultra"
            title="Up to 40% off"
            description="The aerospace-grade titanium case strikes the perfect balance of everything."
            link="/shop/apple-watch-ultra"
            buttonText="Grab the deal"
          />
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
