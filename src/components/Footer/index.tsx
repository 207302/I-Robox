import { CallIcon, EmailIcon, MapIcon } from "@/assets/icons";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TwitterIcon,
} from "@/assets/icons/social";
import {
  chromeBgStyle,
  footerColorStyles,
  type SiteChromeColors,
} from "@/lib/marketing/chromeColors";
import type { StoreContactDisplay } from "@/lib/marketing/storeContactDisplay";
import { phoneToTelHref } from "@/lib/marketing/contactPhoneUtils";
import Link from "next/link";
import type { ReactNode } from "react";
import AccountLinks from "./AccountLinks";
import FooterBottom from "./FooterBottom";
import QuickLinks from "./QuickLinks";

function SocialLink({
  href,
  label,
  children,
  linkStyle,
}: {
  href: string;
  label: string;
  children: ReactNode;
  linkStyle?: React.CSSProperties;
}) {
  if (!href.trim()) {
    return (
      <span className="flex text-meta-4 cursor-not-allowed opacity-40" aria-hidden>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex duration-200 ease-out ${linkStyle ? "hover:opacity-80" : "hover:text-blue"}`}
      style={linkStyle}
    >
      <span className="sr-only">{label}</span>
      {children}
    </Link>
  );
}

export default function Footer({
  storeContact,
  chromeColors,
}: {
  storeContact: StoreContactDisplay;
  chromeColors?: SiteChromeColors;
}) {
  const footerBgStyle = chromeBgStyle(chromeColors?.footerBg);
  const { textStyle, linkStyle, iconFill } = footerColorStyles(chromeColors);
  return (
    <footer
      className={`overflow-hidden border-t border-gray-3 ${footerBgStyle ? "" : "bg-white"}`}
      style={footerBgStyle}
    >
      <div className="px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        {/* <!-- footer menu start --> */}
        <div className="flex flex-wrap xl:flex-nowrap gap-10 xl:gap-19 xl:justify-between pt-17.5 xl:pt-22.5 pb-10 xl:pb-20">
          <div className="max-w-[330px] w-full">
            <h2
              className={`mb-7.5 text-xl font-semibold ${textStyle ? "" : "text-dark"}`}
              style={textStyle}
            >
              {storeContact.helpSupportTitle}
            </h2>

            <ul className="flex flex-col gap-3">
              <li
                className={`flex gap-4.5 text-base ${textStyle ? "" : "text-meta-3"}`}
                style={textStyle}
              >
                <span className="shrink-0">
                  <MapIcon
                    className={iconFill ? "" : "fill-blue"}
                    style={iconFill ? { fill: iconFill } : undefined}
                    width={24}
                    height={24}
                  />
                </span>
                {storeContact.contactAddress}
              </li>

              {storeContact.contactPhone.trim() ? (
                <li>
                  <Link
                    href={phoneToTelHref(storeContact.contactPhone)}
                    className={`flex items-center gap-4.5 text-base ${textStyle ? "hover:opacity-80" : "text-meta-3"}`}
                    style={textStyle}
                  >
                    <CallIcon
                      className={iconFill ? "" : "fill-blue"}
                      style={iconFill ? { fill: iconFill } : undefined}
                      width={24}
                      height={24}
                    />
                    {storeContact.contactPhone}
                  </Link>
                </li>
              ) : null}

              <li>
                <Link
                  href={`mailto:${storeContact.contactEmail}`}
                  className={`flex items-center gap-4.5 text-base ${linkStyle ? "hover:opacity-80" : "text-meta-3"}`}
                  style={linkStyle ?? textStyle}
                >
                  <EmailIcon
                    className={iconFill ? "" : "fill-blue"}
                    style={iconFill ? { fill: iconFill } : undefined}
                    width={24}
                    height={24}
                  />
                  {storeContact.contactEmail}
                </Link>
              </li>
            </ul>

            {/* <!-- Social Links start --> */}
            <div className="mt-7.5 flex items-center gap-4">
              <SocialLink href={storeContact.socialFacebookUrl} label="Facebook" linkStyle={linkStyle}>
                <FacebookIcon />
              </SocialLink>

              <SocialLink href={storeContact.socialTwitterUrl} label="Twitter" linkStyle={linkStyle}>
                <TwitterIcon />
              </SocialLink>

              <SocialLink href={storeContact.socialInstagramUrl} label="Instagram" linkStyle={linkStyle}>
                <InstagramIcon />
              </SocialLink>

              <SocialLink href={storeContact.socialLinkedInUrl} label="LinkedIn" linkStyle={linkStyle}>
                <LinkedInIcon />
              </SocialLink>
            </div>
            {/* <!-- Social Links end --> */}
          </div>

          <AccountLinks textStyle={textStyle} linkStyle={linkStyle} />

          <QuickLinks textStyle={textStyle} linkStyle={linkStyle} />

          <div className="w-full sm:w-auto">
            <h2
              className={`mb-7.5 text-xl font-semibold ${textStyle ? "" : "text-dark"}`}
              style={textStyle}
            >
              {storeContact.businessTitle}
            </h2>
            <ul className="flex flex-col gap-3">
              <li className="text-base">
                <span
                  className={`font-medium ${textStyle ? "" : "text-dark"}`}
                  style={textStyle}
                >
                  {storeContact.businessWholesaleLabel}
                </span>
                <div
                  className={`mt-1 text-sm ${textStyle ? "" : "text-meta-3"}`}
                  style={textStyle}
                >
                  Email:{" "}
                  <Link
                    className={linkStyle ? "hover:opacity-80" : "text-blue hover:underline"}
                    style={linkStyle}
                    href={`mailto:${storeContact.businessWholesaleEmail}`}
                  >
                    {storeContact.businessWholesaleEmail}
                  </Link>
                </div>
              </li>
              <li className="text-base">
                <span
                  className={`font-medium ${textStyle ? "" : "text-dark"}`}
                  style={textStyle}
                >
                  {storeContact.businessRetailLabel}
                </span>
                <div
                  className={`mt-1 text-sm ${textStyle ? "" : "text-meta-3"}`}
                  style={textStyle}
                >
                  Email:{" "}
                  <Link
                    className={linkStyle ? "hover:opacity-80" : "text-blue hover:underline"}
                    style={linkStyle}
                    href={`mailto:${storeContact.businessRetailEmail}`}
                  >
                    {storeContact.businessRetailEmail}
                  </Link>
                </div>
              </li>
            </ul>
          </div>
        </div>
        {/* <!-- footer menu end --> */}
      </div>

      <FooterBottom
        backgroundColor={chromeColors?.footerBg}
        textStyle={textStyle}
        linkStyle={linkStyle}
      />
    </footer>
  );
}
