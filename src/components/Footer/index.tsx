import { CallIcon, EmailIcon, MapIcon } from "@/assets/icons";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TwitterIcon,
} from "@/assets/icons/social";
import { chromeBgStyle, type SiteChromeColors } from "@/lib/marketing/chromeColors";
import type { StoreContactDisplay } from "@/lib/marketing/storeContactDisplay";
import { phoneToTelHref } from "@/lib/marketing/storeContactDisplay";
import Link from "next/link";
import type { ReactNode } from "react";
import AccountLinks from "./AccountLinks";
import FooterBottom from "./FooterBottom";
import QuickLinks from "./QuickLinks";

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
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
      className="flex duration-200 ease-out hover:text-blue"
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
  return (
    <footer
      className={`overflow-hidden border-t border-gray-3 ${footerBgStyle ? "" : "bg-white"}`}
      style={footerBgStyle}
    >
      <div className="px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        {/* <!-- footer menu start --> */}
        <div className="flex flex-wrap xl:flex-nowrap gap-10 xl:gap-19 xl:justify-between pt-17.5 xl:pt-22.5 pb-10 xl:pb-20">
          <div className="max-w-[330px] w-full">
            <h2 className="mb-7.5 text-xl font-semibold text-dark">
              {storeContact.helpSupportTitle}
            </h2>

            <ul className="flex flex-col gap-3">
              <li className="flex gap-4.5 text-base text-meta-3">
                <span className="shrink-0">
                  <MapIcon className="fill-blue" width={24} height={24} />
                </span>
                {storeContact.contactAddress}
              </li>

              {storeContact.contactPhone.trim() ? (
                <li>
                  <Link
                    href={phoneToTelHref(storeContact.contactPhone)}
                    className="flex items-center gap-4.5 text-base text-meta-3"
                  >
                    <CallIcon className="fill-blue" width={24} height={24} />
                    {storeContact.contactPhone}
                  </Link>
                </li>
              ) : null}

              <li>
                <Link
                  href={`mailto:${storeContact.contactEmail}`}
                  className="flex items-center gap-4.5 text-base text-meta-3"
                >
                  <EmailIcon className="fill-blue" width={24} height={24} />
                  {storeContact.contactEmail}
                </Link>
              </li>
            </ul>

            {/* <!-- Social Links start --> */}
            <div className="flex items-center gap-4 mt-7.5">
              <SocialLink href={storeContact.socialFacebookUrl} label="Facebook">
                <FacebookIcon />
              </SocialLink>

              <SocialLink href={storeContact.socialTwitterUrl} label="Twitter">
                <TwitterIcon />
              </SocialLink>

              <SocialLink href={storeContact.socialInstagramUrl} label="Instagram">
                <InstagramIcon />
              </SocialLink>

              <SocialLink href={storeContact.socialLinkedInUrl} label="LinkedIn">
                <LinkedInIcon />
              </SocialLink>
            </div>
            {/* <!-- Social Links end --> */}
          </div>

          <AccountLinks />

          <QuickLinks />

          <div className="w-full sm:w-auto">
            <h2 className="mb-7.5 text-xl font-semibold text-dark">
              Business
            </h2>
            <ul className="flex flex-col gap-3">
              <li className="text-base">
                <span className="font-medium text-dark">Wholesale enquiries</span>
                <div className="text-sm text-meta-3 mt-1">
                  Email:{" "}
                  <Link className="text-blue hover:underline" href="mailto:wholesale@example.com">
                    wholesale@example.com
                  </Link>
                </div>
              </li>
              <li className="text-base">
                <span className="font-medium text-dark">Retail partnerships</span>
                <div className="text-sm text-meta-3 mt-1">
                  Email:{" "}
                  <Link className="text-blue hover:underline" href="mailto:partnerships@example.com">
                    partnerships@example.com
                  </Link>
                </div>
              </li>
            </ul>
          </div>
        </div>
        {/* <!-- footer menu end --> */}
      </div>

      <FooterBottom backgroundColor={chromeColors?.footerBg} />
    </footer>
  );
}
