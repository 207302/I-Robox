import Link from "next/link";
import type { CSSProperties } from "react";
import { shouldPrefetchHref } from "@/lib/navigation/linkPrefetch";

const customerServiceLinks = [
  { id: 1, label: "Track Order", href: "/orders" },
  { id: 2, label: "Shipping Policy", href: "/shipping-policy" },
  { id: 3, label: "Return & Cancellation", href: "/return-cancellation" },
  { id: 4, label: "FAQ", href: "/faq" },
  { id: 5, label: "Contact Us", href: "/contact" },
] as const;

const companyLinks = [
  { id: 1, label: "About Us", href: "/about-us" },
  { id: 2, label: "Blogs", href: "/blog" },
  { id: 3, label: "Become a Dealer", href: "/contact" },
  { id: 4, label: "Privacy Policy", href: "/privacy-policy" },
  { id: 5, label: "Terms & Conditions", href: "/terms-conditions" },
] as const;

type Props = {
  textStyle?: CSSProperties;
  linkStyle?: CSSProperties;
};

function LinkColumn({
  title,
  links,
  textStyle,
  linkStyle,
}: {
  title: string;
  links: readonly { id: number; label: string; href: string }[];
  textStyle?: CSSProperties;
  linkStyle?: CSSProperties;
}) {
  return (
    <div className="w-full sm:w-auto">
      <h2
        className={`mb-7.5 text-xl font-semibold ${textStyle ? "" : "text-dark"}`}
        style={textStyle}
      >
        {title}
      </h2>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
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

export default function QuickLinks({ textStyle, linkStyle }: Props) {
  return (
    <div className="flex w-full flex-col gap-10 sm:flex-row sm:gap-14 lg:gap-20 xl:gap-24">
      <LinkColumn
        title="Customer Service"
        links={customerServiceLinks}
        textStyle={textStyle}
        linkStyle={linkStyle}
      />
      <LinkColumn
        title="Company"
        links={companyLinks}
        textStyle={textStyle}
        linkStyle={linkStyle}
      />
    </div>
  );
}
