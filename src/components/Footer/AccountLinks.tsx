import Link from "next/link";
import type { CSSProperties } from "react";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";

const accountLinks = [
  {
    id: 1,
    label: "Login / Register",
    href: "/login",
  },
  {
    id: 2,
    label: "Cart",
    href: "/cart",
  },
  {
    id: 3,
    label: "Wishlist",
    href: "/wishlist",
  },
  {
    id: 4,
    label: "Shop",
    href: "/shop",
  },
];

type Props = {
  textStyle?: CSSProperties;
  linkStyle?: CSSProperties;
};

export default function AccountLinks({ textStyle, linkStyle }: Props) {
  return (
    <div className="w-full sm:w-auto">
      <h2
        className={`mb-7.5 text-xl font-semibold ${textStyle ? "" : "text-dark"}`}
        style={textStyle}
      >
        Account
      </h2>

      <ul className="flex flex-col gap-3.5">
        {accountLinks.map((link) => (
          <li key={link.id}>
            <Link
              className={`text-base duration-200 ease-out ${linkStyle ? "hover:opacity-80" : "hover:text-blue"}`}
              style={linkStyle ?? textStyle}
              href={link.href}
              prefetch={shouldPrefetchHref(link.href)}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
