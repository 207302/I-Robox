"use client";

import Link from "next/link";
import Image from "next/image";
import { startTransition } from "react";
import { useAppSelector } from "@/redux/store";
import { useDispatch } from "react-redux";
import { removeItemFromWishlist, removeAllItemsFromWishlist } from "@/redux/features/wishlist-slice";
import { formatPrice } from "@/utils/formatePrice";
import { useCart } from "@/hooks/useCart";
import toast from "react-hot-toast";

export default function WishlistPage() {
  const dispatch = useDispatch();
  const items = useAppSelector((state) => state.wishlistReducer).items ?? [];
  const { addItem, cartDetails } = useCart();

  function handleMoveToCart(item: (typeof items)[number]) {
    const alreadyInCart = Object.values(cartDetails ?? {}).some(
      (cartItem) => String(cartItem.id) === String(item.id)
    );
    if (alreadyInCart) {
      toast("Item already in cart!");
    } else {
      addItem({
        id: item.id,
        name: item.title,
        price: item.price,
        quantity: 1,
        shippingPerUnit: 0,
        currency: "INR",
        image: item.image,
        slug: item.slug,
        availableQuantity: item.quantity,
        color: item.color ?? "",
      });
      toast.success("Item moved to cart!");
    }
    dispatch(removeItemFromWishlist(item.id));
  }

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-dark">Wishlist</h1>
          {items.length ? (
            <button
              onClick={() =>
                startTransition(() => {
                  dispatch(removeAllItemsFromWishlist());
                })
              }
              className="text-sm font-medium text-meta-3 hover:text-dark"
            >
              Clear wishlist
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">Your wishlist is empty.</p>
            <Link
              href="/shop"
              className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-3 bg-white p-5"
              >
                <Link href={`/shop/${item.slug}`}>
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-1 border border-gray-3">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                        priority={index === 0}
                        fetchPriority={index === 0 ? "high" : undefined}
                        loading={index === 0 ? undefined : "lazy"}
                      />
                    ) : null}
                  </div>
                </Link>
                <div className="mt-4">
                  <Link
                    href={`/shop/${item.slug}`}
                    className="font-semibold text-dark hover:text-blue line-clamp-1"
                  >
                    {item.title}
                  </Link>
                  <div className="mt-2 text-sm font-medium text-dark">
                    {formatPrice(item.price)}
                  </div>
                  <button
                    onClick={() => handleMoveToCart(item)}
                    className="mt-4 inline-flex w-full justify-center rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition"
                  >
                    Move to cart
                  </button>
                  <button
                    onClick={() => dispatch(removeItemFromWishlist(item.id))}
                    className="mt-2 inline-flex w-full justify-center rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-1 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

