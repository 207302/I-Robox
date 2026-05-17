import Link from "next/link";
import type { CSSProperties } from "react";

const quickLinks = [
  {
    id: 1,
    label: "Privacy Policy",
    href: "/privacy-policy",
  },
  {
    id: 2,
    label: "Terms & Conditions",
    href: "/terms-conditions",
  },
  {
    id: 3,
    label: "Return & Cancellation",
    href: "/return-cancellation",
  },
  {
    id: 4,
    label: "FAQ",
    href: "/faq",
  },
  {
    id: 5,
    label: "Contact",
    href: "/contact",
  },
];

type Props = {
  textStyle?: CSSProperties;
  linkStyle?: CSSProperties;
};

export default function QuickLinks({ textStyle, linkStyle }: Props) {
  return (
    <div className="w-full sm:w-auto">
      <h2
        className={`mb-7.5 text-xl font-semibold ${textStyle ? "" : "text-dark"}`}
        style={textStyle}
      >
        Quick Link
      </h2>

      <ul className="flex flex-col gap-3">
        {quickLinks.map((link) => (
          <li key={link.id}>
            <Link
              className={`text-base duration-200 ease-out ${linkStyle ? "hover:opacity-80" : "hover:text-blue"}`}
              style={linkStyle ?? textStyle}
              href={link.href}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
