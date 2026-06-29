import Image from "next/image";

type Props = {
  title: string;
  description?: string | null;
  heroImage: string | null;
};

export default function CategoryPageHero({ title, description, heroImage }: Props) {
  const trimmedDescription = description?.trim();

  return (
    <div className="flex min-h-[200px] w-full flex-col md:min-h-[320px] md:flex-row">
      <div className="flex flex-1 items-center bg-white px-4 py-8 sm:px-8 md:px-10 lg:px-12">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-dark md:text-4xl">{title}</h1>
          {trimmedDescription ? (
            <p className="mt-3 hidden text-sm leading-relaxed text-meta-3 md:block md:text-base">
              {trimmedDescription}
            </p>
          ) : null}
        </div>
      </div>

      {heroImage ? (
        <div className="relative min-h-[180px] flex-1 bg-white md:min-h-0">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}
