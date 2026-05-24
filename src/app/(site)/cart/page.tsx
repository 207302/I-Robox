"use client";

import Link from "next/link";
import Image from "next/image";
import { startTransition } from "react";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/utils/formatePrice";
import { useDispatch } from "react-redux";
import { AppDispatch, useAppSelector } from "@/redux/store";
import { addItemToWishlist } from "@/redux/features/wishlist-slice";
import toast from "react-hot-toast";

export default function CartPage() {
  const dispatch = useDispatch<AppDispatch>();
  const wishlistItems = useAppSelector((state) => state.wishlistReducer.items ?? []);
  const { cartCount, cartDetails, totalPrice, incrementItem, decrementItem, removeItem, clearCart } =
    useCart();
  function handleMoveToWishlist(item: (typeof items)[number]) {
    const alreadyInWishlist = wishlistItems.some((w) => String(w.id) === String(item.id));
    if (alreadyInWishlist) {
      toast("Item already in cart!");
    } else {
      startTransition(() => {
        dispatch(
          addItemToWishlist({
            id: String(item.id),
            title: item.name,
            slug: item.slug || "",
            image: item.image || "",
            price: item.price,
            quantity: item.availableQuantity ?? item.quantity,
            color: item.color ?? "",
          })
        );
      });
    }
    removeItem(item.id);
  }


  const items = Object.values(cartDetails ?? {});

  return (
    <section className="pt-36 pb-16">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-dark">Your Cart</h1>
          {cartCount ? (
            <button
              onClick={() => startTransition(() => clearCart())}
              className="text-sm font-medium text-meta-3 hover:text-dark"
            >
              Clear cart
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-gray-3 bg-white p-8 text-center">
            <p className="text-sm text-meta-3">Your cart is empty.</p>
            <Link
              href="/shop"
              prefetch={false}
              className="mt-4 inline-flex rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition"
            >
              Continue shopping
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,_1fr)_360px]">
            <div className="rounded-2xl border border-gray-3 bg-white">
              <div className="divide-y divide-gray-3">
                {items.map((item, index) => (
                  <div key={String(item.id)} className="p-4 sm:p-6 flex gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-1 border border-gray-3">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                          priority={index === 0}
                          fetchPriority={index === 0 ? "high" : undefined}
                          loading={index === 0 ? undefined : "lazy"}
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link
                            href={`/shop/${item.slug}`}
                            className="font-semibold text-dark line-clamp-1 hover:text-blue"
                          >
                            {item.name}
                          </Link>
                          {item.variantLabel ? (
                            <p className="text-xs text-meta-3 mt-0.5">{item.variantLabel}</p>
                          ) : null}
                          <p className="mt-1 text-sm text-meta-3">
                            {formatPrice(item.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleMoveToWishlist(item)}
                            className="text-sm text-meta-3 hover:text-dark"
                          >
                            Move to wishlist
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-sm text-meta-3 hover:text-dark"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-gray-3 bg-white">
                          <button
                            onClick={() => decrementItem(item.id)}
                            className="px-3 py-2 text-dark hover:bg-gray-1"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="px-3 py-2 text-sm font-medium text-dark">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => incrementItem(item.id)}
                            className="px-3 py-2 text-dark hover:bg-gray-1"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <p className="text-sm font-semibold text-dark">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border border-gray-3 bg-white p-5 h-fit">
              <h2 className="text-lg font-semibold text-dark">Summary</h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-meta-3">Subtotal</span>
                <span className="font-medium text-dark">
                  {totalPrice ? formatPrice(totalPrice) : formatPrice(0)}
                </span>
              </div>
              <Link
                href="/checkout"
                className="mt-6 inline-flex w-full justify-center rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark transition"
              >
                Checkout
              </Link>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

