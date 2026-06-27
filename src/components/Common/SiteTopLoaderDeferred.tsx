"use client";

import dynamic from "next/dynamic";

const SiteTopLoader = dynamic(() => import("@/components/Common/SiteTopLoader"), {
  ssr: false,
});

/** Client-only top loader — must not use `dynamic({ ssr: false })` in a Server Layout. */
export default function SiteTopLoaderDeferred({
  accentColor,
}: {
  accentColor?: string | null;
}) {
  return <SiteTopLoader accentColor={accentColor} />;
}
