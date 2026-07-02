import Image from "next/image";

type Props = {
  title: string;
  heroImage: string | null;
  centered?: boolean;
};

export default function PageHero({ title, heroImage, centered = false }: Props) {
  if (heroImage) {
    return (
      <div className="relative h-[168px] w-full md:h-[400px]">
        <Image
          src={heroImage}
          alt={title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-[168px] w-full items-center bg-gradient-to-r from-blue to-blue-dark md:h-[400px] ${
        centered ? "justify-center text-center" : "justify-start"
      }`}
    >
      <div className={`px-4 md:px-8 ${centered ? "w-full" : ""}`}>
        <h1 className="text-2xl font-bold text-white md:text-4xl">{title}</h1>
      </div>
    </div>
  );
}
