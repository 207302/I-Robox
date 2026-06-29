import Image from "next/image";

type Props = {
  title: string;
  heroImage: string | null;
  centered?: boolean;
};

export default function PageHero({ title, heroImage, centered = false }: Props) {
  if (heroImage) {
    return (
      <div className="relative h-[200px] w-full md:h-[320px]">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div
          className={`absolute inset-x-0 bottom-0 p-4 md:p-8 ${
            centered ? "text-center" : "text-left"
          }`}
        >
          <h1 className="text-2xl font-bold text-white md:text-4xl">{title}</h1>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-[200px] w-full items-center bg-gradient-to-r from-blue to-blue-dark md:h-[320px] ${
        centered ? "justify-center text-center" : "justify-start"
      }`}
    >
      <div className={`px-4 md:px-8 ${centered ? "w-full" : ""}`}>
        <h1 className="text-2xl font-bold text-white md:text-4xl">{title}</h1>
      </div>
    </div>
  );
}
