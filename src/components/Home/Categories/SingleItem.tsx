import Link from "next/link";
import React from "react";
import Image from "next/image";
import { Category } from "@prisma/client";

type CategoryItem = Category & { img?: string | null };

const SingleItem = ({ item }: { item: CategoryItem }) => {
  const categoryImage = item.img ?? null;

  return (
    <Link
      href={`/categories/${item.slug}`}
      className="flex flex-col items-center group"
    >
      <div className="w-[130px] h-[130px] bg-[#F2F3F8]  rounded-full flex items-center justify-center mb-4">
        {categoryImage && (
          <Image
            src={categoryImage}
            alt="Category"
            width={80}
            height={80}
            sizes="80px"
            loading="lazy"
          />
        )}
      </div>

      <div className="flex justify-center">
        <h3 className="inline-block text-base font-medium text-center duration-500 text-dark group-hover:text-blue">
          {item.title}
        </h3>
      </div>
    </Link>
  );
};

export default SingleItem;
