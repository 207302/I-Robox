"use client";

import NextTopLoader from "nextjs-toploader";
import { resolveAccentHex } from "@/lib/marketing/accentColor";

type Props = {
  /** Storefront only — pass site marketing accent. Omit in admin so loader stays default. */
  accentColor?: string | null;
};

export default function SiteTopLoader({ accentColor }: Props) {
  const color =
    accentColor !== undefined ? resolveAccentHex(accentColor) : "#2563eb";

  return (
    <NextTopLoader
      color={color}
      crawlSpeed={300}
      showSpinner={false}
      shadow="none"
    />
  );
}
